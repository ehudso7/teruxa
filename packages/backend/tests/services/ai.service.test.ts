import { describe, it, expect, beforeEach } from 'vitest';
import { aiService } from '../../src/services/ai.service.js';
import type { SeedData, GeneratedAngle } from '../../src/types/index.js';

describe('AIService', () => {
  const mockSeedData: SeedData = {
    product_name: 'TestProduct',
    product_description: 'A revolutionary test product',
    target_audience: 'Developers and testers',
    key_benefits: ['Easy to use', 'Fast results'],
    pain_points: ['Slow testing', 'Complex setup'],
    tone: 'professional',
    platforms: ['tiktok', 'instagram'],
  };

  describe('generateAngles', () => {
    it('should generate the requested number of angles in mock mode', async () => {
      const count = 3;
      const angles = await aiService.generateAngles(mockSeedData, count);

      expect(angles).toHaveLength(count);
    });

    it('should include product name in generated hooks', async () => {
      const angles = await aiService.generateAngles(mockSeedData, 2);

      angles.forEach((angle) => {
        expect(angle.hook).toContain(mockSeedData.product_name);
      });
    });

    it('should return valid angle structure', async () => {
      const angles = await aiService.generateAngles(mockSeedData, 1);
      const angle = angles[0] as GeneratedAngle;

      expect(angle).toHaveProperty('hook');
      expect(angle).toHaveProperty('problemAgitation');
      expect(angle).toHaveProperty('solution');
      expect(angle).toHaveProperty('cta');
      expect(angle).toHaveProperty('visualDirection');
      expect(angle).toHaveProperty('audioNotes');
      expect(angle).toHaveProperty('estimatedDuration');
      expect(angle).toHaveProperty('generationNotes');

      expect(typeof angle.hook).toBe('string');
      expect(typeof angle.estimatedDuration).toBe('number');
    });

    it('should include tone in generation notes', async () => {
      const angles = await aiService.generateAngles(mockSeedData, 1);
      const angle = angles[0] as GeneratedAngle;

      expect(angle.generationNotes).toContain(mockSeedData.tone);
    });
  });

  describe('localizeContent', () => {
    const mockAngle: GeneratedAngle = {
      hook: 'Test hook',
      problemAgitation: 'Test problem',
      solution: 'Test solution',
      cta: 'Test CTA',
      visualDirection: 'Test visuals',
      audioNotes: 'Test audio',
      estimatedDuration: 30,
    };

    it('should generate localized content for given locale and platform', async () => {
      const localized = await aiService.localizeContent(
        mockAngle,
        'es-ES',
        'tiktok',
        mockSeedData
      );

      expect(localized).toHaveProperty('script');
      expect(localized).toHaveProperty('captions');
      expect(localized).toHaveProperty('onScreenText');
      expect(localized).toHaveProperty('culturalNotes');
      expect(localized).toHaveProperty('platformAdjustments');
    });

    it('should include locale name in script', async () => {
      const localized = await aiService.localizeContent(
        mockAngle,
        'fr-FR',
        'instagram',
        mockSeedData
      );

      expect(localized.script).toContain('French');
    });

    it('should include platform in script', async () => {
      const localized = await aiService.localizeContent(
        mockAngle,
        'de-DE',
        'youtube',
        mockSeedData
      );

      expect(localized.script).toContain('youtube');
    });

    it('should return valid captions structure', async () => {
      const localized = await aiService.localizeContent(
        mockAngle,
        'pt-BR',
        'tiktok',
        mockSeedData
      );

      expect(Array.isArray(localized.captions)).toBe(true);
      if (localized.captions.length > 0) {
        const caption = localized.captions[0];
        expect(caption).toHaveProperty('timestamp_start');
        expect(caption).toHaveProperty('timestamp_end');
        expect(caption).toHaveProperty('text');
      }
    });
  });

  describe('analyzeWinnerPatterns', () => {
    it('should return patterns and recommendations', async () => {
      const winners = [
        {
          angle: {
            hook: 'Winner hook 1',
            problemAgitation: 'Winner problem 1',
            solution: 'Winner solution 1',
            cta: 'Winner CTA 1',
          },
          metrics: { ctr: 5.5, roas: 3.2, conversions: 100 },
        },
        {
          angle: {
            hook: 'Winner hook 2',
            problemAgitation: 'Winner problem 2',
            solution: 'Winner solution 2',
            cta: 'Winner CTA 2',
          },
          metrics: { ctr: 4.8, roas: 2.8, conversions: 85 },
        },
      ];

      const analysis = await aiService.analyzeWinnerPatterns(winners);

      expect(analysis).toHaveProperty('patterns');
      expect(analysis).toHaveProperty('recommendations');
      expect(Array.isArray(analysis.patterns)).toBe(true);
      expect(Array.isArray(analysis.recommendations)).toBe(true);
      expect(analysis.patterns.length).toBeGreaterThan(0);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('generateIterations', () => {
    it('should generate iterations based on winners', async () => {
      const winnerAngles: GeneratedAngle[] = [
        {
          hook: 'Winning hook',
          problemAgitation: 'Winning problem',
          solution: 'Winning solution',
          cta: 'Winning CTA',
        },
      ];
      const patterns = ['Pattern 1', 'Pattern 2'];
      const count = 3;

      const iterations = await aiService.generateIterations(
        winnerAngles,
        patterns,
        mockSeedData,
        count
      );

      expect(iterations).toHaveLength(count);
    });

    it('should mark iterations as such', async () => {
      const winnerAngles: GeneratedAngle[] = [
        {
          hook: 'Original hook',
          problemAgitation: 'Original problem',
          solution: 'Original solution',
          cta: 'Original CTA',
        },
      ];
      const patterns = ['Pattern 1'];

      const iterations = await aiService.generateIterations(
        winnerAngles,
        patterns,
        mockSeedData,
        1
      );

      const iteration = iterations[0];
      expect(iteration?.hook).toContain('[ITERATION]');
    });
  });
});
