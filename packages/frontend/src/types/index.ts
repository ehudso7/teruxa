export type Tone = 'professional' | 'casual' | 'humorous' | 'urgent' | 'empathetic';
export type Platform = 'tiktok' | 'instagram' | 'youtube';
export type Locale = 'en-US' | 'es-ES' | 'fr-FR' | 'de-DE' | 'pt-BR';
export type AngleStatus = 'draft' | 'approved' | 'rejected' | 'archived';

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

export interface Project {
  id: string;
  name: string;
  description?: string;
  seedData: SeedData;
  createdAt: string;
  updatedAt: string;
  _count?: {
    angleCards: number;
    packs: number;
  };
}

export interface AngleCard {
  id: string;
  projectId: string;
  version: number;
  hook: string;
  problemAgitation: string;
  solution: string;
  cta: string;
  visualDirection?: string;
  audioNotes?: string;
  estimatedDuration?: number;
  status: AngleStatus;
  isWinner: boolean;
  parentAngleId?: string;
  generationNotes?: string;
  createdAt: string;
  updatedAt: string;
  localizedContents?: LocalizedContent[];
  _count?: {
    localizedContents: number;
    performanceData: number;
  };
}

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

export interface LocalizedContent {
  id: string;
  angleId: string;
  locale: Locale;
  platform: Platform;
  script: string;
  captions: Caption[];
  onScreenText: OnScreenText[];
  culturalNotes?: string;
  platformAdjustments?: string;
  characterCount?: number;
  wordCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreativePack {
  id: string;
  name: string;
  projectId: string;
  downloadUrl?: string;
  filePath?: string;
  fileSize?: number;
  manifest: PackManifest;
  downloadCount: number;
  expiresAt?: string;
  createdAt: string;
  _count?: {
    packAngles: number;
  };
}

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

export interface PerformanceMetrics {
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

export interface ImportBatch {
  id: string;
  projectId: string;
  filename: string;
  status: 'processing' | 'completed' | 'failed' | 'partial';
  rowsTotal?: number;
  rowsProcessed: number;
  rowsFailed: number;
  errorLog: Array<{ row: number; message: string }>;
  createdAt: string;
  completedAt?: string;
}

export interface WinnerAnalysis {
  topPerformers: Array<{
    angleId: string;
    metrics: {
      impressions: number;
      clicks: number;
      conversions: number;
      spend: number;
      revenue: number;
      ctr?: number;
      cpa?: number;
      roas?: number;
    };
    score: number;
  }>;
  patterns: string[];
  recommendations: string[];
}

export interface ApiResponse<T> {
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
