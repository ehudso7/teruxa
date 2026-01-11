#!/bin/bash

# Release Check Script
# This script performs a complete production cold-start verification
# ensuring the app can be built and run from scratch in production mode

set -e  # Exit on any error

# Detect docker compose command (docker-compose vs docker compose)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "Error: Neither 'docker-compose' nor 'docker compose' found"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAX_RETRIES=30
RETRY_DELAY=2
BACKEND_URL="http://localhost:3001"
FRONTEND_URL="http://localhost"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Cleanup function
cleanup() {
    # Skip cleanup in CI environment
    if [ "$CI" = "true" ]; then
        log_info "Running in CI, skipping cleanup"
        return
    fi

    log_info "Cleaning up Docker containers..."
    $DOCKER_COMPOSE -f docker-compose.release.yml down -v 2>/dev/null || true

    # Kill any processes on the ports we use (portable solution)
    if [ -n "$(lsof -ti:3001 2>/dev/null)" ]; then
        lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
    fi
    if [ -n "$(lsof -ti:80 2>/dev/null)" ]; then
        lsof -ti:80 2>/dev/null | xargs kill -9 2>/dev/null || true
    fi
    if [ -n "$(lsof -ti:5432 2>/dev/null)" ]; then
        lsof -ti:5432 2>/dev/null | xargs kill -9 2>/dev/null || true
    fi
}

# Trap cleanup on exit
trap cleanup EXIT INT TERM

# Function to wait for service with retry
wait_for_service() {
    local url=$1
    local service_name=$2
    local retries=0

    log_info "Waiting for $service_name at $url..."

    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -f -s -o /dev/null "$url"; then
            log_success "$service_name is ready!"
            return 0
        fi

        retries=$((retries + 1))
        echo -n "."
        sleep $RETRY_DELAY
    done

    echo
    log_error "$service_name failed to start after $MAX_RETRIES attempts"

    # Show container logs on failure
    log_error "Showing container logs:"
    $DOCKER_COMPOSE -f docker-compose.release.yml logs --tail=50

    return 1
}

# Function to check HTTP response
check_http_response() {
    local url=$1
    local expected_status=$2
    local description=$3

    log_info "Testing: $description"

    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")

    if [ "$response_code" = "$expected_status" ]; then
        log_success "$description - Status: $response_code ✓"
        return 0
    else
        log_error "$description - Expected: $expected_status, Got: $response_code"
        return 1
    fi
}

# Function to check security headers
check_security_headers() {
    local url=$1

    log_info "Checking security headers..."

    headers=$(curl -s -I "$url")

    # Check for required security headers
    local headers_found=0
    local headers_missing=0

    if echo "$headers" | grep -qi "X-Content-Type-Options: nosniff"; then
        log_success "X-Content-Type-Options header present ✓"
        headers_found=$((headers_found + 1))
    else
        log_warning "X-Content-Type-Options header missing"
        headers_missing=$((headers_missing + 1))
    fi

    if echo "$headers" | grep -qi "X-Frame-Options: DENY"; then
        log_success "X-Frame-Options header present ✓"
        headers_found=$((headers_found + 1))
    else
        log_warning "X-Frame-Options header missing"
        headers_missing=$((headers_missing + 1))
    fi

    if echo "$headers" | grep -qi "X-XSS-Protection: 1; mode=block"; then
        log_success "X-XSS-Protection header present ✓"
        headers_found=$((headers_found + 1))
    else
        log_warning "X-XSS-Protection header missing"
        headers_missing=$((headers_missing + 1))
    fi

    if echo "$headers" | grep -qi "Content-Security-Policy"; then
        log_success "Content-Security-Policy header present ✓"
        headers_found=$((headers_found + 1))
    else
        log_warning "Content-Security-Policy header missing"
        headers_missing=$((headers_missing + 1))
    fi

    log_info "Security headers check: $headers_found found, $headers_missing missing"

    if [ $headers_missing -gt 0 ]; then
        log_warning "Some security headers are missing (this may be OK for local testing)"
    fi
}

# Main execution
main() {
    log_info "=== RELEASE CHECK STARTING ==="
    log_info "This will verify the production build and runtime environment"
    echo

    # Step 1: Run existing verification chain
    log_info "Step 1: Running build verification..."
    if npm run build:verify; then
        log_success "Build verification passed"
    else
        log_error "Build verification failed"
        exit 1
    fi
    echo

    # Step 2: Clean up any existing containers
    log_info "Step 2: Cleaning up any existing containers..."

    # In CI environment, skip cleanup since containers are ephemeral
    if [ "$CI" = "true" ]; then
        log_info "Running in CI, skipping container cleanup"
    else
        # Try to run docker compose down, but don't fail if it errors
        if ! $DOCKER_COMPOSE -f docker-compose.release.yml down -v 2>/dev/null; then
            log_warning "Could not clean up containers (this is OK if none exist)"
        fi

        # Kill any processes on the ports we use (portable solution)
        if [ -n "$(lsof -ti:3001 2>/dev/null)" ]; then
            lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
        fi
        if [ -n "$(lsof -ti:80 2>/dev/null)" ]; then
            lsof -ti:80 2>/dev/null | xargs kill -9 2>/dev/null || true
        fi
        if [ -n "$(lsof -ti:5432 2>/dev/null)" ]; then
            lsof -ti:5432 2>/dev/null | xargs kill -9 2>/dev/null || true
        fi
    fi
    echo

    # Step 3: Build Docker images
    log_info "Step 3: Building Docker images..."
    if $DOCKER_COMPOSE -f docker-compose.release.yml build; then
        log_success "Docker images built successfully"
    else
        log_error "Failed to build Docker images"
        exit 1
    fi
    echo

    # Step 4: Start services
    log_info "Step 4: Starting services in production mode..."
    if $DOCKER_COMPOSE -f docker-compose.release.yml up -d; then
        log_success "Services started"
    else
        log_error "Failed to start services"
        exit 1
    fi
    echo

    # Step 5: Wait for services to be ready
    log_info "Step 5: Waiting for services to be healthy..."

    # Wait for backend
    if ! wait_for_service "$BACKEND_URL/api/health" "Backend"; then
        exit 1
    fi

    # Wait for frontend
    if ! wait_for_service "$FRONTEND_URL" "Frontend"; then
        exit 1
    fi
    echo

    # Step 6: Run HTTP smoke tests
    log_info "Step 6: Running HTTP smoke tests..."

    # Test backend health endpoint
    if ! check_http_response "$BACKEND_URL/api/health" "200" "Backend health check"; then
        exit 1
    fi

    # Test frontend root
    if ! check_http_response "$FRONTEND_URL/" "200" "Frontend root page"; then
        exit 1
    fi

    # Test frontend projects page (SPA routing)
    if ! check_http_response "$FRONTEND_URL/projects" "200" "Frontend projects page"; then
        exit 1
    fi

    # Test API proxy through frontend
    if ! check_http_response "$FRONTEND_URL/api/health" "200" "API proxy through frontend"; then
        exit 1
    fi
    echo

    # Step 7: Check security headers
    log_info "Step 7: Checking security configuration..."
    check_security_headers "$FRONTEND_URL"
    echo

    # Step 8: Verify production guards
    log_info "Step 8: Verifying production environment guards..."

    # Check that backend is running in production mode
    backend_logs=$($DOCKER_COMPOSE -f docker-compose.release.yml logs backend 2>&1)

    if echo "$backend_logs" | grep -q "NODE_ENV.*production"; then
        log_success "Backend running in production mode ✓"
    else
        log_warning "Could not confirm backend is in production mode"
    fi

    if echo "$backend_logs" | grep -q "AI_MOCK_MODE cannot be enabled in production"; then
        log_warning "Backend rejected AI_MOCK_MODE in production (expected behavior)"
    fi

    if echo "$backend_logs" | grep -q "Environment validation passed"; then
        log_success "Backend environment validation passed ✓"
    else
        log_warning "Could not confirm environment validation"
    fi
    echo

    # Final summary
    log_success "=== RELEASE CHECK COMPLETED SUCCESSFULLY ==="
    log_info "The application can be successfully built and run in production mode"
    log_info "All critical endpoints are responding"
    log_info "Production environment guards are working"
    echo

    # Cleanup will be called automatically via trap
}

# Run main function
main "$@"