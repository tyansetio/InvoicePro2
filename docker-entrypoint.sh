#!/bin/sh

# Exit on error
set -e

echo "Starting Docker Entrypoint Script..."

# Run database push (migration)
# We use npm run db:push which calls drizzle-kit push
echo "Running database migrations..."
npm run db:push

# Start the application
echo "Starting the application..."
exec "$@"
