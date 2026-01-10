import { prisma } from './prisma-client.js';
import type { AngleCard, LocalizedContent, Prisma } from '@prisma/client';
import type { AngleStatus } from '../types/index.js';

export interface CreateAngleData {
  projectId: string;
  hook: string;
  problemAgitation: string;
  solution: string;
  cta: string;
  visualDirection?: string;
  audioNotes?: string;
  estimatedDuration?: number;
  parentAngleId?: string;
  generationNotes?: string;
}

export interface UpdateAngleData {
  hook?: string;
  problemAgitation?: string;
  solution?: string;
  cta?: string;
  visualDirection?: string | null;
  audioNotes?: string | null;
  estimatedDuration?: number | null;
  status?: AngleStatus;
  isWinner?: boolean;
}

export interface AngleWithLocalizations extends AngleCard {
  localizedContents: LocalizedContent[];
  parentAngle?: AngleCard | null;
  childAngles?: AngleCard[];
}

export class AngleRepository {
  async create(data: CreateAngleData): Promise<AngleCard> {
    return prisma.angleCard.create({
      data: {
        projectId: data.projectId,
        hook: data.hook,
        problemAgitation: data.problemAgitation,
        solution: data.solution,
        cta: data.cta,
        visualDirection: data.visualDirection,
        audioNotes: data.audioNotes,
        estimatedDuration: data.estimatedDuration,
        parentAngleId: data.parentAngleId,
        generationNotes: data.generationNotes,
      },
    });
  }

  async createMany(data: CreateAngleData[]): Promise<number> {
    const result = await prisma.angleCard.createMany({
      data: data.map((d) => ({
        projectId: d.projectId,
        hook: d.hook,
        problemAgitation: d.problemAgitation,
        solution: d.solution,
        cta: d.cta,
        visualDirection: d.visualDirection,
        audioNotes: d.audioNotes,
        estimatedDuration: d.estimatedDuration,
        parentAngleId: d.parentAngleId,
        generationNotes: d.generationNotes,
      })),
    });
    return result.count;
  }

  async findById(id: string): Promise<AngleWithLocalizations | null> {
    return prisma.angleCard.findUnique({
      where: { id },
      include: {
        localizedContents: true,
        parentAngle: true,
        childAngles: true,
      },
    });
  }

  async findByProjectId(
    projectId: string,
    options?: {
      status?: AngleStatus;
      isWinner?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<{ angles: AngleCard[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AngleCardWhereInput = {
      projectId,
      ...(options?.status && { status: options.status }),
      ...(options?.isWinner !== undefined && { isWinner: options.isWinner }),
    };

    const [angles, total] = await Promise.all([
      prisma.angleCard.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              localizedContents: true,
              performanceData: true,
            },
          },
        },
      }),
      prisma.angleCard.count({ where }),
    ]);

    return { angles, total };
  }

  async update(id: string, data: UpdateAngleData): Promise<AngleCard> {
    // Increment version if content changes
    const shouldIncrementVersion =
      data.hook !== undefined ||
      data.problemAgitation !== undefined ||
      data.solution !== undefined ||
      data.cta !== undefined;

    return prisma.angleCard.update({
      where: { id },
      data: {
        ...data,
        ...(shouldIncrementVersion && {
          version: { increment: 1 },
        }),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.angleCard.delete({ where: { id } });
  }

  async setWinner(id: string, isWinner: boolean): Promise<AngleCard> {
    return prisma.angleCard.update({
      where: { id },
      data: { isWinner },
    });
  }

  async getWinners(projectId: string): Promise<AngleCard[]> {
    return prisma.angleCard.findMany({
      where: {
        projectId,
        isWinner: true,
      },
      include: {
        performanceData: true,
        localizedContents: true,
      },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.angleCard.count({ where: { id } });
    return count > 0;
  }

  async getNextVersion(projectId: string): Promise<number> {
    const maxVersion = await prisma.angleCard.aggregate({
      where: { projectId },
      _max: { version: true },
    });
    return (maxVersion._max.version ?? 0) + 1;
  }
}

export const angleRepository = new AngleRepository();
