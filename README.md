# Redmine API Wrapper & CLI

A NodeJS-based application providing a RESTful API wrapper for Redmine, an interactive Command Line Interface (CLI) for Redmine operations, and an Admin Panel for configuration and monitoring.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Usage](#usage)
  - [Interactive CLI](#interactive-cli)
  - [Web Server (API & Admin Panel)](#web-server-api--admin-panel)
- [Running the Application](#running-the-application)
  - [Development Mode (Web Server)](#development-mode-web-server)
  - [Production Mode (Web Server)](#production-mode-web-server)
  - [Running with Docker (Web Server)](#running-with-docker-web-server)
- [Accessing the Interfaces](#accessing-the-interfaces)
  - [Admin Panel](#admin-panel)
  - [API Documentation (Swagger UI)](#api-documentation-swagger-ui)
  - [API Base URL](#api-base-url)
- [API Usage](#api-usage)
  - [Authentication](#authentication)
  - [Example Requests](#example-requests)
- [Further Documentation](#further-documentation)
- [Development](#development)
  - [Available Scripts](#available-scripts)
- [Environment Variables](#environment-variables)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Contributing](#contributing)
- [Disclaimer](#disclaimer)

## Features

### Core Features
- **RESTful API**: Full-featured API for programmatic access to Redmine data.
- **Admin Panel**: Web-based interface for system configuration and monitoring.
- **CLI Interface**: Command-line interface for direct Redmine interaction.
- **Data Synchronization**: Automated sync with Redmine instance.
- **API Key Management**: Secure access control with API keys.
- **Swagger Documentation**: Interactive API documentation.

### Data Management
- **Issue Management**: Fetch, filter, and search Redmine issues.
- **Project Hierarchy**: Navigate through projects and subprojects.
- **Detailed Views**: Comprehensive issue and project information.
- **Pagination Support**: Efficient data retrieval with pagination.
- **Search Functionality**: Advanced search across all fields.

### Security & Access
- **API Key Authentication**: Secure access to API endpoints.
- **Basic Auth**: Protection for admin panel and Swagger UI.
- **Bcrypt Hashing**: Secure storage of sensitive credentials.
- **Role-based Access**: Different access levels for different users (if implemented).

### Technical Features
- **Interactive CLI**: Menu-driven interface with emoji support.
- **SSL Support**: Secure connections to Redmine servers (depends on Redmine instance setup).
- **Customizable Settings**: Environment-based configuration.
- **MongoDB Integration**: Persistent data storage for API keys, settings, and potentially cached data.
- **Cron Jobs**: Automated data synchronization.
- **Health Monitoring**: System status and error tracking.

### User Experience
- **Emoji Support**: Enhanced CLI interface.
- **Configurable Settings**: Customize items per page and display options.
- **Interactive Documentation**: Try API endpoints directly in Swagger UI.
- **Error Handling**: Comprehensive error messages and logging.
- **Performance Optimization**: Efficient data retrieval and caching (potential).

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB (with Mongoose ODM)
- **CLI**: Inquirer.js
- **API Documentation**: Swagger (swagger-jsdoc, swagger-ui-express)
- **Authentication**: Basic Auth (express-basic-auth), API Keys (custom implementation)
- **Scheduling**: node-cron
- **HTTP Client**: Axios
- **Deployment**: Docker (optional)

## Prerequisites

- Node.js (v18-alpine as per Dockerfile, v18+ recommended for local development)
- npm or yarn
- MongoDB (v5.0+ recommended)
- Access to a Redmine instance with API enabled.
- Docker and Docker Compose (Optional, for running the web server in a containerized environment).

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    # yarn install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root of the project by copying `.env.example`:
    ```bash
    cp .env.example .env
    ```
    Edit the `.env` file with your specific configurations. Key variables include `REDMINE_API_KEY`, `REDMINE_HOST`, and `MONGO_URI`. Refer to the [Environment Variables](#environment-variables) section and `.env.example` for a full list and descriptions. This file is crucial for the application to run correctly.

## Usage

This project provides both a Command Line Interface (CLI) and a Web Server (API & Admin Panel).

### Interactive CLI

The CLI allows direct interaction with your Redmine instance for various operations.

To start the interactive CLI:
```bash
npm start
# or if using yarn:
# yarn start
```
Follow the on-screen prompts to navigate the CLI menus.

### Web Server (API & Admin Panel)

The web server provides a RESTful API to Redmine data and an Admin Panel.

Refer to the [Running the Application](#running-the-application) section for instructions on how to start the web server locally or with Docker.

## Running the Application

### Development Mode (Web Server)

This mode is suitable for local development of the web server and uses `nodemon` for automatic restarts on file changes.

```bash
# Start the server in development mode
npm run dev

# Or start with debug logs for 'redmine' namespace
DEBUG=redmine:* npm run dev
```

### Production Mode (Web Server)

For production, you would typically run the server directly. Ensure `NODE_ENV=production` is set in your `.env` file for optimal performance and security settings.

```bash
# Start the server (ensure NODE_ENV=production in .env)
node src/server.js
```
*(The `Dockerfile` also defaults to `NODE_ENV=production` and runs `src/server.js` when building a container.)*

### Running with Docker (Web Server)

The application can be easily run using Docker and Docker Compose, which is recommended for a consistent environment, especially for the web server component.

1.  **Ensure Docker and Docker Compose are installed on your system.**
2.  **Make sure you have a configured `.env` file** in the project root, as Docker Compose will use variables from this file to configure the container environment.
3.  **Build and start the services in detached mode:**
    ```bash
    docker-compose up -d --build
    ```
    This command will:
    - Build the Docker image based on `Dockerfile` (if not already built or if `Dockerfile` changed).
    - Start the `redmine-data-server` service defined in `docker-compose.yml`.
    The server will typically be accessible at `http://localhost:3000` (or the `PORT` specified in your `.env` file if different and reflected in `docker-compose.yml` port mapping).

4.  **To stop the services:**
    ```bash
    docker-compose down
    ```

5.  **To view logs from the running container:**
    ```bash
    docker-compose logs -f redmine-data-server
    ```

*Note on Docker Volume Mounts: The `docker-compose.yml` is configured to mount the current project directory (`./`) into the container at `/usr/src/app`. This is useful for development as local code changes are immediately reflected in the container. However, this also means that `node_modules` should be installed locally on your host machine, as the current setup mounts the local directory including `node_modules`. If you intend to build a self-contained image, you would uncomment the `COPY src ./src` and `RUN npm install --production` lines in the `Dockerfile` and potentially remove or adjust the volume mount for `node_modules` in `docker-compose.yml` for production builds.*

## Accessing the Interfaces

Once the web server is running (either directly via `npm run dev` / `node src/server.js` or via Docker):

### Admin Panel
- **URL**: `http://localhost:3000` (or your configured `PORT`)
- **Authentication**: Uses the `ADMIN_USERNAME` and `ADMIN_PASSWORD` from your `.env` file for Basic Authentication.
- **Functionality**: Manage API keys, system settings, monitor sync status, and system health.

### API Documentation (Swagger UI)
- **URL**: `http://localhost:3000/api-docs`
- **Authentication**: Uses `SWAGGER_USER` and `SWAGGER_PASSWORD` from your `.env` file for Basic Authentication.
- **Functionality**: Interactive API documentation. Allows testing endpoints directly from the browser.

### API Base URL
- `http://localhost:3000/api` (or your configured `PORT`)

## API Usage

### Authentication
Most API endpoints (excluding `/health` and potentially `/api-docs` depending on configuration) require an API key to be passed in the `Authorization` header as a Bearer token:

```http
Authorization: Bearer YOUR_API_KEY_HERE
```
API keys can be managed via the Admin Panel.

### Example Requests

#### Get Paginated Issues
```bash
curl -X GET "http://localhost:3000/api/issues?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE"
```

#### Search Issues
```bash
curl -X GET "http://localhost:3000/api/issues?q=bug&status_id=open&page=1" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE"
```

## Further Documentation

For more detailed information on specific components, refer to the `docs` directory:

- **Admin Panel**: See [docs/admin-page.md](./docs/admin-page.md) for a comprehensive guide to the Admin Panel features and usage.

## Development

### Available Scripts

```bash
# Start development server (API & Admin Panel) with nodemon
npm run dev

# Start the interactive CLI application
npm start

# Lint code using ESLint
npm run lint

# Attempt to automatically fix linting issues
npm run lint:fix

# Check for security vulnerabilities in dependencies (requires npm v6+)
# npm audit
# npm audit fix
```
*(Note: The `package.json` does not currently include a dedicated `build` script for the server or `test` scripts. These could be added as the project evolves.)*

## Environment Variables

Key environment variables are listed below. For a complete list and default values, please refer to the `.env.example` file.

| Variable             | Description                                         | Example                                   |
|----------------------|-----------------------------------------------------|-------------------------------------------|
| `NODE_ENV`           | Application environment                             | `development` or `production`             |
| `PORT`               | Port for the web server                             | `3000`                                    |
| `MONGO_URI`          | MongoDB connection string                           | `mongodb://localhost:27017/redmine_data`  |
| `REDMINE_API_KEY`    | Your personal Redmine API access key                | `your_actual_redmine_api_key`             |
| `REDMINE_HOST`       | Base URL of your Redmine instance                   | `https://your_redmine_instance.example.com` |
| `REDMINE_DEFAULT_ENDPOINT` | Default Redmine API endpoint for some operations | `/issues.json`                            |
| `ADMIN_USERNAME`     | Username for Admin Panel basic authentication       | `admin`                                   |
| `ADMIN_PASSWORD`     | Password for Admin Panel basic authentication       | `change_this_secure_password`             |
| `SWAGGER_USER`       | Username for Swagger UI basic authentication        | `swagger`                                 |
| `SWAGGER_PASSWORD`   | Password for Swagger UI basic authentication        | `change_me`                               |
| `API_KEY_SECRET`     | Secret key for signing/verifying generated API keys | `a_very_strong_secret_key`                |
| `CRON_SYNC_ENABLED`  | Enable/disable cron job for data synchronization    | `true` or `false`                         |
| `CRON_SYNC_SCHEDULE` | Cron schedule for data synchronization              | `0 * * * *` (e.g., every hour)            |

Ensure these are correctly set in your `.env` file.

## Security

- **API Keys**: Managed via the Admin Panel, required for API access. Store them securely.
- **Basic Authentication**: Protects the Admin Panel and Swagger UI. Use strong, unique credentials in your `.env` file.
- **Environment Variables**: Do not commit your `.env` file with sensitive credentials to version control. Use `.env.example` as a template.
- **Input Validation**: Ensure proper validation is implemented for all API inputs to prevent common vulnerabilities.
- **Dependency Management**: Regularly update dependencies and audit for vulnerabilities (`npm audit`).
- **HTTPS**: For production deployments, ensure the application is served over HTTPS.

## Troubleshooting

- **Server/CLI not starting:**
  - Ensure all dependencies are installed: `npm install`.
  - Verify `.env` file exists and is correctly configured with all necessary variables (especially `MONGO_URI`, `REDMINE_HOST`, `REDMINE_API_KEY`).
  - Check MongoDB is running and accessible at the `MONGO_URI`.
- **API errors / No data:**
  - Check server logs for detailed error messages. Run in dev mode with `DEBUG=redmine:* npm run dev` for verbose logs.
  - Ensure the `Authorization: Bearer YOUR_API_KEY_HERE` header is correctly sent with API requests.
  - Verify your Redmine API key has the necessary permissions in your Redmine instance.
- **Docker issues:**
  - Ensure Docker and Docker Compose are running.
  - Check container logs: `docker-compose logs -f redmine-data-server`.
  - If `node_modules` issues arise in Docker, ensure they are installed on your host, as the current setup mounts the local directory including `node_modules`.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Contributing

Contributions are welcome! Please follow these steps:

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'feat: Add some AmazingFeature'`). (Consider using [Conventional Commits](https://www.conventionalcommits.org/)).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request against the `main` branch.

## Disclaimer

This tool interacts with a Redmine API. Ensure you have the necessary permissions and understand the implications of the actions you perform. The authors are not responsible for any data loss or unintended actions performed using this tool. Use responsibly.
