import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { anglesApi, localizationsApi } from '../services/api';
import { Modal } from '../components/Modal';
import { PageLoading } from '../components/Loading';
import type { LocalizedContent, Locale, Platform } from '../types';
import { clsx } from 'clsx';

const LOCALE_LABELS: Record<Locale, string> = {
  'en-US': 'English (US)',
  'es-ES': 'Spanish',
  'fr-FR': 'French',
  'de-DE': 'German',
  'pt-BR': 'Portuguese',
};

export function LocalizationsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [selectedContent, setSelectedContent] = useState<LocalizedContent | null>(null);
  const [filterLocale, setFilterLocale] = useState<Locale | 'all'>('all');
  const [filterPlatform, setFilterPlatform] = useState<Platform | 'all'>('all');

  const { data: anglesData, isLoading } = useQuery({
    queryKey: ['angles', projectId],
    queryFn: () => anglesApi.list(projectId!, { status: 'approved' }),
    enabled: !!projectId,
  });

  // Fetch localizations for all approved angles
  const { data: localizationsData } = useQuery({
    queryKey: ['localizations', projectId, anglesData?.data.map((a) => a.id)],
    queryFn: async () => {
      if (!anglesData?.data) return [];
      const results = await Promise.all(
        anglesData.data.map((angle) => localizationsApi.list(angle.id))
      );
      return results.flat();
    },
    enabled: !!anglesData?.data.length,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LocalizedContent> }) =>
      localizationsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localizations', projectId] });
      setSelectedContent(null);
      toast.success('Content updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: localizationsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['localizations', projectId] });
      toast.success('Content deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedContent) return;

    const formData = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: selectedContent.id,
      data: {
        script: formData.get('script') as string,
        culturalNotes: formData.get('culturalNotes') as string || undefined,
      },
    });
  };

  if (isLoading) return <PageLoading />;

  const filteredContent = localizationsData?.filter((content) => {
    if (filterLocale !== 'all' && content.locale !== filterLocale) return false;
    if (filterPlatform !== 'all' && content.platform !== filterPlatform) return false;
    return true;
  });

  // Group by angle
  const groupedContent = filteredContent?.reduce(
    (acc, content) => {
      if (!acc[content.angleId]) acc[content.angleId] = [];
      acc[content.angleId].push(content);
      return acc;
    },
    {} as Record<string, LocalizedContent[]>
  );

  return (
    <div>
      <div className="mb-8">
        <Link to={`/projects/${projectId}`} className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          &larr; Back to Project
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Localizations</h1>
        <p className="text-gray-600 mt-1">
          {localizationsData?.length ?? 0} localized versions across {anglesData?.data.length ?? 0} angles
        </p>
      </div>

      <div className="mb-6 flex gap-4">
        <div>
          <label className="label">Filter by Locale</label>
          <select
            value={filterLocale}
            onChange={(e) => setFilterLocale(e.target.value as Locale | 'all')}
            className="input w-48"
          >
            <option value="all">All Locales</option>
            {Object.entries(LOCALE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Filter by Platform</label>
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value as Platform | 'all')}
            className="input w-48"
          >
            <option value="all">All Platforms</option>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
          </select>
        </div>
      </div>

      {!localizationsData?.length ? (
        <div className="card text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No localizations yet</h3>
          <p className="text-gray-600 mb-4">Approve angles and create localizations to see them here</p>
          <Link to={`/projects/${projectId}/angles`} className="btn-primary">
            Manage Angles
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedContent &&
            Object.entries(groupedContent).map(([angleId, contents]) => (
              <div key={angleId} className="card">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Angle: {contents[0]?.script.split('\n')[0]?.substring(0, 50)}...
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {contents.map((content) => (
                    <div
                      key={content.id}
                      className="border rounded-lg p-4 hover:border-primary-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="badge bg-gray-100 text-gray-800">
                          {LOCALE_LABELS[content.locale]}
                        </span>
                        <span className={clsx(
                          'badge',
                          content.platform === 'tiktok' && 'bg-pink-100 text-pink-700',
                          content.platform === 'instagram' && 'bg-purple-100 text-purple-700',
                          content.platform === 'youtube' && 'bg-red-100 text-red-700'
                        )}>
                          {content.platform}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-4 mb-3">
                        {content.script}
                      </p>
                      <div className="text-xs text-gray-500 mb-3">
                        {content.characterCount} chars / {content.wordCount} words
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedContent(content)}
                          className="btn-secondary text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this localization?')) {
                              deleteMutation.mutate(content.id);
                            }
                          }}
                          className="btn-danger text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={!!selectedContent}
        onClose={() => setSelectedContent(null)}
        title={`Edit ${selectedContent?.locale} - ${selectedContent?.platform}`}
        size="lg"
      >
        {selectedContent && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="label">Script</label>
              <textarea
                name="script"
                defaultValue={selectedContent.script}
                required
                className="input font-mono text-sm"
                rows={10}
              />
              <p className="text-xs text-gray-500 mt-1">
                Character count will be updated automatically
              </p>
            </div>
            <div>
              <label className="label">Cultural Notes</label>
              <textarea
                name="culturalNotes"
                defaultValue={selectedContent.culturalNotes ?? ''}
                className="input"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setSelectedContent(null)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={updateMutation.isPending} className="btn-primary">
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
