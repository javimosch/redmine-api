import express from 'express';
import cron from 'node-cron';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';
import { logger } from './utils/logger.js';
import { fetchAndSaveAllIssuesService } from './utils/issueFetcher.js';
import { processLocalSearch } from './utils/localSearchProcessor.js';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import basicAuth from 'express-basic-auth';
import mongoose from 'mongoose';
import appConfigRoutes from './routes/appConfigRoutes.js';
import { getConfig, refreshConfig } from './utils/configLoader.js';
import apiAuthMiddleware from './middlewares/api-auth-middleware.js';

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const MONGO_URI = process.env.MONGO_URI;

app.use(express.json());

// --- Swagger Setup ---
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Redmine Data API',
      version: '1.0.0',
      description: 'API for accessing locally processed Redmine issue data',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
          description: 'API key authentication. Format: "Bearer YOUR_API_KEY"'
        }
      }
    }
  },
  apis: ['./src/server.js'], // files containing annotations as JSDoc
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// --- Swagger UI Basic Auth --- (Moved before scheduled tasks for clarity)
const SWAGGER_USER = process.env.SWAGGER_USER;
const SWAGGER_PASSWORD = process.env.SWAGGER_PASSWORD;

// Configure Swagger UI with additional options
const swaggerUiOptions = {
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true, // Keep auth data between page refreshes
  }
};

// Apply basic auth to Swagger UI if credentials are provided
if (SWAGGER_USER && SWAGGER_PASSWORD) {
  app.use('/api-docs', basicAuth({
    users: { [SWAGGER_USER]: SWAGGER_PASSWORD },
    challenge: true,
    realm: 'SwaggerAPIDocs',
  }));
  logger.info('src/server.js Swagger UI /api-docs is protected with basic authentication.');
} else {
  logger.info('src/server.js Swagger UI /api-docs is not protected (SWAGGER_USER or SWAGGER_PASSWORD not set).');
}

// Serve Swagger UI with the enhanced options
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
logger.info('src/server.js Swagger UI configured with API key authentication support');

// --- Application Routes and Middleware Order ---

// 1. App Configuration Route (uses its own basic auth defined within appConfigRoutes)
app.use('/api/app/configure', appConfigRoutes);
logger.info('src/server.js /api/app/configure route registered.');

// 2. API Key Authentication Middleware for all other /api/* routes that follow
// This middleware (from api-auth-middleware.js) will be applied to subsequent /api routes.
// It has internal skips for OPTIONS, Swagger paths (as a safeguard), etc.
app.use('/api', apiAuthMiddleware); 
logger.info('src/server.js API Key Auth Middleware registered for subsequent /api routes.');

// --- Scheduled Tasks Configuration ---
// Initial values from environment (these will be potentially overridden by DB settings later)
let localSearchCronSchedule = process.env.LOCAL_SEARCH_CRON_SCHEDULE || '0 * * * *'; // Default: every hour
let syncIssuesCronSchedule = process.env.SYNC_ISSUES_CRON_SCHEDULE || '0 */6 * * *'; // Default: every 6 hours

// Store task references so they can be rescheduled if settings change
let localSearchTask = null;
let syncIssuesTask = null;

// Function to schedule the sync task with the current schedule
const scheduleSyncTask = (schedule) => {
  const fileName = 'src/server.js';
  const functionName = 'scheduleSyncTask';
  
  logger.info(`${fileName} ${functionName} Scheduling sync issues task with schedule: ${schedule}`, { data: { schedule } });
  
  // If a task is already scheduled, destroy it first
  if (syncIssuesTask) {
    logger.info(`${fileName} ${functionName} Stopping existing sync issues task`);
    syncIssuesTask.stop();
  }
  
  // Schedule new task
  syncIssuesTask = cron.schedule(schedule, async () => {
  const cronFileName = 'src/server.js';
  const cronFunctionName = 'syncIssuesTask';
  logger.info(`${cronFileName} ${cronFunctionName} Scheduled task started: Fetching all issues from Redmine.`);

  try {
    const fetchResult = await fetchAndSaveAllIssuesService();
    if (fetchResult.error) {
      logger.error(`${cronFileName} ${cronFunctionName} Error during issue sync:`, { message: fetchResult.error });
    } else {
      logger.info(`${cronFileName} ${cronFunctionName} Issue sync completed. Fetched: ${fetchResult.fetched}, Saved: ${fetchResult.saved}`);
    }
  } catch (error) {
    logger.error(`${cronFileName} ${cronFunctionName} Unhandled error in issue sync task:`, { message: error.message, stack: error.stack });
  }
  logger.info(`${cronFileName} ${cronFunctionName} Scheduled issue sync task finished.`);
  });
  
  return syncIssuesTask;
};

// Function to schedule the local search task with the current schedule
const scheduleLocalSearchTask = (schedule) => {
  const fileName = 'src/server.js';
  const functionName = 'scheduleLocalSearchTask';
  
  logger.info(`${fileName} ${functionName} Scheduling local search task with schedule: ${schedule}`, { data: { schedule } });
  
  // If a task is already scheduled, destroy it first
  if (localSearchTask) {
    logger.info(`${fileName} ${functionName} Stopping existing local search task`);
    localSearchTask.stop();
  }
  
  // Schedule new task
  localSearchTask = cron.schedule(schedule, async () => {
  const cronFileName = 'src/server.js';
  const cronFunctionName = 'localSearchTask';
  const startYear = 2015;
  const currentYear = new Date().getFullYear();

  logger.info(`${cronFileName} ${cronFunctionName} Scheduled task started: Performing local search for years ${startYear}-${currentYear}.`);

  try {
    for (let year = startYear; year <= currentYear; year++) {
      const yearStr = year.toString();
      logger.info(`${cronFileName} ${cronFunctionName} Processing local search for year: ${yearStr}.`);
      // Query parameter is optional in processLocalSearch; not passing it means all issues for the year.
      const searchResult = await processLocalSearch(yearStr);
      if (searchResult.error) {
        logger.error(`${cronFileName} ${cronFunctionName} Error during local search for year ${yearStr}:`, { message: searchResult.error });
      } else {
        logger.info(`${cronFileName} ${cronFunctionName} Local search for year ${yearStr} completed. Copied: ${searchResult.copied}, Found: ${searchResult.found}, TargetDir: ${searchResult.targetDir}`);
      }
    }
  } catch (error) {
    logger.error(`${cronFileName} ${cronFunctionName} Unhandled error during multi-year local search task:`, { message: error.message, stack: error.stack });
  }
  logger.info(`${cronFileName} ${cronFunctionName} Scheduled local search task for years ${startYear}-${currentYear} finished.`);
  });
  
  return localSearchTask;
};

// --- API Endpoints ---

// The old generic /api wrapper has been removed and replaced by specific ordering above.

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     ApiKeyAuth:
 *       type: apiKey
 *       in: header
 *       name: Authorization
 *       description: API key authentication. Format: "Bearer YOUR_API_KEY"
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     HealthCheck:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           description: Service status
 *           example: ok
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Current server timestamp
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the current status of the API
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Issue:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The issue ID.
 *         project:
 *           type: object
 *           properties:
 *             id: integer
 *             name: string
 *         tracker:
 *           type: object
 *           properties:
 *             id: integer
 *             name: string
 *         status:
 *           type: object
 *           properties:
 *             id: integer
 *             name: string
 *         priority:
 *           type: object
 *           properties:
 *             id: integer
 *             name: string
 *         author:
 *           type: object
 *           properties:
 *             id: integer
 *             name: string
 *         assigned_to:
 *           type: object
 *           properties:
 *             id: integer
 *             name: string
 *         subject:
 *           type: string
 *         description:
 *           type: string
 *         created_on:
 *           type: string
 *           format: date-time
 *         updated_on:
 *           type: string
 *           format: date-time
 *       example:
 *         id: 43767
 *         project: { id: 572, name: 'Geored V2 - Desktop' }
 *         # ... other fields based on your example
 */

/**
 * @swagger
 * components:
 *   responses:
 *     UnauthorizedError:
 *       description: Unauthorized - API key is missing or invalid
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *                 example: "Unauthorized - Valid API key required"
 *     ServerError:
 *       description: Server error occurred while processing the request
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *                 example: "An unexpected error occurred while processing your request"
 *   parameters:
 *     pageParam:
 *       in: query
 *       name: page
 *       required: false
 *       schema:
 *         type: integer
 *         minimum: 1
 *         default: 1
 *       description: Page number for pagination (1-based index)
 *     limitParam:
 *       in: query
 *       name: limit
 *       required: false
 *       schema:
 *         type: integer
 *         minimum: 1
 *         maximum: 100
 *       description: Number of items per page (overrides the default from settings, max 100)
 *     searchQueryParam:
 *       in: query
 *       name: q
 *       required: false
 *       schema:
 *         type: string
 *       description: Optional search query to filter issues (searches across all fields)
 *   schemas:
 *     PaginationMetadata:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           description: Total number of items across all pages
 *           example: 125
 *         page:
 *           type: integer
 *           description: Current page number (1-based index)
 *           example: 1
 *         limit:
 *           type: integer
 *           description: Number of items per page
 *           example: 20
 *         pages:
 *           type: integer
 *           description: Total number of pages
 *           example: 7
 * 
 * /api/issues:
 *   get:
 *     summary: Retrieve all issues with pagination
 *     description: |
 *       Get a paginated list of all issues across all years.
 *       
 *       ### Pagination
 *       - Uses 1-based page numbering
 *       - Default page size is configured in settings (defaults to 20 if not set)
 *       - Maximum page size is 100 items
 *       
 *       ### Search
 *       - Use the `q` parameter to search across all issue fields
 *       - Search is case-insensitive
 *     tags: [Issues]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - $ref: '#/components/parameters/searchQueryParam'
 *     responses:
 *       200:
 *         description: A paginated list of issues
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Issue'
 *                   description: Array of issue objects
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMetadata'
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid page number. Must be a positive integer"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /api/issues/{year}:
 *   get:
 *     summary: Retrieve issues for a specific year, optionally filtered by a query string.
 *     tags: [Issues]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 2000
 *           maximum: 2100
 *         description: The year to get issues for (e.g., 2023)
 *         example: 2023
 *       - $ref: '#/components/parameters/pageParam'
 *       - $ref: '#/components/parameters/limitParam'
 *       - $ref: '#/components/parameters/searchQueryParam'
 *     responses:
 *       200:
 *         description: A paginated list of issues for the specified year
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Issue'
 *                   description: Array of issue objects for the specified year
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMetadata'
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid year format. Must be a 4-digit year between 2000-2100"
 *       404:
 *         description: No issues found for the specified year
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "No issues found for year 2023"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

// Paginated endpoint for all issues across all years
app.get('/api/issues', async (req, res) => {
  const fileName = 'src/server.js';
  const functionName = 'GET /api/issues';
  
  try {
    logger.info(`${fileName} ${functionName} Request received`, { data: { query: req.query } });
    
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 0;
    const searchQuery = req.query.q;
    
    // If limit is not specified in the query, get it from settings
    if (!limit) {
      const config = await getConfig();
      limit = config.itemsPerPage || 10;
      logger.debug(`${fileName} ${functionName} Using itemsPerPage from config: ${limit}`);
    }
    
    // Ensure limit is within reasonable bounds
    limit = Math.min(Math.max(limit, 1), 100);
    
    // Calculate skip value for pagination
    const skip = (page - 1) * limit;
    
    // Get all years from the data directory
    let allYears = [];
    try {
      const dirContents = await fs.readdir(DATA_DIR);
      allYears = dirContents
        .filter(item => /^\d{4}$/.test(item)) // Only include directories named as years (YYYY)
        .sort((a, b) => b.localeCompare(a)); // Sort years in descending order
      
      logger.info(`${fileName} ${functionName} Found ${allYears.length} year directories`, { data: { years: allYears } });
    } catch (dirError) {
      logger.error(`${fileName} ${functionName} Error reading data directory`, 
        { message: dirError.message, stack: dirError.stack });
      return res.status(500).json({ error: 'Failed to read issue data' });
    }
    
    // Collect issues from all years
    let allIssues = [];
    
    for (const year of allYears) {
      const yearDir = path.join(DATA_DIR, year);
      try {
        const files = await fs.readdir(yearDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const filePath = path.join(yearDir, file);
              const fileContent = await fs.readFile(filePath, 'utf8');
              const issueData = JSON.parse(fileContent);
              
              // Add year information to help with filtering/sorting
              issueData._year = year;
              allIssues.push(issueData);
            } catch (fileError) {
              logger.warn(`${fileName} ${functionName} Error reading issue file ${year}/${file}`, 
                { message: fileError.message, stack: fileError.stack });
              // Continue with other files
            }
          }
        }
      } catch (yearError) {
        logger.warn(`${fileName} ${functionName} Error reading year directory ${year}`, 
          { message: yearError.message, stack: yearError.stack });
        // Continue with other years
      }
    }
    
    // Sort issues by updated_on date (newest first)
    allIssues.sort((a, b) => {
      const dateA = new Date(a.updated_on || a.created_on || 0);
      const dateB = new Date(b.updated_on || b.created_on || 0);
      return dateB - dateA;
    });
    
    // Apply search filter if query parameter is provided
    let filteredIssues = allIssues;
    if (searchQuery) {
      logger.info(`${fileName} ${functionName} Filtering ${allIssues.length} issues with query: '${searchQuery}'`);
      filteredIssues = allIssues.filter(issue => {
        // Perform a case-insensitive search on the stringified JSON content
        const issueStr = JSON.stringify(issue).toLowerCase();
        return issueStr.includes(searchQuery.toLowerCase());
      });
      logger.info(`${fileName} ${functionName} Found ${filteredIssues.length} issues after filtering`);
    }
    
    // Calculate pagination values
    const total = filteredIssues.length;
    const pages = Math.ceil(total / limit);
    
    // Apply pagination
    const paginatedIssues = filteredIssues.slice(skip, skip + limit);
    
    logger.info(`${fileName} ${functionName} Returning paginated issues`, 
      { data: { page, limit, total, count: paginatedIssues.length } });
    
    // Return paginated results
    res.json({
      data: paginatedIssues,
      pagination: {
        total,
        page,
        limit,
        pages
      }
    });
  } catch (error) {
    logger.error(`${fileName} ${functionName} Error retrieving issues`, 
      { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to retrieve issues' });
  }
});

// Endpoint for issues from a specific year
app.get('/api/issues/:year', async (req, res) => {
  const apiFileName = 'src/server.js';
  const apiFunctionName = '/api/issues/:year';
  const { year } = req.params;
  const { q: query } = req.query; // Get optional query string 'q'
  logger.info(`${apiFileName} ${apiFunctionName} Request received`, { data: { year, query } });

  if (!year || !/^\d{4}$/.test(year)) {
    logger.warn(`${apiFileName} ${apiFunctionName} Invalid year format provided: ${year}`);
    return res.status(400).json({ error: 'Invalid year format. Please use YYYY.' });
  }

  const yearDir = path.join(DATA_DIR, year);

  try {
    if (!await fs.pathExists(yearDir)) {
      logger.info(`${apiFileName} ${apiFunctionName} Directory not found for year: ${yearDir}`);
      return res.status(404).json({ error: `No data found for year ${year}.` });
    }

    const files = await fs.readdir(yearDir);
    const issues = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(yearDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          issues.push(JSON.parse(content));
        } catch (parseError) {
          logger.error(`${apiFileName} ${apiFunctionName} Error parsing JSON file: ${filePath}`, { message: parseError.message, stack: parseError.stack });
          // Optionally skip corrupted files or return an error
        }
      }
    }
    let filteredIssues = issues;
    if (query) {
      logger.info(`${apiFileName} ${apiFunctionName} Filtering ${issues.length} issues with query: '${query}'`);
      filteredIssues = issues.filter(issue => {
        // Perform a case-insensitive search on the stringified JSON content
        // This is a broad search. For more specific field searches, this logic would need to be more complex.
        try {
          return JSON.stringify(issue).toLowerCase().includes(query.toLowerCase());
        } catch (stringifyError) {
          logger.error(`${apiFileName} ${apiFunctionName} Error stringifying issue for filtering`, { message: stringifyError.message, issueId: issue.id });
          return false;
        }
      });
      logger.info(`${apiFileName} ${apiFunctionName} Found ${filteredIssues.length} issues after filtering.`);
    } else {
      logger.info(`${apiFileName} ${apiFunctionName} No query provided, returning all ${issues.length} issues for year ${year}`);
    }
    res.json(filteredIssues);

  } catch (error) {
    logger.error(`${apiFileName} ${apiFunctionName} Error processing request for year ${year}`, { message: error.message, stack: error.stack });
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// Serve static files from 'public' directory (for admin page)
// Serve static files from 'public' directory (for admin page, etc.)
app.use(express.static('public'));
logger.info('src/server.js Static file serving from public directory enabled.');

// Note: appConfigRoutes is now registered earlier, before the generic API key auth.

// --- MongoDB Connection ---
const connectDB = async () => {
  const fileName = 'src/server.js';
  const functionName = 'connectDB';
  
  if (!MONGO_URI) {
    logger.warn(`${fileName} ${functionName} MongoDB MONGO_URI not set. Skipping MongoDB connection. Admin configuration features will not be available.`);
    return;
  }
  try {
    logger.info(`${fileName} ${functionName} Attempting to connect to MongoDB`, { data: { uri: MONGO_URI.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@') } });
    await mongoose.connect(MONGO_URI, {
      // useNewUrlParser: true, // No longer needed in Mongoose 6+
      // useUnifiedTopology: true, // No longer needed in Mongoose 6+
    });
    logger.info(`${fileName} ${functionName} MongoDB Connected successfully.`);
  } catch (err) {
    logger.error(`${fileName} ${functionName} MongoDB Connection Failed:`, { message: err.message, stack: err.stack });
    // process.exit(1); // Optionally exit if DB connection is critical
  }
};

// Initialize application
const initializeApp = async () => {
  const fileName = 'src/server.js';
  const functionName = 'initializeApp';
  
  // Connect to MongoDB first
  await connectDB();
  
  try {
    // Load configuration (will use DB if available, otherwise env vars/defaults)
    logger.info(`${fileName} ${functionName} Loading application configuration`);
    const config = await getConfig();
    
    // Update schedule variables with config values
    localSearchCronSchedule = config.localSearchCronSchedule;
    syncIssuesCronSchedule = config.syncIssuesCronSchedule;
    
    logger.info(`${fileName} ${functionName} Configuration loaded successfully`, 
      { data: { localSearchCronSchedule, syncIssuesCronSchedule } });
    
    // Schedule initial tasks with loaded configuration
    scheduleLocalSearchTask(localSearchCronSchedule);
    scheduleSyncTask(syncIssuesCronSchedule);
  } catch (err) {
    logger.error(`${fileName} ${functionName} Error during application initialization:`, 
      { message: err.message, stack: err.stack });
    
    // Fall back to environment variables if config loading fails
    logger.warn(`${fileName} ${functionName} Falling back to environment variables for scheduling`);
    scheduleLocalSearchTask(localSearchCronSchedule);
    scheduleSyncTask(syncIssuesCronSchedule);
  }
};

// Initialize the application
initializeApp();

app.listen(port, () => {
  const startupFileName = 'src/server.js'; // Consistent naming for logs
  logger.info(`${startupFileName} server Startup Server listening on http://localhost:${port}`);
  
  // Log Sync Issues Task configuration
  logger.info(`${startupFileName} server Startup Sync Issues Task configured with schedule: ${syncIssuesCronSchedule}`);

  // Log Local Search Task configuration
  const currentYearForLog = new Date().getFullYear();
  logger.info(`${startupFileName} server Startup Local Search Task configured to process years 2015-${currentYearForLog} with schedule: ${localSearchCronSchedule}.`);
  
  // Setup configuration change listener
  logger.info(`${startupFileName} server Startup Setting up configuration change handler`);  
  // This uses the '/api/app/configure' endpoint's call to refreshConfig() to detect changes
  // A more elegant approach would be using MongoDB change streams, but this is sufficient for now
});
