#!/bin/sh
set -e

# URL-encode special characters in password for PostgreSQL connection string
# This is necessary because passwords may contain characters like /, @, :, etc.
if [ -n "$POSTGRES_PASSWORD" ]; then
    # URL encode the password using Node.js
    ENCODED_PASSWORD=$(node -e "console.log(encodeURIComponent('$POSTGRES_PASSWORD'))")
    export DATABASE_URL="postgresql://${POSTGRES_USER}:${ENCODED_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public"
fi

# Run database migrations
echo "Running database migrations..."
cd /app/apps/api && npx prisma migrate deploy

# Execute the main command
exec "$@"
