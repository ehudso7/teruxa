import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { projectsApi } from '../services/api';
import { Modal } from '../components/Modal';
import { PageLoading } from '../components/Loading';
import type { SeedData, Tone, Platform } from '../types';

const TONES: Tone[] = ['professional', 'casual', 'humorous', 'urgent', 'empathetic'];
const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube'];

export function ProjectsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
      toast.success('Project created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const seedData: SeedData = {
      product_name: formData.get('product_name') as string,
      product_description: formData.get('product_description') as string,
      target_audience: formData.get('target_audience') as string,
      key_benefits: (formData.get('key_benefits') as string).split('\n').filter(Boolean),
      pain_points: (formData.get('pain_points') as string).split('\n').filter(Boolean),
      tone: formData.get('tone') as Tone,
      platforms: formData.getAll('platforms') as Platform[],
      brand_guidelines: formData.get('brand_guidelines') as string || undefined,
    };

    createMutation.mutate({
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      seedData,
    });
  };

  if (isLoading) return <PageLoading />;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage your UGC campaigns</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary">
          New Project
        </button>
      </div>

      {data?.data.length === 0 ? (
        <div className="card text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-600 mb-4">Create your first project to get started</p>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data?.data.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="card hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{project.name}</h3>
              {project.description && (
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{project.description}</p>
              )}
              <div className="flex gap-4 text-sm text-gray-500">
                <span>{project._count?.angleCards ?? 0} angles</span>
                <span>{project._count?.packs ?? 0} packs</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {project.seedData.platforms.map((platform) => (
                  <span key={platform} className="badge bg-primary-100 text-primary-700">
                    {platform}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Project"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Project Name</label>
            <input name="name" required className="input" placeholder="My Campaign" />
          </div>

          <div>
            <label className="label">Description (optional)</label>
            <textarea name="description" className="input" rows={2} placeholder="Brief description..." />
          </div>

          <hr className="my-6" />
          <h4 className="font-medium text-gray-900">Product Details</h4>

          <div>
            <label className="label">Product Name</label>
            <input name="product_name" required className="input" placeholder="Your Product" />
          </div>

          <div>
            <label className="label">Product Description</label>
            <textarea
              name="product_description"
              required
              className="input"
              rows={3}
              placeholder="Describe your product in detail..."
            />
          </div>

          <div>
            <label className="label">Target Audience</label>
            <input
              name="target_audience"
              required
              className="input"
              placeholder="e.g., Young professionals aged 25-35"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Key Benefits (one per line)</label>
              <textarea
                name="key_benefits"
                required
                className="input"
                rows={3}
                placeholder="Saves time&#10;Easy to use&#10;Affordable"
              />
            </div>
            <div>
              <label className="label">Pain Points (one per line)</label>
              <textarea
                name="pain_points"
                required
                className="input"
                rows={3}
                placeholder="Current solutions are slow&#10;Too expensive&#10;Hard to learn"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tone</label>
              <select name="tone" required className="input">
                {TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    {tone.charAt(0).toUpperCase() + tone.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Platforms</label>
              <div className="flex gap-4 mt-2">
                {PLATFORMS.map((platform) => (
                  <label key={platform} className="flex items-center gap-2">
                    <input type="checkbox" name="platforms" value={platform} defaultChecked />
                    <span className="text-sm">{platform}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Brand Guidelines (optional)</label>
            <textarea
              name="brand_guidelines"
              className="input"
              rows={2}
              placeholder="Any specific brand voice or style requirements..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
