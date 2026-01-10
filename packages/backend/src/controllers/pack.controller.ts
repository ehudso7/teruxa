import type { Request, Response } from 'express';
import { packService } from '../services/index.js';
import type { CreatePackInput } from '../validators/index.js';

export class PackController {
  async create(
    req: Request<{ projectId: string }, unknown, Omit<CreatePackInput, 'projectId'>>,
    res: Response
  ) {
    const pack = await packService.createPack({
      ...req.body,
      projectId: req.params.projectId,
    });

    res.status(201).json({
      success: true,
      data: pack,
    });
  }

  async getById(req: Request<{ id: string }>, res: Response) {
    const pack = await packService.getPack(req.params.id);
    res.json({
      success: true,
      data: pack,
    });
  }

  async getByProject(
    req: Request<
      { projectId: string },
      unknown,
      unknown,
      { page?: string; limit?: string }
    >,
    res: Response
  ) {
    const { page, limit } = req.query;

    const packs = await packService.getProjectPacks(req.params.projectId);

    res.json({
      success: true,
      data: packs,
      meta: {
        total: packs.length,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      },
    });
  }

  async download(req: Request<{ id: string }>, res: Response) {
    const { stream, filename, size } = await packService.downloadPack(req.params.id);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', size);

    stream.pipe(res);
  }

  async delete(req: Request<{ id: string }>, res: Response) {
    await packService.deletePack(req.params.id);
    res.status(204).send();
  }
}

export const packController = new PackController();
