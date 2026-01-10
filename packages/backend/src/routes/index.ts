import { Router } from 'express';
import { projectRoutes } from './project.routes.js';
import { angleRoutes } from './angle.routes.js';
import { localizationRoutes } from './localization.routes.js';
import { packRoutes } from './pack.routes.js';
import { performanceRoutes } from './performance.routes.js';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

// Mount routes
router.use('/projects', projectRoutes);
router.use('/angles', angleRoutes);
router.use('/localizations', localizationRoutes);
router.use('/packs', packRoutes);
router.use('/performance', performanceRoutes);

export { router as apiRoutes };
