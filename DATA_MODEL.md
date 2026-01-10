# Data Model Documentation

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     Project     │       │   AngleCard     │       │ LocalizedContent│
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │──┐    │ id              │──┐    │ id              │
│ name            │  │    │ project_id (FK) │  │    │ angle_id (FK)   │
│ description     │  └───►│ version         │  └───►│ locale          │
│ seed_data (JSON)│       │ hook            │       │ platform        │
│ created_at      │       │ problem         │       │ script          │
│ updated_at      │       │ solution        │       │ captions (JSON) │
└─────────────────┘       │ cta             │       │ on_screen (JSON)│
                          │ visual_dir      │       │ cultural_notes  │
                          │ audio_notes     │       │ created_at      │
                          │ duration        │       └─────────────────┘
                          │ status          │
                          │ is_winner       │
                          │ created_at      │
                          └─────────────────┘
                                  │
                                  ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  CreativePack   │       │PackAngle (Join) │       │PerformanceData  │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │──┐    │ pack_id (FK)    │       │ id              │
│ name            │  └───►│ angle_id (FK)   │       │ angle_id (FK)   │
│ project_id (FK) │       │ locale          │       │ impressions     │
│ download_url    │       │ platform        │       │ clicks          │
│ manifest (JSON) │       └─────────────────┘       │ conversions     │
│ download_count  │                                 │ spend           │
│ created_at      │                                 │ revenue         │
└─────────────────┘                                 │ ctr             │
                                                    │ cpa             │
                                                    │ roas            │
                                                    │ import_batch    │
                                                    │ created_at      │
                                                    └─────────────────┘
```

## Tables

### 1. Project

The root entity representing a marketing campaign or product.

```sql
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    seed_data       JSONB NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**seed_data JSON Schema:**
```typescript
interface SeedData {
  product_name: string;
  product_description: string;
  target_audience: string;
  key_benefits: string[];
  pain_points: string[];
  tone: 'professional' | 'casual' | 'humorous' | 'urgent' | 'empathetic';
  platforms: ('tiktok' | 'instagram' | 'youtube')[];
  brand_guidelines?: string;
  competitors?: string[];
  unique_selling_points?: string[];
}
```

**Indexes:**
- `idx_projects_created_at` on `created_at DESC`

---

### 2. AngleCard

Generated content angles with full script structure.

```sql
CREATE TABLE angle_cards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version         INTEGER NOT NULL DEFAULT 1,
    hook            TEXT NOT NULL,
    problem_agitation TEXT NOT NULL,
    solution        TEXT NOT NULL,
    cta             TEXT NOT NULL,
    visual_direction TEXT,
    audio_notes     TEXT,
    estimated_duration INTEGER, -- seconds
    status          VARCHAR(50) DEFAULT 'draft',
    is_winner       BOOLEAN DEFAULT FALSE,
    parent_angle_id UUID REFERENCES angle_cards(id),
    generation_notes TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Status Values:**
- `draft` - Initial generated state
- `approved` - Manually approved for production
- `rejected` - Marked as not suitable
- `archived` - Old version, kept for reference

**Indexes:**
- `idx_angle_cards_project_id` on `project_id`
- `idx_angle_cards_status` on `status`
- `idx_angle_cards_is_winner` on `is_winner`
- `idx_angle_cards_parent` on `parent_angle_id`

---

### 3. LocalizedContent

Localized versions of angle cards per locale and platform.

```sql
CREATE TABLE localized_contents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    angle_id        UUID NOT NULL REFERENCES angle_cards(id) ON DELETE CASCADE,
    locale          VARCHAR(10) NOT NULL, -- e.g., 'en-US', 'es-ES'
    platform        VARCHAR(50) NOT NULL, -- 'tiktok', 'instagram', 'youtube'
    script          TEXT NOT NULL,
    captions        JSONB NOT NULL DEFAULT '[]',
    on_screen_text  JSONB NOT NULL DEFAULT '[]',
    cultural_notes  TEXT,
    platform_adjustments TEXT,
    character_count INTEGER,
    word_count      INTEGER,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(angle_id, locale, platform)
);
```

**captions JSON Schema:**
```typescript
interface Caption {
  timestamp_start: number; // seconds
  timestamp_end: number;
  text: string;
  style?: 'normal' | 'emphasis' | 'whisper';
}
```

**on_screen_text JSON Schema:**
```typescript
interface OnScreenText {
  timestamp: number;
  duration: number;
  text: string;
  position: 'top' | 'center' | 'bottom';
  animation?: 'fade' | 'slide' | 'pop';
}
```

**Indexes:**
- `idx_localized_angle_id` on `angle_id`
- `idx_localized_locale_platform` on `(locale, platform)`

---

### 4. CreativePack

Bundled downloads of localized content.

```sql
CREATE TABLE creative_packs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    download_url    TEXT,
    file_path       TEXT,
    file_size       BIGINT,
    manifest        JSONB NOT NULL DEFAULT '{}',
    download_count  INTEGER DEFAULT 0,
    expires_at      TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**manifest JSON Schema:**
```typescript
interface PackManifest {
  version: string;
  created_at: string;
  project_name: string;
  contents: {
    angles: number;
    locales: string[];
    platforms: string[];
    total_files: number;
  };
  files: {
    path: string;
    type: 'script' | 'captions' | 'metadata';
    angle_id: string;
    locale: string;
    platform: string;
  }[];
}
```

**Indexes:**
- `idx_packs_project_id` on `project_id`
- `idx_packs_created_at` on `created_at DESC`

---

### 5. PackAngle (Join Table)

Many-to-many relationship between packs and localized content.

```sql
CREATE TABLE pack_angles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id         UUID NOT NULL REFERENCES creative_packs(id) ON DELETE CASCADE,
    angle_id        UUID NOT NULL REFERENCES angle_cards(id) ON DELETE CASCADE,
    locale          VARCHAR(10) NOT NULL,
    platform        VARCHAR(50) NOT NULL,

    UNIQUE(pack_id, angle_id, locale, platform)
);
```

**Indexes:**
- `idx_pack_angles_pack_id` on `pack_id`
- `idx_pack_angles_angle_id` on `angle_id`

---

### 6. PerformanceData

Imported performance metrics for winner analysis.

```sql
CREATE TABLE performance_data (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    angle_id        UUID NOT NULL REFERENCES angle_cards(id) ON DELETE CASCADE,
    import_batch_id UUID NOT NULL,
    impressions     BIGINT NOT NULL DEFAULT 0,
    clicks          BIGINT NOT NULL DEFAULT 0,
    conversions     INTEGER NOT NULL DEFAULT 0,
    spend           DECIMAL(12,2) NOT NULL DEFAULT 0,
    revenue         DECIMAL(12,2) NOT NULL DEFAULT 0,
    ctr             DECIMAL(8,4) GENERATED ALWAYS AS (
                      CASE WHEN impressions > 0
                           THEN (clicks::DECIMAL / impressions) * 100
                           ELSE 0 END
                    ) STORED,
    cpa             DECIMAL(12,2) GENERATED ALWAYS AS (
                      CASE WHEN conversions > 0
                           THEN spend / conversions
                           ELSE NULL END
                    ) STORED,
    roas            DECIMAL(8,2) GENERATED ALWAYS AS (
                      CASE WHEN spend > 0
                           THEN revenue / spend
                           ELSE NULL END
                    ) STORED,
    platform        VARCHAR(50),
    locale          VARCHAR(10),
    date_range_start DATE,
    date_range_end  DATE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Indexes:**
- `idx_perf_angle_id` on `angle_id`
- `idx_perf_import_batch` on `import_batch_id`
- `idx_perf_ctr` on `ctr DESC`
- `idx_perf_roas` on `roas DESC`

---

### 7. ImportBatch

Tracks CSV import operations.

```sql
CREATE TABLE import_batches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename        VARCHAR(255) NOT NULL,
    status          VARCHAR(50) DEFAULT 'processing',
    rows_total      INTEGER,
    rows_processed  INTEGER DEFAULT 0,
    rows_failed     INTEGER DEFAULT 0,
    error_log       JSONB DEFAULT '[]',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at    TIMESTAMP WITH TIME ZONE
);
```

**Status Values:**
- `processing` - Import in progress
- `completed` - Successfully finished
- `failed` - Import failed
- `partial` - Completed with some errors

---

## Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Project {
  id           String         @id @default(uuid())
  name         String         @db.VarChar(255)
  description  String?
  seedData     Json           @map("seed_data")
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")

  angleCards   AngleCard[]
  packs        CreativePack[]
  importBatches ImportBatch[]

  @@map("projects")
}

model AngleCard {
  id                String    @id @default(uuid())
  projectId         String    @map("project_id")
  version           Int       @default(1)
  hook              String
  problemAgitation  String    @map("problem_agitation")
  solution          String
  cta               String
  visualDirection   String?   @map("visual_direction")
  audioNotes        String?   @map("audio_notes")
  estimatedDuration Int?      @map("estimated_duration")
  status            String    @default("draft") @db.VarChar(50)
  isWinner          Boolean   @default(false) @map("is_winner")
  parentAngleId     String?   @map("parent_angle_id")
  generationNotes   String?   @map("generation_notes")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  project           Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parentAngle       AngleCard? @relation("AngleIterations", fields: [parentAngleId], references: [id])
  childAngles       AngleCard[] @relation("AngleIterations")
  localizedContents LocalizedContent[]
  performanceData   PerformanceData[]
  packAngles        PackAngle[]

  @@index([projectId])
  @@index([status])
  @@index([isWinner])
  @@map("angle_cards")
}

model LocalizedContent {
  id                  String   @id @default(uuid())
  angleId             String   @map("angle_id")
  locale              String   @db.VarChar(10)
  platform            String   @db.VarChar(50)
  script              String
  captions            Json     @default("[]")
  onScreenText        Json     @default("[]") @map("on_screen_text")
  culturalNotes       String?  @map("cultural_notes")
  platformAdjustments String?  @map("platform_adjustments")
  characterCount      Int?     @map("character_count")
  wordCount           Int?     @map("word_count")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  angle               AngleCard @relation(fields: [angleId], references: [id], onDelete: Cascade)

  @@unique([angleId, locale, platform])
  @@index([angleId])
  @@map("localized_contents")
}

model CreativePack {
  id            String    @id @default(uuid())
  name          String    @db.VarChar(255)
  projectId     String    @map("project_id")
  downloadUrl   String?   @map("download_url")
  filePath      String?   @map("file_path")
  fileSize      BigInt?   @map("file_size")
  manifest      Json      @default("{}")
  downloadCount Int       @default(0) @map("download_count")
  expiresAt     DateTime? @map("expires_at")
  createdAt     DateTime  @default(now()) @map("created_at")

  project       Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  packAngles    PackAngle[]

  @@index([projectId])
  @@map("creative_packs")
}

model PackAngle {
  id       String @id @default(uuid())
  packId   String @map("pack_id")
  angleId  String @map("angle_id")
  locale   String @db.VarChar(10)
  platform String @db.VarChar(50)

  pack     CreativePack @relation(fields: [packId], references: [id], onDelete: Cascade)
  angle    AngleCard    @relation(fields: [angleId], references: [id], onDelete: Cascade)

  @@unique([packId, angleId, locale, platform])
  @@index([packId])
  @@index([angleId])
  @@map("pack_angles")
}

model PerformanceData {
  id             String   @id @default(uuid())
  angleId        String   @map("angle_id")
  importBatchId  String   @map("import_batch_id")
  impressions    BigInt   @default(0)
  clicks         BigInt   @default(0)
  conversions    Int      @default(0)
  spend          Decimal  @default(0) @db.Decimal(12, 2)
  revenue        Decimal  @default(0) @db.Decimal(12, 2)
  platform       String?  @db.VarChar(50)
  locale         String?  @db.VarChar(10)
  dateRangeStart DateTime? @map("date_range_start") @db.Date
  dateRangeEnd   DateTime? @map("date_range_end") @db.Date
  createdAt      DateTime @default(now()) @map("created_at")

  angle          AngleCard   @relation(fields: [angleId], references: [id], onDelete: Cascade)
  importBatch    ImportBatch @relation(fields: [importBatchId], references: [id], onDelete: Cascade)

  @@index([angleId])
  @@index([importBatchId])
  @@map("performance_data")
}

model ImportBatch {
  id            String    @id @default(uuid())
  projectId     String    @map("project_id")
  filename      String    @db.VarChar(255)
  status        String    @default("processing") @db.VarChar(50)
  rowsTotal     Int?      @map("rows_total")
  rowsProcessed Int       @default(0) @map("rows_processed")
  rowsFailed    Int       @default(0) @map("rows_failed")
  errorLog      Json      @default("[]") @map("error_log")
  createdAt     DateTime  @default(now()) @map("created_at")
  completedAt   DateTime? @map("completed_at")

  project       Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  performanceData PerformanceData[]

  @@index([projectId])
  @@map("import_batches")
}
```

---

## Supported Values

### Locales (MVP)
| Code | Language |
|------|----------|
| en-US | English (US) |
| es-ES | Spanish (Spain) |
| fr-FR | French (France) |
| de-DE | German (Germany) |
| pt-BR | Portuguese (Brazil) |

### Platforms
| Value | Platform | Character Limits |
|-------|----------|------------------|
| tiktok | TikTok | Caption: 150, Description: 2200 |
| instagram | Instagram Reels | Caption: 2200 |
| youtube | YouTube Shorts | Title: 100, Description: 5000 |

### Tone Values
- `professional` - Corporate, formal language
- `casual` - Friendly, conversational
- `humorous` - Light-hearted, playful
- `urgent` - Action-oriented, time-sensitive
- `empathetic` - Understanding, supportive

---

## Migration Strategy

1. **Initial Setup**: Run Prisma migrations to create all tables
2. **Seed Data**: Optional seed script for development
3. **Indexes**: Created automatically via Prisma schema
4. **Generated Columns**: CTR, CPA, ROAS calculated at database level for performance

```bash
# Commands
npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed
```
