import { angleRepository, localizedContentRepository, projectRepository } from '../repositories/index.js';
import { aiService } from './ai.service.js';
import { createChildLogger } from '../utils/logger.js';
import { NotFoundError } from '../types/index.js';
import { PLATFORM_LIMITS, validateContentLength } from '../utils/platform-limits.js';
import { parseSeedData } from '../schemas/seedData.schema.js';
import type { Locale, Platform, GeneratedAngle } from '../types/index.js';
import type { LocalizedContent } from '@prisma/client';
import type { UpdateLocalizedContentInput } from '../validators/index.js';
import type { UpdateLocalizedContentData } from '../repositories/localized-content.repository.js';

const logger = createChildLogger('localization-service');

export interface LocalizeRequest {
  angleId: string;
  locales: Locale[];
  platforms: Platform[];
}

export interface LocalizationResult {
  angleId: string;
  created: LocalizedContent[];
  warnings: Array<{
    locale: Locale;
    platform: Platform;
    type: string;
    message: string;
  }>;
}

class LocalizationService {
  async localizeAngle(request: LocalizeRequest): Promise<LocalizationResult> {
    const { angleId, locales, platforms } = request;

    // Get angle with project
    const angle = await angleRepository.findById(angleId);
    if (!angle) {
      throw new NotFoundError('Angle');
    }

    const project = await projectRepository.findById(angle.projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    const seedData = parseSeedData(project.seedData);
    const angleData: GeneratedAngle = {
      hook: angle.hook,
      problemAgitation: angle.problemAgitation,
      solution: angle.solution,
      cta: angle.cta,
      visualDirection: angle.visualDirection ?? undefined,
      audioNotes: angle.audioNotes ?? undefined,
      estimatedDuration: angle.estimatedDuration ?? undefined,
    };

    const created: LocalizedContent[] = [];
    const warnings: LocalizationResult['warnings'] = [];

    // Generate localizations for each locale/platform combination
    for (const locale of locales) {
      for (const platform of platforms) {
        try {
          logger.info({ angleId, locale, platform }, 'Generating localization');

          const localized = await aiService.localizeContent(
            angleData,
            locale,
            platform,
            seedData
          );

          // Validate content against platform limits
          const limits = PLATFORM_LIMITS[platform];
          const scriptValidation = validateContentLength(localized.script, platform, 'caption');

          if (!scriptValidation.valid) {
            warnings.push({
              locale,
              platform,
              type: 'character_limit',
              message: `Script exceeds ${platform} limit: ${scriptValidation.current}/${scriptValidation.limit} characters`,
            });
          }

          // Check duration
          if (
            angleData.estimatedDuration &&
            angleData.estimatedDuration > limits.maxDuration
          ) {
            warnings.push({
              locale,
              platform,
              type: 'duration',
              message: `Duration ${angleData.estimatedDuration}s exceeds ${platform} max of ${limits.maxDuration}s`,
            });
          }

          // Upsert localized content
          const content = await localizedContentRepository.upsert({
            angleId,
            locale,
            platform,
            script: localized.script,
            captions: localized.captions,
            onScreenText: localized.onScreenText,
            culturalNotes: localized.culturalNotes,
            platformAdjustments: localized.platformAdjustments,
          });

          created.push(content);
        } catch (error) {
          logger.error({ error, angleId, locale, platform }, 'Failed to localize');
          warnings.push({
            locale,
            platform,
            type: 'generation_error',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    logger.info(
      { angleId, created: created.length, warnings: warnings.length },
      'Localization complete'
    );

    return { angleId, created, warnings };
  }

  async getLocalizedContent(angleId: string, locale?: Locale, platform?: Platform) {
    const exists = await angleRepository.exists(angleId);
    if (!exists) {
      throw new NotFoundError('Angle');
    }

    return localizedContentRepository.findByAngleId(angleId, { locale, platform });
  }

  async getLocalizedContentById(id: string) {
    const content = await localizedContentRepository.findById(id);
    if (!content) {
      throw new NotFoundError('Localized content');
    }
    return content;
  }

  async updateLocalizedContent(
    id: string,
    data: UpdateLocalizedContentInput
  ) {
    const content = await localizedContentRepository.findById(id);
    if (!content) {
      throw new NotFoundError('Localized content');
    }

    // Validate if script is being updated
    if (data.script) {
      const validation = validateContentLength(
        data.script,
        content.platform as Platform,
        'caption'
      );
      if (!validation.valid) {
        logger.warn(
          { id, platform: content.platform, current: validation.current, limit: validation.limit },
          'Updated script exceeds character limit'
        );
      }
    }

    // Type assertion is safe because zod validation ensures data is valid
    return localizedContentRepository.update(id, data as UpdateLocalizedContentData);
  }

  async deleteLocalizedContent(id: string) {
    const content = await localizedContentRepository.findById(id);
    if (!content) {
      throw new NotFoundError('Localized content');
    }

    await localizedContentRepository.delete(id);
    logger.info({ id }, 'Localized content deleted');
  }

  async regenerateLocalization(
    angleId: string,
    locale: Locale,
    platform: Platform
  ): Promise<LocalizedContent> {
    const angle = await angleRepository.findById(angleId);
    if (!angle) {
      throw new NotFoundError('Angle');
    }

    const project = await projectRepository.findById(angle.projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    const seedData = parseSeedData(project.seedData);
    const angleData: GeneratedAngle = {
      hook: angle.hook,
      problemAgitation: angle.problemAgitation,
      solution: angle.solution,
      cta: angle.cta,
      visualDirection: angle.visualDirection ?? undefined,
      audioNotes: angle.audioNotes ?? undefined,
      estimatedDuration: angle.estimatedDuration ?? undefined,
    };

    const localized = await aiService.localizeContent(angleData, locale, platform, seedData);

    const content = await localizedContentRepository.upsert({
      angleId,
      locale,
      platform,
      script: localized.script,
      captions: localized.captions,
      onScreenText: localized.onScreenText,
      culturalNotes: localized.culturalNotes,
      platformAdjustments: localized.platformAdjustments,
    });

    logger.info({ angleId, locale, platform }, 'Localization regenerated');

    return content;
  }
}

export const localizationService = new LocalizationService();