import { z } from 'zod';

// ============================================
// Common Validators
// ============================================

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================
// Seed Data Validators
// ============================================

export const toneSchema = z.enum([
  'professional',
  'casual',
  'humorous',
  'urgent',
  'empathetic',
]);

export const platformSchema = z.enum(['tiktok', 'instagram', 'youtube']);

export const localeSchema = z.enum(['en-US', 'es-ES', 'fr-FR', 'de-DE', 'pt-BR']);

export const seedDataSchema = z.object({
  product_name: z
    .string()
    .min(1, 'Product name is required')
    .max(255, 'Product name must be 255 characters or less'),
  product_description: z
    .string()
    .min(10, 'Product description must be at least 10 characters')
    .max(2000, 'Product description must be 2000 characters or less'),
  target_audience: z
    .string()
    .min(5, 'Target audience must be at least 5 characters')
    .max(500, 'Target audience must be 500 characters or less'),
  key_benefits: z
    .array(z.string().min(1).max(200))
    .min(1, 'At least one key benefit is required')
    .max(10, 'Maximum 10 key benefits allowed'),
  pain_points: z
    .array(z.string().min(1).max(200))
    .min(1, 'At least one pain point is required')
    .max(10, 'Maximum 10 pain points allowed'),
  tone: toneSchema,
  platforms: z
    .array(platformSchema)
    .min(1, 'At least one platform is required')
    .max(3),
  brand_guidelines: z.string().max(1000).optional(),
  competitors: z.array(z.string().max(100)).max(5).optional(),
  unique_selling_points: z.array(z.string().max(200)).max(5).optional(),
});

// ============================================
// Project Validators
// ============================================

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(255, 'Project name must be 255 characters or less'),
  description: z.string().max(1000).optional(),
  seedData: seedDataSchema,
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  seedData: seedDataSchema.optional(),
});

// ============================================
// Angle Card Validators
// ============================================

export const angleStatusSchema = z.enum(['draft', 'approved', 'rejected', 'archived']);

export const generateAnglesSchema = z.object({
  count: z.coerce.number().int().min(1).max(10).default(3),
});

export const updateAngleSchema = z.object({
  hook: z.string().min(1).max(500).optional(),
  problemAgitation: z.string().min(1).max(1000).optional(),
  solution: z.string().min(1).max(1000).optional(),
  cta: z.string().min(1).max(200).optional(),
  visualDirection: z.string().max(500).optional().nullable(),
  audioNotes: z.string().max(500).optional().nullable(),
  estimatedDuration: z.number().int().min(5).max(180).optional().nullable(),
  status: angleStatusSchema.optional(),
});

// ============================================
// Localization Validators
// ============================================

export const captionSchema = z.object({
  timestamp_start: z.number().min(0),
  timestamp_end: z.number().min(0),
  text: z.string().min(1).max(500),
  style: z.enum(['normal', 'emphasis', 'whisper']).optional(),
});

export const onScreenTextSchema = z.object({
  timestamp: z.number().min(0),
  duration: z.number().min(0.5).max(30),
  text: z.string().min(1).max(100),
  position: z.enum(['top', 'center', 'bottom']),
  animation: z.enum(['fade', 'slide', 'pop']).optional(),
});

export const localizeRequestSchema = z.object({
  locales: z.array(localeSchema).min(1).max(5),
  platforms: z.array(platformSchema).min(1).max(3),
});

export const updateLocalizedContentSchema = z.object({
  script: z.string().min(1).max(5000).optional(),
  captions: z.array(captionSchema).optional(),
  onScreenText: z.array(onScreenTextSchema).optional(),
  culturalNotes: z.string().max(1000).optional().nullable(),
  platformAdjustments: z.string().max(1000).optional().nullable(),
});

// ============================================
// Creative Pack Validators
// ============================================

export const createPackSchema = z.object({
  name: z.string().min(1).max(255),
  angleIds: z.array(uuidSchema).min(1).max(50),
  locales: z.array(localeSchema).min(1),
  platforms: z.array(platformSchema).min(1),
});

// ============================================
// Performance Import Validators
// ============================================

export const csvRowSchema = z.object({
  angle_id: uuidSchema,
  impressions: z.coerce.number().int().min(0),
  clicks: z.coerce.number().int().min(0),
  conversions: z.coerce.number().int().min(0),
  spend: z.coerce.number().min(0),
  revenue: z.coerce.number().min(0),
  platform: platformSchema.optional(),
  locale: localeSchema.optional(),
  date_start: z.string().optional(),
  date_end: z.string().optional(),
});

export const generateIterationSchema = z.object({
  topN: z.coerce.number().int().min(1).max(10).default(3),
  count: z.coerce.number().int().min(1).max(10).default(5),
});

// ============================================
// Type Exports
// ============================================

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type SeedDataInput = z.infer<typeof seedDataSchema>;
export type UpdateAngleInput = z.infer<typeof updateAngleSchema>;
export type LocalizeRequestInput = z.infer<typeof localizeRequestSchema>;
export type UpdateLocalizedContentInput = z.infer<typeof updateLocalizedContentSchema>;
export type CreatePackInput = z.infer<typeof createPackSchema>;
export type CSVRowInput = z.infer<typeof csvRowSchema>;
export type GenerateIterationInput = z.infer<typeof generateIterationSchema>;
