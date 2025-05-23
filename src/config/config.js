import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

// Load .env file
dotenv.config();

/**
 * Configuration module for centralizing all environment variables and configuration settings
 */
export const config = {
  // API Configuration
  api: {
    key: process.env.REDMINE_API_KEY,
    host: process.env.REDMINE_HOST,
    defaultEndpoint: process.env.REDMINE_DEFAULT_ENDPOINT || '/issues.json',
    defaultLimit: parseInt(process.env.REDMINE_API_DEFAULT_LIMIT, 10) || 100, // Default to 100 if not set or invalid
  },
  
  // SSL Configuration
  ssl: {
    // If true, SSL certificate verification is disabled (NOT recommended for production)
    rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
    // Enable legacy renegotiation support, required for some older servers
    enableLegacyRenegotiation: true,
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'INFO',
  },
  
  // UI configuration
  ui: {
    enableEmoji: process.env.ENABLE_EMOJI !== 'false', // Default to true if not explicitly disabled
    itemsPerPage: parseInt(process.env.ITEMS_PER_PAGE, 10) || 10,
  },
  
  // Validate the configuration and ensure required fields are present
  validate() {
    logger.debug('src/config/config.js validate Validating configuration', { config: this });
    
    const errors = [];
    
    if (!this.api.key) {
      errors.push('REDMINE_API_KEY is required in .env file');
    }
    
    if (!this.api.host) {
      errors.push('REDMINE_HOST is required in .env file');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
};

export default config;
