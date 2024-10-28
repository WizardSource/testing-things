#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up Email Service Project...${NC}"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}PostgreSQL is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install it first.${NC}"
    exit 1
fi

# Create necessary directories
mkdir -p src/db/migrations

# Install dependencies
echo -e "${GREEN}Installing Node.js dependencies...${NC}"
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${GREEN}Creating .env file...${NC}"
    cat > .env << EOL
DB_USER=wave
DB_HOST=localhost
DB_NAME=email_service
DB_PASSWORD=
DB_PORT=5432
POSTMARK_API_KEY=your-postmark-api-key
FROM_EMAIL=your-verified-sender@dino.id
PORT=3000
EOL
fi

# Drop and recreate database
echo -e "${GREEN}Recreating database...${NC}"
dropdb email_service 2>/dev/null || true
createdb email_service

# Run database migrations
echo -e "${GREEN}Running database migrations...${NC}"
psql email_service < src/db/migrations/initial_schema.sql

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${GREEN}To start the application:${NC}"
echo -e "1. In one terminal: ${NC}npm run dev"
echo -e "2. In another terminal: ${NC}cd client && npm run dev"