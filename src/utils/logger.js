// A simple logger utility

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;

const formatMessage = (level, message, details) => {
  const timestamp = new Date().toISOString();
  const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);
  let logLine = `${timestamp} [${levelName}] ${message}`;

  if (details) {
    try {
      // Basic check for circular structures if details might be complex
      // A more robust solution would use a library that handles circular refs in JSON.stringify
      const detailsString = JSON.stringify(details, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (key === 'headers' && value['X-Redmine-API-Key']) {
            return { ...value, 'X-Redmine-API-Key': '***REDACTED***' };
          }
        }
        return value;
      }, 2);
      logLine += `\n${detailsString}`;
    } catch (e) {
      logLine += `\n(Could not stringify details: ${e.message})`;
    }
  }
  return logLine;
};

const log = (level, message, details) => {
  if (level < CURRENT_LOG_LEVEL) {
    return;
  }
  const logMessage = formatMessage(level, message, details);

  switch (level) {
    case LOG_LEVELS.DEBUG:
      console.debug(logMessage); // Use console.debug for debug level
      break;
    case LOG_LEVELS.INFO:
      console.info(logMessage); // Use console.info for info level
      break;
    case LOG_LEVELS.WARN:
      console.warn(logMessage);
      break;
    case LOG_LEVELS.ERROR:
      console.error(logMessage);
      break;
    default:
      console.log(logMessage); // Fallback for unknown levels
  }
};

export const logger = {
  debug: (message, details) => log(LOG_LEVELS.DEBUG, message, details),
  info: (message, details) => log(LOG_LEVELS.INFO, message, details),
  warn: (message, details) => log(LOG_LEVELS.WARN, message, details),
  error: (message, details) => log(LOG_LEVELS.ERROR, message, details),
};
