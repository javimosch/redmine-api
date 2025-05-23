import fs from 'fs-extra';
import path from 'path';
import { logger } from './logger.js';

const ISSUES_DIR = path.resolve(process.cwd(), 'data/issues');
const DATA_DIR = path.resolve(process.cwd(), 'data');

/**
 * Processes local issues based on year and query, copying them to a year-specific directory.
 * @param {string} year - The year to filter by (from created_on or updated_on).
 * @param {string} [query] - Optional. The text to search for within the issue's JSON content. If not provided, all issues of the year are processed.
 * @returns {Promise<{copied: number, found: number, targetDir: string, error?: string}>} - Result of the operation.
 */
export async function processLocalSearch(year, query) {
  const fileName = 'src/utils/localSearchProcessor.js';
  const functionName = 'processLocalSearch';
  logger.info(`${fileName} ${functionName} Starting local search processing`, { data: { year, query } });

  if (!year) {
    const errorMsg = 'Year must be provided for local search processing.';
    logger.error(`${fileName} ${functionName} Validation failed: ${errorMsg}`, { message: errorMsg });
    return { copied: 0, found: 0, targetDir: '', error: errorMsg };
  }

  const targetYearDir = path.join(DATA_DIR, year.toString());

  try {
    await fs.ensureDir(targetYearDir);

    let filesFound = 0;
    let filesCopied = 0;

    if (!await fs.pathExists(ISSUES_DIR)) {
      const errorMsg = `Issues directory '${ISSUES_DIR}' not found.`;
      logger.warn(`${fileName} ${functionName} Prerequisite check failed: ${errorMsg}`, { message: errorMsg });
      return { copied: 0, found: 0, targetDir: targetYearDir, error: errorMsg };
    }

    const issueFiles = await fs.readdir(ISSUES_DIR);
    logger.info(`${fileName} ${functionName} Found ${issueFiles.length} files in issues directory`, { data: { count: issueFiles.length, directory: ISSUES_DIR } });

    for (const issueFile of issueFiles) {
      if (!issueFile.endsWith('.json')) continue;

      const filePath = path.join(ISSUES_DIR, issueFile);
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const issueData = JSON.parse(fileContent);

        const createdOn = issueData.created_on ? new Date(issueData.created_on) : null;
        const updatedOn = issueData.updated_on ? new Date(issueData.updated_on) : null;

        const yearMatch = (createdOn && createdOn.getFullYear().toString() === year.toString()) ||
                          (updatedOn && updatedOn.getFullYear().toString() === year.toString());

        const queryMatch = !query || fileContent.includes(query);

        if (yearMatch && queryMatch) {
          filesFound++;
          const targetFilePath = path.join(targetYearDir, issueFile);
          logger.info(`${fileName} ${functionName} Copying matched file`, { data: { source: filePath, destination: targetFilePath } });
          await fs.copy(filePath, targetFilePath);
          filesCopied++;
        }
      } catch (err) {
        logger.error(`${fileName} ${functionName} Error processing individual file`, { message: err.message, stack: err.stack, file: issueFile });
      }
    }
    logger.info(`${fileName} ${functionName} Local search processing complete`, { data: { copied: filesCopied, found: filesFound, targetDir: targetYearDir } });
    return { copied: filesCopied, found: filesFound, targetDir: targetYearDir };

  } catch (mainError) {
    logger.error(`${fileName} ${functionName} Critical error during search processing`, { message: mainError.message, stack: mainError.stack });
    return { copied: 0, found: 0, targetDir: targetYearDir, error: `A critical error occurred: ${mainError.message}` };
  }
}
