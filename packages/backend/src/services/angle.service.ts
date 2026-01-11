import { projectRepository, angleRepository } from '../repositories/index.js';
import { aiService } from './ai.service.js';
import { createChildLogger } from '../utils/logger.js';
import { NotFoundError } from '../types/index.js';
import type { AngleCard } from '@prisma/client';
import { parseSeedData } from '../schemas/seedData.schema.js';
import type { UpdateAngleInput } from '../validators/index.js';

const logger = createChildLogger('angle-service');

export interface GenerateAnglesResult {
  projectId: string;
  angles: AngleCard[];
  count: number;
}

// Re-export for consumers
export type { UpdateAngleInput };

class AngleService {
  async generateAngles(projectId: string, count: number): Promise<GenerateAnglesResult> {
    // Verify project exists
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    const seedData = parseSeedData(project.seedData);
    logger.info({ projectId, count }, 'Generating angles for project');

    // Generate angles via AI service
    const generatedAngles = await aiService.generateAngles(seedData, count);

    // Save angles to database - createMany returns count, we need to fetch them
    const createdCount = await angleRepository.createMany(
      generatedAngles.map((angleData) => ({
        projectId,
        ...angleData,
      }))
    );

    // Fetch the created angles
    const { angles } = await angleRepository.findByProjectId(projectId, {
      limit: createdCount,
    });

    logger.info({ projectId, anglesCreated: createdCount }, 'Angles generated successfully');

    return {
      projectId,
      angles,
      count: createdCount,
    };
  }

  async getProjectAngles(
    projectId: string,
    filters?: {
      status?: AngleStatus;
      isWinner?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<{ angles: AngleCard[]; total: number }> {
    // Verify project exists
    const exists = await projectRepository.exists(projectId);
    if (!exists) {
      throw new NotFoundError('Project');
    }

    return angleRepository.findByProjectId(projectId, filters);
  }

  async getAngle(id: string): Promise<AngleCard> {
    const angle = await angleRepository.findById(id);
    if (!angle) {
      throw new NotFoundError('Angle');
    }
    return angle;
  }

  async getAngleById(id: string): Promise<AngleCard> {
    return this.getAngle(id);
  }

  async updateAngle(id: string, data: UpdateAngleInput): Promise<AngleCard> {
    const existing = await angleRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Angle');
    }

    return angleRepository.update(id, data);
  }

  async updateAngleStatus(id: string, status: AngleStatus): Promise<AngleCard> {
    const existing = await angleRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Angle');
    }

    return angleRepository.update(id, { status });
  }

  async deleteAngle(id: string): Promise<void> {
    const existing = await angleRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Angle');
    }

    await angleRepository.delete(id);
  }

  async setWinner(angleId: string): Promise<AngleCard> {
    return this.markAsWinner(angleId);
  }

  async markAsWinner(angleId: string): Promise<AngleCard> {
    const angle = await angleRepository.findById(angleId);
    if (!angle) {
      throw new NotFoundError('Angle');
    }

    return angleRepository.update(angleId, {
      isWinner: true,
      status: 'approved',
    });
  }

  async getWinningAngles(projectId: string): Promise<AngleCard[]> {
    const exists = await projectRepository.exists(projectId);
    if (!exists) {
      throw new NotFoundError('Project');
    }

    const { angles } = await angleRepository.findByProjectId(projectId, {
      isWinner: true,
    });

    return angles;
  }

  async regenerateAngle(angleId: string): Promise<AngleCard> {
    // Get existing angle to get project and current content
    const angle = await angleRepository.findById(angleId);
    if (!angle) {
      throw new NotFoundError('Angle');
    }

    // Get project for seed data
    const project = await projectRepository.findById(angle.projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    const seedData = parseSeedData(project.seedData);
    logger.info({ angleId }, 'Regenerating angle');

    // Generate a single new angle
    const [newAngleData] = await aiService.generateAngles(seedData, 1);

    // Update the existing angle with new content
    const updatedAngle = await angleRepository.update(angleId, {
      ...newAngleData,
      status: 'draft', // Reset to draft when regenerated
    });

    logger.info({ angleId }, 'Angle regenerated successfully');
    return updatedAngle;
  }
}

export const angleService = new AngleService();