import { Router } from 'express';
import { angleController } from '../controllers/index.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  generateAnglesSchema,
  updateAngleSchema,
  angleStatusSchema,
  paginationSchema,
  uuidSchema,
} from '../validators/index.js';
import { z } from 'zod';

const router = Router();

// POST /api/projects/:projectId/generate
router.post(
  '/projects/:projectId/generate',
  validate({
    params: z.object({ projectId: uuidSchema }),
    query: generateAnglesSchema,
  }),
  asyncHandler(angleController.generate.bind(angleController))
);

// GET /api/projects/:projectId/angles
router.get(
  '/projects/:projectId/angles',
  validate({
    params: z.object({ projectId: uuidSchema }),
    query: paginationSchema.extend({
      status: angleStatusSchema.optional(),
      isWinner: z.enum(['true', 'false']).optional(),
    }),
  }),
  asyncHandler(angleController.getByProject.bind(angleController))
);

// GET /api/angles/:id
router.get(
  '/:id',
  validate({ params: z.object({ id: uuidSchema }) }),
  asyncHandler(angleController.getById.bind(angleController))
);

// PUT /api/angles/:id
router.put(
  '/:id',
  validate({
    params: z.object({ id: uuidSchema }),
    body: updateAngleSchema,
  }),
  asyncHandler(angleController.update.bind(angleController))
);

// PATCH /api/angles/:id/status
router.patch(
  '/:id/status',
  validate({
    params: z.object({ id: uuidSchema }),
    body: z.object({ status: angleStatusSchema }),
  }),
  asyncHandler(angleController.updateStatus.bind(angleController))
);

// PATCH /api/angles/:id/winner
router.patch(
  '/:id/winner',
  validate({
    params: z.object({ id: uuidSchema }),
    body: z.object({ isWinner: z.boolean() }),
  }),
  asyncHandler(angleController.setWinner.bind(angleController))
);

// DELETE /api/angles/:id
router.delete(
  '/:id',
  validate({ params: z.object({ id: uuidSchema }) }),
  asyncHandler(angleController.delete.bind(angleController))
);

// POST /api/angles/:id/regenerate
router.post(
  '/:id/regenerate',
  validate({ params: z.object({ id: uuidSchema }) }),
  asyncHandler(angleController.regenerate.bind(angleController))
);

export { router as angleRoutes };
