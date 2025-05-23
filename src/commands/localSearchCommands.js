import inquirer from 'inquirer';
import { logger } from '../utils/logger.js';
import { handleError } from '../utils/errorHandler.js';
import { formatWithEmoji } from '../utils/emoji.js';
import { processLocalSearch } from '../utils/localSearchProcessor.js';

/**
 * Handles the "Local search - Year - Contains" command.
 * Prompts for year and query, then copies matching issue files.
 */
export async function handleLocalSearchYearContains() {
  const fileName = 'src/commands/localSearchCommands.js';
  const functionName = 'handleLocalSearchYearContains';
  logger.info(`${fileName} ${functionName} Starting local search by year and content`);

  try {
    const { year } = await inquirer.prompt([
      {
        type: 'input',
        name: 'year',
        message: formatWithEmoji('Enter the year to search for (e.g., 2023):', 'calendar'),
        validate: (value) => {
          const yearNum = parseInt(value, 10);
          if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 5) {
            return 'Please enter a valid year (e.g., 2023).';
          }
          return true;
        },
      },
    ]);

    const { query } = await inquirer.prompt([
      {
        type: 'input',
        name: 'query',
        message: formatWithEmoji('Enter the text to search for (case-sensitive):', 'search'),
        validate: (value) => {
          if (!value || value.trim() === '') {
            return 'Please enter a search query.';
          }
          return true;
        },
      },
    ]);

    logger.info(`${fileName} ${functionName} User inputs received`, { data: { year, query } });

    const result = await processLocalSearch(year, query);

    if (result.error) {
      console.log(formatWithEmoji(`Error during local search: ${result.error}`, 'error'));
    } else if (result.copied > 0) {
      console.log(formatWithEmoji(`Successfully copied ${result.copied} issue(s) to "${result.targetDir}".`, 'success'));
    } else if (result.found > 0 && result.copied === 0) {
      console.log(formatWithEmoji(`Found ${result.found} matching issue(s), but failed to copy them. Check logs for details.`, 'warning'));
    } else {
      console.log(formatWithEmoji(`No issues found matching year "${year}" and query "${query}".`, 'info'));
    }

  } catch (error) {
    handleError(error, `${fileName}#${functionName}`);
  }
}
