#!/bin/bash

# Script to check if Docker is running and start it if needed
# This is a helper script for the development environment

echo "🐳 Checking Docker status..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker daemon is running
if ! docker info >/dev/null 2>&1; then
    echo "⚠️  Docker daemon is not running."
    
    # Try to start Docker (this works on some systems)
    if command -v systemctl &> /dev/null; then
        echo "🔄 Attempting to start Docker service..."
        sudo systemctl start docker
        
        # Wait a moment for Docker to start
        sleep 5
        
        # Check again
        if ! docker info >/dev/null 2>&1; then
            echo "❌ Failed to start Docker. Please start Docker manually."
            exit 1
        fi
        
        echo "✅ Docker service started successfully."
    else
        echo "❌ Please start Docker manually and run this script again."
        exit 1
    fi
else
    echo "✅ Docker is running."
fi

echo "🐳 Docker is ready for use."
