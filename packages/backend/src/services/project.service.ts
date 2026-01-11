import { projectRepository } from '../repositories/index.js';
import { createChildLogger } from '../utils/logger.js';
import { NotFoundError } from '../types/index.js';
import type { SeedData } from '../types/index.js';
import type { Project } from '@prisma/client';
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from '../validators/index.js';
import type { UpdateProjectData } from '../repositories/project.repository.js';

const logger = createChildLogger('project-service');

// Re-export types for consumers
export type { CreateProjectInput, UpdateProjectInput };

class ProjectService {
  async createProject(input: CreateProjectInput): Promise<Project> {
    // Type assertion is safe because zod validation ensures seedData is valid
    const project = await projectRepository.create({
      name: input.name,
      description: input.description,
      seedData: input.seedData as SeedData,
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

    // Type assertion is safe because zod validation ensures data is valid
    const updated = await projectRepository.update(id, input as UpdateProjectData);
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
