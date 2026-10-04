import { CheckCircle2, Plus } from 'lucide-react';
import { Button } from '../common/Button.tsx';

interface EmptyStateProps {
  isFiltered?: boolean;
  onClearFilters?: () => void;
  onCreateTask?: () => void;
}

export function EmptyState({ isFiltered = false, onClearFilters, onCreateTask }: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className="flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-dashed border-slate-300 dark:border-white/10 bg-white/40 dark:bg-[#252538]/40 my-6"
    >
      <div className="w-16 h-16 rounded-2xl bg-[#6c63ff]/10 text-[#6c63ff] flex items-center justify-center mb-4">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
        {isFiltered ? 'No tasks match your filters' : 'No tasks yet'}
      </h3>

      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
        {isFiltered
          ? 'Try adjusting your search query, status, priority, or category filters to find what you are looking for.'
          : 'You are all caught up! Create your first task to stay organized and productive.'}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {isFiltered && onClearFilters && (
          <Button variant="secondary" size="md" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
        {onCreateTask && (
          <Button variant="primary" size="md" onClick={onCreateTask}>
            <Plus className="w-4 h-4 mr-1" />
            Create task
          </Button>
        )}
      </div>
    </div>
  );
}
