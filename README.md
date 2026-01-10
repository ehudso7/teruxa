# UGC Localizer + Angle Engine + Winner Loop

A production-grade SaaS application for generating, localizing, and optimizing UGC (User Generated Content) ad creatives.

## Features

- **Angle Engine**: Generate structured ad angles (hook, problem, solution, CTA) from product seed data using AI
- **UGC Localizer**: Localize scripts, captions, and on-screen text for multiple locales and platforms
- **Creative Packs**: Bundle localized content into downloadable ZIP packages
- **Winner Loop**: Import performance data, identify winning patterns, and generate optimized iterations

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

- Node.js 18+
- PostgreSQL 14+ (or use Docker)
- OpenAI API key (optional - mock mode available)
- Network access to `binaries.prisma.sh` (required for Prisma client generation)

> **Note**: The backend build requires Prisma client generation, which downloads binaries from Prisma's servers. If you're behind a corporate firewall or in a restricted network environment, you may need to configure proxy settings or whitelist `binaries.prisma.sh`.

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd New-Repo

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
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ugc_localizer?schema=public"

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
```

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
