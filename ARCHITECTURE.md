# Architecture Documentation

## Current State

**Status**: Empty repository with only a placeholder README.md

**Files**:
- `README.md` - Placeholder

**Infrastructure**: None

---

## Target Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Teruxa UGC Ops                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Frontend  │    │   Backend   │    │  Database   │    │   Storage   │  │
│  │   (React)   │◄──►│  (Express)  │◄──►│ (PostgreSQL)│    │   (Local)   │  │
│  │ TypeScript  │    │ TypeScript  │    │   Prisma    │    │             │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                            │                                    ▲          │
│                            ▼                                    │          │
│                     ┌─────────────┐                             │          │
│                     │   AI/LLM    │─────────────────────────────┘          │
│                     │  (OpenAI)   │  Generates content                     │
│                     └─────────────┘                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| Frontend | React 18 + TypeScript | Type safety, component reusability |
| UI Framework | Tailwind CSS | Rapid prototyping, utility-first |
| State Management | React Query + Zustand | Server state + client state separation |
| Backend | Express.js + TypeScript | Proven, flexible, excellent ecosystem |
| ORM | Prisma | Type-safe database access, migrations |
| Database | PostgreSQL | ACID compliance, JSON support, reliability |
| Validation | Zod | Runtime type validation, TypeScript integration |
| Testing | Jest + Playwright | Unit + E2E coverage |
| Build | Vite (FE) + TSC (BE) | Fast builds, ESM support |

### Core Modules

#### 1. Angle Generation (`/api/angles`)
Generates structured "Angle Cards" from seed input.

```
Input: SeedData {
  product_name, product_description, target_audience,
  key_benefits[], pain_points[], tone, platforms[]
}

Output: AngleCard[] {
  id, hook, problem_agitation, solution, cta,
  visual_direction, audio_notes, estimated_duration
}
```

**Responsibilities:**
- Parse and validate seed input
- Generate multiple angle variations via LLM
- Store angles with versioning
- Support manual editing and regeneration

#### 2. Localization (`/api/localize`)
Localizes scripts/captions/on-screen text per locale/platform.

```
Input: LocalizationRequest {
  angle_card_id, target_locales[], target_platforms[]
}

Output: LocalizedContent[] {
  locale, platform, script, captions[], on_screen_text[],
  cultural_notes, platform_specific_adjustments
}
```

**Responsibilities:**
- Translate and culturally adapt content
- Adjust for platform-specific requirements (TikTok vs IG vs YouTube)
- Handle character limits and format constraints
- Preserve brand voice across locales

#### 3. Creative Packs (`/api/packs`)
Bundles assets into downloadable packages.

```
Input: PackRequest {
  angle_ids[], locales[], formats[], include_assets
}

Output: CreativePack {
  id, name, download_url, manifest, created_at,
  contents: { scripts, captions, assets, metadata }
}
```

**Responsibilities:**
- Aggregate selected angles and localizations
- Generate downloadable ZIP archives
- Include structured manifest for import
- Track pack downloads and usage

#### 4. Performance Iteration (`/api/performance`)
Imports performance data and generates iterations based on winners.

```
Input: PerformanceCSV {
  angle_id, impressions, clicks, conversions, spend, revenue
}

Analysis: WinnerAnalysis {
  top_performers[], pattern_analysis, recommendations
}

Output: NextIteration {
  new_angles[] based on winner patterns
}
```

**Responsibilities:**
- Parse and validate performance CSV
- Calculate performance metrics (CTR, CPA, ROAS)
- Identify winning patterns
- Generate new angles based on winner characteristics

### Data Flow

```
                    ┌──────────────────────────────────────────────────┐
                    │               Performance Iteration               │
                    │  ┌─────────────────────────────────────────────┐ │
                    │  │ CSV Import → Analysis → Pattern Detection   │ │
                    │  └────────────────────────┬────────────────────┘ │
                    │                           │                      │
                    │                           ▼                      │
┌───────────┐       │  ┌─────────────────────────────────────────────┐ │
│   Seed    │──────►│  │           Angle Generation                  │ │
│   Input   │       │  │  Seed → LLM Generation → Angle Cards        │ │
└───────────┘       │  └────────────────────────┬────────────────────┘ │
                    │                           │                      │
                    │                           ▼                      │
                    │  ┌─────────────────────────────────────────────┐ │
                    │  │             Localization                     │ │
                    │  │  Angles → Translation → Platform Adaptation │ │
                    │  └────────────────────────┬────────────────────┘ │
                    │                           │                      │
                    │                           ▼                      │
                    │  ┌─────────────────────────────────────────────┐ │
                    │  │            Creative Packs                    │ │
                    │  │  Localized Content → ZIP Bundle → Download  │ │
                    │  └─────────────────────────────────────────────┘ │
                    └──────────────────────────────────────────────────┘
```

### Security Considerations

1. **Input Validation**: All inputs validated with Zod schemas
2. **SQL Injection**: Prevented via Prisma parameterized queries
3. **XSS Prevention**: React escaping + Content Security Policy
4. **File Upload**: Strict validation, size limits, type checking
5. **Rate Limiting**: Express rate limiter on API endpoints
6. **Authentication**: JWT tokens with secure httpOnly cookies (future)
7. **CORS**: Strict origin configuration

### Error Handling Strategy

```typescript
// Centralized error handling
class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
  }
}

// Error boundary on frontend
// Global error handler middleware on backend
// Structured logging with correlation IDs
```

### Directory Structure

```
/
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── controllers/     # Route handlers
│   │   │   ├── services/        # Business logic
│   │   │   ├── repositories/    # Data access
│   │   │   ├── middleware/      # Express middleware
│   │   │   ├── validators/      # Zod schemas
│   │   │   ├── utils/           # Shared utilities
│   │   │   ├── types/           # TypeScript types
│   │   │   └── index.ts         # Entry point
│   │   ├── prisma/
│   │   │   └── schema.prisma    # Database schema
│   │   ├── tests/
│   │   └── package.json
│   │
│   └── frontend/
│       ├── src/
│       │   ├── components/      # Reusable UI components
│       │   ├── pages/           # Route pages
│       │   ├── hooks/           # Custom React hooks
│       │   ├── services/        # API client
│       │   ├── store/           # State management
│       │   ├── types/           # TypeScript types
│       │   └── main.tsx         # Entry point
│       ├── tests/
│       └── package.json
│
├── e2e/                         # Playwright E2E tests
├── ARCHITECTURE.md
├── DATA_MODEL.md
├── PLAN.md
└── package.json                 # Workspace root
```

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM API failures | High - blocks content generation | Retry logic, fallback responses, caching |
| Large CSV uploads | Medium - server memory | Streaming parser, chunked processing |
| ZIP generation timeout | Medium - user experience | Background jobs, progress indicators |
| Database schema changes | Medium - data integrity | Prisma migrations, backup before deploy |
| Localization quality | Medium - brand reputation | Human review workflow (future) |

---

## MVP Scope Boundaries

### In Scope
- [x] Angle card generation from seed input
- [x] Basic localization (5 languages)
- [x] Platform adaptation (TikTok, Instagram, YouTube)
- [x] Creative pack download (ZIP)
- [x] CSV performance import
- [x] Winner identification
- [x] Next iteration generation

### Out of Scope (Future)
- [ ] User authentication/authorization
- [ ] Team collaboration
- [ ] Direct platform API integration
- [ ] Video generation
- [ ] A/B testing automation
- [ ] Real-time performance sync
