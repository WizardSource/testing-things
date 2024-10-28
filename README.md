# Email Service

A full-stack application for managing email templates and sending emails with a modern, responsive UI.

Prerequisites
------------
- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm (v8 or higher)

Quick Start
----------
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd email-service
   ```

2. Run the setup script:
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

3. Start the backend:
   ```bash
   node src/index.js
   ```

4. In a new terminal, start the frontend:
   ```bash
   cd client
   npm run dev
   ```

5. Open your browser and navigate to:
   http://localhost:5173

Manual Setup
-----------
If the automatic setup doesn't work, follow these steps:

1. Install backend dependencies:
   ```bash
   npm install
   ```

2. Install frontend dependencies:
   ```bash
   cd client
   npm install
   ```

3. Create and configure .env file in the root directory:
   ```env
   DB_USER=wave
   DB_HOST=localhost
   DB_NAME=email_service
   DB_PASSWORD=
   DB_PORT=5432
   POSTMARK_API_KEY=your-postmark-api-key
   FROM_EMAIL=your-verified-sender@dino.id
   PORT=3000
   ```

4. Create database and run migrations:
   ```bash
   createdb email_service
   psql email_service < src/db/migrations/initial_schema.sql
   ```

5. Start the backend:
   ```bash
   npm run dev
   ```

6. Start the frontend:
   ```bash
   cd client
   npm run dev
   ```

Features
--------
- Email template management
- Send emails using templates
- Track email opens and clicks
- Dashboard with analytics
- Modern, responsive UI with Tailwind CSS
- Real-time notifications
- Pagination and sorting
- Error handling and loading states

Tech Stack
----------
### Frontend
- React 18
- Tailwind CSS
- React Router v6
- Vite
- Axios

### Backend
- Node.js
- Express
- PostgreSQL
- Postmark API

### Development
- ESLint
- Prettier
- Nodemon
- dotenv

Project Structure
----------------
email-service/
├── client/ # Frontend React application
│ ├── src/
│ │ ├── components/ # Reusable UI components
│ │ ├── pages/ # Page components
│ │ ├── utils/ # Utility functions
│ │ └── App.jsx # Main application component
│ └── package.json
├── src/ # Backend Node.js application
│ ├── db/
│ │ └── migrations/ # Database migrations
│ └── index.js # Express server setup
├── setup.sh # Setup script
└── package.json


Troubleshooting
--------------
If you encounter any issues:

1. Make sure PostgreSQL is running:
   ```bash
   brew services start postgresql
   ```

2. Check if the database exists:
   ```bash
   psql -l
   ```

3. Verify Node.js version:
   ```bash
   node --version   # Should be 18 or higher
   ```

4. Check if all dependencies are installed:
   ```bash
   # In root directory
   npm install

   # In client directory
   cd client
   npm install
   ```

5. Ensure .env file exists and is configured correctly

6. Check the logs:
   - Backend: Look for console output in the terminal running the backend
   - Frontend: Open browser DevTools (F12) and check the Console tab
   - Database: Check PostgreSQL logs

7. Common issues:
   - Port 3000 already in use: Change the PORT in .env
   - Port 5173 already in use: Kill the process or use a different port
   - Database connection failed: Check PostgreSQL credentials
   - "debug is not defined": Restart the backend server

For more help, please create an issue on the repository.

