import { projectRepository } from '../repositories/index.js';
import { createChildLogger } from '../utils/logger.js';
import { NotFoundError } from '../types/index.js';
import type { SeedData } from '../types/index.js';
import type { Project } from '@prisma/client';

const logger = createChildLogger('project-service');

export interface CreateProjectInput {
  name: string;
  description?: string;
  seedData: SeedData;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  seedData?: SeedData;
}

class ProjectService {
  async createProject(input: CreateProjectInput): Promise<Project> {
    const project = await projectRepository.create({
      name: input.name,
      description: input.description,
      seedData: input.seedData,
    });

    logger.info({ projectId: project.id, name: project.name }, 'Project created');

    return project;
  }

  async getProject(id: string) {
    const project = await projectRepository.findById(id);
    if (!project) {
      throw new NotFoundError('Project');
    }
    return project;
  }

  async getAllProjects(options?: { page?: number; limit?: number }) {
    return projectRepository.findAll(options);
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
    const exists = await projectRepository.exists(id);
    if (!exists) {
      throw new NotFoundError('Project');
    }

    const updated = await projectRepository.update(id, input);
    logger.info({ projectId: id }, 'Project updated');

    return updated;
  }

  async deleteProject(id: string): Promise<void> {
    const exists = await projectRepository.exists(id);
    if (!exists) {
      throw new NotFoundError('Project');
    }

    await projectRepository.delete(id);
    logger.info({ projectId: id }, 'Project deleted');
  }
}

export const projectService = new ProjectService();
