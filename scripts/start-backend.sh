#!/bin/sh

# Required environment variables
[ -z "$DB_HOST" ] && { echo "DB_HOST environment variable is required"; exit 1; }
[ -z "$DB_PORT" ] && { echo "DB_PORT environment variable is required"; exit 1; }
[ -z "$DB_USER" ] && { echo "DB_USER environment variable is required"; exit 1; }
[ -z "$DB_PASSWORD" ] && { echo "DB_PASSWORD environment variable is required"; exit 1; }

# Optional configuration
MAX_ATTEMPTS=${MAX_ATTEMPTS:-30}
SLEEP_TIME=${SLEEP_TIME:-2}

echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT to become available..."
attempt=1

while [ $attempt -le $MAX_ATTEMPTS ]; do
  if pg_isready --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" >/dev/null 2>&1; then
    echo "PostgreSQL ready!"
    break
  fi
  
  echo "PostgreSQL unavailable ($attempt/$MAX_ATTEMPTS), retrying in $SLEEP_TIME seconds..."
  attempt=$((attempt + 1))
  sleep "$SLEEP_TIME"
done

if [ $attempt -gt $MAX_ATTEMPTS ]; then
  echo "Error: Could not connect to PostgreSQL after $MAX_ATTEMPTS attempts" >&2
  exit 1
fi

# Run database initialization if needed
echo "Checking if database initialization is required..."
echo "Running query: SELECT 1 FROM users WHERE email = 'admin@finx.local'"
result=$(psql "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" -c "SELECT 1 FROM users WHERE email = 'admin@finx.local'" 2>&1)
echo "Query result: $result"
if ! echo "$result" | grep -q "1 row"; then
  echo "Initializing database..."
  node scripts/init-db.js
fi

echo "Starting Node.js application..."
exec npm start
