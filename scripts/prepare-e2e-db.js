#!/usr/bin/env node

/**
 * Prepare database for E2E tests
 * Runs prisma generate and db push
 */

const { execSync } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, '..', 'packages', 'backend');

// Set up environment
const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/teruxa_test?schema=public',
};

console.log('🗄️  Preparing database for E2E tests...');
console.log(`📍 Database URL: ${env.DATABASE_URL}`);

try {
  // Generate Prisma client
  console.log('📦 Generating Prisma client...');
  execSync('npm run db:generate', {
    cwd: backendDir,
    env,
    stdio: 'inherit',
  });

  // Push database schema
  console.log('🚀 Pushing database schema...');
  execSync('npx prisma db push --skip-generate', {
    cwd: backendDir,
    env,
    stdio: 'inherit',
  });

  console.log('✅ Database ready for E2E tests!');
} catch (error) {
  console.error('❌ Failed to prepare database:', error.message);
  process.exit(1);
}