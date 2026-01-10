import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { anglesApi, packsApi } from '../services/api';
import { Modal } from '../components/Modal';
import { PageLoading } from '../components/Loading';
import type { Locale, Platform, CreativePack } from '../types';

const LOCALES: { value: Locale; label: string }[] = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'pt-BR', label: 'Portuguese' },
];

const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube'];

export function PacksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: packsData, isLoading: packsLoading } = useQuery({
    queryKey: ['packs', projectId],
    queryFn: () => packsApi.list(projectId!),
    enabled: !!projectId,
  });

  const { data: anglesData, isLoading: anglesLoading } = useQuery({
    queryKey: ['angles', projectId, 'approved'],
    queryFn: () => anglesApi.list(projectId!, { status: 'approved' }),
    enabled: !!projectId && isCreateOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; angleIds: string[]; locales: Locale[]; platforms: Platform[] }) =>
      packsApi.create(projectId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs', projectId] });
      setIsCreateOpen(false);
      toast.success('Pack created successfully');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: packsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packs', projectId] });
      toast.success('Pack deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const angleIds = formData.getAll('angles') as string[];
    const locales = formData.getAll('locales') as Locale[];
    const platforms = formData.getAll('platforms') as Platform[];

    if (angleIds.length === 0) {
      toast.error('Select at least one angle');
      return;
    }
    if (locales.length === 0 || platforms.length === 0) {
      toast.error('Select at least one locale and platform');
      return;
    }

    createMutation.mutate({
      name: formData.get('name') as string,
      angleIds,
      locales,
      platforms,
    });
  };

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (packsLoading) return <PageLoading />;

  return (
    <div>
      <div className="mb-8">
        <Link to={`/projects/${projectId}`} className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          &larr; Back to Project
        </Link>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Creative Packs</h1>
            <p className="text-gray-600 mt-1">{packsData?.data.length ?? 0} packs created</p>
          </div>
          <button onClick={() => setIsCreateOpen(true)} className="btn-primary">
            Create Pack
          </button>
        </div>
      </div>

      {packsData?.data.length === 0 ? (
        <div className="card text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No packs yet</h3>
          <p className="text-gray-600 mb-4">Create a pack to bundle your localized content</p>
          <button onClick={() => setIsCreateOpen(true)} className="btn-primary">
            Create Pack
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {packsData?.data.map((pack: CreativePack) => (
            <div key={pack.id} className="card">
              <h3 className="font-semibold text-gray-900 mb-2">{pack.name}</h3>
              <div className="text-sm text-gray-600 mb-4">
                <p>Size: {formatFileSize(pack.fileSize)}</p>
                <p>Downloads: {pack.downloadCount}</p>
                <p>Files: {pack.manifest.contents.total_files}</p>
              </div>
              <div className="flex flex-wrap gap-1 mb-4">
                {pack.manifest.contents.locales.map((locale) => (
                  <span key={locale} className="badge bg-gray-100 text-gray-700 text-xs">
                    {locale}
                  </span>
                ))}
                {pack.manifest.contents.platforms.map((platform) => (
                  <span key={platform} className="badge bg-primary-100 text-primary-700 text-xs">
                    {platform}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => packsApi.download(pack.id)}
                  className="btn-primary text-sm"
                >
                  Download
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this pack?')) {
                      deleteMutation.mutate(pack.id);
                    }
                  }}
                  className="btn-danger text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Pack Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Creative Pack"
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="label">Pack Name</label>
            <input
              name="name"
              required
              className="input"
              placeholder="Q1 2024 Campaign Pack"
            />
          </div>

          <div>
            <label className="label">Select Angles (Approved Only)</label>
            {anglesLoading ? (
              <p className="text-gray-500">Loading angles...</p>
            ) : anglesData?.data.length === 0 ? (
              <p className="text-gray-500">No approved angles available</p>
            ) : (
              <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-2">
                {anglesData?.data.map((angle) => (
                  <label key={angle.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded">
                    <input type="checkbox" name="angles" value={angle.id} className="mt-1" />
                    <div>
                      <p className="text-sm font-medium">{angle.hook}</p>
                      <p className="text-xs text-gray-500">
                        {angle._count?.localizedContents ?? 0} localizations
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Locales</label>
              <div className="space-y-2">
                {LOCALES.map((locale) => (
                  <label key={locale.value} className="flex items-center gap-2">
                    <input type="checkbox" name="locales" value={locale.value} defaultChecked />
                    <span className="text-sm">{locale.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Platforms</label>
              <div className="space-y-2">
                {PLATFORMS.map((platform) => (
                  <label key={platform} className="flex items-center gap-2">
                    <input type="checkbox" name="platforms" value={platform} defaultChecked />
                    <span className="text-sm capitalize">{platform}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? 'Creating...' : 'Create Pack'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
