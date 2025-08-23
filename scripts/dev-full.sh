#!/bin/bash

# Development script to run both backend and frontend servers
# This script is for local development only and should not be committed to git

echo "🚀 Starting FinX Development Environment..."
echo "========================================"

# Check if required commands are available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js first."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Function to check if Docker daemon is running
check_docker_daemon() {
    echo "🐳 Checking Docker daemon status..."
    if ! docker info >/dev/null 2>&1; then
        echo "❌ Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    echo "✅ Docker daemon is running"
}

# Function to clean up processes on exit
cleanup() {
    echo -e "\n🛑 Shutting down servers..."
    
    # Stop Docker containers
    echo "Stopping Docker containers..."
    docker-compose down 2>/dev/null
    
    # Kill background processes if any are still running
    if [[ -n $BACKEND_PID ]]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [[ -n $FRONTEND_PID ]]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check Docker daemon status
check_docker_daemon

# Load environment variables from .env file
set -a
source .env
set +a

# Set additional environment variables
export DB_HOST=localhost
export DB_PORT=5432
export NODE_ENV=development

# Get the host IP address for network access
HOST_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "127.0.0.1")
if [ "$HOST_IP" = "" ]; then
    HOST_IP="127.0.0.1"
fi

echo "🌐 Host IP Address: $HOST_IP"

# Start database via Docker Compose with timeout
echo "🗄️  Starting database container..."
if ! timeout 60s docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d db; then
    echo "❌ Failed to start database container within 60 seconds"
    exit 1
fi

# Wait for database to be ready with improved healthcheck and error handling
echo "⏳ Waiting for database to be ready..."
MAX_RETRIES=30
DB_CONTAINER_RUNNING=false

for i in $(seq 1 $MAX_RETRIES); do
  # Check if container is running
  CONTAINER_STATE=$(docker inspect -f '{{.State.Status}}' finx-db 2>/dev/null || echo "missing")
  
  if [ "$CONTAINER_STATE" = "missing" ]; then
    echo "Database container not found. Retrying... ($i/$MAX_RETRIES)"
    sleep 2
    continue
  fi
  
  if [ "$CONTAINER_STATE" != "running" ]; then
    echo "Database container is in state: $CONTAINER_STATE"
    if [ "$i" -eq "$MAX_RETRIES" ]; then
      echo "❌ Database container failed to start. Showing logs:"
      docker logs finx-db
      exit 1
    fi
    sleep 2
    continue
  fi

  # Check database readiness
  if docker exec finx-db sh -c 'pg_isready -U finx_admin -d finx_prod' >/dev/null 2>&1; then
    DB_CONTAINER_RUNNING=true
    break
  fi
  
  echo "Waiting for database... ($i/$MAX_RETRIES)"
  sleep 2
done

if [ "$DB_CONTAINER_RUNNING" != "true" ]; then
  echo "❌ Database failed to become ready after $MAX_RETRIES attempts. Showing logs:"
  docker logs finx-db
  exit 1
fi

# Initialize database with sample data if needed
echo "📊 Initializing database with sample data if needed..."
# Use the same check as in start-backend.sh
echo "Running query: SELECT 1 FROM users WHERE is_admin = 'true'"
result=$(docker exec finx-db psql -U finx_admin -d finx_prod -c "SELECT 1 FROM users WHERE is_admin = 'true'" 2>&1)
echo "Query result: $result"
if ! echo "$result" | grep -q "1 row"; then
  echo "Initializing database..."
  for i in {1..5}; do
    if node scripts/init-db.js; then
      echo "✅ Database initialized successfully"
      break
    fi
    sleep 5
    echo "Retrying database initialization... ($i/5)"
    if [ $i -eq 5 ]; then
      echo "❌ Failed to initialize database after 5 attempts"
      exit 1
    fi
  done
fi

# Start backend server (localhost only for security)
echo "🔧 Starting backend server..."
# Use npx nodemon instead of npm start for development auto-reloading
# Bind to localhost only - API calls will be proxied through Vite
npx nodemon server.js &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Verify backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend server failed to start"
    exit 1
fi

# Start frontend server with host binding for development access
echo "🎨 Starting frontend server..."
cd frontend
# Bind to 0.0.0.0 to allow external access with security considerations
HOST=0.0.0.0 npm start &
FRONTEND_PID=$!
cd ..

# Wait a moment for frontend to start
sleep 3

# Verify frontend is running
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Frontend server failed to start"
    exit 1
fi

echo ""
echo "✅ Development environment started!"
echo "   Database: PostgreSQL (Docker container - localhost only)"
echo "   Backend: http://localhost:5000"
echo "   Frontend: http://localhost:3000"
echo ""
echo "⚠️  SECURITY WARNING: This development environment is accessible from other devices"
echo "   on your local network. Only use this for development/testing purposes."
echo "   Do not expose this environment to public networks."
echo ""
echo "🔄 Press Ctrl+C to stop all services"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
