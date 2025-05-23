import axios from 'axios';
import https from 'https';
import { constants } from 'crypto';
import { handleError } from '../utils/errorHandler.js';
import { logger } from '../utils/logger.js';
import config from '../config/config.js';

/**
 * Get configured Axios client for Redmine API requests
 * @returns {Object} Axios client instance
 */
const getApiClient = () => {
  const fileName = 'src/services/redmineService.js';
  const functionName = 'getApiClient';
  const tryDescription = 'creating API client';
  
  const apiKey = config.api.key;
  const host = config.api.host;

  if (!apiKey || !host) {
    logger.error(`${fileName} ${functionName} ${tryDescription}`, {
      message: 'REDMINE_API_KEY or REDMINE_HOST is not defined in .env file.'
    });
    throw new Error('API key or host not configured.');
  }

  const baseURL = `https://${host}`;

  // Create a custom HTTPS agent with legacy server connect option
  const httpsAgent = new https.Agent({
    // Enable legacy renegotiation required by the server (based on ssl.md)
    secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
    // Allow self-signed certificates if configured (not recommended for production)
    rejectUnauthorized: config.ssl.rejectUnauthorized !== false,
  });

  const apiClient = axios.create({
    baseURL,
    headers: {
      'X-Redmine-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    httpsAgent: httpsAgent,
  });

  // Request interceptor for logging
  apiClient.interceptors.request.use(request => {
    logger.debug(`${fileName} ${functionName} Starting Request: ${request.method?.toUpperCase()} ${request.url}`, { data: request.data });
    return request;
  }, error => {
    logger.error(`${fileName} ${functionName} Request Error Setup`, { message: error.message, stack: error.stack });
    return Promise.reject(error);
  });

  // Response interceptor for logging
  apiClient.interceptors.response.use(response => {
    logger.debug(`${fileName} ${functionName} Response: ${response.config.method?.toUpperCase()} ${response.config.url} - Status ${response.status}`);
    return response;
  }, error => {
    const logPayload = {
      message: error.message,
      stack: error.stack,
      config: {
        method: error.config?.method,
        url: error.config?.url,
        headers: error.config?.headers,
        data: error.config?.data,
      }
    };
    
    if (error.response) {
      logPayload.axiosResponse = {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data
      };
    }
    
    logger.error(`${fileName} ${functionName} API Response Error`, logPayload);
    return Promise.reject(error);
  });

  return apiClient;
};

/**
 * Fetch issues from Redmine API
 * @param {Object} options - Query options
 * @param {string} options.status - Filter by status ID
 * @param {string} options.priority - Filter by priority ID
 * @param {string} options.assignedTo - Filter by assignee ID
 * @param {number} options.limit - Limit the number of results
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<Array>} Array of issues
 */
/**
 * Fetch users from Redmine API based on a search query
 * @param {string} nameQuery - The name, login, firstname, or lastname to search for.
 * @returns {Promise<Array>} Array of user objects
 */
export const fetchUsers = async (nameQuery) => {
  const fileName = 'src/services/redmineService.js';
  const functionName = 'fetchUsers';
  const tryDescription = `fetching users matching "${nameQuery}"`;

  if (!nameQuery || nameQuery.trim() === '') {
    logger.error(`${fileName} ${functionName} ${tryDescription}`, {
      message: 'User search query cannot be empty.'
    });
    return null;
  }

  const client = getApiClient();
  // status=all to include locked users as well, adjust if only active users are needed
  const targetEndpoint = `/users.json?status=all&name=${encodeURIComponent(nameQuery)}`;

  logger.info(`${fileName} ${functionName} ${tryDescription} from ${targetEndpoint}`);

  try {
    const response = await client.get(targetEndpoint);
    if (response.data && Array.isArray(response.data.users)) {
      logger.debug(`${fileName} ${functionName} Successfully fetched ${response.data.users.length} users`);
      return response.data.users;
    } else {
      logger.error(`${fileName} ${functionName} Unexpected response structure`, { responseData: response.data });
      return [];
    }
  } catch (error) {
    logger.error(`${fileName} ${functionName} ${tryDescription}`, {message: error.message, stack: error.stack});
    handleError(error, 'fetchUsers');
    return null;
  }
};

export const fetchIssues = async (options = {}) => {
  const fileName = 'src/services/redmineService.js';
  const functionName = 'fetchIssues';
  const tryDescription = 'fetching issues';
  
  const client = getApiClient();
  let targetEndpoint = config.api.defaultEndpoint || '/issues.json';
  
  // Add query parameters for filtering if provided
  const queryParams = new URLSearchParams();
  
  // Standard filters
  if (options.status_id) queryParams.append('status_id', options.status_id);
  if (options.priority_id) queryParams.append('priority_id', options.priority_id);
  if (options.assigned_to_id) queryParams.append('assigned_to_id', options.assigned_to_id);
  if (options.author_id) queryParams.append('author_id', options.author_id);
  if (options.project_id) queryParams.append('project_id', options.project_id);
  if (options.limit) queryParams.append('limit', options.limit);
  if (options.offset) queryParams.append('offset', options.offset);

  // For text search in subject and description
  // Example: options.text_search_fields = { subject: 'keyword', description: 'another keyword' }
  if (options.text_search_fields) {
    Object.entries(options.text_search_fields).forEach(([field, value]) => {
      if (value) {
        queryParams.append(`f[]`, field);
        queryParams.append(`op[${field}]`, '~'); // '~' means 'contains'
        queryParams.append(`v[${field}][]`, value);
      }
    });
  }

  // To include journals (comments/history)
  if (options.include_journals) {
    queryParams.append('include', 'journals');
  }
  
  // Add query parameters to endpoint if any were provided
  const queryString = queryParams.toString();
  if (queryString) {
    targetEndpoint += `?${queryString}`;
  }
  
  logger.info(`${fileName} ${functionName} ${tryDescription} from ${targetEndpoint}`);
  
  try {
    const response = await client.get(targetEndpoint);
    
    // Handle different response structures
    if (response.data && Array.isArray(response.data.issues)) {
      logger.debug(`${fileName} ${functionName} Successfully fetched ${response.data.issues.length} issues`, { 
        total_count: response.data.total_count,
        offset: response.data.offset,
        limit: response.data.limit
      });
      return response.data.issues;
    } else if (response.data && Array.isArray(response.data)) {
      logger.warn(`${fileName} ${functionName} Response data is a direct array which is unusual for Redmine API`);
      return response.data;
    } else {
      logger.error(`${fileName} ${functionName} Unexpected response structure`, { responseData: response.data });
      return [];
    }
  } catch (error) {
    handleError(error, 'fetchIssues');
    return null;
  }
};

/**
 * Fetch projects from Redmine API
 * @param {Object} options - Query options
 * @param {number} options.limit - Limit the number of results
 * @param {number} options.offset - Offset for pagination
 * @returns {Promise<Array>} Array of projects
 */
export const fetchProjects = async (options = {}) => {
  const fileName = 'src/services/redmineService.js';
  const functionName = 'fetchProjects';
  const tryDescription = 'fetching projects';
  
  const client = getApiClient();
  let targetEndpoint = '/projects.json';
  
  // Add query parameters for filtering if provided
  const queryParams = new URLSearchParams();
  
  if (options.limit) queryParams.append('limit', options.limit);
  if (options.offset) queryParams.append('offset', options.offset);
  
  // Add query parameters to endpoint if any were provided
  const queryString = queryParams.toString();
  if (queryString) {
    targetEndpoint += `?${queryString}`;
  }
  
  logger.info(`${fileName} ${functionName} ${tryDescription} from ${targetEndpoint}`);
  
  try {
    const response = await client.get(targetEndpoint);
    
    // Handle different response structures (Redmine API typically returns {projects: [...]})
    if (response.data && Array.isArray(response.data.projects)) {
      logger.debug(`${fileName} ${functionName} Successfully fetched ${response.data.projects.length} projects`, { 
        total_count: response.data.total_count,
        offset: response.data.offset,
        limit: response.data.limit
      });
      return response.data.projects;
    } else if (response.data && Array.isArray(response.data)) {
      logger.warn(`${fileName} ${functionName} Response data is a direct array which is unusual for Redmine API`);
      return response.data;
    } else {
      logger.error(`${fileName} ${functionName} Unexpected response structure`, { responseData: response.data });
      return [];
    }
  } catch (error) {
    handleError(error, 'fetchProjects');
    return null;
  }
};

/**
 * Fetch a single issue by ID
 * @param {number} issueId - ID of the issue to fetch
 * @returns {Promise<Object>} Issue object
 */
export const fetchIssueById = async (issueId) => {
  const fileName = 'src/services/redmineService.js';
  const functionName = 'fetchIssueById';
  const tryDescription = `fetching issue #${issueId}`;
  
  if (!issueId) {
    logger.error(`${fileName} ${functionName} ${tryDescription}`, {
      message: 'Issue ID is required'
    });
    return null;
  }
  
  const client = getApiClient();
  const targetEndpoint = `/issues/${issueId}.json`;
  
  logger.info(`${fileName} ${functionName} ${tryDescription} from ${targetEndpoint}`);
  
  try {
    const response = await client.get(targetEndpoint);
    
    if (response.data && response.data.issue) {
      logger.debug(`${fileName} ${functionName} Successfully fetched issue #${issueId}`);
      return response.data.issue;
    } else {
      logger.error(`${fileName} ${functionName} Unexpected response structure`, { responseData: response.data });
      return null;
    }
  } catch (error) {
    handleError(error, `fetchIssueById #${issueId}`);
    return null;
  }
};

/**
 * Fetch statuses from Redmine API
 * @returns {Promise<Array>} Array of statuses
 */
export const fetchStatuses = async () => {
  const fileName = 'src/services/redmineService.js';
  const functionName = 'fetchStatuses';
  const tryDescription = 'fetching issue statuses';
  
  const client = getApiClient();
  const targetEndpoint = '/issue_statuses.json';
  
  logger.info(`${fileName} ${functionName} ${tryDescription} from ${targetEndpoint}`);
  
  try {
    const response = await client.get(targetEndpoint);
    
    if (response.data && Array.isArray(response.data.issue_statuses)) {
      logger.debug(`${fileName} ${functionName} Successfully fetched ${response.data.issue_statuses.length} statuses`);
      return response.data.issue_statuses;
    } else {
      logger.error(`${fileName} ${functionName} Unexpected response structure`, { responseData: response.data });
      return [];
    }
  } catch (error) {
    handleError(error, 'fetchStatuses');
    return null;
  }
};

/**
 * Fetch a project and its children
 * @param {number} projectId - ID of the project to fetch
 * @returns {Promise<Object>} Project object with children
 */
export const fetchProjectWithChildren = async (projectId) => {
  const fileName = 'src/services/redmineService.js';
  const functionName = 'fetchProjectWithChildren';
  const tryDescription = `fetching project #${projectId} with children`;
  
  if (!projectId) {
    logger.error(`${fileName} ${functionName} ${tryDescription}`, {
      message: 'Project ID is required'
    });
    return null;
  }
  
  const client = getApiClient();
  
  // Make sure to explicitly include children with max depth
  // The include=children parameter ensures subprojects are included in the response
  const targetEndpoint = `/projects/${projectId}.json?include=children`;
  
  logger.info(`${fileName} ${functionName} ${tryDescription} from ${targetEndpoint}`);
  
  try {
    const response = await client.get(targetEndpoint);
    
    if (response.data && response.data.project) {
      logger.debug(`${fileName} ${functionName} Successfully fetched project #${projectId} with children`);
      
      // If no children are returned in the response but we believe they might exist,
      // we'll try a fallback approach by searching for projects with this as parent
      if (!response.data.project.children || response.data.project.children.length === 0) {
        logger.debug(`${fileName} ${functionName} No children found in response, attempting fallback lookup`);
        
        try {
          // Try to fetch all projects that might be children
          const allProjects = await fetchProjects();
          
          // Look for projects that seem to be subprojects of the current project
          // This is a heuristic approach as direct parent-child relationships might not be exposed via API
          const possibleChildren = allProjects.filter(p => {
            // Look for projects with parent reference that matches our project ID
            if (p.parent && p.parent.id === parseInt(projectId)) {
              return true;
            }
            
            // Check if the project name/identifier suggests it's a child (contains the parent name)
            const projectName = response.data.project.name.toLowerCase();
            return p.name.toLowerCase().includes(projectName) || 
                   (p.identifier && p.identifier.toLowerCase().includes(projectName));
          });
          
          if (possibleChildren.length > 0) {
            logger.info(`${fileName} ${functionName} Found ${possibleChildren.length} possible children using fallback lookup`);
            response.data.project.children = possibleChildren;
            response.data.project.has_children = true;
          }
        } catch (fallbackError) {
          logger.error(`${fileName} ${functionName} Error in fallback lookup`, {message: fallbackError.message});
          // Continue with the original response if fallback fails
        }
      }
      
      return response.data.project;
    } else {
      logger.error(`${fileName} ${functionName} Unexpected response structure`, { responseData: response.data });
      return null;
    }
  } catch (error) {
    logger.error(`${fileName} ${functionName} ${tryDescription}`, {message: error.message, stack: error.stack});
    handleError(error, `fetchProjectWithChildren #${projectId}`);
    return null;
  }
};

/**
 * Fetch all issues that match the given criteria, handling pagination
 * @param {Object} options - Query options to pass to fetchIssues
 * @param {Function} onBatchFetched - Optional callback that receives each batch of issues. If it returns false, fetching will stop.
 * @returns {Promise<Array>} Array of all issues matching criteria
 */
export const fetchAllIssuesWithCriteria = async (options = {}, onBatchFetched = null) => {
  const fileName = 'src/services/redmineService.js';
  const functionName = 'fetchAllIssuesWithCriteria';
  const tryDescription = `fetching all issues with criteria`;
  
  logger.info(`${fileName} ${functionName} ${tryDescription}`, { data: options });
  
  const allIssues = [];
  let offset = 0;
  const limit = config.api.defaultLimit || 100; // Use configured limit or default to 100
  let hasMoreIssues = true;
  let shouldContinue = true;
  
  try {
    while (hasMoreIssues && shouldContinue) {
      // Merge pagination parameters with the provided options
      const paginatedOptions = {
        ...options,
        limit,
        offset
      };
      
      logger.debug(`${fileName} ${functionName} Fetching batch with offset ${offset}`, { paginatedOptions });
      const issues = await fetchIssues(paginatedOptions);
      
      if (!issues || issues.length === 0) {
        hasMoreIssues = false;
      } else {
        allIssues.push(...issues);
        offset += issues.length;
        
        // If we got fewer issues than the limit, we've reached the end
        if (issues.length < limit) {
          hasMoreIssues = false;
        }
        
        // Call the callback with the batch of issues if provided
        if (onBatchFetched && typeof onBatchFetched === 'function') {
          // If callback returns false, stop fetching more issues
          const result = await onBatchFetched(issues, offset, hasMoreIssues);
          if (result === false) {
            shouldContinue = false;
            logger.info(`${fileName} ${functionName} Stopped fetching due to callback result`);
          }
        }
      }
    }
    
    logger.info(`${fileName} ${functionName} Successfully fetched ${allIssues.length} total issues`);
    return allIssues;
  } catch (error) {
    logger.error(`${fileName} ${functionName} ${tryDescription}`, {message: error.message, stack: error.stack, axiosResponse: error.isAxiosError ? error.response?.data : undefined});
    handleError(error, functionName);
    return [];
  }
};

export default {
  fetchIssues,
  fetchProjects,
  fetchIssueById,
  fetchStatuses,
  fetchProjectWithChildren,
  fetchUsers,
  fetchAllIssuesWithCriteria
};
