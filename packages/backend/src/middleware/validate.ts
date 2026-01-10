import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

type ValidateTarget = 'body' | 'query' | 'params';

interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Express middleware for validating request data using Zod schemas.
 * Supports validating body, query, and params simultaneously.
 */
export function validate(options: ValidateOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targets: ValidateTarget[] = ['body', 'query', 'params'];

      for (const target of targets) {
        const schema = options[target];
        if (schema) {
          const result = await schema.parseAsync(req[target]);
          // Replace with parsed/transformed values
          (req as Record<string, unknown>)[target] = result;
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
