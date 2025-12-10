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

# Save current directory and change to API directory for migrations
ORIGINAL_DIR=$(pwd)
cd /app/apps/api

# Run migration and capture output
npx prisma migrate deploy 2>&1 | tee /tmp/migrate.log
MIGRATE_EXIT_CODE=$?

# Check if P3009 error occurred (regardless of exit code)
if grep -q "P3009" /tmp/migrate.log; then
    echo "Found failed migration (P3009). Attempting to resolve..."

    # Extract the failed migration name from the error message
    FAILED_MIGRATION=$(grep "migration started at" /tmp/migrate.log | sed -n 's/.*The `\([^`]*\)` migration.*/\1/p')

    if [ -n "$FAILED_MIGRATION" ]; then
        echo "Failed migration: $FAILED_MIGRATION"

        # Check if the 'users' table exists in the database
        # If it exists, the migration actually succeeded but wasn't marked as such
        echo "Checking if database tables exist..."

        # Use psql to check if table exists (more reliable than prisma db execute)
        if PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users');" | grep -q "t"; then
            echo "✓ Tables exist - marking migration as applied..."
            npx prisma migrate resolve --applied "$FAILED_MIGRATION"
            echo "✓ Migration marked as applied successfully"
        else
            echo "✗ Tables don't exist - marking migration as rolled back and retrying..."
            npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION"
            echo "Retrying migration..."
            npx prisma migrate deploy
        fi
    fi
elif [ $MIGRATE_EXIT_CODE -ne 0 ]; then
    # Migration failed for a different reason
    echo "Migration failed with exit code $MIGRATE_EXIT_CODE"
    cat /tmp/migrate.log
    exit 1
fi

echo "Migrations completed successfully"

# Seed database if AUTO_SEED is enabled (useful for first deployment)
if [ "$AUTO_SEED" = "true" ]; then
    echo "AUTO_SEED is enabled, checking if database needs seeding..."

    # Check if demo user exists (if not, database is empty)
    USER_EXISTS=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT EXISTS (SELECT 1 FROM users WHERE email = 'demo@o3c.dev');" 2>/dev/null || echo "f")

    if [ "$USER_EXISTS" = "f" ]; then
        echo "Database is empty, running seed..."
        npx prisma db seed
        echo "✓ Database seeded successfully"
    else
        echo "✓ Database already seeded, skipping"
    fi
fi

# Return to original directory before executing the main command
cd "$ORIGINAL_DIR"

# Execute the main command
exec "$@"
