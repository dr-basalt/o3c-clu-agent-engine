#!/bin/sh
set -e

# URL-encode special characters in password for PostgreSQL connection string
# This is necessary because passwords may contain characters like /, @, :, etc.
if [ -n "$POSTGRES_PASSWORD" ]; then
    # URL encode the password using Node.js
    ENCODED_PASSWORD=$(node -e "console.log(encodeURIComponent('$POSTGRES_PASSWORD'))")
    export DATABASE_URL="postgresql://${POSTGRES_USER}:${ENCODED_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public"
fi

# Run database migrations with error handling for failed migrations (P3009)
echo "Running database migrations..."
cd /app/apps/api

if ! npx prisma migrate deploy 2>&1 | tee /tmp/migrate.log; then
    # Check if this is a P3009 error (failed migration found)
    if grep -q "P3009" /tmp/migrate.log; then
        echo "Found failed migration (P3009). Attempting to resolve..."

        # Extract the failed migration name from the error message
        FAILED_MIGRATION=$(grep "migration started at" /tmp/migrate.log | sed -n 's/.*The `\([^`]*\)` migration.*/\1/p')

        if [ -n "$FAILED_MIGRATION" ]; then
            echo "Failed migration: $FAILED_MIGRATION"

            # Check if the tables were actually created by querying the database
            # We'll check for the 'users' table which should exist if migration succeeded
            TABLE_EXISTS=$(npx prisma db execute --stdin <<EOF
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'users'
);
EOF
)

            if echo "$TABLE_EXISTS" | grep -q "true\|t"; then
                echo "Tables exist - marking migration as applied..."
                npx prisma migrate resolve --applied "$FAILED_MIGRATION"
            else
                echo "Tables don't exist - marking migration as rolled back and will retry..."
                npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION"
                npx prisma migrate deploy
            fi
        fi
    else
        # Different error, re-throw it
        cat /tmp/migrate.log
        exit 1
    fi
fi

echo "Migrations completed successfully"

# Execute the main command
exec "$@"
