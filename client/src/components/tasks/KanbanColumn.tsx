import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard.tsx';
import type { Task, TaskStatus } from '../../types/task.types.ts';

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  total: number;
  onToggleDone: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  isFilterActive: boolean;
}

const COLUMN_THEMES: Record<
  TaskStatus,
  {
    headerBg: string;
    dotBg: string;
    borderAccent: string;
    badgeBg: string;
  }
> = {
  todo: {
    headerBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    dotBg: 'bg-amber-500',
    borderAccent: 'border-amber-500/20',
    badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  'in-progress': {
    headerBg: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
    dotBg: 'bg-indigo-500',
    borderAccent: 'border-indigo-500/20',
    badgeBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  },
  done: {
    headerBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    dotBg: 'bg-emerald-500',
    borderAccent: 'border-emerald-500/20',
    badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
};

export function KanbanColumn({
  status,
  title,
  tasks,
  total,
  onToggleDone,
  onEdit,
  onDelete,
  isFilterActive,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: 'column',
      status,
    },
  });

  const isTruncated = total > tasks.length;
  // Drag is disabled if global filter is active OR if column has more tasks than loaded
  const isDragDisabled = isFilterActive || isTruncated;
  const theme = COLUMN_THEMES[status];

  return (
    <div
      data-testid={`kanban-column-${status}`}
      className={`flex flex-col w-full md:w-80 lg:w-96 shrink-0 bg-slate-50/80 dark:bg-[#1a1a28] rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs transition-colors ${
        isOver ? 'ring-2 ring-[#6c63ff] bg-[#6c63ff]/5' : ''
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-200/60 dark:border-white/5">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${theme.dotBg}`} aria-hidden="true" />
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 tracking-tight">
            {title}
          </h3>
          <span
            data-testid={`column-count-${status}`}
            className="text-xs px-2 py-0.5 rounded-full font-semibold bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300"
          >
            {total}
          </span>
        </div>

        {/* Truncation warning indicator */}
        {isTruncated && (
          <span
            data-testid={`truncated-warning-${status}`}
            title="Column has more tasks than loaded. Reordering is disabled."
            className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
          >
            Showing {tasks.length} of {total}
          </span>
        )}
      </div>

      {/* Cards List Drop Zone */}
      <div
        ref={setNodeRef}
        data-testid={`droppable-area-${status}`}
        className="flex-1 p-2.5 flex flex-col gap-2.5 min-h-[300px] max-h-[calc(100vh-250px)] overflow-y-auto"
      >
        <SortableContext
          items={tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onToggleDone={onToggleDone}
              onEdit={onEdit}
              onDelete={onDelete}
              isDragDisabled={isDragDisabled}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div
            data-testid={`empty-column-dropzone-${status}`}
            className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl text-center text-xs text-slate-400 dark:text-slate-500"
          >
            <p>No tasks here</p>
            <p className="mt-1 text-[11px] opacity-75">Drop a task to move it here</p>
          </div>
        )}
      </div>
    </div>
  );
}
