import fs from 'fs-extra';
import path from 'path';
import expandTilde from 'expand-tilde';
import { logger } from './logger.js';

const CONFIG_DIR = expandTilde('~/.redmine-api');
const CONFIG_FILE_PATH = path.join(CONFIG_DIR, 'config.json');

/**
 * Ensures the configuration directory exists.
 */
const ensureConfigDirExists = async () => {
  try {
    await fs.ensureDir(CONFIG_DIR);
  } catch (err) {
    logger.error('src/utils/serverConfig.js ensureConfigDirExists Error creating config directory:', { message: err.message, stack: err.stack, data: { directory: CONFIG_DIR } });
    throw err; // Re-throw to be handled by caller
  }
};

/**
 * Loads the server configuration from ~/.redmine-api/config.json.
 * @returns {Promise<Object>} The configuration object, or an empty object if not found/error.
 */
export const loadServerConfig = async () => {
  const fileName = 'src/utils/serverConfig.js';
  const functionName = 'loadServerConfig';
  await ensureConfigDirExists();
  try {
    if (await fs.pathExists(CONFIG_FILE_PATH)) {
      const config = await fs.readJson(CONFIG_FILE_PATH);
      logger.info(`${fileName} ${functionName} Server configuration loaded successfully.`, { data: { path: CONFIG_FILE_PATH } });
      return config;
    }
    logger.info(`${fileName} ${functionName} Server configuration file not found, returning empty config.`, { data: { path: CONFIG_FILE_PATH }});
    return {}; // Return empty object if file doesn't exist
  } catch (err) {
    logger.error(`${fileName} ${functionName} Error loading server configuration:`, { message: err.message, stack: err.stack, data: { path: CONFIG_FILE_PATH } });
    return {}; // Return empty object on error to allow prompting
  }
};

/**
 * Saves the server configuration to ~/.redmine-api/config.json.
 * @param {Object} config - The configuration object to save.
 * @returns {Promise<void>}
 */
export const saveServerConfig = async (config) => {
  const fileName = 'src/utils/serverConfig.js';
  const functionName = 'saveServerConfig';
  await ensureConfigDirExists();
  try {
    await fs.writeJson(CONFIG_FILE_PATH, config, { spaces: 2 });
    logger.info(`${fileName} ${functionName} Server configuration saved successfully.`, { data: { path: CONFIG_FILE_PATH, config } });
  } catch (err) {
    logger.error(`${fileName} ${functionName} Error saving server configuration:`, { message: err.message, stack: err.stack, data: { path: CONFIG_FILE_PATH } });
    throw err; // Re-throw to be handled by caller
  }
};

export default {
  loadServerConfig,
  saveServerConfig,
};
