import { AlertCircle } from 'lucide-react';
import type { TaskCategory, TaskPriority, TaskStatus } from '../../types/task.types.ts';

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const styles = {
    high: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    low: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
  };

  const labels = {
    high: 'High Priority',
    medium: 'Medium Priority',
    low: 'Low Priority',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[priority]}`}
    >
      {labels[priority]}
    </span>
  );
}

export function CategoryBadge({ category }: { category: TaskCategory }) {
  if (category === 'none') return null;

  const styles = {
    Work: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30',
    Home: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
    Personal: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30',
    Urgent: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30',
    none: '',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[category]}`}
    >
      {category}
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const styles = {
    todo: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
    'in-progress': 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    done: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  };

  const labels = {
    todo: 'To Do',
    'in-progress': 'In Progress',
    done: 'Done',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export function OverdueBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs animate-pulse"
      data-testid="overdue-badge"
    >
      <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
      Overdue
    </span>
  );
}
