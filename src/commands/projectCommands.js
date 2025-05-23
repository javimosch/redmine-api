import inquirer from 'inquirer';
import { fetchProjects, fetchProjectWithChildren } from '../services/redmineService.js';
import { logger } from '../utils/logger.js';
import { formatWithEmoji } from '../utils/emoji.js';

/**
 * Module for handling project-related commands
 */

/**
 * Handle the fetch projects command
 * Fetches projects from the Redmine API and displays them to the user
 */
export const handleFetchProjects = async () => {
  const fileName = 'src/commands/projectCommands.js';
  const functionName = 'handleFetchProjects';
  
  logger.info(`${fileName} ${functionName} Starting to fetch projects...`);
  console.log(formatWithEmoji('Fetching projects from Redmine...', 'fetch'));
  
  try {
    const projects = await fetchProjects();
    
    if (!projects || projects.length === 0) {
      console.log(formatWithEmoji('No projects found.', 'info'));
      return null;
    }
    
    logger.info(`${fileName} ${functionName} Successfully fetched ${projects.length} projects.`, { projectCount: projects.length });
    console.log(formatWithEmoji(`Found ${projects.length} projects.`, 'success'));
    
    // Display the list of projects
    console.log('\n' + formatWithEmoji('Projects:', 'project'));
    console.log('─'.repeat(50));
    
    projects.forEach((project, index) => {
      console.log(`${formatWithEmoji('', 'project')} ID: ${project.id}`);
      console.log(`   Name: ${project.name}`);
      if (project.description) {
        console.log(`   Description: ${project.description.substring(0, 100)}${project.description.length > 100 ? '...' : ''}`);
      }
      console.log('─'.repeat(50));
    });
    
    return projects;
  } catch (error) {
    logger.error(`${fileName} ${functionName} Error fetching projects`, { message: error.message, stack: error.stack });
    console.error(formatWithEmoji('Failed to fetch projects.', 'error'));
    return null;
  }
};

/**
 * Handle exploring the project hierarchy
 * Allows navigating through projects and their subprojects
 */
export const handleExploreProjects = async () => {
  const fileName = 'src/commands/projectCommands.js';
  const functionName = 'handleExploreProjects';
  
  logger.info(`${fileName} ${functionName} Starting project exploration`);
  console.log(formatWithEmoji('Fetching top-level projects from Redmine...', 'fetch'));
  
  try {
    // Start with top-level projects
    const projects = await fetchProjects();
    
    if (!projects || projects.length === 0) {
      console.log(formatWithEmoji('No projects found.', 'info'));
      return null;
    }
    
    logger.info(`${fileName} ${functionName} Successfully fetched ${projects.length} top-level projects`);
    
    // Begin exploration from the top level
    await exploreProjectLevel(projects);
    
    return true;
  } catch (error) {
    logger.error(`${fileName} ${functionName} Error exploring projects`, { message: error.message, stack: error.stack });
    console.error(formatWithEmoji('Failed to explore projects.', 'error'));
    return null;
  }
};

/**
 * Explore a specific level in the project hierarchy
 * @param {Array} projects - Array of projects at the current level
 * @param {string} [parentPath=''] - Path of parent projects (for display)
 */
const exploreProjectLevel = async (projects, parentPath = '') => {
  const fileName = 'src/commands/projectCommands.js';
  const functionName = 'exploreProjectLevel';
  
  if (!projects || projects.length === 0) {
    console.log(formatWithEmoji('No projects found at this level.', 'info'));
    return;
  }
  
  // Create choices for the project selection menu
  const projectChoices = projects.map(project => ({
    name: `${formatWithEmoji('', 'project')} ${project.name} (ID: ${project.id})${project.has_children ? ' 📁' : ''}`,
    value: project.id,
    short: project.name,
    hasChildren: project.has_children || false
  }));
  
  // Add a back option if we're not at the top level
  if (parentPath) {
    projectChoices.push({
      name: formatWithEmoji('⬅️ Back to parent level', 'back'),
      value: 'back'
    });
  }
  
  // Add an exit option
  projectChoices.push({
    name: formatWithEmoji('Exit exploration', 'exit'),
    value: 'exit'
  });
  
  // Display the current path if we're in a nested level
  if (parentPath) {
    console.log(formatWithEmoji(`Current path: ${parentPath}`, 'info'));
  }
  
  // Display the project selection menu
  console.log(formatWithEmoji('\nSelect a project to explore:', 'help'));
  
  const { projectId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'projectId',
      message: 'Choose a project:',
      pageSize: 15,
      choices: projectChoices
    }
  ]);
  
  // Handle selection
  if (projectId === 'back') {
    return; // Go back to the previous level
  } else if (projectId === 'exit') {
    return 'exit'; // Exit exploration
  }
  
  // Find the selected project
  const selectedProject = projects.find(p => p.id === projectId);
  if (!selectedProject) {
    logger.error(`${fileName} ${functionName} Selected project not found in list`, { projectId });
    console.error(formatWithEmoji('Error: Selected project not found.', 'error'));
    return;
  }
  
  // Show project details
  await displayProjectDetails(selectedProject);
  
  // Always attempt to fetch subprojects, regardless of has_children flag
  // This is because sometimes the API reports has_children as false when projects actually have subprojects
  const newPath = parentPath 
    ? `${parentPath} > ${selectedProject.name}` 
    : selectedProject.name;
  
  console.log(formatWithEmoji(`Fetching subprojects of "${selectedProject.name}"...`, 'fetch'));
  
  try {
    // Fetch the project with its children
    const projectWithChildren = await fetchProjectWithChildren(projectId);
    
    if (projectWithChildren && projectWithChildren.children && projectWithChildren.children.length > 0) {
      logger.info(`${fileName} ${functionName} Found ${projectWithChildren.children.length} subprojects for project #${projectId}`);
      console.log(formatWithEmoji(`Found ${projectWithChildren.children.length} subprojects for "${selectedProject.name}"`, 'success'));
      
      // Explore the children
      const result = await exploreProjectLevel(projectWithChildren.children, newPath);
      if (result === 'exit') {
        return 'exit'; // Propagate the exit command up
      }
    } else {
      logger.info(`${fileName} ${functionName} No subprojects found for project #${projectId}`);
      console.log(formatWithEmoji(`No subprojects found for "${selectedProject.name}"`, 'info'));
      
      // Additional check for possible hidden subprojects
      console.log(formatWithEmoji("Note: If you believe this project has subprojects that aren't showing, it might be due to API visibility settings.", 'info'));
      
      await inquirer.prompt([{
        type: 'input',
        name: 'continue',
        message: formatWithEmoji('Press Enter to continue...', 'info')
      }]);
    }
  } catch (error) {
    logger.error(`${fileName} ${functionName} Error fetching subprojects`, { projectId, error: error.message });
    console.error(formatWithEmoji(`Failed to fetch subprojects: ${error.message}`, 'error'));
  }
  
  // After exploring subprojects, return to this level
  return await exploreProjectLevel(projects, parentPath);
};

/**
 * Display detailed information about a project
 * @param {Object} project - The project to display
 */
const displayProjectDetails = async (project) => {
  console.clear();
  console.log('\n' + formatWithEmoji(`Project Details: ${project.name}`, 'project'));
  console.log('═'.repeat(60));
  
  console.log(formatWithEmoji(`ID: ${project.id}`, 'info'));
  console.log(formatWithEmoji(`Name: ${project.name}`, 'info'));
  
  if (project.identifier) {
    console.log(formatWithEmoji(`Identifier: ${project.identifier}`, 'info'));
  }
  
  if (project.description) {
    console.log(formatWithEmoji('Description:', 'info'));
    // Simple HTML to text conversion
    console.log(project.description.replace(/<\/?[^>]+(>|$)/g, ''));
  }
  
  if (project.status !== undefined) {
    const statusMap = {
      1: 'Active',
      5: 'Archived',
      9: 'Closed'
    };
    console.log(formatWithEmoji(`Status: ${statusMap[project.status] || project.status}`, 'info'));
  }
  
  if (project.created_on) {
    console.log(formatWithEmoji(`Created on: ${new Date(project.created_on).toLocaleString()}`, 'info'));
  }
  
  if (project.updated_on) {
    console.log(formatWithEmoji(`Last updated: ${new Date(project.updated_on).toLocaleString()}`, 'info'));
  }
  
  console.log(formatWithEmoji(`Has subprojects: ${project.has_children ? 'Yes' : 'No'}`, 'info'));
  
  console.log('═'.repeat(60));
  console.log(formatWithEmoji('Press Enter to continue or explore subprojects...', 'info'));
  
  await inquirer.prompt([{
    type: 'input',
    name: 'continue',
    message: ''
  }]);
};

export default {
  handleFetchProjects,
  handleExploreProjects
};
