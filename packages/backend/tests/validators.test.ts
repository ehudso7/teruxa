import { describe, it, expect } from 'vitest';
import {
  seedDataSchema,
  createProjectSchema,
  updateAngleSchema,
  localizeRequestSchema,
  csvRowSchema,
} from '../src/validators/index.js';

describe('Validators', () => {
  describe('seedDataSchema', () => {
    it('should validate valid seed data', () => {
      const validData = {
        product_name: 'Test Product',
        product_description: 'A test product for unit testing purposes',
        target_audience: 'Developers who write tests',
        key_benefits: ['Fast', 'Reliable'],
        pain_points: ['Slow builds', 'Flaky tests'],
        tone: 'professional',
        platforms: ['tiktok', 'instagram'],
      };

      const result = seedDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty product name', () => {
      const invalidData = {
        product_name: '',
        product_description: 'A test product',
        target_audience: 'Developers',
        key_benefits: ['Fast'],
        pain_points: ['Slow'],
        tone: 'professional',
        platforms: ['tiktok'],
      };

      const result = seedDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid tone', () => {
      const invalidData = {
        product_name: 'Test',
        product_description: 'A test product description',
        target_audience: 'Developers',
        key_benefits: ['Fast'],
        pain_points: ['Slow'],
        tone: 'invalid_tone',
        platforms: ['tiktok'],
      };

      const result = seedDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid platform', () => {
      const invalidData = {
        product_name: 'Test',
        product_description: 'A test product description',
        target_audience: 'Developers',
        key_benefits: ['Fast'],
        pain_points: ['Slow'],
        tone: 'professional',
        platforms: ['facebook'], // not in allowed list
      };

      const result = seedDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require at least one benefit', () => {
      const invalidData = {
        product_name: 'Test',
        product_description: 'A test product description',
        target_audience: 'Developers',
        key_benefits: [],
        pain_points: ['Slow'],
        tone: 'professional',
        platforms: ['tiktok'],
      };

      const result = seedDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('createProjectSchema', () => {
    it('should validate valid project creation', () => {
      const validProject = {
        name: 'My Project',
        description: 'A test project',
        seedData: {
          product_name: 'Test Product',
          product_description: 'A test product for testing',
          target_audience: 'Test audience',
          key_benefits: ['Benefit 1'],
          pain_points: ['Pain 1'],
          tone: 'casual',
          platforms: ['youtube'],
        },
      };

      const result = createProjectSchema.safeParse(validProject);
      expect(result.success).toBe(true);
    });

    it('should reject project without name', () => {
      const invalidProject = {
        name: '',
        seedData: {
          product_name: 'Test',
          product_description: 'Test description',
          target_audience: 'Test',
          key_benefits: ['B1'],
          pain_points: ['P1'],
          tone: 'casual',
          platforms: ['youtube'],
        },
      };

      const result = createProjectSchema.safeParse(invalidProject);
      expect(result.success).toBe(false);
    });
  });

  describe('updateAngleSchema', () => {
    it('should validate partial angle update', () => {
      const validUpdate = {
        hook: 'New hook text',
        status: 'approved',
      };

      const result = updateAngleSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should accept empty update', () => {
      const result = updateAngleSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const invalidUpdate = {
        status: 'invalid_status',
      };

      const result = updateAngleSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should validate duration within range', () => {
      const validUpdate = { estimatedDuration: 30 };
      const result = updateAngleSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);

      const tooShort = { estimatedDuration: 1 };
      expect(updateAngleSchema.safeParse(tooShort).success).toBe(false);

      const tooLong = { estimatedDuration: 200 };
      expect(updateAngleSchema.safeParse(tooLong).success).toBe(false);
    });
  });

  describe('localizeRequestSchema', () => {
    it('should validate valid localization request', () => {
      const validRequest = {
        locales: ['en-US', 'es-ES'],
        platforms: ['tiktok', 'instagram'],
      };

      const result = localizeRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should reject empty locales', () => {
      const invalidRequest = {
        locales: [],
        platforms: ['tiktok'],
      };

      const result = localizeRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject invalid locale', () => {
      const invalidRequest = {
        locales: ['en-UK'], // not in allowed list
        platforms: ['tiktok'],
      };

      const result = localizeRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('csvRowSchema', () => {
    it('should validate valid CSV row', () => {
      const validRow = {
        angle_id: '550e8400-e29b-41d4-a716-446655440000',
        impressions: '10000',
        clicks: '500',
        conversions: '50',
        spend: '100.50',
        revenue: '250.00',
      };

      const result = csvRowSchema.safeParse(validRow);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.impressions).toBe(10000);
        expect(result.data.spend).toBe(100.5);
      }
    });

    it('should coerce string numbers', () => {
      const row = {
        angle_id: '550e8400-e29b-41d4-a716-446655440000',
        impressions: 10000,
        clicks: 500,
        conversions: 50,
        spend: 100,
        revenue: 250,
      };

      const result = csvRowSchema.safeParse(row);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const invalidRow = {
        angle_id: 'not-a-uuid',
        impressions: '10000',
        clicks: '500',
        conversions: '50',
        spend: '100',
        revenue: '250',
      };

      const result = csvRowSchema.safeParse(invalidRow);
      expect(result.success).toBe(false);
    });

    it('should reject negative values', () => {
      const invalidRow = {
        angle_id: '550e8400-e29b-41d4-a716-446655440000',
        impressions: '-100',
        clicks: '500',
        conversions: '50',
        spend: '100',
        revenue: '250',
      };

      const result = csvRowSchema.safeParse(invalidRow);
      expect(result.success).toBe(false);
    });
  });
});
