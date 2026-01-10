import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { AnglesPage } from './pages/AnglesPage';
import { LocalizationsPage } from './pages/LocalizationsPage';
import { PacksPage } from './pages/PacksPage';
import { PerformancePage } from './pages/PerformancePage';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="projects/:projectId/angles" element={<AnglesPage />} />
          <Route path="projects/:projectId/localizations" element={<LocalizationsPage />} />
          <Route path="projects/:projectId/packs" element={<PacksPage />} />
          <Route path="projects/:projectId/performance" element={<PerformancePage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
