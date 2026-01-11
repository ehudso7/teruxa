import { z } from 'zod';
import type { SeedData } from '../types/index.js';
import { ValidationError } from '../types/index.js';

// Zod schema for SeedData validation
export const seedDataSchema = z.object({
  product_name: z.string(),
  product_description: z.string(),
  target_audience: z.string(),
  key_benefits: z.array(z.string()),
  pain_points: z.array(z.string()),
  tone: z.enum(['professional', 'casual', 'humorous', 'urgent', 'empathetic']),
  platforms: z.array(z.enum(['tiktok', 'instagram', 'youtube'])),
  brand_guidelines: z.string().optional(),
  competitors: z.array(z.string()).optional(),
  unique_selling_points: z.array(z.string()).optional(),
});

/**
 * Parse and validate seed data from a Prisma JsonValue
 * @param value - The JsonValue to parse
 * @returns Validated SeedData
 * @throws ValidationError if the data is invalid
 */
export function parseSeedData(value: unknown): SeedData {
  if (!value) {
    throw new ValidationError('Seed data is missing');
  }

  const result = seedDataSchema.safeParse(value);

  if (!result.success) {
    throw new ValidationError('Invalid seed data', result.error.format());
  }

  return result.data as SeedData;
}