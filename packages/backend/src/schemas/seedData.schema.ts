import type { SeedData } from '../types/index.js';
import { ValidationError } from '../types/index.js';
import { seedDataSchema } from '../validators/index.js';

// Re-export the schema from validators for consistency
export { seedDataSchema };

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
