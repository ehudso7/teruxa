# Production Dockerfile for Frontend
FROM node:20-alpine AS builder

# Apply security patches
RUN apk update && apk upgrade --no-cache

WORKDIR /app

# Copy package files from root and frontend
COPY package*.json ./
COPY packages/frontend/package*.json ./packages/frontend/

# Install all dependencies (needed for build)
# Note: Alpine uses musl libc, so we need @rollup/rollup-linux-x64-musl
RUN npm ci && \
    if ! npm install --no-save --force @rollup/rollup-linux-x64-musl 2>/dev/null; then \
      echo "Warning: Could not install @rollup/rollup-linux-x64-musl, continuing anyway"; \
    fi && \
    npm rebuild

# Copy frontend source code
COPY packages/frontend ./packages/frontend

# Build the frontend with production environment
WORKDIR /app/packages/frontend
ENV NODE_ENV=production
RUN npm run build

# Production stage - nginx
FROM nginx:alpine

# Apply security patches and install curl for health checks
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache curl

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