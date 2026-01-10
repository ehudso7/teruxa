import { prisma } from './prisma-client.js';
import type { CreativePack, PackAngle } from '@prisma/client';
import type { PackManifest, Locale, Platform } from '../types/index.js';
import { toInputJson } from '../utils/prismaJson.js';

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
        manifest: toInputJson(data.manifest),
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

  async findById(id: string): Promise<CreativePack | null> {
    return prisma.creativePack.findUnique({
      where: { id },
    });
  }

  async findWithAngles(id: string): Promise<PackWithAngles | null> {
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
    }) as Promise<PackWithAngles | null>;
  }

  async findByProjectId(projectId: string): Promise<CreativePack[]> {
    return prisma.creativePack.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateDownloadInfo(
    id: string,
    data: {
      filePath?: string;
      downloadUrl?: string;
      fileSize?: number;
    }
  ): Promise<CreativePack> {
    return prisma.creativePack.update({
      where: { id },
      data: {
        ...(data.filePath && { filePath: data.filePath }),
        ...(data.downloadUrl && { downloadUrl: data.downloadUrl }),
        ...(data.fileSize && { fileSize: BigInt(data.fileSize) }),
      },
    });
  }

  async incrementDownloads(id: string): Promise<void> {
    await prisma.creativePack.update({
      where: { id },
      data: {
        downloadCount: {
          increment: 1,
        },
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.creativePack.delete({ where: { id } });
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.creativePack.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }
}

export const packRepository = new PackRepository();