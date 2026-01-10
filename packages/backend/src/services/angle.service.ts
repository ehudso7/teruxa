import { projectRepository, angleRepository } from '../repositories/index.js';
import { aiService } from './ai.service.js';
import { createChildLogger } from '../utils/logger.js';
import { NotFoundError, ValidationError } from '../types/index.js';
import type { SeedData, AngleStatus } from '../types/index.js';
import type { AngleCard } from '@prisma/client';

const logger = createChildLogger('angle-service');

export interface GenerateAnglesResult {
  projectId: string;
  angles: AngleCard[];
  count: number;
}

export interface UpdateAngleInput {
  hook?: string;
  problemAgitation?: string;
  solution?: string;
  cta?: string;
  visualDirection?: string | null;
  audioNotes?: string | null;
  estimatedDuration?: number | null;
  status?: AngleStatus;
}

class AngleService {
  async generateAngles(projectId: string, count: number): Promise<GenerateAnglesResult> {
    // Verify project exists
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    const seedData = project.seedData as SeedData;
    logger.info({ projectId, count }, 'Generating angles for project');

    // Generate angles via AI service
    const generatedAngles = await aiService.generateAngles(seedData, count);

    // Store angles in database
    const createdAngles: AngleCard[] = [];
    for (const angle of generatedAngles) {
      const created = await angleRepository.create({
        projectId,
        hook: angle.hook,
        problemAgitation: angle.problemAgitation,
        solution: angle.solution,
        cta: angle.cta,
        visualDirection: angle.visualDirection,
        audioNotes: angle.audioNotes,
        estimatedDuration: angle.estimatedDuration,
        generationNotes: angle.generationNotes,
      });
      createdAngles.push(created);
    }

    logger.info({ projectId, created: createdAngles.length }, 'Angles generated successfully');

    return {
      projectId,
      angles: createdAngles,
      count: createdAngles.length,
    };
  }

  async getAngle(id: string) {
    const angle = await angleRepository.findById(id);
    if (!angle) {
      throw new NotFoundError('Angle');
    }
    return angle;
  }

  async getProjectAngles(
    projectId: string,
    options?: {
      status?: AngleStatus;
      isWinner?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    // Verify project exists
    const projectExists = await projectRepository.exists(projectId);
    if (!projectExists) {
      throw new NotFoundError('Project');
    }

    return angleRepository.findByProjectId(projectId, options);
  }

  async updateAngle(id: string, data: UpdateAngleInput) {
    const exists = await angleRepository.exists(id);
    if (!exists) {
      throw new NotFoundError('Angle');
    }

    return angleRepository.update(id, data);
  }

  async updateAngleStatus(id: string, status: AngleStatus) {
    const angle = await angleRepository.findById(id);
    if (!angle) {
      throw new NotFoundError('Angle');
    }

    // Validate status transitions
    const validTransitions: Record<string, AngleStatus[]> = {
      draft: ['approved', 'rejected', 'archived'],
      approved: ['archived', 'rejected'],
      rejected: ['draft', 'archived'],
      archived: ['draft'],
    };

    const currentStatus = angle.status as AngleStatus;
    if (!validTransitions[currentStatus]?.includes(status)) {
      throw new ValidationError(
        `Cannot transition from ${currentStatus} to ${status}`
      );
    }

    return angleRepository.update(id, { status });
  }

  async setWinner(id: string, isWinner: boolean) {
    const exists = await angleRepository.exists(id);
    if (!exists) {
      throw new NotFoundError('Angle');
    }

    return angleRepository.setWinner(id, isWinner);
  }

  async deleteAngle(id: string) {
    const exists = await angleRepository.exists(id);
    if (!exists) {
      throw new NotFoundError('Angle');
    }

    await angleRepository.delete(id);
    logger.info({ angleId: id }, 'Angle deleted');
  }

  async regenerateAngle(id: string) {
    const angle = await angleRepository.findById(id);
    if (!angle) {
      throw new NotFoundError('Angle');
    }

    const project = await projectRepository.findById(angle.projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    const seedData = project.seedData as SeedData;

    // Generate a single new angle
    const [generatedAngle] = await aiService.generateAngles(seedData, 1);
    if (!generatedAngle) {
      throw new Error('Failed to generate replacement angle');
    }

    // Create new angle with reference to old one
    const newAngle = await angleRepository.create({
      projectId: angle.projectId,
      hook: generatedAngle.hook,
      problemAgitation: generatedAngle.problemAgitation,
      solution: generatedAngle.solution,
      cta: generatedAngle.cta,
      visualDirection: generatedAngle.visualDirection,
      audioNotes: generatedAngle.audioNotes,
      estimatedDuration: generatedAngle.estimatedDuration,
      parentAngleId: id,
      generationNotes: `Regenerated from angle ${id}. ${generatedAngle.generationNotes ?? ''}`,
    });

    // Archive the old angle
    await angleRepository.update(id, { status: 'archived' });

    logger.info({ oldAngleId: id, newAngleId: newAngle.id }, 'Angle regenerated');

    return newAngle;
  }
}

export const angleService = new AngleService();
