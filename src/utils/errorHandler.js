import { logger } from './logger.js';

export const handleError = (error, context = 'General') => {
  const fileName = 'src/utils/errorHandler.js';
  const functionName = 'handleError';
  const tryDescription = `handling error in ${context}`;
  
  const logPayload = {
    context,
    message: error.message,
    // stack: error.stack, // Stack can be very verbose, consider logging conditionally or to a separate debug log
  };

  if (error.isAxiosError) {
    logPayload.requestPath = `${error.config?.method?.toUpperCase()} ${error.config?.url}`;
    if (error.response) {
      logPayload.axiosResponse = {
        status: error.response.status,
        data: error.response.data, // Be cautious with large data payloads
        // headers: error.response.headers, // Headers can also be verbose
      };
      logger.error(`${fileName} ${functionName} ${tryDescription} - API Error`, logPayload);
      // User-friendly message
      logger.error(`API Error in ${context}: ${error.response.status} - ${error.message}. Check logs for more details.`);
      if (error.response.data && typeof error.response.data === 'object') {
        // Attempt to provide more specific error details if available from Redmine
        const redmineErrors = error.response.data.errors;
        if (Array.isArray(redmineErrors) && redmineErrors.length > 0) {
          logger.error(`Redmine API reported: ${redmineErrors.join(', ')}`);
        }
      }
    } else if (error.request) {
      logger.error(`${fileName} ${functionName} ${tryDescription} - Network Error or No Response`, logPayload);
      logger.error(`Network Error or No Response in ${context}: ${error.message}. Ensure the Redmine server is reachable, the host in .env is correct, and there are no network issues.`);
    } else {
      logger.error(`${fileName} ${functionName} ${tryDescription} - Axios Error (no response/request)`, logPayload);
      logger.error(`Axios error in ${context}: ${error.message}. This is an unexpected Axios issue.`);
    }
  } else {
    logger.error(`${fileName} ${functionName} ${tryDescription} - Non-Axios Error`, { ...logPayload, stack: error.stack });
    logger.error(`An unexpected error occurred in ${context}: ${error.message}. Check logs for stack trace.`);
  }
  // For CLI, we might not want to exit on all errors, let the calling function decide.
};
