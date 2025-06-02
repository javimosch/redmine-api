import axios from 'axios';
import https from 'https';
import { constants } from 'crypto';

/**
 * Finds an issue by its ID using the Redmine API.
 *
 * @param {string|number} issueId - The ID of the issue to find.
 * @param {string} [redmineBaseUrl] - The base URL of the Redmine instance (e.g., 'https://my.redmine.org').
 *                                    Defaults to process.env.REDMINE_HOST if not provided.
 * @param {string} [redmineApiKey] - The Redmine API key.
 *                                   Defaults to process.env.REDMINE_API_KEY if not provided.
 * @returns {Promise<Object>} A promise that resolves with the issue data.
 * @throws {Error} If required parameters are missing or if the API request fails.
 */
export const findIssueById = async (issueId, redmineBaseUrl, redmineApiKey) => {
  const baseUrl = redmineBaseUrl || process.env.REDMINE_HOST;
  const apiKey = redmineApiKey || process.env.REDMINE_API_KEY;

  if (!issueId) {
    throw new Error('Issue ID is required.');
  }
  if (!baseUrl) {
    throw new Error('Redmine base URL is required. Provide it as an argument or set REDMINE_HOST environment variable.');
  }
  if (!apiKey) {
    throw new Error('Redmine API key is required. Provide it as an argument or set REDMINE_API_KEY environment variable.');
  }

  const url = `${baseUrl.startsWith('http') ? '' : 'https://'}${baseUrl}/issues/${issueId}.json`;

  console.log(`mini-redmine-api-wrapper findIssueById Fetching issue...`, { data: { url } }); // User rule: debug log

  // Create a custom HTTPS agent to allow legacy server connections
  const httpsAgent = new https.Agent({
    secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
  });

  try {
    const response = await axios.get(url, {
      headers: {
        'X-Redmine-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      httpsAgent, // Use the custom agent
    });
    console.log(`mini-redmine-api-wrapper findIssueById Issue fetched successfully.`, { data: { issueId: issueId, status: response.status } }); // User rule: debug log
    return response.data.issue; // Typically, the issue data is nested under an 'issue' key
  } catch (error) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      url,
      issueId,
    };
    if (error.isAxiosError && error.response) {
      errorData.axiosResponse = {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      };
    }
    console.log(`mini-redmine-api-wrapper findIssueById Error fetching issue by ID:`, errorData); // User rule: debug log
    
    if (error.response) {
      // More specific error based on Redmine response
      throw new Error(`Failed to fetch issue ${issueId}. Status: ${error.response.status}. Data: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // The request was made but no response was received
      throw new Error(`Failed to fetch issue ${issueId}. No response received from server at ${baseUrl}.`);
    } else {
      // Something happened in setting up the request that triggered an Error
      throw new Error(`Failed to fetch issue ${issueId}. Error: ${error.message}`);
    }
  }
};

export default {
  findIssueById,
};

//TEST: findIssueById(3928,'https://easyredmine.simpliciti.fr','xxx').then(console.log)