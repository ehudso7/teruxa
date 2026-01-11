import { config } from './config.js';
import { createChildLogger } from './logger.js';

const logger = createChildLogger('env-validator');

// Define the union type for valid environments
export type NodeEnv = 'development' | 'test' | 'production';

export interface EnvRequirement {
  name: string;
  required: boolean;
  validator?: (value: string | undefined) => boolean;
  errorMessage?: string;
}

// Use satisfies to ensure all environments are covered while maintaining exact type
const ENV_REQUIREMENTS = {
  production: [
    {
      name: 'DATABASE_URL',
      required: true,
      validator: (v) => !!v && v.startsWith('postgresql://'),
      errorMessage: 'DATABASE_URL must be a valid PostgreSQL connection string',
    },
    {
      name: 'OPENAI_API_KEY',
      required: true,
      validator: (v) => !!v && v.startsWith('sk-'),
      errorMessage: 'OPENAI_API_KEY is required in production (must start with sk-)',
    },
    {
      name: 'PORT',
      required: false,
      validator: (v) => !v || (!isNaN(Number(v)) && Number(v) > 0 && Number(v) < 65536),
      errorMessage: 'PORT must be a valid port number (1-65535)',
    },
    {
      name: 'CORS_ORIGIN',
      required: true,
      validator: (v) => !!v && (v.startsWith('http://') || v.startsWith('https://')),
      errorMessage: 'CORS_ORIGIN must be a valid HTTP(S) URL',
    },
    {
      name: 'AI_MOCK_MODE',
      required: false,
      validator: (v) => !v || v === 'false',
      errorMessage: 'AI_MOCK_MODE cannot be enabled in production',
    },
  ],
  development: [
    {
      name: 'DATABASE_URL',
      required: true,
      validator: (v) => !!v && v.startsWith('postgresql://'),
      errorMessage: 'DATABASE_URL must be a valid PostgreSQL connection string',
    },
    {
      name: 'OPENAI_API_KEY',
      required: false, // Optional in dev if mock mode is on
      validator: (v) => {
        // If AI_MOCK_MODE is true, OPENAI_API_KEY is optional
        if (config.AI_MOCK_MODE) return true;
        // Otherwise, must be valid if provided
        return !v || v.startsWith('sk-');
      },
      errorMessage: 'OPENAI_API_KEY must start with sk- (or enable AI_MOCK_MODE)',
    },
  ],
  test: [
    {
      name: 'DATABASE_URL',
      required: true,
      validator: (v) => !!v && v.startsWith('postgresql://'),
      errorMessage: 'DATABASE_URL must be a valid PostgreSQL connection string',
    },
    // In test, we always allow mock mode
  ],
} satisfies Record<NodeEnv, EnvRequirement[]>;

/**
 * Normalizes an unknown environment value to a valid NodeEnv
 * Falls back to 'development' if the value is not recognized
 */
export function normalizeNodeEnv(input: unknown): NodeEnv {
  if (typeof input !== 'string') {
    return 'development';
  }

  switch (input) {
    case 'production':
      return 'production';
    case 'test':
      return 'test';
    case 'development':
      return 'development';
    default:
      return 'development';
  }
}

/**
 * Gets the environment requirements for a given environment
 * This function is guaranteed to always return a valid EnvRequirement[] array
 */
export function getEnvRequirements(env: unknown): EnvRequirement[] {
  const normalizedEnv = normalizeNodeEnv(env);

  // TypeScript knows normalizedEnv is one of: 'production' | 'test' | 'development'
  // and ENV_REQUIREMENTS has all these keys, so this access is safe
  return ENV_REQUIREMENTS[normalizedEnv];
}

/**
 * Validates environment variables based on the current environment
 * Throws an error if validation fails
 */
export function validateEnvironment(): void {
  const env = normalizeNodeEnv(config.NODE_ENV);
  const requirements = getEnvRequirements(env);

  logger.info({ environment: env }, 'Validating environment variables');

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const req of requirements) {
    const value = process.env[req.name];

    // Check if required
    if (req.required && !value) {
      errors.push(`Missing required environment variable: ${req.name}`);
      continue;
    }

    // Run validator if provided
    if (value && req.validator && !req.validator(value)) {
      const message = req.errorMessage || `Invalid value for ${req.name}`;
      if (req.required) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }
  }

  // Production-specific checks
  if (env === 'production') {
    // Ensure no test/debug flags are set
    const dangerousVars = ['TEST_MODE', 'DEBUG_MODE', 'SKIP_AUTH'];
    for (const varName of dangerousVars) {
      if (process.env[varName] && process.env[varName] !== 'false') {
        errors.push(`Dangerous environment variable ${varName} is set in production!`);
      }
    }

    // Ensure NODE_ENV is explicitly set
    if (!process.env.NODE_ENV) {
      errors.push('NODE_ENV must be explicitly set to "production" in production deployments');
    }

    // Warn about default ports
    if (!process.env.PORT || process.env.PORT === '3000' || process.env.PORT === '3001') {
      warnings.push('Using default port in production. Consider setting PORT explicitly.');
    }
  }

  // Log warnings
  for (const warning of warnings) {
    logger.warn(warning);
  }

  // Throw if there are errors
  if (errors.length > 0) {
    const errorMessage = `Environment validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
    logger.error({ errors }, errorMessage);
    throw new Error(errorMessage);
  }

  logger.info(
    {
      environment: env,
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      mockMode: config.AI_MOCK_MODE,
      port: config.PORT,
    },
    'Environment validation passed'
  );
}

/**
 * Gets a summary of the current environment configuration
 */
export function getEnvironmentInfo() {
  return {
    environment: normalizeNodeEnv(config.NODE_ENV),
    port: config.PORT,
    database: config.DATABASE_URL ? 'configured' : 'not configured',
    openai: config.OPENAI_API_KEY ? 'configured' : 'not configured',
    mockMode: config.AI_MOCK_MODE,
    cors: config.CORS_ORIGIN,
  };
}