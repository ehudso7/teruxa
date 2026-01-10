import { prisma } from './prisma-client.js';
import type { Project } from '@prisma/client';
import type { SeedData } from '../types/index.js';
import { toInputJson } from '../utils/prismaJson.js';

export interface CreateProjectData {
  name: string;
  description?: string;
  seedData: SeedData;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  seedData?: SeedData;
}

export interface ProjectWithRelations extends Project {
  angleCards?: {
    id: string;
    status: string;
    isWinner: boolean;
    createdAt: Date;
  }[];
  _count?: {
    angleCards: number;
    packs: number;
  };
}

export class ProjectRepository {
  async create(data: CreateProjectData): Promise<Project> {
    return prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        seedData: toInputJson(data.seedData),
      },
    });
  }

  async findById(id: string): Promise<ProjectWithRelations | null> {
    return prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            angleCards: true,
            packs: true,
          },
        },
      },
    });
  }

  async findAll(options?: {
    page?: number;
    limit?: number;
  }): Promise<{ projects: ProjectWithRelations[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              angleCards: true,
              packs: true,
            },
          },
        },
      }),
      prisma.project.count(),
    ]);

    return { projects, total };
  }

  async update(id: string, data: UpdateProjectData): Promise<Project> {
    return prisma.project.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.seedData && { seedData: toInputJson(data.seedData) }),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.project.delete({ where: { id } });
  }

  async exists(id: string): Promise<boolean> {
    const count = await prisma.project.count({ where: { id } });
    return count > 0;
  }
}

export const projectRepository = new ProjectRepository();