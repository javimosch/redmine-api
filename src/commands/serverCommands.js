import inquirer from 'inquirer';
import { spawn } from 'child_process';
import path from 'path';
import { logger } from '../utils/logger.js';
import { loadServerConfig, saveServerConfig } from '../utils/serverConfig.js';
import { formatWithEmoji } from '../utils/emoji.js';
import fs from 'fs-extra'; // For ensureFile and readJson/writeJson
import expandTilde from 'expand-tilde'; // To resolve tilde path for config file

let serverProcess = null;
const CONFIG_DIR = expandTilde('~/.redmine-api');
const CONFIG_FILE_PATH = path.join(CONFIG_DIR, 'config.json');

/**
 * Prompts the user for Redmine API key and host if not already configured.
 * Saves the configuration.
 * @returns {Promise<Object>} The server configuration.
 */
const getServerConfig = async () => {
  const fileName = 'src/commands/serverCommands.js';
  const functionName = 'getServerConfig';
  let config = await loadServerConfig();

  const questions = [];
  if (!config.REDMINE_API_KEY) {
    questions.push({
      type: 'password',
      name: 'REDMINE_API_KEY',
      message: 'Enter your Redmine API Key:',
      mask: '*',
    });
  }
  if (!config.REDMINE_HOST) {
    questions.push({
      type: 'input',
      name: 'REDMINE_HOST',
      message: 'Enter your Redmine Host (e.g., my.redmine.org):',
    });
  }

  if (questions.length > 0) {
    logger.info(`${fileName} ${functionName} Prompting for server configuration.`);
    const answers = await inquirer.prompt(questions);
    config = { ...config, ...answers };
    await saveServerConfig(config);
    logger.info(`${fileName} ${functionName} Server configuration saved.`);
  } else {
    logger.info(`${fileName} ${functionName} Server configuration loaded from file.`);
  }
  return config;
};

/**
 * Handles starting the Redmine API server.
 */
export const handleStartServer = async () => {
  const fileName = 'src/commands/serverCommands.js';
  const functionName = 'handleStartServer';

  try {
    const config = await getServerConfig();

    if (!config.REDMINE_API_KEY || !config.REDMINE_HOST) {
      logger.error(`${fileName} ${functionName} API Key or Host is missing. Cannot start server.`);
      console.log(formatWithEmoji('Error: API Key or Host is missing. Please provide them to start the server.', 'error'));
      return;
    }

    const serverEnv = {
      ...process.env, // Inherit current environment variables
      ...config,
      REDMINE_API_KEY: config.REDMINE_API_KEY,
      REDMINE_HOST: config.REDMINE_HOST,
      REDMINE_DEFAULT_ENDPOINT: '/issues.json', // Default endpoint
      // Ensure MONGO_URI is not set to force SQLite if user wants to run server standalone via CLI
      // Or, we could prompt for MONGO_URI as well if it's desired for this mode.
      // For now, let's assume SQLite for CLI-spawned server if MONGO_URI isn't in the main .env
      MONGO_URI: process.env.MONGO_URI || '' 
    };

    const serverPath = path.resolve(process.cwd(), 'src/server.js');
    logger.info(`${fileName} ${functionName} Starting server...`, { data: { path: serverPath } });
    console.log(formatWithEmoji('Starting Redmine API server...', 'rocket'));

    serverProcess = spawn('node', [serverPath], { env: serverEnv, stdio: 'inherit' });

    serverProcess.on('spawn', () => {
      logger.info(`${fileName} ${functionName} Server process spawned successfully.`);
      console.log(formatWithEmoji('Server is running. Press CTRL+C to stop.', 'info'));
    });

    serverProcess.on('error', (err) => {
      logger.error(`${fileName} ${functionName} Failed to start server process:`, { message: err.message, stack: err.stack });
      console.log(formatWithEmoji(`Error starting server: ${err.message}`, 'error'));
      serverProcess = null;
    });

    serverProcess.on('exit', (code, signal) => {
      logger.info(`${fileName} ${functionName} Server process exited.`, { data: { code, signal } });
      if (signal === 'SIGINT') {
        console.log(formatWithEmoji('\nServer stopped successfully.', 'info'));
      } else if (code !== 0 && code !== null) {
        console.log(formatWithEmoji(`Server exited with code ${code}.`, 'warning'));
      }
      serverProcess = null;
      // We might want to return to main menu or exit CLI here depending on desired flow
      // For now, it will just end.
    });

  } catch (error) {
    logger.error(`${fileName} ${functionName} Error starting server:`, { message: error.message, stack: error.stack });
    console.log(formatWithEmoji(`An error occurred: ${error.message}`, 'error'));
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  const fileName = 'src/commands/serverCommands.js';
  const functionName = 'SIGINT_HANDLER';
  if (serverProcess) {
    logger.info(`${fileName} ${functionName} SIGINT received, attempting to stop server process.`);
    serverProcess.kill('SIGINT'); 
    serverProcess = null;
  } else {
    // If serverProcess is null, it means either it wasn't started by this command
    // or it already exited. In this case, let the main CLI handler (if any) or Node itself handle exit.
    logger.info(`${fileName} ${functionName} SIGINT received, but no active server process to stop from here. Exiting CLI.`);
    process.exit(0); 
  }
});

/**
 * Opens the server configuration file in the user's preferred editor.
 */
export const handleEditServerConfig = async () => {
  const fileName = 'src/commands/serverCommands.js';
  const functionName = 'handleEditServerConfig';
  try {
    await fs.ensureFile(CONFIG_FILE_PATH);
    // Ensure the file is valid JSON or initialize if empty
    try {
      const stats = await fs.stat(CONFIG_FILE_PATH);
      if (stats.size === 0) {
        await fs.writeJson(CONFIG_FILE_PATH, {}, { spaces: 2 });
        logger.info(`${fileName} ${functionName} Initialized empty server config file.`);
      } else {
        await fs.readJson(CONFIG_FILE_PATH); // Validate existing JSON
      }
    } catch (jsonErr) {
      logger.warn(`${fileName} ${functionName} Server config file was unparseable or empty, re-initializing.`, { message: jsonErr.message, data: { path: CONFIG_FILE_PATH } });
      await fs.writeJson(CONFIG_FILE_PATH, {}, { spaces: 2 });
    }

    const editor = process.env.EDITOR || process.env.VISUAL || 'nano';
    logger.info(`${fileName} ${functionName} Opening server config file with editor.`, { data: { editor, path: CONFIG_FILE_PATH }});
    console.log(formatWithEmoji(`Opening ${CONFIG_FILE_PATH} with ${editor}...`, 'edit'));

    const editorProcess = spawn(editor, [CONFIG_FILE_PATH], { stdio: 'inherit' });

    return new Promise((resolve, reject) => {
      editorProcess.on('error', (err) => {
        logger.error(`${fileName} ${functionName} Failed to start editor:`, { message: err.message, stack: err.stack });
        console.log(formatWithEmoji(`Error opening editor '${editor}': ${err.message}`, 'error'));
        console.log(formatWithEmoji(`Please ensure '${editor}' is installed and in your PATH, or set the EDITOR/VISUAL environment variable.`, 'info'));
        reject(err); // Propagate error to stop further processing if editor fails
      });

      editorProcess.on('exit', (code) => {
        if (code === 0) {
          logger.info(`${fileName} ${functionName} Editor closed. Config may have been updated.`);
          console.log(formatWithEmoji('Editor closed. Server configuration might have been updated.', 'info'));
        } else {
          logger.warn(`${fileName} ${functionName} Editor exited with code ${code}.`);
          console.log(formatWithEmoji(`Editor exited with code ${code}.`, 'warning'));
        }
        resolve(); // Resolve to allow CLI to continue (e.g., return to menu)
      });
    });

  } catch (error) {
    logger.error(`${fileName} ${functionName} Error preparing to edit server config:`, { message: error.message, stack: error.stack });
    console.log(formatWithEmoji(`An error occurred while trying to open the editor: ${error.message}`, 'error'));
    // Don't reject, allow to return to menu or calling function to handle
  }
};

/**
 * Displays a menu for server-related actions like starting or editing configuration.
 * @returns {Promise<string>} A string indicating the outcome or next step for the CLI.
 */
export const serverActionsMenu = async () => {
  const fileName = 'src/commands/serverCommands.js';
  const functionName = 'serverActionsMenu';

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'API Server Actions:',
      choices: [
        { name: formatWithEmoji('Start API Server', 'rocket'), value: 'start' },
        { name: formatWithEmoji('Edit Server Configuration File', 'edit'), value: 'editConfig' },
        new inquirer.Separator(),
        { name: formatWithEmoji('Back to Main Menu', 'back'), value: 'back' },
      ],
    },
  ]);

  switch (action) {
    case 'start':
      logger.info(`${fileName} ${functionName} User chose to start server.`);
      await handleStartServer(); // Assumes handleStartServer manages its own errors and process lifecycle
      return 'server_action_completed'; // Indicates an action that might be long-running or terminal for this path
    case 'editConfig':
      logger.info(`${fileName} ${functionName} User chose to edit server config.`);
      await handleEditServerConfig();
      return serverActionsMenu(); // Loop back to server actions menu
    case 'back':
    default:
      logger.info(`${fileName} ${functionName} User chose to go back to main menu.`);
      return 'back_to_main';
  }
};

export default {
  handleStartServer,
  handleEditServerConfig,
  serverActionsMenu,
};
