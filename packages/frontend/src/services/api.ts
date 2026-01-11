import axios, { AxiosError } from 'axios';
import type {
  Project,
  AngleCard,
  LocalizedContent,
  CreativePack,
  PerformanceMetrics,
  ImportBatch,
  WinnerAnalysis,
  ApiResponse,
  SeedData,
  Locale,
  Platform,
  AngleStatus,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<never>>) => {
    const message = error.response?.data?.error?.message ?? error.message;
    throw new Error(message);
  }
);

// Projects
export const projectsApi = {
  list: async (page = 1, limit = 20) => {
    const res = await api.get<ApiResponse<Project[]>>('/projects', {
      params: { page, limit },
    });
    return { data: res.data.data ?? [], meta: res.data.meta };
  },

  get: async (id: string) => {
    const res = await api.get<ApiResponse<Project>>(`/projects/${id}`);
    return res.data.data;
  },

  create: async (data: { name: string; description?: string; seedData: SeedData }) => {
    const res = await api.post<ApiResponse<Project>>('/projects', data);
    return res.data.data;
  },

  update: async (id: string, data: Partial<{ name: string; description: string; seedData: SeedData }>) => {
    const res = await api.put<ApiResponse<Project>>(`/projects/${id}`, data);
    return res.data.data;
  },

  delete: async (id: string) => {
    await api.delete(`/projects/${id}`);
  },
};

// Angles
export const anglesApi = {
  generate: async (projectId: string, count = 3) => {
    const res = await api.post<ApiResponse<{ angles: AngleCard[] }>>(
      `/angles/projects/${projectId}/generate`,
      {},
      { params: { count } }
    );
    return res.data.data?.angles ?? [];
  },

  list: async (projectId: string, options?: { status?: AngleStatus; isWinner?: boolean; page?: number; limit?: number }) => {
    const res = await api.get<ApiResponse<AngleCard[]>>(`/angles/projects/${projectId}/angles`, {
      params: options,
    });
    return { data: res.data.data ?? [], meta: res.data.meta };
  },

  get: async (id: string) => {
    const res = await api.get<ApiResponse<AngleCard>>(`/angles/${id}`);
    return res.data.data;
  },

  update: async (id: string, data: Partial<AngleCard>) => {
    const res = await api.put<ApiResponse<AngleCard>>(`/angles/${id}`, data);
    return res.data.data;
  },

  updateStatus: async (id: string, status: AngleStatus) => {
    const res = await api.patch<ApiResponse<AngleCard>>(`/angles/${id}/status`, { status });
    return res.data.data;
  },

  setWinner: async (id: string, isWinner: boolean) => {
    const res = await api.patch<ApiResponse<AngleCard>>(`/angles/${id}/winner`, { isWinner });
    return res.data.data;
  },

  delete: async (id: string) => {
    await api.delete(`/angles/${id}`);
  },

  regenerate: async (id: string) => {
    const res = await api.post<ApiResponse<AngleCard>>(`/angles/${id}/regenerate`);
    return res.data.data;
  },
};

// Localizations
export const localizationsApi = {
  localize: async (angleId: string, locales: Locale[], platforms: Platform[]) => {
    const res = await api.post<ApiResponse<{ created: LocalizedContent[]; warnings: unknown[] }>>(
      `/localizations/angles/${angleId}/localize`,
      { locales, platforms }
    );
    return res.data.data;
  },

  list: async (angleId: string, locale?: Locale, platform?: Platform) => {
    const res = await api.get<ApiResponse<LocalizedContent[]>>(`/localizations/angles/${angleId}/localizations`, {
      params: { locale, platform },
    });
    return res.data.data ?? [];
  },

  get: async (id: string) => {
    const res = await api.get<ApiResponse<LocalizedContent>>(`/localizations/${id}`);
    return res.data.data;
  },

  update: async (id: string, data: Partial<LocalizedContent>) => {
    const res = await api.put<ApiResponse<LocalizedContent>>(`/localizations/${id}`, data);
    return res.data.data;
  },

  delete: async (id: string) => {
    await api.delete(`/localizations/${id}`);
  },

  regenerate: async (angleId: string, locale: Locale, platform: Platform) => {
    const res = await api.post<ApiResponse<LocalizedContent>>(
      `/localizations/angles/${angleId}/localize/regenerate`,
      { locale, platform }
    );
    return res.data.data;
  },
};

// Packs
export const packsApi = {
  create: async (projectId: string, data: { name: string; angleIds: string[]; locales: Locale[]; platforms: Platform[] }) => {
    const res = await api.post<ApiResponse<CreativePack>>(`/packs/projects/${projectId}/packs`, data);
    return res.data.data;
  },

  list: async (projectId: string, page = 1, limit = 20) => {
    const res = await api.get<ApiResponse<CreativePack[]>>(`/packs/projects/${projectId}/packs`, {
      params: { page, limit },
    });
    return { data: res.data.data ?? [], meta: res.data.meta };
  },

  get: async (id: string) => {
    const res = await api.get<ApiResponse<CreativePack>>(`/packs/${id}`);
    return res.data.data;
  },

  download: (id: string) => {
    window.open(`/api/packs/${id}/download`, '_blank');
  },

  delete: async (id: string) => {
    await api.delete(`/packs/${id}`);
  },
};

// Performance
export const performanceApi = {
  importCSV: async (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<ApiResponse<ImportBatch>>(
      `/performance/projects/${projectId}/performance/import`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data.data;
  },

  listImports: async (projectId: string) => {
    const res = await api.get<ApiResponse<ImportBatch[]>>(`/performance/projects/${projectId}/performance/imports`);
    return res.data.data ?? [];
  },

  getImport: async (batchId: string) => {
    const res = await api.get<ApiResponse<ImportBatch>>(`/performance/imports/${batchId}`);
    return res.data.data;
  },

  getMetrics: async (projectId: string) => {
    const res = await api.get<ApiResponse<PerformanceMetrics[]>>(`/performance/projects/${projectId}/performance/metrics`);
    return res.data.data ?? [];
  },

  identifyWinners: async (projectId: string, topN = 3, metric: 'ctr' | 'roas' | 'conversions' = 'ctr') => {
    const res = await api.post<ApiResponse<WinnerAnalysis>>(
      `/performance/projects/${projectId}/performance/winners`,
      null,
      { params: { topN, metric } }
    );
    return res.data.data;
  },

  generateIterations: async (projectId: string, topN = 3, count = 5) => {
    const res = await api.post<ApiResponse<AngleCard[]>>(
      `/performance/projects/${projectId}/performance/iterate`,
      null,
      { params: { topN, count } }
    );
    return res.data.data ?? [];
  },
};
