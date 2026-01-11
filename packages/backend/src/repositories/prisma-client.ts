import { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('prisma');

// Event types for Prisma logging
interface QueryEvent {
  query: string;
  params: string;
  duration: number;
  timestamp: Date;
  target: string;
}

interface LogEvent {
  message: string;
  timestamp: Date;
  target: string;
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });

  // Log queries in development
  if (process.env.NODE_ENV === 'development') {
    client.$on('query', (e: QueryEvent) => {
      logger.debug({
        query: e.query,
        params: e.params,
        duration: e.duration,
      });
    });
  }

  client.$on('error', (e: LogEvent) => {
    logger.error({ error: e.message });
  });

  client.$on('warn', (e: LogEvent) => {
    logger.warn({ warning: e.message });
  });

  return client;
}

// Prevent multiple instances in development due to hot reloading
export const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
