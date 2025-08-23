// Script to quickly start the development environment
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('FinX Development Environment Starter');
console.log('=====================================');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  .env file not found!');
  console.log('Please create a .env file with your configuration.');
  console.log('Refer to LOCAL_TESTING.md for setup instructions.');
  process.exit(1);
}

console.log('Starting development environment...');

// Start backend server
console.log('🚀 Starting backend server...');
const backend = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..')
});

// Start frontend server after a short delay
setTimeout(() => {
  console.log('🎨 Starting frontend server...');
  const frontend = spawn('npm', ['start'], {
    cwd: path.join(__dirname, '..', 'frontend'),
    stdio: 'inherit'
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down servers...');
    backend.kill();
    frontend.kill();
    process.exit(0);
  });
}, 3000);

console.log('\n📖 To stop the servers, press Ctrl+C');
console.log('📖 For testing instructions, see TESTING_PLAN.md');
