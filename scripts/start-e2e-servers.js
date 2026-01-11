#!/usr/bin/env node

/**
 * Starts backend and frontend servers for E2E testing
 * Handles database setup with prisma db push
 */

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

// Color output helpers
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const blue = (text) => `\x1b[34m${text}\x1b[0m`;

const rootDir = path.join(__dirname, '..');
const backendDir = path.join(rootDir, 'packages', 'backend');
const frontendDir = path.join(rootDir, 'packages', 'frontend');

// Environment setup
const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'test',
  AI_MOCK_MODE: 'true',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/teruxa_test?schema=public',
  PORT: '3001',
  VITE_API_URL: 'http://127.0.0.1:3001',
};

let backendProcess = null;
let frontendProcess = null;

// Cleanup on exit
function cleanup(exitCode = 0) {
  console.log(yellow('\n🔄 Shutting down servers...'));
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
  }
  if (frontendProcess) {
    frontendProcess.kill('SIGTERM');
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));

// Wait for a URL to be available
function waitForUrl(url, maxAttempts = 60, interval = 2000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      attempts++;

      http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
        } else {
          retry();
        }
      }).on('error', retry);

      function retry() {
        if (attempts >= maxAttempts) {
          reject(new Error(`Timeout waiting for ${url}`));
        } else {
          setTimeout(check, interval);
        }
      }
    };

    check();
  });
}

// Run a command and wait for it to complete
function runCommand(command, args, cwd, description) {
  return new Promise((resolve, reject) => {
    console.log(blue(`\n📦 ${description}...`));

    const proc = spawn(command, args, {
      cwd,
      env,
      stdio: 'inherit',
      shell: true,
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${description} failed with code ${code}`));
      } else {
        resolve();
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// Start a server process
function startServer(command, args, cwd, name) {
  return new Promise((resolve, reject) => {
    console.log(blue(`\n🚀 Starting ${name}...`));

    const proc = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    proc.stdout.on('data', (data) => {
      process.stdout.write(`[${name}] ${data}`);
    });

    proc.stderr.on('data', (data) => {
      process.stderr.write(`[${name}] ${data}`);
    });

    proc.on('error', (err) => {
      reject(err);
    });

    // Consider the server started after spawning
    setTimeout(() => resolve(proc), 1000);
  });
}

async function main() {
  try {
    console.log(green('🎭 Starting E2E test servers...\n'));
    console.log(yellow('Database URL: [REDACTED]'));

    // Step 1: Generate Prisma client
    await runCommand('npm', ['run', 'db:generate'], backendDir, 'Generating Prisma client');

    // Step 2: Push database schema (creates tables without migrations)
    await runCommand('npx', ['prisma', 'db', 'push', '--skip-generate'], backendDir, 'Pushing database schema');

    // Step 3: Start backend server
    backendProcess = await startServer('npm', ['run', 'dev'], backendDir, 'Backend');

    // Step 4: Wait for backend health check
    console.log(blue('\n⏳ Waiting for backend health check...'));
    await waitForUrl('http://127.0.0.1:3001/api/health');
    console.log(green('✅ Backend is ready!'));

    // Step 5: Start frontend server
    frontendProcess = await startServer('npm', ['run', 'dev', '--', '--port', '5173'], frontendDir, 'Frontend');

    // Step 6: Wait for frontend
    console.log(blue('\n⏳ Waiting for frontend...'));
    await waitForUrl('http://127.0.0.1:5173');
    console.log(green('✅ Frontend is ready!'));

    console.log(green('\n✨ All servers are running!'));
    console.log(yellow('Press Ctrl+C to stop servers\n'));

    // Keep the process running
    await new Promise(() => {});

  } catch (error) {
    console.error(red(`\n❌ Error: ${error.message}`));
    cleanup(1);
  }
}

main();