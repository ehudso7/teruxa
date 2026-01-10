#!/bin/bash

# Test Setup Script for E2E Tests
# This script ensures the test environment is properly configured

set -e

echo "🔧 Setting up test environment..."

# Check if .env file exists for backend
if [ ! -f packages/backend/.env ]; then
  echo "📝 Creating backend .env file..."
  cat > packages/backend/.env << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ugc_test?schema=public
PORT=3001
NODE_ENV=test
AI_MOCK_MODE=true
CORS_ORIGIN=http://localhost:5173
EOF
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
  echo "📦 Installing dependencies..."
  npm ci
fi

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
npm run db:generate

# Check if PostgreSQL is running (basic check)
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
  echo "⚠️  PostgreSQL is not running on localhost:5432"
  echo "   Please start PostgreSQL or update DATABASE_URL in packages/backend/.env"
  exit 1
fi

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:migrate || npm run db:push

echo "✅ Test environment setup complete!"
echo ""
echo "You can now run:"
echo "  npm run test:e2e    - Run E2E tests"
echo "  npm run test        - Run unit tests"
echo "  npm run dev         - Start development servers"