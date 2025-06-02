import { getIssueById } from '../services/issueService.js';
import { logger } from '../utils/logger.js';

const fileName = 'src/controllers/issueController.js';

/**
 * @swagger
 * tags:
 *   name: Issues
 *   description: Issue management and retrieval
 */

/**
 * @swagger
 * /api/issue/{id}:
 *   get:
 *     summary: Retrieve a specific issue by its ID.
 *     tags: [Issues]
 *     description: Fetches a single issue by its unique ID. It first checks a local cache and, if not found, queries the Redmine API. The issue is then cached locally if retrieved from Redmine.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Numeric ID of the issue to retrieve.
 *         schema:
 *           type: integer
 *           example: 12345
 *     responses:
 *       200:
 *         description: Successfully retrieved the issue.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Issue' # Assuming Issue schema is defined in server.js or a shared components file
 *       400:
 *         description: Invalid issue ID supplied.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid issue ID: must be a positive integer."
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError' # Defined in server.js
 *       404:
 *         description: Issue not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Issue not found."
 *       500:
 *         $ref: '#/components/responses/ServerError' # Defined in server.js
 */
export const fetchIssueByIdController = async (req, res) => {
  const functionName = 'fetchIssueByIdController';
  const { id } = req.params;

  logger.info(`${fileName} ${functionName} Received request for issue ID`, { data: { id } });

  const issueId = parseInt(id, 10);
  if (isNaN(issueId) || issueId <= 0) {
    logger.warn(`${fileName} ${functionName} Invalid issue ID provided`, { data: { id } });
    return res.status(400).json({ error: 'Invalid issue ID: must be a positive integer.' });
  }

  try {
    const issue = await getIssueById(issueId);

    if (issue) {
      logger.info(`${fileName} ${functionName} Issue found, returning to client`, { data: { issueId: issue.id } });
      return res.status(200).json(issue);
    } else {
      logger.warn(`${fileName} ${functionName} Issue not found for ID`, { data: { issueId } });
      return res.status(404).json({ error: 'Issue not found.' });
    }
  } catch (error) {
    // This catch is for unexpected errors from the service layer if it doesn't handle them by returning null
    logger.error(`${fileName} ${functionName} Unexpected error while fetching issue`, { data: { issueId }, message: error.message, stack: error.stack });
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
};
