import { Check, Edit2, Trash2, Calendar } from 'lucide-react';
import { PriorityBadge, CategoryBadge, StatusBadge, OverdueBadge } from '../common/Badge.tsx';
import { isTaskOverdue, formatDateForDisplay } from '../../utils/date.ts';
import type { Task } from '../../types/task.types.ts';

interface TaskCardProps {
  task: Task;
  onToggleDone: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  isToggling?: boolean;
}

export function TaskCard({
  task,
  onToggleDone,
  onEdit,
  onDelete,
  isToggling = false,
}: TaskCardProps) {
  const isDone = task.status === 'done';
  const overdue = isTaskOverdue(task.dueDate, task.status);

  return (
    <div
      data-testid={`task-item-${task.id}`}
      className={`group relative flex flex-col gap-3 p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
        isDone
          ? 'bg-slate-50/70 dark:bg-[#1e1e2f]/50 border-slate-200/60 dark:border-white/5 opacity-75'
          : overdue
          ? 'bg-white dark:bg-[#252538] border-rose-300 dark:border-rose-900/50 shadow-md shadow-rose-900/5 hover:border-rose-400'
          : 'bg-white dark:bg-[#252538] border-slate-200/80 dark:border-white/10 shadow-xs hover:shadow-md hover:border-[#6c63ff]/40 dark:hover:border-[#6c63ff]/40'
      }`}
    >
      {/* Top Header: Checkbox, Title, Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Complete / Toggle Done Button */}
          <button
            type="button"
            onClick={() => onToggleDone(task)}
            disabled={isToggling}
            aria-label={isDone ? `Mark "${task.title}" as incomplete` : `Mark "${task.title}" as done`}
            className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center border transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff] ${
              isDone
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                : 'border-slate-300 dark:border-white/20 hover:border-[#6c63ff] bg-transparent text-transparent hover:text-slate-400'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
          </button>

          {/* Title & Description */}
          <div className="flex-1 min-w-0 text-left">
            <h3
              className={`font-semibold text-base leading-snug break-words transition-colors ${
                isDone
                  ? 'line-through text-slate-400 dark:text-slate-500'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {task.title}
            </h3>

            {task.description && (
              <p
                className={`text-xs sm:text-sm mt-1 leading-relaxed break-words line-clamp-2 ${
                  isDone
                    ? 'line-through text-slate-400/80 dark:text-slate-500/80'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {task.description}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons (Edit / Delete) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(task)}
            aria-label={`Edit task "${task.title}"`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#6c63ff] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff]"
          >
            <Edit2 className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(task)}
            aria-label={`Delete task "${task.title}"`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Badges and Due Date Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={task.priority} />
          <CategoryBadge category={task.category} />
          <StatusBadge status={task.status} />
          {overdue && <OverdueBadge />}
        </div>

        {task.dueDate && (
          <div
            className={`flex items-center gap-1 font-medium ${
              overdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{formatDateForDisplay(task.dueDate)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
