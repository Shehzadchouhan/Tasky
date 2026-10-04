import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { Check, Edit2, Trash2, Calendar, GripVertical } from 'lucide-react';
import { PriorityBadge, CategoryBadge, OverdueBadge } from '../common/Badge.tsx';
import { isTaskOverdue, formatDateForDisplay } from '../../utils/date.ts';
import type { Task } from '../../types/task.types.ts';

interface KanbanCardProps {
  task: Task;
  onToggleDone?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  isDragDisabled?: boolean;
  isOverlay?: boolean;
}

export function KanbanCard({
  task,
  onToggleDone,
  onEdit,
  onDelete,
  isDragDisabled = false,
  isOverlay = false,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: isDragDisabled || isOverlay,
  });

  const isDone = task.status === 'done';
  const overdue = isTaskOverdue(task.dueDate, task.status);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`kanban-card-${task.id}`}
      className={`group relative flex flex-col gap-2.5 p-3.5 rounded-xl border select-none transition-shadow ${
        isOverlay
          ? 'bg-white dark:bg-[#252538] border-[#6c63ff] shadow-xl ring-2 ring-[#6c63ff]/30 opacity-95 scale-105'
          : isDragging
          ? 'bg-slate-100 dark:bg-[#1e1e2f] border-dashed border-slate-300 dark:border-white/20 opacity-30 shadow-none'
          : isDone
          ? 'bg-slate-50/70 dark:bg-[#1e1e2f]/50 border-slate-200/60 dark:border-white/5 opacity-80'
          : overdue
          ? 'bg-white dark:bg-[#252538] border-rose-300 dark:border-rose-900/50 shadow-xs hover:border-rose-400'
          : 'bg-white dark:bg-[#252538] border-slate-200/80 dark:border-white/10 shadow-xs hover:shadow-md hover:border-[#6c63ff]/40'
      }`}
    >
      {/* Top Header: Drag Handle, Done Checkbox, Title, and Actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {/* Dedicated Drag Handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            disabled={isDragDisabled || isOverlay}
            style={{ touchAction: 'none' }}
            tabIndex={isDragDisabled || isOverlay ? -1 : 0}
            aria-label={`Drag handle for ${task.title}. Press space or enter to pick up.`}
            title={isDragDisabled ? 'Reordering disabled' : 'Drag to reorder'}
            className={`mt-0.5 p-1 rounded-md text-slate-400 dark:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff] ${
              isDragDisabled || isOverlay
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 cursor-grab active:cursor-grabbing'
            }`}
          >
            <GripVertical className="w-4 h-4" aria-hidden="true" />
          </button>

          {/* Toggle Done Checkbox */}
          {onToggleDone && (
            <button
              type="button"
              onClick={() => onToggleDone(task)}
              aria-label={isDone ? `Mark "${task.title}" as incomplete` : `Mark "${task.title}" as done`}
              className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border transition-all cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff] ${
                isDone
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                  : 'border-slate-300 dark:border-white/20 hover:border-[#6c63ff] bg-transparent text-transparent hover:text-slate-400'
              }`}
            >
              <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />
            </button>
          )}

          {/* Title & Description */}
          <div className="flex-1 min-w-0 text-left">
            <h4
              className={`font-semibold text-sm leading-snug break-words ${
                isDone
                  ? 'line-through text-slate-400 dark:text-slate-500'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {task.title}
            </h4>

            {task.description && (
              <p
                className={`text-xs mt-1 leading-relaxed break-words line-clamp-2 ${
                  isDone
                    ? 'line-through text-slate-400/80 dark:text-slate-500/80'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {task.description}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons: Edit / Delete */}
        {!isOverlay && (onEdit || onDelete) && (
          <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(task)}
                aria-label={`Edit task "${task.title}"`}
                className="p-1 rounded text-slate-400 hover:text-[#6c63ff] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff]"
              >
                <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(task)}
                aria-label={`Delete task "${task.title}"`}
                className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Badges & Due Date footer */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
        <PriorityBadge priority={task.priority} />
        {task.category && task.category !== 'none' && (
          <CategoryBadge category={task.category} />
        )}

        {task.dueDate && (
          <div
            className={`inline-flex items-center gap-1 text-[11px] font-medium ml-auto ${
              overdue
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Calendar className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>{formatDateForDisplay(task.dueDate)}</span>
            {overdue && <OverdueBadge />}
          </div>
        )}
      </div>
    </div>
  );
}
