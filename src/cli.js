#!/usr/bin/env node

import inquirer from 'inquirer';
import { handleError } from './utils/errorHandler.js';
import { logger } from './utils/logger.js';
import { formatWithEmoji } from './utils/emoji.js';
import config from './config/config.js';

// Import command handlers
import { handleFetchIssues } from './commands/issueCommands.js';
import { handleFetchProjects, handleExploreProjects } from './commands/projectCommands.js';
import { handleLocalSearchYearContains } from './commands/localSearchCommands.js';

/**
 * Main CLI interface entry point
 */
const cli = {
  /**
   * Display application header
   */
  displayHeader() {
    console.clear();
    console.log('\n' + '═'.repeat(60));
    console.log(formatWithEmoji('  REDMINE CLI  ', 'issue'));
    console.log('═'.repeat(60) + '\n');
  },

  /**
   * Display the main menu and handle user selection
   */
  async mainMenu() {
    const fileName = 'src/cli.js';
    const functionName = 'mainMenu';
    
    try {
      this.displayHeader();

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: formatWithEmoji('What would you like to do?', 'help'),
          pageSize: 10,
          choices: [
            {
              name: formatWithEmoji('Fetch Issues', 'issue'),
              value: 'fetchIssues',
            },
            {
              name: formatWithEmoji('Fetch Projects', 'project'),
              value: 'fetchProjects',
            },
            {
              name: formatWithEmoji('Explore Projects Hierarchy', 'project'),
              value: 'exploreProjects',
            },
            {
              name: formatWithEmoji('Local search - Year - Contains', 'search'),
              value: 'localSearchYearContains',
            },
            new inquirer.Separator('─'.repeat(40)),
            {
              name: formatWithEmoji('Settings', 'settings'),
              value: 'settings',
            },
            {
              name: formatWithEmoji('Exit', 'exit'),
              value: 'exit',
            },
          ],
        },
      ]);

      // Process user selection
      switch (action) {
        case 'fetchIssues':
          logger.info(`${fileName} ${functionName} User selected to fetch issues`);
          await handleFetchIssues();
          break;
          
        case 'fetchProjects':
          logger.info(`${fileName} ${functionName} User selected to fetch projects`);
          await handleFetchProjects();
          break;
        
        case 'exploreProjects':
          logger.info(`${fileName} ${functionName} User selected to explore projects hierarchy`);
          await handleExploreProjects();
          break;

        case 'localSearchYearContains':
          logger.info(`${fileName} ${functionName} User selected local search by year and content`);
          await handleLocalSearchYearContains();
          break;
          
        case 'settings':
          logger.info(`${fileName} ${functionName} User selected settings`);
          await this.settingsMenu();
          break;
          
        case 'exit':
          logger.info(`${fileName} ${functionName} User selected to exit`);
          console.log(formatWithEmoji('\nThank you for using Redmine CLI. Goodbye!', 'exit'));
          process.exit(0);
          break;
          
        default:
          logger.warn(`${fileName} ${functionName} Invalid action selected: ${action}`);
          console.log(formatWithEmoji('Invalid option selected.', 'warning'));
      }
      
      // Return to main menu after command completes
      if (action !== 'exit') {
        await this.promptContinue();
        await this.mainMenu();
      }
    } catch (error) {
      handleError(error, 'MainMenu');
      await this.promptContinue();
      await this.mainMenu();
    }
  },

  /**
   * Display the settings menu
   */
  async settingsMenu() {
    const fileName = 'src/cli.js';
    const functionName = 'settingsMenu';
    
    try {
      this.displayHeader();
      console.log(formatWithEmoji('Settings', 'settings') + '\n');

      const { setting } = await inquirer.prompt([
        {
          type: 'list',
          name: 'setting',
          message: 'Select a setting to modify:',
          choices: [
            {
              name: formatWithEmoji(`Emoji: ${config.ui.enableEmoji ? 'Enabled' : 'Disabled'}`, 'settings'),
              value: 'toggleEmoji',
            },
            {
              name: formatWithEmoji(`Items per page: ${config.ui.itemsPerPage}`, 'settings'),
              value: 'itemsPerPage',
            },
            {
              name: formatWithEmoji('Back to main menu', 'back'),
              value: 'back',
            },
          ],
        },
      ]);

      switch (setting) {
        case 'toggleEmoji':
          // Toggle emoji setting
          config.ui.enableEmoji = !config.ui.enableEmoji;
          logger.info(`${fileName} ${functionName} Emoji ${config.ui.enableEmoji ? 'enabled' : 'disabled'}`);
          console.log(`Emoji ${config.ui.enableEmoji ? 'enabled' : 'disabled'}.`);
          await this.settingsMenu(); // Return to settings menu
          break;
          
        case 'itemsPerPage':
          // Prompt for items per page
          const { itemsPerPage } = await inquirer.prompt([
            {
              type: 'number',
              name: 'itemsPerPage',
              message: 'Enter number of items to display per page:',
              default: config.ui.itemsPerPage,
              validate: (value) => {
                if (value < 1 || value > 100) {
                  return 'Please enter a number between 1 and 100.';
                }
                return true;
              },
            },
          ]);
          
          config.ui.itemsPerPage = itemsPerPage;
          logger.info(`${fileName} ${functionName} Items per page set to ${itemsPerPage}`);
          console.log(`Items per page set to ${itemsPerPage}.`);
          await this.settingsMenu(); // Return to settings menu
          break;
          
        case 'back':
        default:
          // Return to main menu
          return;
      }
    } catch (error) {
      handleError(error, 'SettingsMenu');
      await this.promptContinue();
    }
  },

  /**
   * Prompt user to continue
   */
  async promptContinue() {
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: formatWithEmoji('Press Enter to continue...', 'info'),
      },
    ]);
  },

  /**
   * Bootstrap the application
   */
  async bootstrap() {
    const fileName = 'src/cli.js';
    const functionName = 'bootstrap';
    
    try {
      // Validate configuration
      const validation = config.validate();
      
      if (!validation.isValid) {
        console.error(formatWithEmoji('Configuration error:', 'error'));
        validation.errors.forEach(error => {
          console.error(`- ${error}`);
        });
        console.log('\nPlease create a .env file by copying .env.example and fill in your details.\n');
        process.exit(1);
      }
      
      logger.info(`${fileName} ${functionName} Starting Redmine CLI`);
      await this.mainMenu();
    } catch (error) {
      handleError(error, 'Bootstrap');
      process.exit(1);
    }
  },
};

// Start the CLI
cli.bootstrap();

