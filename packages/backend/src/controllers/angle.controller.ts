import type { Request, Response } from 'express';
import { angleService } from '../services/index.js';
import type { UpdateAngleInput } from '../validators/index.js';
import type { AngleStatus } from '../types/index.js';

export class AngleController {
  async generate(
    req: Request<{ projectId: string }, unknown, unknown, { count?: string }>,
    res: Response
  ) {
    const count = req.query.count ? parseInt(req.query.count, 10) : 3;
    const result = await angleService.generateAngles(req.params.projectId, count);
    res.status(201).json({
      success: true,
      data: result,
    });
  }

  async getById(req: Request<{ id: string }>, res: Response) {
    const angle = await angleService.getAngle(req.params.id);
    res.json({
      success: true,
      data: angle,
    });
  }

  async getByProject(
    req: Request<
      { projectId: string },
      unknown,
      unknown,
      { status?: string; isWinner?: string; page?: string; limit?: string }
    >,
    res: Response
  ) {
    const { status, isWinner, page, limit } = req.query;

    const result = await angleService.getProjectAngles(req.params.projectId, {
      status: status as AngleStatus | undefined,
      isWinner: isWinner === 'true' ? true : isWinner === 'false' ? false : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    res.json({
      success: true,
      data: result.angles,
      meta: {
        total: result.total,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      },
    });
  }

  async update(req: Request<{ id: string }, unknown, UpdateAngleInput>, res: Response) {
    const angle = await angleService.updateAngle(req.params.id, req.body);
    res.json({
      success: true,
      data: angle,
    });
  }

  async updateStatus(
    req: Request<{ id: string }, unknown, { status: AngleStatus }>,
    res: Response
  ) {
    const angle = await angleService.updateAngleStatus(req.params.id, req.body.status);
    res.json({
      success: true,
      data: angle,
    });
  }

  async setWinner(
    req: Request<{ id: string }, unknown, { isWinner: boolean }>,
    res: Response
  ) {
    const angle = await angleService.setWinner(req.params.id);
    res.json({
      success: true,
      data: angle,
    });
  }

  async delete(req: Request<{ id: string }>, res: Response) {
    await angleService.deleteAngle(req.params.id);
    res.status(204).send();
  }

  async regenerate(req: Request<{ id: string }>, res: Response) {
    const angle = await angleService.regenerateAngle(req.params.id);
    res.status(201).json({
      success: true,
      data: angle,
    });
  }
}

export const angleController = new AngleController();
