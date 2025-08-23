#!/bin/bash

# Build script for FinX application

echo "🚀 Building FinX application..."

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js is installed"

# Check if npm is installed
if ! command -v npm &> /dev/null
then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm is installed"

# Build backend (no build step needed for Node.js)
echo "📦 Backend: No build required for Node.js"

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm install
npm run build
cd ..

if [ -d "frontend/build" ]; then
    echo "✅ Frontend build successful"
    echo "📁 Build output is in frontend/build/"
else
    echo "❌ Frontend build failed"
    exit 1
fi

echo "🎉 Build complete!"
echo ""
echo "Next steps for deployment:"
echo "1. Configure your .env file with production values"
echo "2. Start the backend with PM2: pm2 start server.js --name finx-api"
echo "3. Deploy the frontend/build directory to your web server"
echo "4. Configure Apache2/Nginx to serve static files and proxy /api requests"
echo "5. See SIMPLIFIED_DEPLOYMENT.md for detailed instructions"
