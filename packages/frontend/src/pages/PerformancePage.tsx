import { useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { performanceApi, anglesApi } from '../services/api';
import { PageLoading } from '../components/Loading';
import type { PerformanceMetrics, WinnerAnalysis } from '../types';

export function PerformancePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  const [winnerAnalysis, setWinnerAnalysis] = useState<WinnerAnalysis | null>(null);

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics', projectId],
    queryFn: () => performanceApi.getMetrics(projectId!),
    enabled: !!projectId,
  });

  const { data: imports, isLoading: importsLoading } = useQuery({
    queryKey: ['imports', projectId],
    queryFn: () => performanceApi.listImports(projectId!),
    enabled: !!projectId,
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => performanceApi.importCSV(projectId!, file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['imports', projectId] });
      queryClient.invalidateQueries({ queryKey: ['metrics', projectId] });
      toast.success(`Imported ${data?.rowsProcessed ?? 0} rows`);
      if (data?.rowsFailed) {
        toast.error(`${data.rowsFailed} rows failed to import`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const winnersMutation = useMutation({
    mutationFn: () => performanceApi.identifyWinners(projectId!, 3, 'ctr'),
    onSuccess: (data) => {
      if (data) {
        setWinnerAnalysis(data);
        queryClient.invalidateQueries({ queryKey: ['angles', projectId] });
        toast.success(`${data.topPerformers.length} winners identified`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const iterateMutation = useMutation({
    mutationFn: () => performanceApi.generateIterations(projectId!, 3, 5),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['angles', projectId] });
      toast.success(`${data.length} new angles generated`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        importMutation.mutate(file);
      }
    },
    [importMutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  if (metricsLoading || importsLoading) return <PageLoading />;

  const hasData = (metrics?.length ?? 0) > 0;

  return (
    <div>
      <div className="mb-8">
        <Link to={`/projects/${projectId}`} className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
          &larr; Back to Project
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Performance & Winner Loop</h1>
        <p className="text-gray-600 mt-1">Import data, identify winners, and generate iterations</p>
      </div>

      {/* CSV Upload */}
      <div className="card mb-8">
        <h2 className="text-lg font-semibold mb-4">Import Performance Data</h2>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-400'
          }`}
        >
          <input {...getInputProps()} />
          {importMutation.isPending ? (
            <p className="text-gray-600">Uploading...</p>
          ) : isDragActive ? (
            <p className="text-primary-600">Drop the CSV file here</p>
          ) : (
            <div>
              <p className="text-gray-600 mb-2">Drag and drop a CSV file here, or click to select</p>
              <p className="text-sm text-gray-500">
                Required columns: angle_id, impressions, clicks, conversions, spend, revenue
              </p>
            </div>
          )}
        </div>

        {imports && imports.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Imports</h3>
            <div className="space-y-2">
              {imports.slice(0, 5).map((batch) => (
                <div key={batch.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                  <span>{batch.filename}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500">
                      {batch.rowsProcessed} / {batch.rowsTotal ?? '?'} rows
                    </span>
                    <span
                      className={`badge ${
                        batch.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : batch.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {batch.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      {hasData && (
        <div className="card mb-8">
          <h2 className="text-lg font-semibold mb-4">Performance Metrics</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Angle</th>
                  <th className="text-right py-2 px-3">Impressions</th>
                  <th className="text-right py-2 px-3">Clicks</th>
                  <th className="text-right py-2 px-3">CTR</th>
                  <th className="text-right py-2 px-3">Conversions</th>
                  <th className="text-right py-2 px-3">CPA</th>
                  <th className="text-right py-2 px-3">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {metrics?.map((m: PerformanceMetrics) => (
                  <tr key={m.angleId} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3 max-w-xs truncate">{m.hook}</td>
                    <td className="text-right py-2 px-3">{m.totalImpressions.toLocaleString()}</td>
                    <td className="text-right py-2 px-3">{m.totalClicks.toLocaleString()}</td>
                    <td className="text-right py-2 px-3">{m.ctr.toFixed(2)}%</td>
                    <td className="text-right py-2 px-3">{m.totalConversions}</td>
                    <td className="text-right py-2 px-3">
                      {m.cpa ? `$${m.cpa.toFixed(2)}` : '-'}
                    </td>
                    <td className="text-right py-2 px-3">
                      {m.roas ? `${m.roas.toFixed(2)}x` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Winner Loop */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Winner Loop</h2>
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => winnersMutation.mutate()}
            disabled={!hasData || winnersMutation.isPending}
            className="btn-primary"
          >
            {winnersMutation.isPending ? 'Analyzing...' : 'Identify Winners'}
          </button>
          <button
            onClick={() => iterateMutation.mutate()}
            disabled={!winnerAnalysis || iterateMutation.isPending}
            className="btn-secondary"
          >
            {iterateMutation.isPending ? 'Generating...' : 'Generate Iterations'}
          </button>
        </div>

        {winnerAnalysis && (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Top Performers</h3>
              <div className="space-y-2">
                {winnerAnalysis.topPerformers.map((performer, index) => (
                  <div key={performer.angleId} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-yellow-600">#{index + 1}</span>
                      <div>
                        <p className="font-medium">Angle {performer.angleId.slice(0, 8)}</p>
                        <p className="text-sm text-gray-600">
                          CTR: {performer.metrics.ctr?.toFixed(2)}% |
                          ROAS: {performer.metrics.roas?.toFixed(2) ?? '-'}x
                        </p>
                      </div>
                    </div>
                    <span className="badge-winner">Winner</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Identified Patterns</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {winnerAnalysis.patterns.map((pattern, i) => (
                  <li key={i}>{pattern}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Recommendations</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {winnerAnalysis.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {!hasData && (
          <p className="text-gray-500">Import performance data to identify winners and generate iterations.</p>
        )}
      </div>
    </div>
  );
}
