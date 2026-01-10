import type { Request, Response } from 'express';
import { projectService } from '../services/index.js';
import type { CreateProjectInput, UpdateProjectInput } from '../validators/index.js';

export class ProjectController {
  async create(req: Request<unknown, unknown, CreateProjectInput>, res: Response) {
    const project = await projectService.createProject(req.body);
    res.status(201).json({
      success: true,
      data: project,
    });
  }

  async getById(req: Request<{ id: string }>, res: Response) {
    const project = await projectService.getProject(req.params.id);
    res.json({
      success: true,
      data: project,
    });
  }

  async getAll(req: Request<unknown, unknown, unknown, { page?: string; limit?: string }>, res: Response) {
    const page = req.query.page ? parseInt(req.query.page, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;

    const result = await projectService.getAllProjects({ page, limit });
    res.json({
      success: true,
      data: result.projects,
      meta: {
        total: result.total,
        page: page ?? 1,
        limit: limit ?? 20,
      },
    });
  }

  async update(req: Request<{ id: string }, unknown, UpdateProjectInput>, res: Response) {
    const project = await projectService.updateProject(req.params.id, req.body);
    res.json({
      success: true,
      data: project,
    });
  }

  async delete(req: Request<{ id: string }>, res: Response) {
    await projectService.deleteProject(req.params.id);
    res.status(204).send();
  }
}

export const projectController = new ProjectController();
