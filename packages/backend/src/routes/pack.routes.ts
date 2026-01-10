import { Router } from 'express';
import { packController } from '../controllers/index.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { createPackSchema, paginationSchema, uuidSchema } from '../validators/index.js';
import { z } from 'zod';

const router = Router();

// POST /api/projects/:projectId/packs
router.post(
  '/projects/:projectId/packs',
  validate({
    params: z.object({ projectId: uuidSchema }),
    body: createPackSchema.omit({ angleIds: true }).extend({
      angleIds: z.array(uuidSchema).min(1).max(50),
    }),
  }),
  asyncHandler(packController.create.bind(packController))
);

// GET /api/projects/:projectId/packs
router.get(
  '/projects/:projectId/packs',
  validate({
    params: z.object({ projectId: uuidSchema }),
    query: paginationSchema,
  }),
  asyncHandler(packController.getByProject.bind(packController))
);

// GET /api/packs/:id
router.get(
  '/:id',
  validate({ params: z.object({ id: uuidSchema }) }),
  asyncHandler(packController.getById.bind(packController))
);

// GET /api/packs/:id/download
router.get(
  '/:id/download',
  validate({ params: z.object({ id: uuidSchema }) }),
  asyncHandler(packController.download.bind(packController))
);

// DELETE /api/packs/:id
router.delete(
  '/:id',
  validate({ params: z.object({ id: uuidSchema }) }),
  asyncHandler(packController.delete.bind(packController))
);

export { router as packRoutes };
