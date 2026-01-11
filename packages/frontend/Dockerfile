# Production Dockerfile for Frontend
# Using pinned base image for reproducible builds
FROM node:20.18.0-alpine3.20 AS builder

WORKDIR /app

# Copy package files from root and frontend
COPY package*.json ./
COPY packages/frontend/package*.json ./packages/frontend/

# Install all dependencies (needed for build)
# Note: Rollup native binaries are declared in optionalDependencies
RUN npm ci && npm rebuild

# Copy frontend source code
COPY packages/frontend ./packages/frontend

# Build the frontend with production environment
WORKDIR /app/packages/frontend
ENV NODE_ENV=production
RUN npm run build

# Production stage - nginx with pinned version for reproducible builds
FROM nginx:1.27.3-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY packages/frontend/nginx.conf /etc/nginx/nginx.conf

# Copy built static files
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# Create non-root user
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S nginx-user -u 1001 && \
    chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx-user:nginx-user /var/run/nginx.pid

# Switch to non-root user
USER nginx-user

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
