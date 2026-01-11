import { describe, it, expect } from 'vitest';
import {
  normalizeNodeEnv,
  getEnvRequirements,
  type NodeEnv,
  type EnvRequirement,
} from '../src/utils/env-validator.js';

describe('env-validator', () => {
  describe('normalizeNodeEnv', () => {
    it('should return "production" when input is "production"', () => {
      expect(normalizeNodeEnv('production')).toBe('production');
    });

    it('should return "test" when input is "test"', () => {
      expect(normalizeNodeEnv('test')).toBe('test');
    });

    it('should return "development" when input is "development"', () => {
      expect(normalizeNodeEnv('development')).toBe('development');
    });

    it('should return "development" when input is undefined', () => {
      expect(normalizeNodeEnv(undefined)).toBe('development');
    });

    it('should return "development" when input is null', () => {
      expect(normalizeNodeEnv(null)).toBe('development');
    });

    it('should return "development" when input is empty string', () => {
      expect(normalizeNodeEnv('')).toBe('development');
    });

    it('should return "development" when input is invalid string', () => {
      expect(normalizeNodeEnv('staging')).toBe('development');
      expect(normalizeNodeEnv('prod')).toBe('development');
      expect(normalizeNodeEnv('PRODUCTION')).toBe('development');
    });

    it('should return "development" when input is not a string', () => {
      expect(normalizeNodeEnv(123)).toBe('development');
      expect(normalizeNodeEnv({})).toBe('development');
      expect(normalizeNodeEnv([])).toBe('development');
      expect(normalizeNodeEnv(true)).toBe('development');
    });
  });

  describe('getEnvRequirements', () => {
    it('should return production requirements for "production" env', () => {
      const requirements = getEnvRequirements('production');

      // Check it returns an array
      expect(Array.isArray(requirements)).toBe(true);

      // Check specific production requirements exist
      const dbReq = requirements.find(r => r.name === 'DATABASE_URL');
      expect(dbReq).toBeDefined();
      expect(dbReq?.required).toBe(true);

      const apiKeyReq = requirements.find(r => r.name === 'OPENAI_API_KEY');
      expect(apiKeyReq).toBeDefined();
      expect(apiKeyReq?.required).toBe(true);

      const corsReq = requirements.find(r => r.name === 'CORS_ORIGIN');
      expect(corsReq).toBeDefined();
      expect(corsReq?.required).toBe(true);

      const mockModeReq = requirements.find(r => r.name === 'AI_MOCK_MODE');
      expect(mockModeReq).toBeDefined();
      expect(mockModeReq?.required).toBe(false);
    });

    it('should return development requirements for "development" env', () => {
      const requirements = getEnvRequirements('development');

      expect(Array.isArray(requirements)).toBe(true);

      const dbReq = requirements.find(r => r.name === 'DATABASE_URL');
      expect(dbReq).toBeDefined();
      expect(dbReq?.required).toBe(true);

      const apiKeyReq = requirements.find(r => r.name === 'OPENAI_API_KEY');
      expect(apiKeyReq).toBeDefined();
      expect(apiKeyReq?.required).toBe(false); // Optional in dev
    });

    it('should return test requirements for "test" env', () => {
      const requirements = getEnvRequirements('test');

      expect(Array.isArray(requirements)).toBe(true);

      const dbReq = requirements.find(r => r.name === 'DATABASE_URL');
      expect(dbReq).toBeDefined();
      expect(dbReq?.required).toBe(true);
    });

    it('should fall back to development requirements for unknown env', () => {
      const requirementsUnknown = getEnvRequirements('staging');
      const requirementsDev = getEnvRequirements('development');

      expect(requirementsUnknown).toEqual(requirementsDev);
    });

    it('should fall back to development requirements for invalid input', () => {
      const requirementsNull = getEnvRequirements(null);
      const requirementsUndefined = getEnvRequirements(undefined);
      const requirementsNumber = getEnvRequirements(123);
      const requirementsDev = getEnvRequirements('development');

      expect(requirementsNull).toEqual(requirementsDev);
      expect(requirementsUndefined).toEqual(requirementsDev);
      expect(requirementsNumber).toEqual(requirementsDev);
    });

    it('should always return a defined array (never undefined)', () => {
      // Test various inputs to ensure the function never returns undefined
      const testCases: unknown[] = [
        'production',
        'development',
        'test',
        'invalid',
        '',
        null,
        undefined,
        123,
        {},
        [],
        true,
        false,
      ];

      for (const testCase of testCases) {
        const requirements = getEnvRequirements(testCase);

        // TypeScript compile-time check: requirements is EnvRequirement[]
        // This line would fail to compile if requirements could be undefined
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _typeCheck: EnvRequirement[] = requirements;

        // Runtime check
        expect(requirements).toBeDefined();
        expect(Array.isArray(requirements)).toBe(true);
      }
    });
  });

  describe('TypeScript type safety', () => {
    it('should have correct types for NodeEnv', () => {
      // This test validates that the NodeEnv type is correctly defined
      // These assignments should compile without errors
      const env1: NodeEnv = 'production';
      const env2: NodeEnv = 'development';
      const env3: NodeEnv = 'test';

      // This would cause a TypeScript error if uncommented:
      // const env4: NodeEnv = 'staging';

      expect(env1).toBe('production');
      expect(env2).toBe('development');
      expect(env3).toBe('test');
    });

    it('should ensure requirements is never undefined', () => {
      // This test validates that TypeScript correctly infers the return type
      const requirements = getEnvRequirements('unknown');

      // This should compile without any non-null assertions
      requirements.forEach(req => {
        expect(req.name).toBeDefined();
        expect(typeof req.required).toBe('boolean');
      });

      // The length property should be accessible without checks
      expect(requirements.length).toBeGreaterThanOrEqual(0);
    });
  });
});