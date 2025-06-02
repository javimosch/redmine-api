import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { getDbMode } from '../utils/appState.js';
import SqliteSettings from './SqliteSettings.js';

const settingsSchema = new mongoose.Schema({
  configKey: {
    type: String,
    default: 'global_settings',
    unique: true,
    index: true // Add index for faster lookups on configKey
  },
  apiKeys: {
    type: [String],
    default: [],
    //select: false // Don't return this field by default in queries
  },
  itemsPerPage: {
    type: Number,
    default: 10,
    min: 1,
    max: 100,
  },
  logLevel: {
    type: String,
    enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'],
    default: 'INFO',
  },
  localSearchCronSchedule: {
    type: String,
    default: '0 * * * *',
    validate: {
      validator: function(v) {
        return /^(\S+) (\S+) (\S+) (\S+) (\S+)$/.test(v);
      },
      message: props => `${props.value} is not a valid cron schedule format!`
    }
  },
  syncIssuesCronSchedule: {
    type: String,
    default: '0 */6 * * *',
    validate: {
      validator: function(v) {
        return /^(\S+) (\S+) (\S+) (\S+) (\S+)$/.test(v);
      },
      message: props => `${props.value} is not a valid cron schedule format!`
    }
  },
}, {
  timestamps: true,
  versionKey: false
});

// MongoDB implementation of getSettings
settingsSchema.statics.getSettings = async function() {
  const fileName = 'src/models/Settings.js';
  const functionName = 'getSettings';
  
  logger.info(`${fileName} ${functionName} Attempting to retrieve global settings`);
  
  try {
    let settings = await this.findOne({ configKey: 'global_settings' });
    if (!settings) {
      logger.info(`${fileName} ${functionName} No global settings found, creating with defaults`);
      settings = await this.create({ configKey: 'global_settings' });
    }
    return settings;
  } catch (error) {
    logger.error(`${fileName} ${functionName} Error getting/creating global settings`, 
      { message: error.message, stack: error.stack });
    
    // Return fallback defaults if DB operation fails
    const defaults = {
      configKey: 'global_settings',
      itemsPerPage: 10,
      logLevel: 'INFO',
      localSearchCronSchedule: '0 * * * *',
      syncIssuesCronSchedule: '0 */6 * * *'
    };
    
    logger.warn(`${fileName} ${functionName} Falling back to default settings due to DB error`);
    return defaults;
  }
};

const MongoSettings = mongoose.model('Settings', settingsSchema);

/**
 * Database-agnostic Settings model
 * Routes to the appropriate implementation based on the current database mode
 */
const Settings = {
  async getSettings() {
    const fileName = 'src/models/Settings.js';
    const functionName = 'getSettings';
    
    const dbMode = getDbMode();
    logger.info(`${fileName} ${functionName} Using database mode: ${dbMode}`);
    
    if (dbMode === 'mongo') {
      return MongoSettings.getSettings();
    } else if (dbMode === 'sqlite') {
      return SqliteSettings.getSettings();
    } else {
      const err = new Error(`Unsupported database mode: ${dbMode}`);
      logger.error(`${fileName} ${functionName} ${err.message}`, { stack: err.stack });
      throw err;
    }
  },
  
  async updateSettings(settings) {
    const fileName = 'src/models/Settings.js';
    const functionName = 'updateSettings';
    
    const dbMode = getDbMode();
    logger.info(`${fileName} ${functionName} Using database mode: ${dbMode}`, { data: settings });
    
    if (dbMode === 'mongo') {
      try {
        const doc = await MongoSettings.findOneAndUpdate(
          { configKey: 'global_settings' },
          settings,
          { new: true, upsert: true }
        );
        return doc;
      } catch (error) {
        logger.error(`${fileName} ${functionName} Error updating settings in MongoDB`, 
          { message: error.message, stack: error.stack });
        throw error;
      }
    } else if (dbMode === 'sqlite') {
      return SqliteSettings.updateSettings(settings);
    } else {
      const err = new Error(`Unsupported database mode: ${dbMode}`);
      logger.error(`${fileName} ${functionName} ${err.message}`, { stack: err.stack });
      throw err;
    }
  }
};

export default Settings;
