import Settings from '../models/Settings.js';
import { logger } from './logger.js';

// Cache for settings to avoid repeated DB queries
let settingsCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 60000; // 1 minute cache TTL

/**
 * Get configuration values with precedence: DB > ENV > defaults
 * @returns {Promise<Object>} Configuration object
 */
export const getConfig = async () => {
  const fileName = 'src/utils/configLoader.js';
  const functionName = 'getConfig';
  
  try {
    // Check if cache is valid
    const now = Date.now();
    if (settingsCache && cacheTimestamp && (now - cacheTimestamp < CACHE_TTL)) {
      logger.debug(`${fileName} ${functionName} Using cached settings`);
      return settingsCache;
    }

    // Get settings from database or fallback to defaults if DB fails
    const dbSettings = await Settings.getSettings();
    
    // Combine with environment variables (ENV overrides DB if value exists)
    const combinedSettings = {
      // Start with DB settings (or defaults if DB failed)
      ...dbSettings,
      
      // Override with ENV variables if they exist
      itemsPerPage: process.env.ITEMS_PER_PAGE ? parseInt(process.env.ITEMS_PER_PAGE, 10) : dbSettings.itemsPerPage,
      logLevel: process.env.LOG_LEVEL || dbSettings.logLevel,
      localSearchCronSchedule: process.env.LOCAL_SEARCH_CRON_SCHEDULE || dbSettings.localSearchCronSchedule,
      syncIssuesCronSchedule: process.env.SYNC_ISSUES_CRON_SCHEDULE || dbSettings.syncIssuesCronSchedule,
    };

    // Update cache
    settingsCache = combinedSettings;
    cacheTimestamp = now;
    
    logger.debug(`${fileName} ${functionName} Configuration loaded successfully`);
    return combinedSettings;
  } catch (err) {
    logger.error(`${fileName} ${functionName} Error loading configuration`, 
      { message: err.message, stack: err.stack });
    
    // Fallback to environment variables or defaults
    return {
      itemsPerPage: process.env.ITEMS_PER_PAGE ? parseInt(process.env.ITEMS_PER_PAGE, 10) : 10,
      logLevel: process.env.LOG_LEVEL || 'INFO',
      localSearchCronSchedule: process.env.LOCAL_SEARCH_CRON_SCHEDULE || '0 * * * *',
      syncIssuesCronSchedule: process.env.SYNC_ISSUES_CRON_SCHEDULE || '0 */6 * * *',
    };
  }
};

/**
 * Get a specific configuration value
 * @param {string} key - Configuration key to retrieve
 * @returns {Promise<any>} - Value for the requested configuration key
 */
export const getConfigValue = async (key) => {
  const fileName = 'src/utils/configLoader.js';
  const functionName = 'getConfigValue';
  
  try {
    const config = await getConfig();
    return config[key];
  } catch (err) {
    logger.error(`${fileName} ${functionName} Error getting config value for ${key}`, 
      { message: err.message, stack: err.stack });
    return null;
  }
};

/**
 * Force refresh the configuration cache
 * @returns {Promise<Object>} - Fresh configuration object
 */
export const refreshConfig = async () => {
  const fileName = 'src/utils/configLoader.js';
  const functionName = 'refreshConfig';
  
  logger.info(`${fileName} ${functionName} Forcing configuration refresh`);
  
  // Invalidate cache
  settingsCache = null;
  cacheTimestamp = null;
  
  // Get fresh config
  return await getConfig();
};

export default {
  getConfig,
  getConfigValue,
  refreshConfig
};
