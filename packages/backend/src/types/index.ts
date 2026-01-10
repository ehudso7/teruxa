import type { Request, Response, NextFunction } from 'express';

// ============================================
// Seed Data Types
// ============================================

export type Tone = 'professional' | 'casual' | 'humorous' | 'urgent' | 'empathetic';
export type Platform = 'tiktok' | 'instagram' | 'youtube';
export type Locale = 'en-US' | 'es-ES' | 'fr-FR' | 'de-DE' | 'pt-BR';

export interface SeedData {
  product_name: string;
  product_description: string;
  target_audience: string;
  key_benefits: string[];
  pain_points: string[];
  tone: Tone;
  platforms: Platform[];
  brand_guidelines?: string;
  competitors?: string[];
  unique_selling_points?: string[];
}

// ============================================
// Angle Card Types
// ============================================

export type AngleStatus = 'draft' | 'approved' | 'rejected' | 'archived';

export interface AngleCardData {
  hook: string;
  problemAgitation: string;
  solution: string;
  cta: string;
  visualDirection?: string;
  audioNotes?: string;
  estimatedDuration?: number;
}

export interface GeneratedAngle extends AngleCardData {
  generationNotes?: string;
}

// ============================================
// Localization Types
// ============================================

export interface Caption {
  timestamp_start: number;
  timestamp_end: number;
  text: string;
  style?: 'normal' | 'emphasis' | 'whisper';
}

export interface OnScreenText {
  timestamp: number;
  duration: number;
  text: string;
  position: 'top' | 'center' | 'bottom';
  animation?: 'fade' | 'slide' | 'pop';
}

export interface LocalizedContentData {
  script: string;
  captions: Caption[];
  onScreenText: OnScreenText[];
  culturalNotes?: string;
  platformAdjustments?: string;
}

// ============================================
// Performance Types
// ============================================

export interface PerformanceMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr?: number;
  cpa?: number;
  roas?: number;
}

export interface WinnerAnalysis {
  topPerformers: Array<{
    angleId: string;
    metrics: PerformanceMetrics;
    score: number;
  }>;
  patterns: string[];
  recommendations: string[];
}

// ============================================
// API Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

// ============================================
// Express Extensions
// ============================================

export interface TypedRequest<T = unknown> extends Request {
  body: T;
}

export type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

// ============================================
// Error Types
// ============================================

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class AIServiceError extends AppError {
  constructor(message: string, details?: unknown) {
    super(503, message, 'AI_SERVICE_ERROR', details);
    this.name = 'AIServiceError';
  }
}

// ============================================
// Pack Types
// ============================================

export interface PackManifest {
  version: string;
  created_at: string;
  project_name: string;
  contents: {
    angles: number;
    locales: string[];
    platforms: string[];
    total_files: number;
  };
  files: Array<{
    path: string;
    type: 'script' | 'captions' | 'metadata';
    angle_id: string;
    locale: string;
    platform: string;
  }>;
}

export interface PackRequest {
  name: string;
  angleIds: string[];
  locales: Locale[];
  platforms: Platform[];
}

// ============================================
// CSV Import Types
// ============================================

export interface CSVPerformanceRow {
  angle_id: string;
  impressions: string | number;
  clicks: string | number;
  conversions: string | number;
  spend: string | number;
  revenue: string | number;
  platform?: string;
  locale?: string;
  date_start?: string;
  date_end?: string;
}

export interface ImportResult {
  batchId: string;
  filename: string;
  rowsTotal: number;
  rowsProcessed: number;
  rowsFailed: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
}
