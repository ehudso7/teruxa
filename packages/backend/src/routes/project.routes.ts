import { Router } from 'express';
import { projectController } from '../controllers/index.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  createProjectSchema,
  updateProjectSchema,
  paginationSchema,
  uuidSchema,
} from '../validators/index.js';
import { z } from 'zod';

const router = Router();

// GET /api/projects
router.get(
  '/',
  validate({ query: paginationSchema }),
  asyncHandler(projectController.getAll.bind(projectController))
);

// POST /api/projects
router.post(
  '/',
  validate({ body: createProjectSchema }),
  asyncHandler(projectController.create.bind(projectController))
);

// GET /api/projects/:id
router.get(
  '/:id',
  validate({ params: z.object({ id: uuidSchema }) }),
  asyncHandler(projectController.getById.bind(projectController))
);

// PUT /api/projects/:id
router.put(
  '/:id',
  validate({
    params: z.object({ id: uuidSchema }),
    body: updateProjectSchema,
  }),
  asyncHandler(projectController.update.bind(projectController))
);

// DELETE /api/projects/:id
router.delete(
  '/:id',
  validate({ params: z.object({ id: uuidSchema }) }),
  asyncHandler(projectController.delete.bind(projectController))
);

export { router as projectRoutes };
