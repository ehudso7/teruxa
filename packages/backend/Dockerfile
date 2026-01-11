# Production Dockerfile for Backend
FROM node:20-alpine AS builder

# Install build dependencies and apply security patches
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files from root and backend
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/

# Copy root tsconfig.json (required for backend tsconfig extends)
COPY tsconfig.json ./

# Install all dependencies (needed for build)
RUN npm ci && npm rebuild

# Copy backend source code
COPY packages/backend ./packages/backend

# Generate Prisma Client
WORKDIR /app/packages/backend
RUN npx prisma generate

# Build the backend
RUN npm run build

# Production stage
FROM node:20-alpine

# Apply security patches and install dumb-init for proper signal handling
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/backend/package*.json ./packages/backend/

# Install production dependencies only
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm rebuild

# Copy built application and Prisma files
COPY --from=builder --chown=nodejs:nodejs /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/backend/prisma ./packages/backend/prisma
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Set production environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "packages/backend/dist/index.js"]