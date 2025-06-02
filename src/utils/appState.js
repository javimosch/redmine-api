/**
 * Application state management
 * Maintains global application state including database mode and connections
 */
import { logger } from './logger.js';

// Database mode: 'mongo' or 'sqlite'
let dbMode = null;

// SQLite database instance (only used in sqlite mode)
let sqliteDb = null;

/**
 * Set the database mode
 * @param {string} mode - 'mongo' or 'sqlite'
 */
export const setDbMode = (mode) => {
  const fileName = 'src/utils/appState.js';
  const functionName = 'setDbMode';
  
  if (mode !== 'mongo' && mode !== 'sqlite') {
    logger.error(`${fileName} ${functionName} Invalid database mode: ${mode}`);
    throw new Error(`Invalid database mode: ${mode}`);
  }
  
  logger.info(`${fileName} ${functionName} Setting database mode to ${mode}`);
  dbMode = mode;
};

/**
 * Get the current database mode
 * @returns {string} - 'mongo', 'sqlite', or null if not set
 */
export const getDbMode = () => {
  return dbMode;
};

/**
 * Set the SQLite database instance
 * @param {Object} db - SQLite database instance
 */
export const setSqliteDb = (db) => {
  const fileName = 'src/utils/appState.js';
  const functionName = 'setSqliteDb';
  
  logger.info(`${fileName} ${functionName} Setting SQLite database instance`);
  sqliteDb = db;
};

/**
 * Get the SQLite database instance
 * @returns {Object} SQLite database instance or null if not set
 */
export const getSqliteDb = () => {
  return sqliteDb;
};

export default {
  setDbMode,
  getDbMode,
  setSqliteDb,
  getSqliteDb
};
