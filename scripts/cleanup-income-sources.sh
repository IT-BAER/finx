#!/bin/bash

# Income Source Cleanup Script for FinX
# This script helps clean up sources that were incorrectly created when adding income transactions

echo "🔧 FinX Income Source Cleanup Tool"
echo "=================================="
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed or not in PATH"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "scripts" ]; then
    echo "❌ Please run this script from the FinX root directory"
    exit 1
fi

# Check if the cleanup script exists
if [ ! -f "scripts/cleanup-income-sources.js" ]; then
    echo "❌ Cleanup script not found at scripts/cleanup-income-sources.js"
    exit 1
fi

# Parse command line arguments
if [ "$1" = "--fix" ] || [ "$1" = "-f" ]; then
    echo "⚠️  WARNING: This will modify your database!"
    echo "⚠️  Make sure you have a backup before proceeding."
    echo ""
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Operation cancelled"
        exit 1
    fi
    
    echo ""
    echo "🔄 Running income source cleanup (with fixes)..."
    node scripts/cleanup-income-sources.js --fix
else
    echo "🔍 Running analysis (no changes will be made)..."
    echo "This will show you what sources need to be cleaned up."
    echo ""
    node scripts/cleanup-income-sources.js
fi

echo ""
echo "🏁 Script completed!"
