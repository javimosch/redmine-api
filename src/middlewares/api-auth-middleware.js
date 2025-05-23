import Settings from '../models/Settings.js';
import { logger } from '../utils/logger.js';
import bcrypt from 'bcrypt';

/**
 * Middleware to authenticate API requests using API keys
 * Reads the 'Authorization' header in the format: 'Bearer API_KEY'
 */
const apiAuthMiddleware = async (req, res, next) => {
  const fileName = 'src/middlewares/api-auth-middleware.js';
  const functionName = 'apiAuthMiddleware';
  logger.info(`${fileName} ${functionName} ENTERING: ${req.method} ${req.originalUrl}`);

  // --- Start of critical section for Swagger/OPTIONS skipping ---
  // 1. Skip authentication for Swagger UI and API docs related paths FIRST
  // This checks the full original URL. Useful if Swagger UI is served under /api-docs or fetches /swagger.json
  if (req.originalUrl.includes('/api-docs') || req.originalUrl.includes('/swagger.json') || req.originalUrl.includes('/swagger-ui')) {
    logger.info(`${fileName} ${functionName} SKIPPING for Swagger/UI path: ${req.originalUrl}`);
    return next();
  }

  // 2. Skip authentication for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    logger.info(`${fileName} ${functionName} SKIPPING for OPTIONS request: ${req.originalUrl}`);
    return next();
  }
  // --- End of critical section for Swagger/OPTIONS skipping ---
  
  // The following checks are for actual API requests that need authentication.
  // Note: The decision to *call* this middleware for a path like /api/app/configure
  // is made in server.js. If server.js already skips it, this middleware won't even see it.
  // However, keeping a check here can be a safeguard if middleware mounting changes.
  if (req.path.startsWith('/app/configure')) { // req.path is relative to the mount point (e.g., /api)
    logger.info(`${fileName} ${functionName} SKIPPING for /app/configure (relative path): ${req.originalUrl}`);
    return next();
  }

  logger.info(`${fileName} ${functionName} Proceeding with authentication check for: ${req.originalUrl}`);
  try {
    // Get API key from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      logger.warn(`${fileName} ${functionName} Unauthorized: Missing Authorization header`, { data: { path: req.originalUrl } });
      return res.status(401).json({ error: 'Unauthorized: Missing Authorization header' });
    }
    
    const [authType, apiKey] = authHeader.split(' ');
    if (authType !== 'Bearer' || !apiKey) {
      logger.warn(`${fileName} ${functionName} Unauthorized: Invalid Authorization header format`, { data: { path: req.originalUrl } });
      return res.status(401).json({ error: 'Invalid Authorization header format. Use: Bearer API_KEY' });
    }
    
    // Validate API key against stored keys
    logger.info(`${fileName} ${functionName} Attempting to load settings for API key validation for path: ${req.originalUrl}`);
    const settings = await Settings.findOne({ configKey: 'global_settings' });
    
    if (!settings) {
      logger.error(`${fileName} ${functionName} CRITICAL: Settings document not found. Cannot validate API keys. Path: ${req.originalUrl}`);
      return res.status(500).json({ error: 'Server configuration error: Cannot validate API keys.' });
    }
    logger.info(`${fileName} ${functionName} Settings loaded successfully for API key validation. Path: ${req.originalUrl}`);
    
    if (!settings.apiKeys || settings.apiKeys.length === 0) {
      logger.warn(`${fileName} ${functionName} Unauthorized: No API keys configured in settings. Path: ${req.originalUrl}`);
      return res.status(401).json({ error: 'Unauthorized: No API keys configured' });
    }
    
    // Check if the provided API key is valid (hashed comparison)
    const isValidKey = settings.apiKeys.some(storedApiKeyHash => bcrypt.compareSync(apiKey, storedApiKeyHash.split('bcrypt:').join('')));
    
    if (!isValidKey) {
      logger.warn(`${fileName} ${functionName} Unauthorized: Invalid API key. Path: ${req.originalUrl}`);
      return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }
    
    logger.info(`${fileName} ${functionName} API key validated successfully. Path: ${req.originalUrl}`);
    next();
  } catch (error) {
    logger.error(`${fileName} ${functionName} Error in API authentication middleware:`, 
      { message: error.message, stack: error.stack, data: { path: req.originalUrl } });
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

export default apiAuthMiddleware;