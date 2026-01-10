import { Router } from 'express';
import { localizationController } from '../controllers/index.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  localizeRequestSchema,
  updateLocalizedContentSchema,
  localeSchema,
  platformSchema,
  uuidSchema,
} from '../validators/index.js';
import { z } from 'zod';

const router = Router();

// POST /api/angles/:angleId/localize
router.post(
  '/angles/:angleId/localize',
  validate({
    params: z.object({ angleId: uuidSchema }),
    body: localizeRequestSchema,
  }),
  asyncHandler(localizationController.localize.bind(localizationController))
);

// GET /api/angles/:angleId/localizations
router.get(
  '/angles/:angleId/localizations',
  validate({
    params: z.object({ angleId: uuidSchema }),
    query: z.object({
      locale: localeSchema.optional(),
      platform: platformSchema.optional(),
    }),
  }),
  asyncHandler(localizationController.getByAngle.bind(localizationController))
);

// GET /api/localizations/:id
router.get(
  '/:id',
  validate({ params: z.object({ id: uuidSchema }) }),
  asyncHandler(localizationController.getById.bind(localizationController))
);

// PUT /api/localizations/:id
router.put(
  '/:id',
  validate({
    params: z.object({ id: uuidSchema }),
    body: updateLocalizedContentSchema,
  }),
  asyncHandler(localizationController.update.bind(localizationController))
);

// DELETE /api/localizations/:id
router.delete(
  '/:id',
  validate({ params: z.object({ id: uuidSchema }) }),
  asyncHandler(localizationController.delete.bind(localizationController))
);

// POST /api/angles/:angleId/localize/regenerate
router.post(
  '/angles/:angleId/localize/regenerate',
  validate({
    params: z.object({ angleId: uuidSchema }),
    body: z.object({
      locale: localeSchema,
      platform: platformSchema,
    }),
  }),
  asyncHandler(localizationController.regenerate.bind(localizationController))
);

export { router as localizationRoutes };
