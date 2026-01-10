import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().min(1),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  AI_MOCK_MODE: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // File Storage
  STORAGE_PATH: z.string().default('./storage'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(50),
});

function loadConfig() {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return result.data;
}

export const config = loadConfig();

export type Config = typeof config;
