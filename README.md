# Teruxa UGC Ops

A production-grade SaaS application for generating, localizing, and optimizing UGC (User Generated Content) ad creatives.

## Features

- **Create**: Generate structured ad angles (hook, problem, solution, CTA) from product seed data
- **Localize**: Localize scripts, captions, and on-screen text for multiple locales and platforms
- **Build packs**: Bundle localized content into downloadable ZIP packages
- **Iterate winners**: Import performance data, identify winning patterns, and generate optimized iterations

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Tailwind CSS, React Query, Vite |
| Backend | Express.js, TypeScript, Prisma ORM |
| Database | PostgreSQL |
| AI | OpenAI GPT-4 (with mock mode for development) |
| Testing | Vitest, Playwright |

## Getting Started

### Prerequisites

- Node.js 20 LTS (v20.x recommended, see .nvmrc)
- PostgreSQL 14+ (or use Docker)
- OpenAI API key (optional - mock mode available)
- Network access to `binaries.prisma.sh` (required for Prisma client generation)

> **Note**: The backend build requires Prisma client generation, which downloads binaries from Prisma's servers. If you're behind a corporate firewall or in a restricted network environment:
> - You may need to configure proxy settings or whitelist `binaries.prisma.sh`
> - Alternatively, set `PRISMA_ENGINES_MIRROR` environment variable to use a custom mirror:
>   ```bash
>   export PRISMA_ENGINES_MIRROR=https://your-mirror.com
>   ```

### Installation

```bash
# Clone the repository
git clone https://github.com/ehudso7/teruxa.git
cd teruxa

# Install dependencies
npm install

# Set up environment variables
cp packages/backend/.env.example packages/backend/.env
# Edit .env with your database URL and optional OpenAI key

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Start development servers
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/teruxa?schema=public"

# Server
PORT=3001
NODE_ENV=development

# OpenAI (optional - mock mode available)
OPENAI_API_KEY=sk-your-key-here
AI_MOCK_MODE=true  # Set to false to use real OpenAI

# CORS
CORS_ORIGIN=http://localhost:5173
```

### Development

```bash
# Start both frontend and backend
npm run dev

# Start only backend
npm run dev:backend

# Start only frontend
npm run dev:frontend

# Run tests
npm run test

# Run linting
npm run lint

# Run production release check (requires Docker)
npm run release:check
```

## Release Check

The release check performs a complete production cold-start verification, ensuring the app can be built and run from scratch with production guards enforced.

### Running Release Check Locally

```bash
# Prerequisites
# - Docker and Docker Compose installed
# - Clean repository state (commit or stash changes)

# Run the release check
npm run release:check
```

This will:
1. Run build verification (typecheck, lint, production build)
2. Build Docker images for frontend and backend
3. Start PostgreSQL, backend, and frontend in production mode
4. Wait for health checks
5. Perform HTTP smoke tests on critical endpoints
6. Verify security headers
7. Validate production environment guards
8. Clean up containers and volumes

### Production Environment Variables

For production deployments, these environment variables are required:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | OpenAI API key (starts with `sk-`) |
| `CORS_ORIGIN` | Yes | Allowed origin for CORS (e.g., `https://app.example.com`) |
| `PORT` | No | Backend port (default: 3001) |
| `AI_MOCK_MODE` | No | Must be `false` or unset in production |

### CI Integration

The release check runs as a required gate in our CI pipeline:

#### CI Gates (in order)

1. **ci job** - Core validation
   - Type checking (`npm run typecheck:all`)
   - Linting (`npm run lint:all`)
   - Production build (`npm run build:all`)
   - Unit tests (`npm run test`)
   - Smoke tests (`npm run test:smoke`)
   - Full E2E tests (`npm run test:e2e`)

2. **release-check job** - Docker cold-start validation
   - Docker image builds
   - Production environment startup
   - Health checks and smoke tests
   - Security header validation
   - Production guard enforcement

3. **release-validation job** - Main branch only
   - Final production build validation
   - Uses production environment variables

#### Running in GitHub Actions

```yaml
# Automatically runs on all PRs and pushes to main
- name: Run Release Check
  run: npm run release:check
```

The release check completes in ~30-90 seconds with Docker caching enabled. It runs in parallel with the main CI job for faster feedback.

#### Artifacts on Failure

When the release check fails, these artifacts are preserved:
- `release-check.log` - Full command output
- `docker-logs.txt` - Container logs from all services
- `test-results/` - Playwright test results (if applicable)
- `playwright-report/` - HTML test report (if applicable)

Access these via the GitHub Actions UI under "Artifacts".

## Security & Supply Chain Gates

Our CI/CD pipeline includes comprehensive security scanning to identify and prevent vulnerabilities from entering production.

### Security Gates Overview

| Gate | Type | When It Runs | Blocks PR | Description |
|------|------|--------------|-----------|-------------|
| **Dependency Review** | Supply Chain | Every PR | ✅ Yes | Blocks PRs introducing high/critical vulnerable dependencies |
| **CodeQL** | SAST | PR + Push + Weekly | ❌ No* | Static analysis for security vulnerabilities |
| **Container Scan** | Vulnerability | PR + Push | ✅ Yes | Scans Docker images for OS & library vulnerabilities |
| **NPM Audit** | Supply Chain | PR + Push | ✅ Yes | Audits npm dependencies for known vulnerabilities |
| **SBOM Generation** | Supply Chain | PR + Push | ❌ No | Generates Software Bill of Materials |

*CodeQL results appear in the Security tab but don't block PRs by default (configurable)

### Security Workflows

#### 1. Dependency Review (PR-only)
- **File**: `.github/workflows/dependency-review.yml`
- **Purpose**: Prevent introduction of vulnerable or problematic dependencies
- **Checks**:
  - High/critical vulnerabilities in new dependencies
  - License compliance (blocks GPL, AGPL, LGPL)
  - Provides detailed comments on PRs

#### 2. CodeQL Analysis
- **File**: `.github/workflows/codeql.yml`
- **Purpose**: Static Application Security Testing (SAST)
- **Coverage**: JavaScript/TypeScript code
- **Schedule**: On push, PR, and weekly scan
- **Results**: Available in GitHub Security tab

#### 3. Container Security Scanning
- **File**: `.github/workflows/security-scan.yml`
- **Purpose**: Scan Docker images for vulnerabilities
- **Tool**: Trivy
- **Threshold**: Fails on HIGH and CRITICAL vulnerabilities
- **Outputs**:
  - SARIF reports uploaded to Security tab
  - JSON vulnerability reports
  - SBOMs in CycloneDX format
  - Summary reports in artifacts

#### 4. Supply Chain Security
- **NPM Audit**: Runs on every build
- **SBOM Generation**: Creates Software Bill of Materials for:
  - Docker images (via Trivy)
  - NPM dependencies (via CycloneDX)
- **Provenance**: Docker builds include attestations

### Local Security Scanning

Run security scans locally before pushing:

```bash
# Full security scan (npm + Docker images)
npm run security:scan

# NPM audit only
npm run security:audit

# Fix npm vulnerabilities automatically
npm run security:fix

# Manual Trivy scan (requires Docker)
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image teruxa-backend:latest
```

### Managing Vulnerabilities

#### Ignoring False Positives

Add vulnerabilities to `.trivyignore` with explanations:

```
# CVE-2021-12345 - False positive, not applicable to our usage
CVE-2021-12345
```

#### Vulnerability Response Process

1. **Critical/High**: Must be fixed before merging
2. **Medium**: Fix in next release cycle
3. **Low**: Track and fix in regular maintenance

### Security Artifacts

All security scans produce artifacts available in GitHub Actions:

- **Vulnerability Reports**: Detailed JSON reports for each scan
- **SARIF Files**: Integrated with GitHub Security tab
- **SBOMs**: Software Bill of Materials in CycloneDX format
- **Scan Summaries**: Human-readable summaries

### Security Best Practices

1. **Regular Updates**: Keep dependencies and base images updated
2. **Minimal Images**: Use Alpine-based images where possible
3. **Non-root Users**: All containers run as non-root users
4. **Secret Scanning**: GitHub secret scanning is enabled
5. **Security Headers**: Production includes security headers (CSP, HSTS, etc.)

### Compliance

- **License Checking**: Automated license compliance checking
- **SBOM Generation**: Full supply chain transparency
- **Audit Trail**: All security scans are logged and archived
- **Attestations**: Docker images include provenance attestations

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create a project with seed data
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Angles
- `POST /api/angles/projects/:projectId/generate` - Generate angle cards
- `GET /api/angles/projects/:projectId/angles` - List project angles
- `GET /api/angles/:id` - Get angle details
- `PUT /api/angles/:id` - Update angle
- `PATCH /api/angles/:id/status` - Update angle status
- `DELETE /api/angles/:id` - Delete angle

### Localizations
- `POST /api/localizations/angles/:angleId/localize` - Generate localizations
- `GET /api/localizations/angles/:angleId/localizations` - List localizations
- `PUT /api/localizations/:id` - Update localized content

### Creative Packs
- `POST /api/packs/projects/:projectId/packs` - Create pack
- `GET /api/packs/projects/:projectId/packs` - List packs
- `GET /api/packs/:id/download` - Download pack ZIP

### Performance
- `POST /api/performance/projects/:projectId/performance/import` - Import CSV
- `GET /api/performance/projects/:projectId/performance/metrics` - Get metrics
- `POST /api/performance/projects/:projectId/performance/winners` - Identify winners
- `POST /api/performance/projects/:projectId/performance/iterate` - Generate iterations

## CSV Import Format

```csv
angle_id,impressions,clicks,conversions,spend,revenue,platform,locale
uuid-here,10000,500,50,100.00,250.00,tiktok,en-US
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

## Data Model

See [DATA_MODEL.md](./DATA_MODEL.md) for database schema and relationships.

## Implementation Plan

See [PLAN.md](./PLAN.md) for development roadmap and task tracking.

## Supported Locales

- English (US) - `en-US`
- Spanish (Spain) - `es-ES`
- French (France) - `fr-FR`
- German (Germany) - `de-DE`
- Portuguese (Brazil) - `pt-BR`

## Supported Platforms

- TikTok
- Instagram Reels
- YouTube Shorts

## License

Private - All rights reserved
