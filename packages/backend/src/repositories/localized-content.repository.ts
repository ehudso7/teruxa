import { prisma } from './prisma-client.js';
import type { LocalizedContent, Prisma } from '@prisma/client';
import type { Locale, Platform, Caption, OnScreenText } from '../types/index.js';

export interface CreateLocalizedContentData {
  angleId: string;
  locale: Locale;
  platform: Platform;
  script: string;
  captions: Caption[];
  onScreenText: OnScreenText[];
  culturalNotes?: string;
  platformAdjustments?: string;
}

export interface UpdateLocalizedContentData {
  script?: string;
  captions?: Caption[];
  onScreenText?: OnScreenText[];
  culturalNotes?: string | null;
  platformAdjustments?: string | null;
}

export class LocalizedContentRepository {
  async create(data: CreateLocalizedContentData): Promise<LocalizedContent> {
    return prisma.localizedContent.create({
      data: {
        angleId: data.angleId,
        locale: data.locale,
        platform: data.platform,
        script: data.script,
        captions: data.captions as Prisma.InputJsonValue,
        onScreenText: data.onScreenText as Prisma.InputJsonValue,
        culturalNotes: data.culturalNotes,
        platformAdjustments: data.platformAdjustments,
        characterCount: data.script.length,
        wordCount: data.script.split(/\s+/).filter(Boolean).length,
      },
    });
  }

  async createMany(data: CreateLocalizedContentData[]): Promise<number> {
    const result = await prisma.localizedContent.createMany({
      data: data.map((d) => ({
        angleId: d.angleId,
        locale: d.locale,
        platform: d.platform,
        script: d.script,
        captions: d.captions as Prisma.InputJsonValue,
        onScreenText: d.onScreenText as Prisma.InputJsonValue,
        culturalNotes: d.culturalNotes,
        platformAdjustments: d.platformAdjustments,
        characterCount: d.script.length,
        wordCount: d.script.split(/\s+/).filter(Boolean).length,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async upsert(data: CreateLocalizedContentData): Promise<LocalizedContent> {
    return prisma.localizedContent.upsert({
      where: {
        angleId_locale_platform: {
          angleId: data.angleId,
          locale: data.locale,
          platform: data.platform,
        },
      },
      create: {
        angleId: data.angleId,
        locale: data.locale,
        platform: data.platform,
        script: data.script,
        captions: data.captions as Prisma.InputJsonValue,
        onScreenText: data.onScreenText as Prisma.InputJsonValue,
        culturalNotes: data.culturalNotes,
        platformAdjustments: data.platformAdjustments,
        characterCount: data.script.length,
        wordCount: data.script.split(/\s+/).filter(Boolean).length,
      },
      update: {
        script: data.script,
        captions: data.captions as Prisma.InputJsonValue,
        onScreenText: data.onScreenText as Prisma.InputJsonValue,
        culturalNotes: data.culturalNotes,
        platformAdjustments: data.platformAdjustments,
        characterCount: data.script.length,
        wordCount: data.script.split(/\s+/).filter(Boolean).length,
      },
    });
  }

  async findById(id: string): Promise<LocalizedContent | null> {
    return prisma.localizedContent.findUnique({
      where: { id },
    });
  }

  async findByAngleId(
    angleId: string,
    filters?: {
      locale?: Locale;
      platform?: Platform;
    }
  ): Promise<LocalizedContent[]> {
    return prisma.localizedContent.findMany({
      where: {
        angleId,
        ...(filters?.locale && { locale: filters.locale }),
        ...(filters?.platform && { platform: filters.platform }),
      },
      orderBy: [{ locale: 'asc' }, { platform: 'asc' }],
    });
  }

  async findByAngleAndLocalePlatform(
    angleId: string,
    locale: Locale,
    platform: Platform
  ): Promise<LocalizedContent | null> {
    return prisma.localizedContent.findUnique({
      where: {
        angleId_locale_platform: {
          angleId,
          locale,
          platform,
        },
      },
    });
  }

  async update(id: string, data: UpdateLocalizedContentData): Promise<LocalizedContent> {
    const updateData: Prisma.LocalizedContentUpdateInput = {
      ...(data.script !== undefined && {
        script: data.script,
        characterCount: data.script.length,
        wordCount: data.script.split(/\s+/).filter(Boolean).length,
      }),
      ...(data.captions !== undefined && {
        captions: data.captions as Prisma.InputJsonValue,
      }),
      ...(data.onScreenText !== undefined && {
        onScreenText: data.onScreenText as Prisma.InputJsonValue,
      }),
      ...(data.culturalNotes !== undefined && {
        culturalNotes: data.culturalNotes,
      }),
      ...(data.platformAdjustments !== undefined && {
        platformAdjustments: data.platformAdjustments,
      }),
    };

    return prisma.localizedContent.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.localizedContent.delete({ where: { id } });
  }

  async deleteByAngleId(angleId: string): Promise<number> {
    const result = await prisma.localizedContent.deleteMany({
      where: { angleId },
    });
    return result.count;
  }
}

export const localizedContentRepository = new LocalizedContentRepository();
