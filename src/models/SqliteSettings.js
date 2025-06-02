/**
 * SQLite implementation of the Settings model
 * Used when MONGO_URI is not provided
 */
import { getSqliteDb } from '../utils/appState.js';
import { logger } from '../utils/logger.js';

/**
 * Create the settings table if it doesn't exist
 * @returns {Promise<void>}
 */
export const initSettingsTable = () => {
  const fileName = 'src/models/SqliteSettings.js';
  const functionName = 'initSettingsTable';
  
  logger.info(`${fileName} ${functionName} Initializing settings table`);
  
  return new Promise((resolve, reject) => {
    const db = getSqliteDb();
    if (!db) {
      const err = new Error('SQLite database not initialized');
      logger.error(`${fileName} ${functionName} SQLite database not initialized`, { message: err.message, stack: err.stack });
      return reject(err);
    }

    const sql = `
      CREATE TABLE IF NOT EXISTS settings (
        configKey TEXT PRIMARY KEY,
        apiKeys TEXT DEFAULT '[]', 
        itemsPerPage INTEGER DEFAULT 10,
        logLevel TEXT DEFAULT 'INFO',
        localSearchCronSchedule TEXT DEFAULT '0 * * * *',
        syncIssuesCronSchedule TEXT DEFAULT '0 */6 * * *',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    db.run(sql, (err) => {
      if (err) {
        logger.error(`${fileName} ${functionName} Error creating settings table`, { message: err.message, stack: err.stack });
        return reject(err);
      }
      
      logger.info(`${fileName} ${functionName} Settings table initialized successfully`);
      resolve();
    });
  });
};

/**
 * Get settings or create with defaults if not found
 * Mimics the behavior of the MongoDB Settings.getSettings() method
 * @returns {Promise<Object>} Settings object
 */
export const getSettings = async () => {
  const fileName = 'src/models/SqliteSettings.js';
  const functionName = 'getSettings';
  
  logger.info(`${fileName} ${functionName} Attempting to retrieve global settings`);
  
  return new Promise((resolve, reject) => {
    const db = getSqliteDb();
    if (!db) {
      const err = new Error('SQLite database not initialized');
      logger.error(`${fileName} ${functionName} SQLite database not initialized`, { message: err.message, stack: err.stack });
      return reject(err);
    }

    // Try to find existing settings
    db.get('SELECT * FROM settings WHERE configKey = ?', ['global_settings'], async (err, row) => {
      if (err) {
        logger.error(`${fileName} ${functionName} Error retrieving settings`, { message: err.message, stack: err.stack });
        return reject(err);
      }

      // If settings exist, return them
      if (row) {
        // Parse JSON fields
        try {
          row.apiKeys = JSON.parse(row.apiKeys || '[]');
          logger.info(`${fileName} ${functionName} Retrieved global settings`);
          return resolve(row);
        } catch (parseErr) {
          logger.error(`${fileName} ${functionName} Error parsing JSON in settings`, { message: parseErr.message, stack: parseErr.stack });
          row.apiKeys = [];
          return resolve(row);
        }
      }

      // Settings not found, create with defaults
      logger.info(`${fileName} ${functionName} No global settings found, creating with defaults`);
      
      const defaults = {
        configKey: 'global_settings',
        apiKeys: '[]',
        itemsPerPage: 10,
        logLevel: 'INFO',
        localSearchCronSchedule: '0 * * * *',
        syncIssuesCronSchedule: '0 */6 * * *'
      };

      db.run(
        `INSERT INTO settings (
          configKey, apiKeys, itemsPerPage, logLevel, 
          localSearchCronSchedule, syncIssuesCronSchedule
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          defaults.configKey,
          defaults.apiKeys,
          defaults.itemsPerPage,
          defaults.logLevel,
          defaults.localSearchCronSchedule,
          defaults.syncIssuesCronSchedule
        ],
        function(insertErr) {
          if (insertErr) {
            logger.error(`${fileName} ${functionName} Error creating default settings`, { message: insertErr.message, stack: insertErr.stack });
            
            // Return fallback defaults if DB operation fails
            return resolve({
              configKey: 'global_settings',
              apiKeys: [],
              itemsPerPage: 10,
              logLevel: 'INFO',
              localSearchCronSchedule: '0 * * * *',
              syncIssuesCronSchedule: '0 */6 * * *'
            });
          }

          // Return the created settings
          return resolve({
            configKey: defaults.configKey,
            apiKeys: [],
            itemsPerPage: defaults.itemsPerPage,
            logLevel: defaults.logLevel,
            localSearchCronSchedule: defaults.localSearchCronSchedule,
            syncIssuesCronSchedule: defaults.syncIssuesCronSchedule
          });
        }
      );
    });
  });
};

/**
 * Update settings
 * @param {Object} settings - Settings object to update
 * @returns {Promise<Object>} Updated settings object
 */
export const updateSettings = async (settings) => {
  const fileName = 'src/models/SqliteSettings.js';
  const functionName = 'updateSettings';
  
  logger.info(`${fileName} ${functionName} Updating settings`, { data: settings });
  
  return new Promise((resolve, reject) => {
    const db = getSqliteDb();
    if (!db) {
      const err = new Error('SQLite database not initialized');
      logger.error(`${fileName} ${functionName} SQLite database not initialized`, { message: err.message, stack: err.stack });
      return reject(err);
    }

    // Ensure apiKeys is serialized as JSON
    const apiKeysJson = JSON.stringify(settings.apiKeys || []);

    db.run(
      `UPDATE settings SET 
        apiKeys = ?,
        itemsPerPage = ?,
        logLevel = ?,
        localSearchCronSchedule = ?,
        syncIssuesCronSchedule = ?,
        updatedAt = CURRENT_TIMESTAMP
      WHERE configKey = ?`,
      [
        apiKeysJson,
        settings.itemsPerPage,
        settings.logLevel,
        settings.localSearchCronSchedule,
        settings.syncIssuesCronSchedule,
        'global_settings'
      ],
      function(err) {
        if (err) {
          logger.error(`${fileName} ${functionName} Error updating settings`, { message: err.message, stack: err.stack });
          return reject(err);
        }

        // Return the updated settings
        logger.info(`${fileName} ${functionName} Settings updated successfully`);
        resolve({
          configKey: 'global_settings',
          apiKeys: settings.apiKeys,
          itemsPerPage: settings.itemsPerPage,
          logLevel: settings.logLevel,
          localSearchCronSchedule: settings.localSearchCronSchedule,
          syncIssuesCronSchedule: settings.syncIssuesCronSchedule
        });
      }
    );
  });
};

export default {
  initSettingsTable,
  getSettings,
  updateSettings
};
