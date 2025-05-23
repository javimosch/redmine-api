import express from 'express';
import basicAuth from 'express-basic-auth';
import Settings from '../models/Settings.js';
import { logger } from '../utils/logger.js';
import { refreshConfig } from '../utils/configLoader.js';

const router = express.Router();
const fileName = 'src/routes/appConfigRoutes.js';

// Basic authentication middleware for admin routes
const setupAuthMiddleware = () => {
  const adminUser = process.env.ADMIN_USER;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminUser && adminPassword) {
    logger.info(`${fileName} setupAuthMiddleware Admin API authentication enabled`);
    return basicAuth({
      users: { [adminUser]: adminPassword },
      challenge: true,
      realm: 'Admin Configuration API',
    });
  } else {
    logger.warn(`${fileName} setupAuthMiddleware Admin API authentication DISABLED - ADMIN_USER or ADMIN_PASSWORD not set`);
    return (req, res, next) => next(); // No authentication if credentials aren't set
  }
};

// Apply authentication middleware
router.use(setupAuthMiddleware());

/**
 * GET /api/app/configure
 * Retrieve current application settings
 */
router.get('/', async (req, res) => {
  const functionName = 'GET /api/app/configure';
  logger.info(`${fileName} ${functionName} Request received`, { data: { ip: req.ip } });

  try {
    const settings = await Settings.getSettings();
    
    // Don't expose MongoDB specific fields in the API response
    const sanitizedSettings = {
      itemsPerPage: settings.itemsPerPage,
      logLevel: settings.logLevel,
      localSearchCronSchedule: settings.localSearchCronSchedule,
      syncIssuesCronSchedule: settings.syncIssuesCronSchedule,
      lastUpdated: settings.updatedAt || new Date()
    };
    
    logger.info(`${fileName} ${functionName} Settings retrieved successfully`);
    res.json(sanitizedSettings);
  } catch (err) {
    logger.error(`${fileName} ${functionName} Error retrieving settings`, 
      { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to retrieve application settings' });
  }
});

/**
 * POST /api/app/configure
 * Update application settings
 */
router.post('/', async (req, res) => {
  const functionName = 'POST /api/app/configure';
  logger.info(`${fileName} ${functionName} Request received`, { data: req.body });

  try {
    const { itemsPerPage, logLevel, localSearchCronSchedule, syncIssuesCronSchedule } = req.body;
    
    // Validate inputs
    const errors = [];
    
    if (itemsPerPage !== undefined) {
      const itemsPerPageNum = parseInt(itemsPerPage, 10);
      if (isNaN(itemsPerPageNum) || itemsPerPageNum < 1 || itemsPerPageNum > 100) {
        errors.push('itemsPerPage must be a number between 1 and 100');
      }
    }
    
    if (logLevel !== undefined && !['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(logLevel)) {
      errors.push('logLevel must be one of: DEBUG, INFO, WARN, ERROR');
    }
    
    // Basic cron validation
    const cronRegex = /^(\S+) (\S+) (\S+) (\S+) (\S+)$/;
    if (localSearchCronSchedule !== undefined && !cronRegex.test(localSearchCronSchedule)) {
      errors.push('localSearchCronSchedule must be a valid cron pattern (e.g., "0 * * * *")');
    }
    
    if (syncIssuesCronSchedule !== undefined && !cronRegex.test(syncIssuesCronSchedule)) {
      errors.push('syncIssuesCronSchedule must be a valid cron pattern (e.g., "0 */6 * * *")');
    }
    
    if (errors.length > 0) {
      logger.warn(`${fileName} ${functionName} Validation errors`, { data: errors });
      return res.status(400).json({ errors });
    }
    
    // Find and update settings
    const settings = await Settings.findOne({ configKey: 'global_settings' });
    
    if (!settings) {
      logger.info(`${fileName} ${functionName} No settings found, creating new settings document`);
      const newSettings = new Settings({ configKey: 'global_settings' });
      
      if (itemsPerPage !== undefined) newSettings.itemsPerPage = parseInt(itemsPerPage, 10);
      if (logLevel !== undefined) newSettings.logLevel = logLevel;
      if (localSearchCronSchedule !== undefined) newSettings.localSearchCronSchedule = localSearchCronSchedule;
      if (syncIssuesCronSchedule !== undefined) newSettings.syncIssuesCronSchedule = syncIssuesCronSchedule;
      
      await newSettings.save();
      logger.info(`${fileName} ${functionName} New settings created successfully`);
      
      // Force configuration refresh
      await refreshConfig();
      
      return res.status(201).json({
        message: 'Settings created successfully',
        settings: {
          itemsPerPage: newSettings.itemsPerPage,
          logLevel: newSettings.logLevel,
          localSearchCronSchedule: newSettings.localSearchCronSchedule,
          syncIssuesCronSchedule: newSettings.syncIssuesCronSchedule,
        }
      });
    }
    
    // Update existing settings
    if (itemsPerPage !== undefined) settings.itemsPerPage = parseInt(itemsPerPage, 10);
    if (logLevel !== undefined) settings.logLevel = logLevel;
    if (localSearchCronSchedule !== undefined) settings.localSearchCronSchedule = localSearchCronSchedule;
    if (syncIssuesCronSchedule !== undefined) settings.syncIssuesCronSchedule = syncIssuesCronSchedule;
    
    await settings.save();
    logger.info(`${fileName} ${functionName} Settings updated successfully`);
    
    // Force configuration refresh
    await refreshConfig();
    
    res.json({
      message: 'Settings updated successfully',
      settings: {
        itemsPerPage: settings.itemsPerPage,
        logLevel: settings.logLevel,
        localSearchCronSchedule: settings.localSearchCronSchedule,
        syncIssuesCronSchedule: settings.syncIssuesCronSchedule,
      }
    });
  } catch (err) {
    logger.error(`${fileName} ${functionName} Error updating settings`, 
      { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to update application settings' });
  }
});

export default router;
