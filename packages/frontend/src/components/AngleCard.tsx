import { clsx } from 'clsx';
import type { AngleCard as AngleCardType, AngleStatus } from '../types';

interface AngleCardProps {
  angle: AngleCardType;
  onEdit?: () => void;
  onStatusChange?: (status: AngleStatus) => void;
  onLocalize?: () => void;
  onDelete?: () => void;
  onMarkWinner?: () => void;
  onRegenerate?: () => void;
}

const statusColors: Record<AngleStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  archived: 'bg-yellow-100 text-yellow-800',
};

export function AngleCardComponent({
  angle,
  onEdit,
  onStatusChange,
  onLocalize,
  onDelete,
  onMarkWinner,
  onRegenerate,
}: AngleCardProps) {
  return (
    <div className="card hover:shadow-md transition-shadow" data-testid="angle-card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={clsx('badge', statusColors[angle.status])}>
            {angle.status}
          </span>
          {angle.isWinner && (
            <span className="badge-winner">Winner</span>
          )}
          <span className="text-xs text-gray-500">v{angle.version}</span>
        </div>
        {angle.estimatedDuration && (
          <span className="text-sm text-gray-500">{angle.estimatedDuration}s</span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium text-gray-500">Hook</h4>
          <p className="text-gray-900">{angle.hook}</p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-500">Problem</h4>
          <p className="text-gray-700 text-sm line-clamp-2">{angle.problemAgitation}</p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-500">Solution</h4>
          <p className="text-gray-700 text-sm line-clamp-2">{angle.solution}</p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-500">CTA</h4>
          <p className="text-gray-900 font-medium">{angle.cta}</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
        {onMarkWinner && (
          <button
            onClick={onMarkWinner}
            className={`btn text-xs ${angle.isWinner ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            data-testid="angle-mark-winner"
            aria-label="Mark as winner"
          >
            {angle.isWinner ? 'Winner ★' : 'Mark Winner'}
          </button>
        )}
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="btn-secondary text-xs"
            data-testid="angle-regenerate"
            aria-label="Regenerate angle"
          >
            Regenerate
          </button>
        )}
        {onEdit && (
          <button onClick={onEdit} className="btn-secondary text-xs" aria-label="Edit angle">
            Edit
          </button>
        )}
        {onLocalize && (
          <button onClick={onLocalize} className="btn-primary text-xs" aria-label="Localize angle">
            Localize
          </button>
        )}
        {onStatusChange && angle.status === 'draft' && (
          <>
            <button
              onClick={() => onStatusChange('approved')}
              className="btn text-xs bg-green-100 text-green-700 hover:bg-green-200"
              aria-label="Approve angle"
            >
              Approve
            </button>
            <button
              onClick={() => onStatusChange('rejected')}
              className="btn text-xs bg-red-100 text-red-700 hover:bg-red-200"
              aria-label="Reject angle"
            >
              Reject
            </button>
          </>
        )}
        {onDelete && (
          <button onClick={onDelete} className="btn-danger text-xs" aria-label="Delete angle">
            Delete
          </button>
        )}
      </div>

      {angle._count && (
        <div className="mt-3 text-xs text-gray-500">
          {angle._count.localizedContents} localizations
        </div>
      )}
    </div>
  );
}
