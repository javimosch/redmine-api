import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

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

// Static method to get or create the global settings document
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

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
