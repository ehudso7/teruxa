import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface ErrorWithStatusCode extends Error {
  statusCode?: number;
  status?: number;
  code?: string;
}

interface ErrorReport {
  error: {
    message: string;
    stack?: string;
    code?: string;
  };
  request: {
    method: string;
    url: string;
    headers: Record<string, string | string[] | undefined>;
    query: any;
    params: any;
    body?: any;
    ip?: string;
    userAgent?: string;
  };
  context: {
    timestamp: string;
    environment: string;
    nodeVersion: string;
    processId: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
  user?: {
    id?: string;
    email?: string;
  };
}

class ErrorTracker {
  private errorQueue: ErrorReport[] = [];
  private maxQueueSize = 100;
  private flushInterval = 30000; // 30 seconds
  private intervalId?: NodeJS.Timeout;
  private sentryDsn?: string;

  constructor() {
    this.sentryDsn = process.env.SENTRY_DSN;

    // Periodically flush error queue
    if (this.sentryDsn) {
      this.intervalId = setInterval(() => {
        this.flushErrors();
      }, this.flushInterval);
    }

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      this.trackError(error, null);
      // Give time to flush errors before exit
      setTimeout(() => process.exit(1), 1000);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      logger.error('Unhandled Rejection:', error);
      this.trackError(error, null);
    });
  }

  trackError(error: ErrorWithStatusCode, req: Request | null, user?: { id?: string; email?: string }) {
    const report: ErrorReport = {
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
      },
      request: req ? {
        method: req.method,
        url: req.originalUrl || req.url,
        headers: this.sanitizeHeaders(req.headers),
        query: req.query,
        params: req.params,
        body: this.sanitizeBody(req.body),
        ip: req.ip,
        userAgent: req.get('user-agent'),
      } : {
        method: 'SYSTEM',
        url: 'internal',
        headers: {},
        query: {},
        params: {},
      },
      context: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        processId: process.pid,
        memoryUsage: process.memoryUsage(),
      },
      user,
    };

    // Add to queue
    this.errorQueue.push(report);

    // Log locally
    logger.error('Error tracked', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode || error.status || 500,
      url: report.request.url,
      method: report.request.method,
    });

    // Flush if queue is full
    if (this.errorQueue.length >= this.maxQueueSize) {
      this.flushErrors();
    }
  }

  private sanitizeHeaders(headers: any): Record<string, string | string[] | undefined> {
    const sanitized = { ...headers };
    // Remove sensitive headers
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body) return undefined;

    const sanitized = { ...body };
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];

    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;

      const result: any = Array.isArray(obj) ? [] : {};

      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          result[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          result[key] = sanitizeObject(obj[key]);
        } else {
          result[key] = obj[key];
        }
      }

      return result;
    };

    return sanitizeObject(sanitized);
  }

  async flushErrors() {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    if (this.sentryDsn) {
      try {
        // In production, this would send to Sentry
        // For now, we'll log that we would send
        logger.info(`Would send ${errors.length} errors to Sentry`);
      } catch (error) {
        logger.error('Failed to send errors to Sentry:', error);
        // Re-queue errors if send failed
        this.errorQueue.unshift(...errors);
      }
    }
  }

  getErrorStats() {
    return {
      queuedErrors: this.errorQueue.length,
      sentryConfigured: !!this.sentryDsn,
    };
  }

  cleanup() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.flushErrors();
  }
}

export const errorTracker = new ErrorTracker();

// Error handling middleware
export function errorHandler(err: ErrorWithStatusCode, req: Request, res: Response, next: NextFunction) {
  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Track error
  errorTracker.trackError(err, req, (req as any).user);

  // Send response
  const response: any = {
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code,
    },
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
  }

  // Add request ID if available
  if ((req as any).id) {
    response.requestId = (req as any).id;
  }

  res.status(statusCode).json(response);
}

// Async error wrapper
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Custom error classes
export class AppError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  errorTracker.cleanup();
});