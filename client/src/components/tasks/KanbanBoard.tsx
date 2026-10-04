import { useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCorners,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragCancelEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Info, AlertCircle, RefreshCw } from 'lucide-react';
import { KanbanColumn } from './KanbanColumn.tsx';
import { KanbanCard } from './KanbanCard.tsx';
import { Button } from '../common/Button.tsx';
import { TaskSkeleton } from '../common/Spinner.tsx';
import { useBoardColumnsQuery, useSerializedReorderTasks } from '../../hooks/useTasks.ts';
import type { Task, TaskCategory, TaskPriority, TaskStatus } from '../../types/task.types.ts';

interface KanbanBoardProps {
  category: TaskCategory | 'all';
  priority: TaskPriority | 'all';
  search: string;
  onToggleDone: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

const COLUMNS_CONFIG: { status: TaskStatus; title: string }[] = [
  { status: 'todo', title: 'To Do' },
  { status: 'in-progress', title: 'In Progress' },
  { status: 'done', title: 'Done' },
];

export function KanbanBoard({
  category,
  priority,
  search,
  onToggleDone,
  onEdit,
  onDelete,
}: KanbanBoardProps) {
  const isFilterActive = Boolean(
    (category && category !== 'all') ||
      (priority && priority !== 'all') ||
      Boolean(search && search.trim())
  );

  const filters = useMemo(
    () => ({
      category: category === 'all' ? undefined : category,
      priority: priority === 'all' ? undefined : priority,
      search: search.trim() || undefined,
    }),
    [category, priority, search]
  );

  const { columns, totals, queries, isLoading, isError, error, refetch } = useBoardColumnsQuery(filters);
  const { reorderTasks } = useSerializedReorderTasks();

  // Local optimistic state for columns
  const [boardColumns, setBoardColumns] = useState<Record<TaskStatus, Task[]>>({
    todo: [],
    'in-progress': [],
    done: [],
  });

  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const todoUpdated = queries.todo.dataUpdatedAt;
  const inProgressUpdated = queries['in-progress'].dataUpdatedAt;
  const doneUpdated = queries.done.dataUpdatedAt;

  // Sync server data to local boardColumns whenever query data updates
  useEffect(() => {
    setBoardColumns({
      todo: columns.todo,
      'in-progress': columns['in-progress'],
      done: columns.done,
    });
  }, [todoUpdated, inProgressUpdated, doneUpdated]);

  // Map of all tasks across columns
  const tasksMap = useMemo(() => {
    const map = new Map<string, Task>();
    for (const status of ['todo', 'in-progress', 'done'] as const) {
      for (const task of boardColumns[status]) {
        map.set(task.id, task);
      }
    }
    return map;
  }, [boardColumns]);

  // Sensors setup: dedicated handle activation constraint
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 4,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 150,
      tolerance: 5,
    },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  // Requirement 6: collisionDetection: pointerWithin with closestCorners as fallback
  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return closestCorners(args);
  };

  // Find which column contains a task id
  const findColumnOfTask = (taskId: string): TaskStatus | null => {
    for (const status of ['todo', 'in-progress', 'done'] as const) {
      if (boardColumns[status].some((t) => t.id === taskId)) {
        return status;
      }
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (isFilterActive) return;
    const task = tasksMap.get(String(event.active.id));
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (isFilterActive) return;
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const sourceStatus = findColumnOfTask(activeId);
    if (!sourceStatus) return;

    // Check if over target is a column itself or a task within a column
    let targetStatus: TaskStatus | null = null;
    if (['todo', 'in-progress', 'done'].includes(overId)) {
      targetStatus = overId as TaskStatus;
    } else {
      targetStatus = findColumnOfTask(overId);
    }

    if (!targetStatus || sourceStatus === targetStatus) return;

    // Move task temporarily in local state between columns for real-time visual feedback
    setBoardColumns((prev) => {
      const sourceList = [...prev[sourceStatus]];
      const targetList = [...prev[targetStatus]];

      const taskIndex = sourceList.findIndex((t) => t.id === activeId);
      if (taskIndex === -1) return prev;

      const [movedItem] = sourceList.splice(taskIndex, 1);
      const updatedMovedItem = { ...movedItem, status: targetStatus };

      const overIndex = targetList.findIndex((t) => t.id === overId);
      if (overIndex !== -1) {
        targetList.splice(overIndex, 0, updatedMovedItem);
      } else {
        targetList.push(updatedMovedItem);
      }

      return {
        ...prev,
        [sourceStatus]: sourceList,
        [targetStatus]: targetList,
      };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (isFilterActive || !over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Current location of activeId in boardColumns
    const currentStatus = findColumnOfTask(activeId);
    if (!currentStatus) return;

    const currentList = boardColumns[currentStatus];
    const currentIndex = currentList.findIndex((t) => t.id === activeId);
    if (currentIndex === -1) return;

    // Find target index in currentStatus
    let targetIndex = currentIndex;

    if (['todo', 'in-progress', 'done'].includes(overId)) {
      // Dropped onto empty column area
      targetIndex = currentList.length - 1;
    } else {
      const overIndex = currentList.findIndex((t) => t.id === overId);
      if (overIndex !== -1) {
        targetIndex = overIndex;
      }
    }

    let finalOrderedList = currentList;
    if (currentIndex !== targetIndex) {
      finalOrderedList = arrayMove(currentList, currentIndex, targetIndex);
      setBoardColumns((prev) => ({
        ...prev,
        [currentStatus]: finalOrderedList,
      }));
    }

    // Persist reorder to server (with serialization and optimistic rollback on error)
    try {
      await reorderTasks({
        targetStatus: currentStatus,
        targetOrderedIds: finalOrderedList.map((t) => t.id),
        tasksMap,
      });
    } catch {
      // Revert local state to query data
      setBoardColumns({
        todo: columns.todo,
        'in-progress': columns['in-progress'],
        done: columns.done,
      });
    }
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveTask(null);
    // Reset to server query state on cancel
    setBoardColumns({
      todo: columns.todo,
      'in-progress': columns['in-progress'],
      done: columns.done,
    });
  };

  // Screen reader announcements
  const announcements = {
    onDragStart({ active }: DragStartEvent) {
      const task = tasksMap.get(String(active.id));
      return `Picked up task: ${task?.title || active.id}. Use arrow keys to reorder.`;
    },
    onDragOver({ active, over }: DragOverEvent) {
      if (!over) return '';
      const task = tasksMap.get(String(active.id));
      const isCol = ['todo', 'in-progress', 'done'].includes(String(over.id));
      if (isCol) {
        return `Task "${task?.title || active.id}" moved over column ${over.id}.`;
      }
      const overTask = tasksMap.get(String(over.id));
      return `Task "${task?.title || active.id}" moved over task "${overTask?.title || over.id}".`;
    },
    onDragEnd({ active, over }: DragEndEvent) {
      const task = tasksMap.get(String(active.id));
      if (!over) {
        return `Task "${task?.title || active.id}" dropped without change.`;
      }
      return `Task "${task?.title || active.id}" placed successfully.`;
    },
    onDragCancel({ active }: DragCancelEvent) {
      const task = tasksMap.get(String(active.id));
      return `Dragging cancelled for task "${task?.title || active.id}".`;
    },
  };

  if (isLoading) {
    return (
      <div className="w-full flex flex-col md:flex-row gap-4 items-stretch" data-testid="kanban-loading">
        <div className="flex-1 bg-slate-50 dark:bg-[#1a1a28] rounded-2xl p-4 flex flex-col gap-3">
          <div className="h-6 w-24 bg-slate-200 dark:bg-white/10 rounded-md animate-pulse" />
          <TaskSkeleton />
          <TaskSkeleton />
        </div>
        <div className="flex-1 bg-slate-50 dark:bg-[#1a1a28] rounded-2xl p-4 flex flex-col gap-3">
          <div className="h-6 w-24 bg-slate-200 dark:bg-white/10 rounded-md animate-pulse" />
          <TaskSkeleton />
        </div>
        <div className="flex-1 bg-slate-50 dark:bg-[#1a1a28] rounded-2xl p-4 flex flex-col gap-3">
          <div className="h-6 w-24 bg-slate-200 dark:bg-white/10 rounded-md animate-pulse" />
          <TaskSkeleton />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center p-8 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-center gap-3"
      >
        <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" />
        <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
          {error instanceof Error ? error.message : 'Unable to load board columns.'}
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={() => refetch()} className="mt-1">
          <RefreshCw className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Informative banner when search or filter is active */}
      {isFilterActive && (
        <div
          role="status"
          data-testid="filter-disabled-banner"
          className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-medium"
        >
          <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span>
            Drag-and-drop reordering is disabled while search or filters are active. Clear filters to reorder.
          </span>
        </div>
      )}

      {/* Kanban Columns Container with horizontal scroll on mobile */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{
          announcements,
        }}
      >
        <div
          data-testid="kanban-board-container"
          className="w-full flex flex-col md:flex-row gap-4 items-start overflow-x-auto pb-4 pt-1 snap-x"
        >
          {COLUMNS_CONFIG.map(({ status, title }) => (
            <KanbanColumn
              key={status}
              status={status}
              title={title}
              tasks={boardColumns[status]}
              total={totals[status]}
              onToggleDone={onToggleDone}
              onEdit={onEdit}
              onDelete={onDelete}
              isFilterActive={isFilterActive}
            />
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask ? (
            <KanbanCard
              task={activeTask}
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
