/* eslint-disable no-console */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Cleaning dist directory...');
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}

console.log('Creating dist directory...');
fs.mkdirSync('dist', { recursive: true });

console.log('Bundling with tsup...');
execSync('tsup', { stdio: 'inherit' });

// Make CLI executable
const cliPath = path.join('dist', 'cli.js');
if (fs.existsSync(cliPath)) {
  fs.chmodSync(cliPath, '755');
}

console.log('Build completed successfully!');
