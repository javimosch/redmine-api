import express from 'express';
import { fetchIssueByIdController } from '../controllers/issueController.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const fileName = 'src/routes/issueRoutes.js';

// Note: Swagger JSDoc for this endpoint is in issueController.js
// The path here is relative to where it's mounted in server.js (e.g., /api)
router.get('/issue/:id', fetchIssueByIdController);

logger.info(`${fileName} Issue routes configured: GET /issue/:id`);

export default router;
