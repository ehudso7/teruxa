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
 * Stores validated data in res.locals for type safety.
 */
export function validate(options: ValidateOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targets: ValidateTarget[] = ['body', 'query', 'params'];

      // Initialize validated data storage in res.locals
      res.locals.validated = res.locals.validated || {};

      for (const target of targets) {
        const schema = options[target];
        if (schema) {
          const result = await schema.parseAsync(req[target]);
          // Store validated data in res.locals for type safety
          res.locals.validated[target] = result;
          // Also update req with parsed/transformed values
          const reqWithData = req as unknown as Record<string, unknown>;
          reqWithData[target] = result;
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}