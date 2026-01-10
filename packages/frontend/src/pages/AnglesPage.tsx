import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { anglesApi, localizationsApi } from '../services/api';
import { AngleCardComponent } from '../components/AngleCard';
import { Modal } from '../components/Modal';
import { PageLoading } from '../components/Loading';
import type { AngleCard, AngleStatus, Locale, Platform } from '../types';

const LOCALES: { value: Locale; label: string }[] = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
];

const PLATFORMS: Platform[] = ['tiktok', 'instagram', 'youtube'];

export function AnglesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [selectedAngle, setSelectedAngle] = useState<AngleCard | null>(null);
  const [localizeModal, setLocalizeModal] = useState<AngleCard | null>(null);
  const [statusFilter, setStatusFilter] = useState<AngleStatus | 'all'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['angles', projectId, statusFilter],
    queryFn: () =>
      anglesApi.list(projectId!, {
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
    enabled: !!projectId,
  });

  const generateMutation = useMutation({
    mutationFn: (count: number) => anglesApi.generate(projectId!, count),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['angles', projectId] });
      toast.success('Angles generated successfully');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AngleStatus }) =>
      anglesApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['angles', projectId] });
      toast.success('Status updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: anglesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['angles', projectId] });
      toast.success('Angle deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const localizeMutation = useMutation({
    mutationFn: ({
      angleId,
      locales,
      platforms,
    }: {
      angleId: string;
      locales: Locale[];
      platforms: Platform[];
    }) => localizationsApi.localize(angleId, locales, platforms),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['angles', projectId] });
      setLocalizeModal(null);
      toast.success('Localization complete');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AngleCard> }) =>
      anglesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['angles', projectId] });
      setSelectedAngle(null);
      toast.success('Angle updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleLocalizeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!localizeModal) return;

    const formData = new FormData(e.currentTarget);
    const locales = formData.getAll('locales') as Locale[];
    const platforms = formData.getAll('platforms') as Platform[];

    if (locales.length === 0 || platforms.length === 0) {
      toast.error('Select at least one locale and platform');
      return;
    }

    localizeMutation.mutate({
      angleId: localizeModal.id,
      locales,
      platforms,
    });
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAngle) return;

    const formData = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: selectedAngle.id,
      data: {
        hook: formData.get('hook') as string,
        problemAgitation: formData.get('problemAgitation') as string,
        solution: formData.get('solution') as string,
        cta: formData.get('cta') as string,
      },
    });
  };

  if (isLoading) return <PageLoading />;

  return (
    <div>
      <div className="mb-8">
        <Link to={`/projects/${projectId}`} className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          &larr; Back to Project
        </Link>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Angles</h1>
            <p className="text-gray-600 mt-1">{data?.meta?.total ?? 0} total angles</p>
          </div>
          <button
            onClick={() => generateMutation.mutate(3)}
            disabled={generateMutation.isPending}
            className="btn-primary"
          >
            {generateMutation.isPending ? 'Generating...' : 'Generate 3 Angles'}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex gap-2">
          {(['all', 'draft', 'approved', 'rejected', 'archived'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`btn text-sm ${
                statusFilter === status ? 'btn-primary' : 'btn-secondary'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {data?.data.length === 0 ? (
        <div className="card text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No angles yet</h3>
          <p className="text-gray-600 mb-4">Generate angles to get started</p>
          <button
            onClick={() => generateMutation.mutate(3)}
            disabled={generateMutation.isPending}
            className="btn-primary"
          >
            Generate Angles
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data?.data.map((angle) => (
            <AngleCardComponent
              key={angle.id}
              angle={angle}
              onEdit={() => setSelectedAngle(angle)}
              onLocalize={() => setLocalizeModal(angle)}
              onStatusChange={(status) => statusMutation.mutate({ id: angle.id, status })}
              onDelete={() => {
                if (confirm('Delete this angle?')) {
                  deleteMutation.mutate(angle.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={!!selectedAngle}
        onClose={() => setSelectedAngle(null)}
        title="Edit Angle"
        size="lg"
      >
        {selectedAngle && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="label">Hook</label>
              <input
                name="hook"
                defaultValue={selectedAngle.hook}
                required
                className="input"
              />
            </div>
            <div>
              <label className="label">Problem/Agitation</label>
              <textarea
                name="problemAgitation"
                defaultValue={selectedAngle.problemAgitation}
                required
                className="input"
                rows={3}
              />
            </div>
            <div>
              <label className="label">Solution</label>
              <textarea
                name="solution"
                defaultValue={selectedAngle.solution}
                required
                className="input"
                rows={3}
              />
            </div>
            <div>
              <label className="label">CTA</label>
              <input
                name="cta"
                defaultValue={selectedAngle.cta}
                required
                className="input"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setSelectedAngle(null)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={updateMutation.isPending} className="btn-primary">
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Localize Modal */}
      <Modal
        isOpen={!!localizeModal}
        onClose={() => setLocalizeModal(null)}
        title="Localize Angle"
      >
        <form onSubmit={handleLocalizeSubmit} className="space-y-4">
          <div>
            <label className="label">Select Locales</label>
            <div className="space-y-2">
              {LOCALES.map((locale) => (
                <label key={locale.value} className="flex items-center gap-2">
                  <input type="checkbox" name="locales" value={locale.value} defaultChecked />
                  <span>{locale.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Select Platforms</label>
            <div className="space-y-2">
              {PLATFORMS.map((platform) => (
                <label key={platform} className="flex items-center gap-2">
                  <input type="checkbox" name="platforms" value={platform} defaultChecked />
                  <span className="capitalize">{platform}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setLocalizeModal(null)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={localizeMutation.isPending} className="btn-primary">
              {localizeMutation.isPending ? 'Localizing...' : 'Generate Localizations'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
