# Admin Page and Configuration API Plan

## 1. Objective

To create a simple web-based admin interface and a corresponding API endpoint that allows for dynamic configuration of global application settings. These settings will be persisted in a MongoDB database, providing a more flexible way to manage the application's behavior than relying solely on environment variables.

## 2. Components

### 2.1. Admin Page (`/public/index.html`)

*   **Purpose**: Provide a user interface for viewing and modifying global application settings.
*   **Technology**:
    *   HTML
    *   Tailwind CSS (via CDN for simplicity)
    *   Vanilla JavaScript (for fetching and submitting data)
*   **Functionality**:
    *   On page load, fetch current settings from `/api/app/configure` (GET).
    *   Display current settings in input fields.
    *   Allow modification of settings such as:
        *   `ITEMS_PER_PAGE` (for API pagination)
        *   `LOG_LEVEL`
        *   `LOCAL_SEARCH_CRON_SCHEDULE`
        *   `SYNC_ISSUES_CRON_SCHEDULE`
    *   A "Save Settings" button to submit changes to `/api/app/configure` (POST).
    *   Display success or error messages based on the API response.
*   **Accessibility**: 
    *   The page will be accessible at `/public/index.html`.
    *   Authorization will be handled through the same basic auth as the API endpoint (`ADMIN_USER` and `ADMIN_PASSWORD`).

### 2.2. Configuration API (`/api/app/configure`)

*   **Purpose**: Provide programmatic access to read and update global application settings.
*   **Persistence**: MongoDB, using Mongoose ODM.
*   **Endpoints**:
    *   `GET /api/app/configure`:
        *   Retrieves the current global settings document from MongoDB.
        *   If no settings document exists, it creates one with default values.
        *   Response format: JSON object with all settings properties.
    *   `POST /api/app/configure`:
        *   Accepts a JSON payload with settings to be updated.
        *   Validates the incoming data (e.g., correct data types, valid cron patterns).
        *   Updates the global settings document in MongoDB.
        *   Response format: Updated settings object or error details.
*   **Security**: This endpoint is protected with basic authentication using `ADMIN_USER` and `ADMIN_PASSWORD` environment variables.

### 2.3. Mongoose Model (`src/models/Settings.js`)

*   **Schema Definition**: Defines the structure for the global settings document with these fields:
    *   `configKey`: String identifier to ensure we only have one settings document (`'global_settings'`).
    *   `itemsPerPage`: Number (default: 10)
    *   `logLevel`: String enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'] (default: 'INFO')
    *   `localSearchCronSchedule`: String (default: '0 * * * *')
    *   `syncIssuesCronSchedule`: String (default: '0 */6 * * *')
    *   Timestamps (createdAt, updatedAt)
*   **Static Methods**:
    *   `getSettings()`: Retrieves the single settings document or creates it if it doesn't exist.

### 2.4. Configuration Loader (`src/utils/configLoader.js`)

*   **Purpose**: Provide a consistent way to access application settings with the proper precedence.
*   **Precedence**:
    1. MongoDB settings (if available)
    2. Environment variables 
    3. Default values (as defined in the Settings schema)
*   **Methods**:
    *   `getConfig()`: Asynchronous function that returns a settings object by combining values from all sources.
    *   `getConfigValue(key)`: Retrieves a specific configuration value using the above precedence.
    *   `refreshConfig()`: Force a reload of settings from the database.

## 3. Integration with Existing Functionality

### 3.1. Dynamic Scheduling

*   Scheduled tasks will use configuration values from the database:
    *   The local search task will use `localSearchCronSchedule` from database (defaulting to ENV or hardcoded value if unavailable).
    *   The sync issues task will use `syncIssuesCronSchedule` from database.
*   The server will handle:
    *   Using the initially loaded values at startup.
    *   A mechanism for reconfiguring the scheduled tasks if settings are updated during runtime.

### 3.2. API Behavior

*   Pagination in API responses will use the `itemsPerPage` value from configuration.
*   Other behaviors can be adapted to use the configuration system as the application grows.

## 4. Implementation Steps

1. **Project Setup**:
   * ✅ Add `mongoose` to dependencies.
   * ✅ Add `express-basic-auth` for API protection.
   * ✅ Update `.env.example` with new variables.

2. **Database Model & Connection**:
   * ✅ Setup MongoDB connection in `server.js`.
   * Create `src/models/Settings.js` schema and model.

3. **Configuration System**:
   * Create `src/utils/configLoader.js` utility.
   * Modify server code to use this for configuration values.

4. **API Endpoint**:
   * Create `src/routes/appConfigRoutes.js` with GET/POST handlers.
   * Implement route protection with basic auth.
   * Add the routes to `server.js`.

5. **Admin Page**:
   * Create `public/index.html` with Tailwind CSS.
   * Implement JavaScript for API interaction.
   * Style the page with a clean, functional layout.

6. **Testing & Documentation**:
   * Test the complete flow (view settings, change settings, observe system changes).
   * Document all new components and update existing documentation.

## 5. Security Considerations

*   Basic authentication is used to protect both the Swagger UI (`/api-docs`) and the Admin API (`/api/app/configure`).
*   Different credentials can be used for each interface:
    *   `SWAGGER_USER`/`SWAGGER_PASSWORD` for the API docs.
    *   `ADMIN_USER`/`ADMIN_PASSWORD` for the admin interface.
*   Proper input validation is implemented in the API to prevent injection attacks or invalid data.
*   The admin page is a static HTML file that requires authentication to make changes.

## 6. Future Enhancements

*   User management system for more granular access control.
*   Audit logging for configuration changes.
*   WebSocket integration for real-time updates when settings change.
*   More sophisticated UI with form validation and feedback.
*   Additional configurable parameters as the application grows.
