import * as fs from 'fs/promises';
import * as path from 'path';
import { fetchAllIssuesWithCriteria } from '../services/redmineService.js';
import { logger } from './logger.js';
import config from '../config/config.js'; // Assuming redmineService might rely on config

const EXPORT_DIR = path.join(process.cwd(), 'data', 'issues');

/**
 * Fetches all issues from Redmine based on general criteria (e.g., all open/updated)
 * and saves them to the data/issues directory. This is non-interactive.
 * @returns {Promise<{fetched: number, saved: number, error?: string}>}
 */
export async function fetchAndSaveAllIssuesService() {
  const fileName = 'src/utils/issueFetcher.js';
  const functionName = 'fetchAndSaveAllIssuesService';
  logger.info(`${fileName} ${functionName} Starting non-interactive issue fetch and save process`);

  try {
    await fs.mkdir(EXPORT_DIR, { recursive: true });
    logger.info(`${fileName} ${functionName} Ensured export directory exists: ${EXPORT_DIR}`);

    let totalSavedCount = 0;
    let totalFetchedCount = 0;

    // Callback to save a batch of issues to files
    const saveBatchToFile = async (issuesBatch) => {
      logger.debug(`${fileName} ${functionName} saveBatchToFile called with ${issuesBatch.length} issues.`);
      let batchSavedCount = 0;
      for (const issue of issuesBatch) {
        const filePath = path.join(EXPORT_DIR, `${issue.id}.json`);
        try {
          await fs.writeFile(filePath, JSON.stringify(issue, null, 2));
          batchSavedCount++;
          logger.debug(`${fileName} ${functionName} Successfully wrote issue ${issue.id} to ${filePath}`);
        } catch (writeError) {
          logger.error(`${fileName} ${functionName} Failed to write issue ${issue.id} to file ${filePath}`, { message: writeError.message, stack: writeError.stack });
          // For a scheduled task, we typically log the error and continue with other issues.
        }
      }
      return batchSavedCount;
    };

    // Callback for fetchAllIssuesWithCriteria to process each batch of issues
    const processIssueBatchCallback = async (issuesBatch, currentOffset, totalIssuesApprox) => {
      logger.info(`${fileName} ${functionName} processIssueBatchCallback: Received batch of ${issuesBatch.length} issues. Offset: ${currentOffset}. Total (approx): ${totalIssuesApprox}`);
      totalFetchedCount += issuesBatch.length;
      const savedInBatch = await saveBatchToFile(issuesBatch);
      totalSavedCount += savedInBatch;
      logger.info(`${fileName} ${functionName} processIssueBatchCallback: Saved ${savedInBatch} issues from this batch. Total saved so far: ${totalSavedCount}`);
      // Return true to continue fetching more batches
      return true;
    };

    // Define criteria for fetching issues. An empty object {} is used in issueCommands.js
    // to fetch all issues when no specific user filter is applied.
    // This typically means the redmineService will fetch all issues it's configured to (e.g., all open issues).
    const criteria = {}; 
    logger.info(`${fileName} ${functionName} Calling Redmine service 'fetchAllIssuesWithCriteria' with criteria:`, { data: criteria });

    await fetchAllIssuesWithCriteria(criteria, processIssueBatchCallback);

    logger.info(`${fileName} ${functionName} Issue fetching and saving process completed.`, { data: { totalFetched: totalFetchedCount, totalSaved: totalSavedCount } });
    return { fetched: totalFetchedCount, saved: totalSavedCount };

  } catch (error) {
    // Log the error with context
    logger.error(`${fileName} ${functionName} Critical error during issue fetching/saving process`, { message: error.message, stack: error.stack });
    return { fetched: 0, saved: 0, error: error.message };
  }
}
