import pino, { type LoggerOptions } from 'pino';

const isProd = process.env.NODE_ENV === 'production';

const options: LoggerOptions = {
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  base: {
    service: 'teruxa-backend',
    env: process.env.NODE_ENV || 'development',
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.apiKey',
    ],
    remove: true,
  },
};

// Enable pretty logging locally only if explicitly requested.
// If pino-pretty isn't installed, keep it off (no runtime crash).
const transport =
  !isProd && process.env.LOG_PRETTY === 'true'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined;

export const logger = pino(transport ? { ...options, transport } : options);

export function createChildLogger(name: string) {
  return logger.child({ module: name });
}

export type Logger = typeof logger;