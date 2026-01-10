import { parse } from 'csv-parse';
import { Readable } from 'stream';
import {
  projectRepository,
  angleRepository,
  performanceRepository,
} from '../repositories/index.js';
import { aiService } from './ai.service.js';
import { createChildLogger } from '../utils/logger.js';
import { NotFoundError, ValidationError } from '../types/index.js';
import { csvRowSchema } from '../validators/index.js';
import { parseSeedData } from '../schemas/seedData.schema.js';
import type { GeneratedAngle, ImportResult, WinnerAnalysis, Platform, Locale } from '../types/index.js';
import type { AngleCard, ImportBatch } from '@prisma/client';

const logger = createChildLogger('performance-service');

class PerformanceService {
  async importCSV(
    projectId: string,
    filename: string,
    fileBuffer: Buffer
  ): Promise<ImportResult> {
    // Verify project exists
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    // Create import batch
    const batch = await performanceRepository.createImportBatch({
      projectId,
      filename,
    });

    const errors: Array<{ row: number; message: string }> = [];
    const validRows: Array<{
      angleId: string;
      impressions: number;
      clicks: number;
      conversions: number;
      spend: number;
      revenue: number;
      platform?: Platform;
      locale?: Locale;
      dateRangeStart?: Date;
      dateRangeEnd?: Date;
    }> = [];

    try {
      // Parse CSV
      const records = await this.parseCSV(fileBuffer);

      // Validate each row
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNum = i + 2; // 1-indexed, skip header

        try {
          const validated = csvRowSchema.parse(record);

          // Verify angle exists and belongs to project
          const angle = await angleRepository.findById(validated.angle_id);
          if (!angle) {
            errors.push({ row: rowNum, message: `Angle ${validated.angle_id} not found` });
            continue;
          }
          if (angle.projectId !== projectId) {
            errors.push({
              row: rowNum,
              message: `Angle ${validated.angle_id} does not belong to this project`,
            });
            continue;
          }

          validRows.push({
            angleId: validated.angle_id,
            impressions: validated.impressions,
            clicks: validated.clicks,
            conversions: validated.conversions,
            spend: validated.spend,
            revenue: validated.revenue,
            platform: validated.platform as Platform | undefined,
            locale: validated.locale as Locale | undefined,
            dateRangeStart: validated.date_start ? new Date(validated.date_start) : undefined,
            dateRangeEnd: validated.date_end ? new Date(validated.date_end) : undefined,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Invalid row format';
          errors.push({ row: rowNum, message });
        }
      }

      // Insert valid rows
      if (validRows.length > 0) {
        await performanceRepository.createManyPerformanceData(
          validRows.map((r) => ({
            ...r,
            importBatchId: batch.id,
          }))
        );
      }

      // Update batch status
      const finalStatus =
        errors.length === 0
          ? 'completed'
          : validRows.length === 0
            ? 'failed'
            : 'partial';

      await performanceRepository.updateImportBatch(batch.id, {
        status: finalStatus,
        rowsProcessed: validRows.length,
        rowsFailed: errors.length,
        errorLog: errors,
        completedAt: new Date(),
      });

      logger.info(
        { batchId: batch.id, processed: validRows.length, failed: errors.length },
        'CSV import completed'
      );

      return {
        batchId: batch.id,
        filename,
        rowsTotal: records.length,
        rowsProcessed: validRows.length,
        rowsFailed: errors.length,
        errors,
      };
    } catch (error) {
      await performanceRepository.updateImportBatch(batch.id, {
        status: 'failed',
        errorLog: [{ row: 0, message: String(error) }],
        completedAt: new Date(),
      });
      throw error;
    }
  }

  private async parseCSV(buffer: Buffer): Promise<Record<string, string>[]> {
    return new Promise((resolve, reject) => {
      const records: Record<string, string>[] = [];
      const stream = Readable.from(buffer);

      stream
        .pipe(
          parse({
            columns: true,
            skip_empty_lines: true,
            trim: true,
          })
        )
        .on('data', (record: Record<string, string>) => {
          records.push(record);
        })
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }

  async getImportBatch(batchId: string): Promise<ImportBatch> {
    const batch = await performanceRepository.findImportBatchById(batchId);
    if (!batch) {
      throw new NotFoundError('Import batch');
    }
    return batch;
  }

  async getProjectImports(projectId: string): Promise<ImportBatch[]> {
    const exists = await projectRepository.exists(projectId);
    if (!exists) {
      throw new NotFoundError('Project');
    }
    return performanceRepository.findImportBatchesByProjectId(projectId);
  }

  async getProjectMetrics(projectId: string) {
    const exists = await projectRepository.exists(projectId);
    if (!exists) {
      throw new NotFoundError('Project');
    }
    return performanceRepository.getAggregatedMetricsByProject(projectId);
  }

  async identifyWinners(
    projectId: string,
    options?: { topN?: number; metric?: 'ctr' | 'roas' | 'conversions' }
  ): Promise<WinnerAnalysis> {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    const topN = options?.topN ?? 3;
    const metric = options?.metric ?? 'ctr';

    // Get top performers
    const topPerformers = await performanceRepository.getTopPerformers(
      projectId,
      metric,
      topN
    );

    if (topPerformers.length === 0) {
      return {
        topPerformers: [],
        patterns: [],
        recommendations: ['No performance data available. Import CSV data first.'],
      };
    }

    // Mark winners in database
    for (const performer of topPerformers) {
      await angleRepository.update(performer.angleId, { isWinner: true });
    }

    // Get full angle data for pattern analysis
    const winnerAngles: Array<{
      angle: GeneratedAngle;
      metrics: { ctr: number; roas: number | null; conversions: number };
    }> = [];

    for (const performer of topPerformers) {
      const angle = await angleRepository.findById(performer.angleId);
      if (angle) {
        winnerAngles.push({
          angle: {
            hook: angle.hook,
            problemAgitation: angle.problemAgitation,
            solution: angle.solution,
            cta: angle.cta,
            visualDirection: angle.visualDirection ?? undefined,
            audioNotes: angle.audioNotes ?? undefined,
            estimatedDuration: angle.estimatedDuration ?? undefined,
          },
          metrics: {
            ctr: performer.ctr,
            roas: performer.roas,
            conversions: performer.totalConversions,
          },
        });
      }
    }

    // Analyze patterns
    const { patterns, recommendations } =
      await aiService.analyzeWinnerPatterns(winnerAngles);

    logger.info({ projectId, winners: topPerformers.length }, 'Winners identified');

    return {
      topPerformers: topPerformers.map((p) => ({
        angleId: p.angleId,
        metrics: {
          impressions: p.totalImpressions,
          clicks: p.totalClicks,
          conversions: p.totalConversions,
          spend: p.totalSpend,
          revenue: p.totalRevenue,
          ctr: p.ctr,
          cpa: p.cpa ?? undefined,
          roas: p.roas ?? undefined,
        },
        score: metric === 'ctr' ? p.ctr : metric === 'roas' ? (p.roas ?? 0) : p.totalConversions,
      })),
      patterns,
      recommendations,
    };
  }

  async generateIterations(
    projectId: string,
    options?: { topN?: number; count?: number }
  ): Promise<AngleCard[]> {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project');
    }

    const topN = options?.topN ?? 3;
    const count = options?.count ?? 5;
    const seedData = parseSeedData(project.seedData);

    // Get winners
    const { angles: winners } = await angleRepository.findByProjectId(projectId, {
      isWinner: true,
    });
    if (winners.length === 0) {
      throw new ValidationError(
        'No winners identified. Run winner identification first.'
      );
    }

    // Get pattern analysis
    const winnerAngles = winners.slice(0, topN).map((w) => ({
      angle: {
        hook: w.hook,
        problemAgitation: w.problemAgitation,
        solution: w.solution,
        cta: w.cta,
        visualDirection: w.visualDirection ?? undefined,
        audioNotes: w.audioNotes ?? undefined,
        estimatedDuration: w.estimatedDuration ?? undefined,
      } as GeneratedAngle,
      metrics: { ctr: 0, roas: null, conversions: 0 }, // Will be filled from perf data
    }));

    const { patterns } = await aiService.analyzeWinnerPatterns(winnerAngles);

    // Generate new angles based on winners
    const newAngles = await aiService.generateIterations(
      winnerAngles.map((w) => w.angle),
      patterns,
      seedData,
      count
    );

    // Store new angles with parent references
    const createdAngles: AngleCard[] = [];
    for (let i = 0; i < newAngles.length; i++) {
      const angle = newAngles[i];
      const parentWinner = winners[i % winners.length];

      if (!angle || !parentWinner) continue;

      const created = await angleRepository.create({
        projectId,
        hook: angle.hook,
        problemAgitation: angle.problemAgitation,
        solution: angle.solution,
        cta: angle.cta,
        visualDirection: angle.visualDirection,
        audioNotes: angle.audioNotes,
        estimatedDuration: angle.estimatedDuration,
        parentAngleId: parentWinner.id,
        generationNotes: `Iteration based on winner ${parentWinner.id}. ${angle.generationNotes ?? ''}`,
      });
      createdAngles.push(created);
    }

    logger.info(
      { projectId, winnersUsed: Math.min(topN, winners.length), created: createdAngles.length },
      'Iterations generated'
    );

    return createdAngles;
  }
}

export const performanceService = new PerformanceService();