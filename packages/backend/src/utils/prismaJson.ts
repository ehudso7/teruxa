import type { Prisma } from '@prisma/client';

/**
 * Helper function to safely convert values to Prisma's InputJsonValue type
 * @param value - The value to convert
 * @returns The value as InputJsonValue
 */
export function toInputJson<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}