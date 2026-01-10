import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('http');

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Add correlation ID
  const correlationId = (req.headers['x-correlation-id'] as string) ?? uuidv4();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  const startTime = Date.now();

  // Log request
  logger.info({
    type: 'request',
    method: req.method,
    url: req.url,
    correlationId,
    userAgent: req.headers['user-agent'],
  });

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info({
      type: 'response',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      correlationId,
    });
  });

  next();
}
