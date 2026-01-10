import type { Platform } from '../types/index.js';

interface PlatformLimits {
  captionLength: number;
  descriptionLength: number;
  titleLength?: number;
  maxDuration: number; // seconds
  aspectRatio: string;
  recommendedDuration: { min: number; max: number };
}

export const PLATFORM_LIMITS: Record<Platform, PlatformLimits> = {
  tiktok: {
    captionLength: 150,
    descriptionLength: 2200,
    maxDuration: 180,
    aspectRatio: '9:16',
    recommendedDuration: { min: 15, max: 60 },
  },
  instagram: {
    captionLength: 2200,
    descriptionLength: 2200,
    maxDuration: 90,
    aspectRatio: '9:16',
    recommendedDuration: { min: 15, max: 30 },
  },
  youtube: {
    captionLength: 5000,
    descriptionLength: 5000,
    titleLength: 100,
    maxDuration: 60,
    aspectRatio: '9:16',
    recommendedDuration: { min: 15, max: 60 },
  },
};

export function getCharacterLimit(platform: Platform, type: 'caption' | 'description' | 'title'): number {
  const limits = PLATFORM_LIMITS[platform];
  switch (type) {
    case 'caption':
      return limits.captionLength;
    case 'description':
      return limits.descriptionLength;
    case 'title':
      return limits.titleLength ?? limits.captionLength;
    default:
      return limits.captionLength;
  }
}

export function validateContentLength(
  content: string,
  platform: Platform,
  type: 'caption' | 'description' | 'title'
): { valid: boolean; limit: number; current: number } {
  const limit = getCharacterLimit(platform, type);
  const current = content.length;
  return {
    valid: current <= limit,
    limit,
    current,
  };
}
