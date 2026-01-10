import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { projectsApi, anglesApi } from '../services/api';
import { PageLoading } from '../components/Loading';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const { data: anglesData } = useQuery({
    queryKey: ['angles', projectId],
    queryFn: () => anglesApi.list(projectId!),
    enabled: !!projectId,
  });

  const generateMutation = useMutation({
    mutationFn: () => anglesApi.generate(projectId!, 3),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['angles', projectId] });
      toast.success('Angles generated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.delete(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
      navigate('/projects');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) return <PageLoading />;
  if (!project) return <div>Project not found</div>;

  const navItems = [
    { name: 'Angles', href: `/projects/${projectId}/angles`, count: anglesData?.meta?.total },
    { name: 'Localizations', href: `/projects/${projectId}/localizations` },
    { name: 'Packs', href: `/projects/${projectId}/packs`, count: project._count?.packs },
    { name: 'Performance', href: `/projects/${projectId}/performance` },
  ];

  return (
    <div>
      <div className="mb-8">
        <Link to="/projects" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          &larr; Back to Projects
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            {project.description && (
              <p className="text-gray-600 mt-1">{project.description}</p>
            )}
          </div>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this project?')) {
                deleteMutation.mutate();
              }
            }}
            className="btn-danger"
          >
            Delete Project
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4 mb-8">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className="card hover:shadow-md transition-shadow text-center"
          >
            <h3 className="text-lg font-medium text-gray-900">{item.name}</h3>
            {item.count !== undefined && (
              <p className="text-3xl font-bold text-primary-600 mt-2">{item.count}</p>
            )}
          </Link>
        ))}
      </div>

      <div className="card mb-8">
        <h2 className="text-lg font-semibold mb-4">Seed Data</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-gray-500">Product</h4>
            <p className="text-gray-900">{project.seedData.product_name}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500">Target Audience</h4>
            <p className="text-gray-900">{project.seedData.target_audience}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500">Tone</h4>
            <p className="text-gray-900 capitalize">{project.seedData.tone}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500">Platforms</h4>
            <div className="flex gap-2 mt-1">
              {project.seedData.platforms.map((p) => (
                <span key={p} className="badge bg-primary-100 text-primary-700">
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500">Key Benefits</h4>
            <ul className="list-disc list-inside text-gray-900">
              {project.seedData.key_benefits.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500">Pain Points</h4>
            <ul className="list-disc list-inside text-gray-900">
              {project.seedData.pain_points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
        </div>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="btn-primary"
          >
            {generateMutation.isPending ? 'Generating...' : 'Generate 3 Angles'}
          </button>
          <Link to={`/projects/${projectId}/angles`} className="btn-secondary">
            Manage Angles
          </Link>
          <Link to={`/projects/${projectId}/performance`} className="btn-secondary">
            Import Performance Data
          </Link>
        </div>
      </div>
    </div>
  );
}
