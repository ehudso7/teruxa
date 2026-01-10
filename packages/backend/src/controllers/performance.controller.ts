import type { Request, Response } from 'express';
import { performanceService } from '../services/index.js';
import { ValidationError } from '../types/index.js';

export class PerformanceController {
  async importCSV(req: Request<{ projectId: string }>, res: Response) {
    if (!req.file) {
      throw new ValidationError('No CSV file provided');
    }

    const result = await performanceService.importCSV(
      req.params.projectId,
      req.file.originalname,
      req.file.buffer
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  }

  async getImportBatch(req: Request<{ batchId: string }>, res: Response) {
    const batch = await performanceService.getImportBatch(req.params.batchId);
    res.json({
      success: true,
      data: batch,
    });
  }

  async getProjectImports(req: Request<{ projectId: string }>, res: Response) {
    const imports = await performanceService.getProjectImports(req.params.projectId);
    res.json({
      success: true,
      data: imports,
    });
  }

  async getProjectMetrics(req: Request<{ projectId: string }>, res: Response) {
    const metrics = await performanceService.getProjectMetrics(req.params.projectId);
    res.json({
      success: true,
      data: metrics,
    });
  }

  async identifyWinners(
    req: Request<
      { projectId: string },
      unknown,
      unknown,
      { topN?: string; metric?: string }
    >,
    res: Response
  ) {
    const { topN, metric } = req.query;

    const analysis = await performanceService.identifyWinners(req.params.projectId, {
      topN: topN ? parseInt(topN, 10) : undefined,
      metric: metric as 'ctr' | 'roas' | 'conversions' | undefined,
    });

    res.json({
      success: true,
      data: analysis,
    });
  }

  async generateIterations(
    req: Request<
      { projectId: string },
      unknown,
      unknown,
      { topN?: string; count?: string }
    >,
    res: Response
  ) {
    const { topN, count } = req.query;

    const iterations = await performanceService.generateIterations(
      req.params.projectId,
      {
        topN: topN ? parseInt(topN, 10) : undefined,
        count: count ? parseInt(count, 10) : undefined,
      }
    );

    res.status(201).json({
      success: true,
      data: iterations,
    });
  }
}

export const performanceController = new PerformanceController();
