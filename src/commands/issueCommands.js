import inquirer from 'inquirer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fetchIssues, fetchUsers, fetchAllIssuesWithCriteria } from '../services/redmineService.js';
import { handleError } from '../utils/errorHandler.js'; // Added handleError import
import { logger } from '../utils/logger.js';
import { formatWithEmoji } from '../utils/emoji.js';
import config from '../config/config.js';

/**
 * Module for handling issue-related commands
 */

/**
 * Handle the fetch issues command
 * Fetches issues from the Redmine API and displays them to the user
 */
export const handleFetchIssues = async () => {
  const fileName = 'src/commands/issueCommands.js';
  const functionName = 'handleFetchIssues';
  
  logger.info(`${fileName} ${functionName} Starting to fetch issues...`);
  console.log(formatWithEmoji('Fetching issues from Redmine...', 'fetch'));
  
  let issues = [];

  logger.info(`${fileName} ${functionName} Initiating issue fetching process.`);

  try {
    // Prepare the export directory before fetching
    const exportDir = path.join(process.cwd(), 'data', 'issues');
    try {
      await fs.mkdir(exportDir, { recursive: true });
      logger.info(`${fileName} ${functionName} Ensured export directory exists: ${exportDir}`);
    } catch (dirError) {
      logger.error(`${fileName} ${functionName} Failed to create export directory ${exportDir}:`, { message: dirError.message, stack: dirError.stack });
      console.log(formatWithEmoji(`Could not create directory ${exportDir}. Cannot export issues. Check logs.`, 'error'));
      return null;
    }
    
    // Setup tracking variables for export progress
    let totalExportedCount = 0;
    let totalFetchedCount = 0;
    
    // Function to handle progressive export of each batch
    const exportBatch = async (issuesBatch, currentOffset, hasMore) => {
      console.log(formatWithEmoji(`Received batch of ${issuesBatch.length} issues (total so far: ${currentOffset})`, 'info'));
      totalFetchedCount += issuesBatch.length;
      
      let batchExportedCount = 0;
      let batchFailedCount = 0;
      
      for (const issue of issuesBatch) {
        const filePath = path.join(exportDir, `${issue.id}.json`);
        try {
          await fs.writeFile(filePath, JSON.stringify(issue, null, 2));
          batchExportedCount++;
          totalExportedCount++;
          logger.debug(`${fileName} ${functionName} Successfully wrote issue ${issue.id} to ${filePath}`);
        } catch (writeError) {
          batchFailedCount++;
          logger.error(`${fileName} ${functionName} Failed to write issue ${issue.id} to file ${filePath}:`, { message: writeError.message, stack: writeError.stack });
          console.log(formatWithEmoji(`Error saving issue ${issue.id}. Check logs.`, 'error'));
        }
      }
      
      // Show progress to the user
      if (batchExportedCount > 0) {
        console.log(formatWithEmoji(`Successfully exported ${batchExportedCount}/${issuesBatch.length} issues in this batch (total: ${totalExportedCount})`, 'success'));
      }
      
      // If all exports failed in this batch, stop fetching more
      if (batchExportedCount === 0 && batchFailedCount > 0) {
        console.log(formatWithEmoji(`All exports failed in this batch. Stopping further fetching.`, 'error'));
        return false; // Stop fetching more issues
      }
      
      return true; // Continue fetching
    };

    const { filterByUser } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'filterByUser',
        message: formatWithEmoji('Do you want to fetch issues for a specific user?', 'question'),
        default: false,
      },
    ]);

    if (filterByUser) {
      const { userIdentifier } = await inquirer.prompt([
        {
          type: 'input',
          name: 'userIdentifier',
          message: formatWithEmoji('Enter user name, login, email, or part of it:', 'input'),
          validate: input => input.trim() !== '' || 'User identifier cannot be empty.',
        },
      ]);

      logger.info(`${fileName} ${functionName} Searching for users matching: "${userIdentifier}"`);
      const usersFound = await fetchUsers(userIdentifier);

      let userIdToUse;
      let searchTermForMentions;
      let userIdentificationMessage = '';

      if (usersFound === null) { // fetchUsers failed, likely API error (e.g., 403)
        // handleError in redmineService.js should have logged the detailed error already.
        const { tryManualInput } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'tryManualInput',
            message: formatWithEmoji('Searching users by name failed (this might be due to API key permissions). Would you like to provide a numeric User ID and a name/login (for searching mentions in text) instead?', 'question'),
            default: false,
          },
        ]);

        if (tryManualInput) {
          const manualInputs = await inquirer.prompt([
            {
              type: 'number',
              name: 'manualUserId',
              message: formatWithEmoji('Enter the numeric User ID:', 'input'),
              validate: input => (Number.isInteger(input) && input > 0) || 'Please enter a valid positive User ID.',
            },
            {
              type: 'input',
              name: 'manualSearchTerm',
              message: formatWithEmoji('Enter the user\'s login or name (for searching mentions in text):', 'input'),
              validate: input => input.trim() !== '' || 'Search term cannot be empty.',
            },
          ]);
          userIdToUse = manualInputs.manualUserId;
          searchTermForMentions = manualInputs.manualSearchTerm.trim();
          userIdentificationMessage = `Fetching issues using User ID: ${userIdToUse} and search term for mentions: "${searchTermForMentions}"`;
          logger.info(`${fileName} ${functionName} Proceeding with manual User ID: ${userIdToUse} and search term: "${searchTermForMentions}"`);
        } else {
          logger.info(`${fileName} ${functionName} User opted not to provide manual input after user search failure.`);
          console.log(formatWithEmoji('User search failed and no manual input provided. Aborting.', 'info'));
          return null;
        }
      } else if (usersFound.length === 0) {
        console.log(formatWithEmoji(`No users found matching "${userIdentifier}".`, 'info'));
        logger.warn(`${fileName} ${functionName} No users found for identifier: "${userIdentifier}"`);
        return null;
      } else {
        let selectedUser;
        if (usersFound.length > 1) {
          const { userIdChoice } = await inquirer.prompt([
            {
              type: 'list',
              name: 'userIdChoice',
              message: formatWithEmoji('Multiple users found. Please select one:', 'select'),
              choices: usersFound.map(user => ({
                name: `${user.firstname} ${user.lastname} (${user.login}) - ID: ${user.id}`,
                value: user.id,
              })).concat([{ name: 'Cancel', value: 'cancel_selection' }]),
            },
          ]);
          if (userIdChoice === 'cancel_selection') {
            logger.info(`${fileName} ${functionName} User cancelled selection from multiple users.`);
            console.log(formatWithEmoji('User selection cancelled.', 'info'));
            return null;
          }
          selectedUser = usersFound.find(user => user.id === userIdChoice);
        } else {
          selectedUser = usersFound[0];
          const { confirmUser } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmUser',
              message: formatWithEmoji(`Is this the correct user: ${selectedUser.firstname} ${selectedUser.lastname} (${selectedUser.login})?`, 'question'),
              default: true,
            }
          ]);
          if (!confirmUser) {
            logger.info(`${fileName} ${functionName} User did not confirm the single found user.`);
            console.log(formatWithEmoji('User confirmation declined.', 'info'));
            return null;
          }
        }

        if (!selectedUser) {
          logger.error(`${fileName} ${functionName} User selection process failed to identify a user.`);
          console.log(formatWithEmoji('User selection failed. Please try again.', 'error'));
          return null;
        }
        userIdToUse = selectedUser.id;
        searchTermForMentions = selectedUser.login; // Using login as the default search term for mentions
        userIdentificationMessage = `Fetching issues for user: ${selectedUser.firstname} ${selectedUser.lastname} (Login: ${selectedUser.login}, ID: ${userIdToUse})`;
        logger.info(`${fileName} ${functionName} Selected user: ${selectedUser.login} (ID: ${userIdToUse})`);
      }

      if (typeof userIdToUse === 'undefined') {
        logger.error(`${fileName} ${functionName} User ID to use for fetching issues is undefined. Aborting.`);
        console.log(formatWithEmoji('Could not identify a user to proceed. Aborting issue fetch.', 'error'));
        return null;
      }

      console.log(formatWithEmoji(userIdentificationMessage, 'fetch'));

      const assignedOptions = { assigned_to_id: userIdToUse };
      const authoredOptions = { author_id: userIdToUse };
      const mentionedOptions = { 
        text_search_fields: { 
          description: searchTermForMentions, 
          notes: searchTermForMentions 
        }, 
        include_journals: true 
      };

      logger.info(`${fileName} ${functionName} Starting progressive export for user-specific issues`);
      
      console.log(formatWithEmoji('Fetching issues assigned to the user...', 'fetch'));
      const issuesAssigned = await fetchAllIssuesWithCriteria(assignedOptions, exportBatch);
      console.log(formatWithEmoji(`Found ${issuesAssigned.length} issues assigned to user ID ${userIdToUse}.`, issuesAssigned.length > 0 ? 'success' : 'info'));

      console.log(formatWithEmoji('Fetching issues authored by the user...', 'fetch'));
      const issuesAuthored = await fetchAllIssuesWithCriteria(authoredOptions, exportBatch);
      console.log(formatWithEmoji(`Found ${issuesAuthored.length} issues authored by user ID ${userIdToUse}.`, issuesAuthored.length > 0 ? 'success' : 'info'));
      
      console.log(formatWithEmoji(`Fetching issues mentioning "${searchTermForMentions}" in description or comments...`, 'fetch'));
      const issuesMentioned = await fetchAllIssuesWithCriteria(mentionedOptions, exportBatch);
      console.log(formatWithEmoji(`Found ${issuesMentioned.length} issues mentioning "${searchTermForMentions}".`, issuesMentioned.length > 0 ? 'success' : 'info'));

      const allUserIssuesMap = new Map();
      [...issuesAssigned, ...issuesAuthored, ...issuesMentioned].forEach(issue => {
        if (issue && typeof issue.id !== 'undefined') { // Check issue and issue.id validity
            allUserIssuesMap.set(issue.id, issue);
        }
      });
      issues = Array.from(allUserIssuesMap.values());
      
      logger.info(`${fileName} ${functionName} Total unique issues for user ID ${userIdToUse} (search term "${searchTermForMentions}"): ${issues.length}`);

    } else {
      logger.info(`${fileName} ${functionName} User opted to fetch all issues (or based on general filters).`);
      console.log(formatWithEmoji('Fetching all issues from Redmine...', 'fetch'));
      logger.info(`${fileName} ${functionName} Starting progressive export for all issues`);
      issues = await fetchAllIssuesWithCriteria({}, exportBatch);
      logger.info(`${fileName} ${functionName} Total issues fetched: ${issues.length}`);
    }

    if (totalExportedCount > 0) {
      console.log(formatWithEmoji(`Export complete. Total: ${totalExportedCount}/${totalFetchedCount} issues successfully exported to ${exportDir}`, 'success'));
    } else if (totalFetchedCount > 0) {
      console.log(formatWithEmoji(`Export failed. ${totalFetchedCount} issues were fetched but none were exported successfully.`, 'error'));
    } else if (issues && issues.length === 0) {
      console.log(formatWithEmoji('No issues found matching your criteria. Nothing to export.', 'info'));
    } else {
      console.log(formatWithEmoji('An unexpected error occurred, or no issues were fetched. Nothing to export.', 'error'));
      logger.error(`${fileName} ${functionName} Issues variable is null or undefined after fetching attempts.`);
    }
  } catch (error) {
    logger.error(`${fileName} ${functionName} Error fetching issues:`, { message: error.message, stack: error.stack, axiosResponse: error.isAxiosError ? error.response?.data : undefined });
    // Use the imported handleError for consistent error display
    handleError(error, `${functionName}`);
    return [];
  }
};

const fetchUserIssues = async (assignedOptions, authoredOptions, mentionedOptions, exportBatch, userIdToUse, searchTermForMentions) => {
  const fileName = 'src/commands/issueCommands.js';
  const functionName = 'fetchUserIssues';
  
  try {
    logger.info(`${fileName} ${functionName} Starting progressive export for user-specific issues`);
    
    console.log(formatWithEmoji('Fetching issues assigned to the user...', 'fetch'));
    const issuesAssigned = await fetchAllIssuesWithCriteria(assignedOptions, exportBatch);
    console.log(formatWithEmoji(`Found ${issuesAssigned.length} issues assigned to user ID ${userIdToUse}.`, issuesAssigned.length > 0 ? 'success' : 'info'));

    console.log(formatWithEmoji('Fetching issues authored by the user...', 'fetch'));
    const issuesAuthored = await fetchAllIssuesWithCriteria(authoredOptions, exportBatch);
    console.log(formatWithEmoji(`Found ${issuesAuthored.length} issues authored by user ID ${userIdToUse}.`, issuesAuthored.length > 0 ? 'success' : 'info'));
    
    console.log(formatWithEmoji(`Fetching issues mentioning "${searchTermForMentions}" in description or comments...`, 'fetch'));
    const issuesMentioned = await fetchAllIssuesWithCriteria(mentionedOptions, exportBatch);
    console.log(formatWithEmoji(`Found ${issuesMentioned.length} issues mentioning "${searchTermForMentions}".`, issuesMentioned.length > 0 ? 'success' : 'info'));

    const allUserIssuesMap = new Map();
    [...issuesAssigned, ...issuesAuthored, ...issuesMentioned].forEach(issue => {
      if (issue && typeof issue.id !== 'undefined') { // Check issue and issue.id validity
          allUserIssuesMap.set(issue.id, issue);
      }
    });
    
    const issues = Array.from(allUserIssuesMap.values());
    logger.info(`${fileName} ${functionName} Total unique issues for user ID ${userIdToUse} (search term "${searchTermForMentions}"): ${issues.length}`);
    return issues;
  } catch (error) {
    logger.error(`${fileName} ${functionName} Error in user issue fetching process`, {
      message: error.message, 
      stack: error.stack, 
      axiosResponse: error.isAxiosError ? error.response?.data : undefined
    });
    handleError(error, functionName);
    return [];
  }
};
/**
 * Display issues with pagination
 * @param {Array} issues - Array of issues to display
 */
export const displayIssuesWithPagination = async (issues) => {
  const fileName = 'src/commands/issueCommands.js';
  const functionName = 'displayIssuesWithPagination';
  
  if (!issues || issues.length === 0) {
    console.log(formatWithEmoji('No issues to display.', 'info'));
    return;
  }
  
  const itemsPerPage = config.ui.itemsPerPage;
  const totalPages = Math.ceil(issues.length / itemsPerPage);
  let currentPage = 1;
  
  const displayPage = (page) => {
    console.log('\n' + formatWithEmoji(`Issues (Page ${page}/${totalPages})`, 'issue'));
    console.log('─'.repeat(50));
    
    const startIdx = (page - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, issues.length);
    
    for (let i = startIdx; i < endIdx; i++) {
      const issue = issues[i];
      const priorityEmoji = getPriorityEmoji(issue.priority?.name);
      const statusEmoji = getStatusEmoji(issue.status?.name);
      
      console.log(`${formatWithEmoji('', 'issue')} ID: ${issue.id}`);
      console.log(`   ${statusEmoji} ${issue.status?.name || 'Unknown Status'}`);
      console.log(`   ${priorityEmoji} ${issue.subject || 'No Subject'}`);
      if (issue.assigned_to) {
        console.log(`   ${formatWithEmoji('', 'user')} Assigned to: ${issue.assigned_to.name}`);
      }
      console.log('─'.repeat(50));
    }
    
    logger.debug(`${fileName} ${functionName} Displayed issues page ${page}/${totalPages}`, { 
      startIdx, 
      endIdx, 
      totalIssues: issues.length 
    });
  };
  
  // Show first page
  displayPage(currentPage);
  
  // Handle pagination
  while (true) {
    if (totalPages <= 1) {
      break; // No pagination needed for a single page
    }
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Pagination options:',
        choices: [
          ...(currentPage > 1 ? [{ name: formatWithEmoji('Previous page', 'previous'), value: 'prev' }] : []),
          ...(currentPage < totalPages ? [{ name: formatWithEmoji('Next page', 'next'), value: 'next' }] : []),
          { name: formatWithEmoji('Go to specific page', 'goto'), value: 'goto' },
          { name: formatWithEmoji('View issue details', 'view'), value: 'view' },
          { name: formatWithEmoji('Back to main menu', 'back'), value: 'back' }
        ]
      }
    ]);
    
    switch (action) {
      case 'prev':
        currentPage--;
        displayPage(currentPage);
        break;
      case 'next':
        currentPage++;
        displayPage(currentPage);
        break;
      case 'goto':
        const { pageNum } = await inquirer.prompt([
          {
            type: 'number',
            name: 'pageNum',
            message: `Enter page number (1-${totalPages}):`,
            validate: (input) => {
              const page = parseInt(input);
              return page >= 1 && page <= totalPages ? true : `Please enter a valid page number between 1 and ${totalPages}.`;
            }
          }
        ]);
        currentPage = parseInt(pageNum);
        displayPage(currentPage);
        break;
      case 'view':
        await viewIssueDetails(issues, currentPage, itemsPerPage);
        displayPage(currentPage); // Redisplay the current page after viewing details
        break;
      case 'back':
        return;
    }
  }
};

/**
 * View details of a specific issue
 * @param {Array} issues - Array of issues
 * @param {number} currentPage - Current page
 * @param {number} itemsPerPage - Items per page
 */
export const viewIssueDetails = async (issues, currentPage, itemsPerPage) => {
  const fileName = 'src/commands/issueCommands.js';
  const functionName = 'viewIssueDetails';
  
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = Math.min(startIdx + itemsPerPage, issues.length);
  
  // Create choices for the current page issues
  const issueChoices = issues
    .slice(startIdx, endIdx)
    .map((issue) => ({
      name: `#${issue.id} - ${issue.subject}`,
      value: issue.id
    }));
  
  const { issueId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'issueId',
      message: 'Select an issue to view details:',
      choices: issueChoices
    }
  ]);
  
  // Find the selected issue
  const selectedIssue = issues.find(issue => issue.id === issueId);
  
  if (!selectedIssue) {
    console.log(formatWithEmoji('Issue not found.', 'error'));
    return;
  }
  
  logger.debug(`${fileName} ${functionName} Viewing details for issue #${issueId}`, { selectedIssue });
  
  // Display issue details
  console.clear();
  console.log('\n' + formatWithEmoji(`Issue #${selectedIssue.id} Details`, 'issue'));
  console.log('═'.repeat(50));
  
  console.log(formatWithEmoji(`Subject: ${selectedIssue.subject}`, 'subject'));
  console.log(`${getStatusEmoji(selectedIssue.status?.name)} Status: ${selectedIssue.status?.name || 'Unknown'}`);
  console.log(`${getPriorityEmoji(selectedIssue.priority?.name)} Priority: ${selectedIssue.priority?.name || 'Unknown'}`);
  
  if (selectedIssue.project) {
    console.log(formatWithEmoji(`Project: ${selectedIssue.project.name}`, 'project'));
  }
  
  if (selectedIssue.author) {
    console.log(formatWithEmoji(`Author: ${selectedIssue.author.name}`, 'user'));
  }
  
  if (selectedIssue.assigned_to) {
    console.log(formatWithEmoji(`Assigned to: ${selectedIssue.assigned_to.name}`, 'user'));
  }
  
  if (selectedIssue.start_date) {
    console.log(formatWithEmoji(`Start date: ${selectedIssue.start_date}`, 'date'));
  }
  
  if (selectedIssue.due_date) {
    console.log(formatWithEmoji(`Due date: ${selectedIssue.due_date}`, 'date'));
  }
  
  if (selectedIssue.done_ratio !== undefined) {
    console.log(formatWithEmoji(`Progress: ${selectedIssue.done_ratio}%`, 'progress'));
  }
  
  console.log('─'.repeat(50));
  console.log('Description:');
  console.log(selectedIssue.description ? 
    // Simple HTML to text conversion for description
    selectedIssue.description.replace(/<\/?[^>]+(>|$)/g, '') : 
    'No description available.');
  
  if (selectedIssue.custom_fields && selectedIssue.custom_fields.length > 0) {
    console.log('─'.repeat(50));
    console.log('Custom Fields:');
    
    selectedIssue.custom_fields.forEach(field => {
      if (field.value) {
        console.log(`${field.name}: ${field.value}`);
      }
    });
  }
  
  console.log('═'.repeat(50));
  
  // Wait for user to press a key to continue
  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: 'Press Enter to go back...'
    }
  ]);
};

/**
 * Get emoji for priority level
 * @param {string} priorityName - Name of the priority
 * @returns {string} Emoji representing the priority
 */
const getPriorityEmoji = (priorityName) => {
  if (!priorityName) return formatWithEmoji('', 'priority.normal');
  
  const lowerPriority = priorityName.toLowerCase();
  
  if (lowerPriority.includes('low') || lowerPriority.includes('basse')) {
    return formatWithEmoji('', 'priority.low');
  } else if (lowerPriority.includes('normal') || lowerPriority.includes('normale')) {
    return formatWithEmoji('', 'priority.normal');
  } else if (lowerPriority.includes('high') || lowerPriority.includes('haute')) {
    return formatWithEmoji('', 'priority.high');
  } else if (lowerPriority.includes('urgent')) {
    return formatWithEmoji('', 'priority.urgent');
  } else if (lowerPriority.includes('immediate')) {
    return formatWithEmoji('', 'priority.immediate');
  }
  
  return formatWithEmoji('', 'priority.normal');
};

/**
 * Get emoji for issue status
 * @param {string} statusName - Name of the status
 * @returns {string} Emoji representing the status
 */
const getStatusEmoji = (statusName) => {
  if (!statusName) return formatWithEmoji('', 'status.new');
  
  const lowerStatus = statusName.toLowerCase();
  
  if (lowerStatus.includes('new') || lowerStatus.includes('déclaré')) {
    return formatWithEmoji('', 'status.new');
  } else if (lowerStatus.includes('progress') || lowerStatus.includes('cours')) {
    return formatWithEmoji('', 'status.inProgress');
  } else if (lowerStatus.includes('resolved') || lowerStatus.includes('résolu')) {
    return formatWithEmoji('', 'status.resolved');
  } else if (lowerStatus.includes('closed') || lowerStatus.includes('fermé')) {
    return formatWithEmoji('', 'status.closed');
  } else if (lowerStatus.includes('feedback') || lowerStatus.includes('retour')) {
    return formatWithEmoji('', 'status.feedback');
  } else if (lowerStatus.includes('reject') || lowerStatus.includes('rejeté')) {
    return formatWithEmoji('', 'status.rejected');
  }
  
  return formatWithEmoji('', 'status.new');
};

export default {
  handleFetchIssues,
  displayIssuesWithPagination,
  viewIssueDetails
};
