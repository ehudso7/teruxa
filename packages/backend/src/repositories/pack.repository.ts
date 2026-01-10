import { prisma } from './prisma-client.js';
import type { CreativePack, PackAngle, Prisma } from '@prisma/client';
import type { PackManifest, Locale, Platform } from '../types/index.js';

export interface CreatePackData {
  name: string;
  projectId: string;
  manifest: PackManifest;
  filePath?: string;
  downloadUrl?: string;
  fileSize?: number;
}

export interface PackAngleData {
  packId: string;
  angleId: string;
  locale: Locale;
  platform: Platform;
}

export interface PackWithAngles extends CreativePack {
  packAngles: (PackAngle & {
    angle: {
      id: string;
      hook: string;
      status: string;
    };
  })[];
}

export class PackRepository {
  async create(data: CreatePackData): Promise<CreativePack> {
    return prisma.creativePack.create({
      data: {
        name: data.name,
        projectId: data.projectId,
        manifest: data.manifest as Prisma.InputJsonValue,
        filePath: data.filePath,
        downloadUrl: data.downloadUrl,
        fileSize: data.fileSize ? BigInt(data.fileSize) : null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  }

  async addAngles(packId: string, angles: Omit<PackAngleData, 'packId'>[]): Promise<number> {
    const result = await prisma.packAngle.createMany({
      data: angles.map((a) => ({
        packId,
        angleId: a.angleId,
        locale: a.locale,
        platform: a.platform,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async findById(id: string): Promise<PackWithAngles | null> {
    return prisma.creativePack.findUnique({
      where: { id },
      include: {
        packAngles: {
          include: {
            angle: {
              select: {
                id: true,
                hook: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  async findByProjectId(
    projectId: string,
    options?: {
      page?: number;
      limit?: number;
    }
  ): Promise<{ packs: CreativePack[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [packs, total] = await Promise.all([
      prisma.creativePack.findMany({
        where: { projectId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              packAngles: true,
            },
          },
        },
      }),
      prisma.creativePack.count({ where: { projectId } }),
    ]);

    return { packs, total };
  }

  async incrementDownloadCount(id: string): Promise<void> {
    await prisma.creativePack.update({
      where: { id },
      data: {
        downloadCount: { increment: 1 },
      },
    });
  }

  async updateFilePath(id: string, filePath: string, fileSize: number): Promise<CreativePack> {
    return prisma.creativePack.update({
      where: { id },
      data: {
        filePath,
        fileSize: BigInt(fileSize),
        downloadUrl: `/api/packs/${id}/download`,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.creativePack.delete({ where: { id } });
  }
}

export const packRepository = new PackRepository();
