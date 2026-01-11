#!/bin/bash

# Local Security Scanning Script
# Run this before pushing code to catch vulnerabilities early

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SEVERITY_THRESHOLD="HIGH,CRITICAL"
BACKEND_IMAGE="teruxa-backend"
FRONTEND_IMAGE="teruxa-frontend"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check for required tools
check_dependencies() {
    log_info "Checking for required tools..."

    local missing_tools=()

    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi

    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install missing tools and try again"
        exit 1
    fi

    log_success "All required tools are installed"
}

# Run npm audit
run_npm_audit() {
    log_info "Running npm dependency audit..."

    if npm audit --audit-level=high; then
        log_success "No high or critical vulnerabilities in npm dependencies"
    else
        log_warning "Found vulnerabilities in npm dependencies"
        log_info "Run 'npm audit fix' to attempt automatic fixes"
    fi
}

# Build Docker images if needed
build_images() {
    log_info "Building Docker images for scanning..."

    # Build backend
    log_info "Building backend image..."
    docker build -f packages/backend/Dockerfile -t ${BACKEND_IMAGE}:latest . || {
        log_error "Failed to build backend image"
        exit 1
    }

    # Build frontend
    log_info "Building frontend image..."
    docker build -f packages/frontend/Dockerfile -t ${FRONTEND_IMAGE}:latest . || {
        log_error "Failed to build frontend image"
        exit 1
    }

    log_success "Docker images built successfully"
}

# Install Trivy if not present
install_trivy() {
    if ! command -v trivy &> /dev/null; then
        log_info "Trivy not found, attempting to use Docker image..."
        TRIVY_CMD="docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image"
    else
        TRIVY_CMD="trivy image"
    fi
}

# Scan Docker image with Trivy
scan_image() {
    local image_name=$1
    local report_name=$2

    log_info "Scanning $image_name for vulnerabilities..."

    # Create reports directory if it doesn't exist
    mkdir -p security-reports

    # Run scan with table output to console
    if $TRIVY_CMD --severity ${SEVERITY_THRESHOLD} --exit-code 1 ${image_name}:latest; then
        log_success "$image_name has no ${SEVERITY_THRESHOLD} vulnerabilities"
    else
        log_warning "$image_name has vulnerabilities that need attention"
        SCAN_FAILED=true
    fi

    # Generate detailed JSON report
    $TRIVY_CMD --format json --output security-reports/${report_name}.json ${image_name}:latest || true

    # Generate SARIF report for GitHub
    $TRIVY_CMD --format sarif --output security-reports/${report_name}.sarif ${image_name}:latest || true
}

# Generate SBOM
generate_sbom() {
    local image_name=$1
    local sbom_name=$2

    log_info "Generating SBOM for $image_name..."

    $TRIVY_CMD --format cyclonedx --output security-reports/${sbom_name}-sbom.json ${image_name}:latest || {
        log_warning "Failed to generate SBOM for $image_name"
    }
}

# Main execution
main() {
    log_info "=== Starting Security Scan ==="

    SCAN_FAILED=false

    # Check dependencies
    check_dependencies

    # Run npm audit
    run_npm_audit

    # Build images
    build_images

    # Install/setup Trivy
    install_trivy

    # Scan images
    scan_image ${BACKEND_IMAGE} "backend-vulns"
    scan_image ${FRONTEND_IMAGE} "frontend-vulns"

    # Generate SBOMs
    generate_sbom ${BACKEND_IMAGE} "backend"
    generate_sbom ${FRONTEND_IMAGE} "frontend"

    # Summary
    echo
    log_info "=== Scan Complete ==="

    if [ "$SCAN_FAILED" = true ]; then
        log_warning "Security issues found. Review the output above and security-reports/ directory"
        log_info "To ignore specific vulnerabilities, add them to .trivyignore with explanations"
        exit 1
    else
        log_success "All security checks passed!"
    fi

    log_info "Detailed reports saved in security-reports/ directory"
}

# Run main function
main "$@"