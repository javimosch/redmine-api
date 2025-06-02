import fs from 'fs/promises';
import path from 'path';
import redmineService from './redmineService.js';
import { logger } from '../utils/logger.js';

const ISSUES_DIR = path.join(process.cwd(), 'data', 'issues');
const fileName = 'src/services/issueService.js';

/**
 * Retrieves an issue by its ID.
 * It first attempts to find the issue in the local cache (data/issues/{id}.json).
 * If not found locally, it fetches the issue from the Redmine API and caches it.
 * @param {number|string} issueId - The ID of the issue to retrieve.
 * @returns {Promise<Object|null>} The issue object if found, otherwise null.
 */
export const getIssueById = async (issueId) => {
  const functionName = 'getIssueById';
  const localIssuePath = path.join(ISSUES_DIR, `${issueId}.json`);

  logger.info(`${fileName} ${functionName} Attempting to retrieve issue`, { data: { issueId, localPath: localIssuePath } });

  // 1. Try to get from local cache
  try {
    logger.debug(`${fileName} ${functionName} Checking local cache for issue`, { data: { issueId } });
    const fileContent = await fs.readFile(localIssuePath, 'utf-8');
    const issue = JSON.parse(fileContent);
    logger.info(`${fileName} ${functionName} Issue found in local cache`, { data: { issueId } });
    return issue;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info(`${fileName} ${functionName} Issue not found in local cache, will try Redmine API`, { data: { issueId } });
    } else {
      // Log other errors (e.g., JSON parsing error, permission issues) but still try Redmine
      logger.warn(`${fileName} ${functionName} Error reading from local cache, proceeding to Redmine API`, { data: { issueId }, message: error.message, stack: error.stack });
    }
  }

  // 2. If not in cache, try to get from Redmine API
  try {
    logger.info(`${fileName} ${functionName} Fetching issue from Redmine API`, { data: { issueId } });
    const issueFromApi = await redmineService.fetchIssueById(issueId);

    if (issueFromApi) {
      logger.info(`${fileName} ${functionName} Issue successfully fetched from Redmine API`, { data: { issueId: issueFromApi.id } });
      // Cache the fetched issue
      try {
        await fs.mkdir(ISSUES_DIR, { recursive: true });
        await fs.writeFile(localIssuePath, JSON.stringify(issueFromApi, null, 2));
        logger.info(`${fileName} ${functionName} Issue cached locally`, { data: { issueId: issueFromApi.id, path: localIssuePath } });
      } catch (cacheError) {
        logger.error(`${fileName} ${functionName} Failed to cache issue locally`, { data: { issueId: issueFromApi.id }, message: cacheError.message, stack: cacheError.stack });
        // Non-fatal: return the issue even if caching fails
      }
      return issueFromApi;
    } else {
      logger.warn(`${fileName} ${functionName} Issue not found via Redmine API`, { data: { issueId } });
      return null; // Explicitly return null if Redmine service indicates not found
    }
  } catch (apiError) {
    // redmineService.fetchIssueById is expected to use handleError, which might rethrow or return null.
    // If it rethrows, this catch block will handle it.
    logger.error(`${fileName} ${functionName} Error fetching issue from Redmine API`, { data: { issueId }, message: apiError.message, stack: apiError.stack, axiosResponse: apiError.isAxiosError ? apiError.response?.data : undefined });
    return null; // Or rethrow if a 500 is more appropriate upstream
  }
};
