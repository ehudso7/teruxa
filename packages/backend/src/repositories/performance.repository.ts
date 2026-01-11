import { prisma } from './prisma-client.js';
import type { PerformanceData, ImportBatch, Prisma } from '@prisma/client';
import type { Locale, Platform } from '../types/index.js';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateImportBatchData {
  projectId: string;
  filename: string;
  rowsTotal?: number;
}

export interface CreatePerformanceData {
  angleId: string;
  importBatchId: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  platform?: Platform;
  locale?: Locale;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
}

export interface PerformanceWithAngle extends PerformanceData {
  angle: {
    id: string;
    hook: string;
    projectId: string;
    isWinner: boolean;
  };
}

export interface PerformanceMetricsResult {
  angleId: string;
  hook: string;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalSpend: number;
  totalRevenue: number;
  ctr: number;
  cpa: number | null;
  roas: number | null;
}

// Type for raw SQL query result
interface RawMetricsRow {
  angle_id: string;
  hook: string;
  total_impressions: bigint;
  total_clicks: bigint;
  total_conversions: bigint;
  total_spend: Decimal;
  total_revenue: Decimal;
}

export class PerformanceRepository {
  // Import Batch methods
  async createImportBatch(data: CreateImportBatchData): Promise<ImportBatch> {
    return prisma.importBatch.create({
      data: {
        projectId: data.projectId,
        filename: data.filename,
        rowsTotal: data.rowsTotal,
        status: 'processing',
      },
    });
  }

  async updateImportBatch(
    id: string,
    data: {
      status?: string;
      rowsProcessed?: number;
      rowsFailed?: number;
      errorLog?: Array<{ row: number; message: string }>;
      completedAt?: Date;
    }
  ): Promise<ImportBatch> {
    return prisma.importBatch.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.rowsProcessed !== undefined && { rowsProcessed: data.rowsProcessed }),
        ...(data.rowsFailed !== undefined && { rowsFailed: data.rowsFailed }),
        ...(data.errorLog && { errorLog: data.errorLog as Prisma.InputJsonValue }),
        ...(data.completedAt && { completedAt: data.completedAt }),
      },
    });
  }

  async findImportBatchById(id: string): Promise<ImportBatch | null> {
    return prisma.importBatch.findUnique({
      where: { id },
    });
  }

  async findImportBatchesByProjectId(projectId: string): Promise<ImportBatch[]> {
    return prisma.importBatch.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Performance Data methods
  async createPerformanceData(data: CreatePerformanceData): Promise<PerformanceData> {
    return prisma.performanceData.create({
      data: {
        angleId: data.angleId,
        importBatchId: data.importBatchId,
        impressions: BigInt(data.impressions),
        clicks: BigInt(data.clicks),
        conversions: data.conversions,
        spend: new Decimal(data.spend),
        revenue: new Decimal(data.revenue),
        platform: data.platform,
        locale: data.locale,
        dateRangeStart: data.dateRangeStart,
        dateRangeEnd: data.dateRangeEnd,
      },
    });
  }

  async createManyPerformanceData(data: CreatePerformanceData[]): Promise<number> {
    const result = await prisma.performanceData.createMany({
      data: data.map((d) => ({
        angleId: d.angleId,
        importBatchId: d.importBatchId,
        impressions: BigInt(d.impressions),
        clicks: BigInt(d.clicks),
        conversions: d.conversions,
        spend: new Decimal(d.spend),
        revenue: new Decimal(d.revenue),
        platform: d.platform,
        locale: d.locale,
        dateRangeStart: d.dateRangeStart,
        dateRangeEnd: d.dateRangeEnd,
      })),
    });
    return result.count;
  }

  async findByAngleId(angleId: string): Promise<PerformanceData[]> {
    return prisma.performanceData.findMany({
      where: { angleId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByImportBatchId(importBatchId: string): Promise<PerformanceWithAngle[]> {
    return prisma.performanceData.findMany({
      where: { importBatchId },
      include: {
        angle: {
          select: {
            id: true,
            hook: true,
            projectId: true,
            isWinner: true,
          },
        },
      },
    });
  }

  async getAggregatedMetricsByProject(projectId: string): Promise<PerformanceMetricsResult[]> {
    // Raw query for aggregation with calculated metrics
    const results = await prisma.$queryRaw<RawMetricsRow[]>`
      SELECT
        ac.id as angle_id,
        ac.hook,
        COALESCE(SUM(pd.impressions), 0) as total_impressions,
        COALESCE(SUM(pd.clicks), 0) as total_clicks,
        COALESCE(SUM(pd.conversions), 0) as total_conversions,
        COALESCE(SUM(pd.spend), 0) as total_spend,
        COALESCE(SUM(pd.revenue), 0) as total_revenue
      FROM angle_cards ac
      LEFT JOIN performance_data pd ON ac.id = pd.angle_id
      WHERE ac.project_id = ${projectId}
      GROUP BY ac.id, ac.hook
      ORDER BY total_impressions DESC
    `;

    return results.map((r) => {
      const impressions = Number(r.total_impressions);
      const clicks = Number(r.total_clicks);
      const conversions = Number(r.total_conversions);
      const spend = Number(r.total_spend);
      const revenue = Number(r.total_revenue);

      return {
        angleId: r.angle_id,
        hook: r.hook,
        totalImpressions: impressions,
        totalClicks: clicks,
        totalConversions: conversions,
        totalSpend: spend,
        totalRevenue: revenue,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpa: conversions > 0 ? spend / conversions : null,
        roas: spend > 0 ? revenue / spend : null,
      };
    });
  }

  async getTopPerformers(
    projectId: string,
    metric: 'ctr' | 'roas' | 'conversions',
    limit: number
  ): Promise<PerformanceMetricsResult[]> {
    const all = await this.getAggregatedMetricsByProject(projectId);

    // Sort by the specified metric
    const sorted = all.sort((a, b) => {
      switch (metric) {
        case 'ctr':
          return b.ctr - a.ctr;
        case 'roas':
          return (b.roas ?? 0) - (a.roas ?? 0);
        case 'conversions':
          return b.totalConversions - a.totalConversions;
        default:
          return b.ctr - a.ctr;
      }
    });

    return sorted.slice(0, limit);
  }
}

export const performanceRepository = new PerformanceRepository();
