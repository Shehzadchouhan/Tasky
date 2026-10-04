import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TaskPaginationProps {
  currentPage: number;
  totalPages: number;
  totalTasks: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  isLoading?: boolean;
}

export function TaskPagination({
  currentPage,
  totalPages,
  totalTasks,
  limit,
  onPageChange,
  isLoading = false,
}: TaskPaginationProps) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * limit + 1;
  const end = Math.min(currentPage * limit, totalTasks);

  return (
    <nav
      aria-label="Tasks pagination"
      className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400"
    >
      <div>
        Showing <span className="font-semibold text-slate-900 dark:text-white">{start}</span> to{' '}
        <span className="font-semibold text-slate-900 dark:text-white">{end}</span> of{' '}
        <span className="font-semibold text-slate-900 dark:text-white">{totalTasks}</span> tasks
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          aria-label="Go to previous page"
          className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#252538] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff] flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        <span className="px-3 py-1 font-medium text-slate-700 dark:text-slate-200">
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading}
          aria-label="Go to next page"
          className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#252538] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff] flex items-center gap-1"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
