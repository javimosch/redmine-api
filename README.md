# Redmine CLI

A NodeJS-based command-line interface to interact with a Redmine API.

## Features

### Core Features
- **RESTful API**: Full-featured API for programmatic access to Redmine data
- **Admin Panel**: Web-based interface for system configuration and monitoring
- **CLI Interface**: Command-line interface for direct Redmine interaction
- **Data Synchronization**: Automated sync with Redmine instance
- **API Key Management**: Secure access control with API keys
- **Swagger Documentation**: Interactive API documentation

### Data Management
- **Issue Management**: Fetch, filter, and search Redmine issues
- **Project Hierarchy**: Navigate through projects and subprojects
- **Detailed Views**: Comprehensive issue and project information
- **Pagination Support**: Efficient data retrieval with pagination
- **Search Functionality**: Advanced search across all fields

### Security & Access
- **API Key Authentication**: Secure access to API endpoints
- **Basic Auth**: Protection for admin panel and Swagger UI
- **Bcrypt Hashing**: Secure storage of sensitive credentials
- **Role-based Access**: Different access levels for different users

### Technical Features
- **Interactive CLI**: Menu-driven interface with emoji support
- **SSL Support**: Secure connections to Redmine servers
- **Customizable Settings**: Environment-based configuration
- **MongoDB Integration**: Persistent data storage
- **Cron Jobs**: Automated data synchronization
- **Health Monitoring**: System status and error tracking

### User Experience
- **Emoji Support**: Enhanced CLI interface
- **Configurable Settings**: Customize items per page and display options
- **Interactive Documentation**: Try API endpoints directly in Swagger UI
- **Error Handling**: Comprehensive error messages and logging
- **Performance Optimization**: Efficient data retrieval and caching

## Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- MongoDB 5.0+
- Redmine API access

## Setup

1.  **Clone the repository (or create the files as described).**

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
    Edit the `.env` file with your Redmine API key and host:
    ```env
    REDMINE_API_KEY=your_actual_api_key
    REDMINE_HOST=your_redmine_instance.example.com
    REDMINE_DEFAULT_ENDPOINT=/issues.json
    MONGO_URI=mongodb://localhost:27017/redmine_data
    PORT=3000
    NODE_ENV=development
    ADMIN_USERNAME=admin
    ADMIN_PASSWORD=change_this_secure_password
    SWAGGER_USER=swagger
    SWAGGER_PASSWORD=change_me
    ```

## Usage

To start the interactive CLI:

```bash
npm start
# or
# yarn start
```

Follow the on-screen prompts to interact with the Redmine API.

## Running the Application

### Development Mode
```bash
# Start the server
npm run dev

# Or start with debug logs
DEBUG=redmine:* npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

## Accessing the Interfaces

### Admin Panel
- URL: `http://localhost:3000`
- Use the admin credentials from your `.env` file
- Manage API keys and system settings
- Monitor sync status and system health

### API Documentation (Swagger UI)
- URL: `http://localhost:3000/api-docs`
- Interactive API documentation
- Test endpoints directly from the browser
- Authenticate using your API key

### API Base URL
- `http://localhost:3000/api`

## API Usage

### Authentication
All API endpoints (except `/health`) require an API key in the `Authorization` header:
```
Authorization: Bearer your_api_key_here
```

### Example Requests

#### Get Paginated Issues
```bash
curl -X GET "http://localhost:3000/api/issues?page=1&limit=10" \
  -H "Authorization: Bearer your_api_key_here"
```

#### Search Issues
```bash
curl -X GET "http://localhost:3000/api/issues?q=bug&page=1" \
  -H "Authorization: Bearer your_api_key_here"
```

## Development

- **Linting:**
  ```bash
  npm run lint
  npm run lint:fix
  ```

### Available Scripts
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Check for security vulnerabilities
npm audit
```

### Environment Variables
- `NODE_ENV`: Application environment (development/production)
- `PORT`: Server port (default: 3000)
- `MONGO_URI`: MongoDB connection string
- `REDMINE_API_KEY`: Your Redmine API key
- `REDMINE_HOST`: Redmine instance hostname
- `ADMIN_USERNAME`: Admin panel username
- `ADMIN_PASSWORD`: Admin panel password

## Security

- API keys are stored using bcrypt hashing
- Admin panel is protected with basic authentication
- Sensitive endpoints require API key authentication
- Regular security updates recommended

## Troubleshooting

- Check server logs for errors
- Verify MongoDB connection
- Ensure all required environment variables are set
- Check API key permissions in Redmine

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Disclaimer

This tool interacts with a Redmine API. Ensure you have the necessary permissions and understand the implications of the actions you perform.
