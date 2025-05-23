# Redmine CLI

A NodeJS-based command-line interface to interact with a Redmine API.

## Features

- Fetch issues with pagination and detailed views
- Fetch and view project information
- **Explore project hierarchy** - Navigate through projects and their subprojects to find project IDs
- Interactive menu-driven interface with emoji support
- Customizable settings (emoji toggle, items per page)
- SSL support with legacy renegotiation for older Redmine servers
- Configurable via `.env` file

## Prerequisites

- Node.js (v18+ recommended)
- npm or yarn

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
    ```

## Usage

To start the interactive CLI:

```bash
npm start
# or
# yarn start
```

Follow the on-screen prompts to interact with the Redmine API.

## Development

- **Linting:**
  ```bash
  npm run lint
  npm run lint:fix
  ```

## Disclaimer

This tool interacts with a Redmine API. Ensure you have the necessary permissions and understand the implications of the actions you perform.
