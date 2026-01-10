import { Router } from 'express';
import multer from 'multer';
import { performanceController } from '../controllers/index.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { generateIterationSchema, uuidSchema } from '../validators/index.js';
import { z } from 'zod';

const router = Router();

// Configure multer for CSV uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// POST /api/projects/:projectId/performance/import
router.post(
  '/projects/:projectId/performance/import',
  validate({ params: z.object({ projectId: uuidSchema }) }),
  upload.single('file'),
  asyncHandler(performanceController.importCSV.bind(performanceController))
);

// GET /api/projects/:projectId/performance/imports
router.get(
  '/projects/:projectId/performance/imports',
  validate({ params: z.object({ projectId: uuidSchema }) }),
  asyncHandler(performanceController.getProjectImports.bind(performanceController))
);

// GET /api/performance/imports/:batchId
router.get(
  '/imports/:batchId',
  validate({ params: z.object({ batchId: uuidSchema }) }),
  asyncHandler(performanceController.getImportBatch.bind(performanceController))
);

// GET /api/projects/:projectId/performance/metrics
router.get(
  '/projects/:projectId/performance/metrics',
  validate({ params: z.object({ projectId: uuidSchema }) }),
  asyncHandler(performanceController.getProjectMetrics.bind(performanceController))
);

// POST /api/projects/:projectId/performance/winners
router.post(
  '/projects/:projectId/performance/winners',
  validate({
    params: z.object({ projectId: uuidSchema }),
    query: z.object({
      topN: z.coerce.number().int().min(1).max(10).optional(),
      metric: z.enum(['ctr', 'roas', 'conversions']).optional(),
    }),
  }),
  asyncHandler(performanceController.identifyWinners.bind(performanceController))
);

// POST /api/projects/:projectId/performance/iterate
router.post(
  '/projects/:projectId/performance/iterate',
  validate({
    params: z.object({ projectId: uuidSchema }),
    query: generateIterationSchema,
  }),
  asyncHandler(performanceController.generateIterations.bind(performanceController))
);

export { router as performanceRoutes };
