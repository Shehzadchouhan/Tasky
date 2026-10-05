import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../components/common/Button.tsx';
import { TaskSkeleton } from '../components/common/Spinner.tsx';
import { TaskCard } from '../components/tasks/TaskCard.tsx';
import { TaskModal } from '../components/tasks/TaskModal.tsx';
import { DeleteConfirmModal } from '../components/tasks/DeleteConfirmModal.tsx';
import { TaskControls } from '../components/tasks/TaskControls.tsx';
import { TaskPagination } from '../components/tasks/TaskPagination.tsx';
import { EmptyState } from '../components/tasks/EmptyState.tsx';
import { KanbanBoard } from '../components/tasks/KanbanBoard.tsx';
import { StatsDashboard } from '../components/stats/StatsDashboard.tsx';
import { useTasksQuery, useCreateTask, useUpdateTask, useDeleteTask } from '../hooks/useTasks.ts';
import { useDebounce } from '../hooks/useDebounce.ts';
import { useToast } from '../hooks/useToast.ts';
import type {
  CreateTaskInput,
  Task,
  TaskCategory,
  TaskPriority,
  TaskQueryParams,
  TaskSortField,
  TaskStatus,
  TaskViewMode,
  SortOrder,
  UpdateTaskInput,
} from '../types/task.types.ts';

const PAGE_LIMIT = 10;

export function DashboardPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract query params from URL
  const viewParam = (searchParams.get('view') as TaskViewMode) || 'list';
  const statusParam = (searchParams.get('status') as TaskStatus | 'all') || 'all';
  const categoryParam = (searchParams.get('category') as TaskCategory | 'all') || 'all';
  const priorityParam = (searchParams.get('priority') as TaskPriority | 'all') || 'all';
  const searchUrlParam = searchParams.get('search') || '';
  const sortParam = (searchParams.get('sort') as TaskSortField) || 'createdAt';
  const orderParam = (searchParams.get('order') as SortOrder) || 'desc';
  const pageParam = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  // Local state for search bar (to debounce)
  const [searchInput, setSearchInput] = useState(searchUrlParam);
  const [prevSearchUrlParam, setPrevSearchUrlParam] = useState(searchUrlParam);

  if (prevSearchUrlParam !== searchUrlParam) {
    setPrevSearchUrlParam(searchUrlParam);
    setSearchInput(searchUrlParam);
  }

  const debouncedSearch = useDebounce(searchInput, 300);

  // Sync debounced search to URL query params (reset page to 1)
  useEffect(() => {
    if (debouncedSearch !== searchUrlParam) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (debouncedSearch.trim()) {
            next.set('search', debouncedSearch.trim());
          } else {
            next.delete('search');
          }
          next.set('page', '1');
          return next;
        },
        { replace: true }
      );
    }
  }, [debouncedSearch, searchUrlParam, setSearchParams]);

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const isBoardView = viewParam === 'board';
  const isStatsView = viewParam === 'stats';
  const isListView = !isBoardView && !isStatsView;

  // Helper to update URL params and reset page to 1
  const updateFilter = (key: string, value: string | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value && value !== 'all') {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        next.set('page', '1');
        return next;
      },
      { replace: true }
    );
  };

  const handleViewChange = (newView: TaskViewMode) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (newView === 'board') {
          next.set('view', 'board');
        } else if (newView === 'stats') {
          next.set('view', 'stats');
        } else {
          next.delete('view');
        }
        return next;
      },
      { replace: true }
    );
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('page', String(newPage));
        return next;
      },
      { replace: true }
    );
  };

  const handleOrderToggle = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('order', orderParam === 'asc' ? 'desc' : 'asc');
        next.set('page', '1');
        return next;
      },
      { replace: true }
    );
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams();
        const currentView = prev.get('view');
        if (currentView) {
          next.set('view', currentView);
        }
        return next;
      },
      { replace: true }
    );
  };

  const hasActiveFilters = Boolean(
    statusParam !== 'all' ||
      categoryParam !== 'all' ||
      priorityParam !== 'all' ||
      searchUrlParam ||
      sortParam !== 'createdAt' ||
      orderParam !== 'desc'
  );

  // TanStack Query parameters (used for List view)
  const queryParams: TaskQueryParams = useMemo(() => {
    return {
      status: statusParam === 'all' ? undefined : statusParam,
      category: categoryParam === 'all' ? undefined : categoryParam,
      priority: priorityParam === 'all' ? undefined : priorityParam,
      search: searchUrlParam || undefined,
      sort: sortParam,
      order: orderParam,
      page: pageParam,
      limit: PAGE_LIMIT,
    };
  }, [statusParam, categoryParam, priorityParam, searchUrlParam, sortParam, orderParam, pageParam]);

  const { data, isLoading, isError, error, refetch } = useTasksQuery(queryParams, {
    enabled: isListView,
  });
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

  // Create or Update task submit
  const handleTaskSubmit = async (formData: CreateTaskInput | UpdateTaskInput) => {
    if (taskToEdit) {
      await updateTaskMutation.mutateAsync({
        id: taskToEdit.id,
        data: formData,
      });
      showToast('Task updated successfully', 'success');
    } else {
      await createTaskMutation.mutateAsync(formData as CreateTaskInput);
      showToast('Task created successfully', 'success');
    }
  };

  // Toggle done status
  const handleToggleDone = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await updateTaskMutation.mutateAsync({
        id: task.id,
        data: { status: newStatus },
      });
      showToast(
        newStatus === 'done' ? 'Task marked as done' : 'Task marked as to-do',
        'success'
      );
    } catch {
      showToast('Failed to update task status', 'error');
    }
  };

  // Delete task confirm
  const handleDeleteConfirm = async (id: string) => {
    try {
      await deleteTaskMutation.mutateAsync(id);
      showToast('Task deleted successfully', 'success');

      // Requirement 5: if deletion empties the current page, go back one page
      if (pageParam > 1 && data && data.tasks.length === 1) {
        handlePageChange(pageParam - 1);
      }
    } catch {
      showToast('Failed to delete task', 'error');
    }
  };

  const tasks = data?.tasks || [];
  const totalTasks = data?.total || 0;
  const totalPages = data?.totalPages || 0;

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Page Title & Create Task CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            My Tasks
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your daily tasks, track progress, and meet deadlines.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => {
            setTaskToEdit(null);
            setIsTaskModalOpen(true);
          }}
          className="self-start sm:self-auto shadow-md"
        >
          <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
          Add Task
        </Button>
      </div>

      {/* Search, Filter, Sort Controls */}
      <TaskControls
        search={searchInput}
        onSearchChange={setSearchInput}
        status={statusParam}
        onStatusChange={(val) => updateFilter('status', val)}
        category={categoryParam}
        onCategoryChange={(val) => updateFilter('category', val)}
        priority={priorityParam}
        onPriorityChange={(val) => updateFilter('priority', val)}
        sort={sortParam}
        onSortChange={(val) => updateFilter('sort', val)}
        order={orderParam}
        onOrderToggle={handleOrderToggle}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
        view={viewParam}
        onViewChange={handleViewChange}
      />

      {/* Main Content Area */}
      {isStatsView ? (
        <StatsDashboard
          onCreateTask={() => {
            setTaskToEdit(null);
            setIsTaskModalOpen(true);
          }}
        />
      ) : isBoardView ? (
        <KanbanBoard
          category={categoryParam}
          priority={priorityParam}
          search={searchUrlParam}
          onToggleDone={handleToggleDone}
          onEdit={(t) => {
            setTaskToEdit(t);
            setIsTaskModalOpen(true);
          }}
          onDelete={(t) => {
            setTaskToDelete(t);
            setIsDeleteModalOpen(true);
          }}
        />
      ) : isLoading ? (
        <div className="flex flex-col gap-3 my-2" data-testid="tasks-loading">
          <TaskSkeleton />
          <TaskSkeleton />
          <TaskSkeleton />
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center p-8 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-center gap-3"
        >
          <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" />
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
            {error instanceof Error ? error.message : 'Unable to load tasks.'}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            className="mt-1"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            Retry
          </Button>
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          isFiltered={hasActiveFilters}
          onClearFilters={handleResetFilters}
          onCreateTask={() => {
            setTaskToEdit(null);
            setIsTaskModalOpen(true);
          }}
        />
      ) : (
        <div className="flex flex-col gap-3" data-testid="task-list">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggleDone={handleToggleDone}
              onEdit={(t) => {
                setTaskToEdit(t);
                setIsTaskModalOpen(true);
              }}
              onDelete={(t) => {
                setTaskToDelete(t);
                setIsDeleteModalOpen(true);
              }}
              isToggling={updateTaskMutation.isPending}
            />
          ))}

          {/* Pagination Navigation */}
          <TaskPagination
            currentPage={pageParam}
            totalPages={totalPages}
            totalTasks={totalTasks}
            limit={PAGE_LIMIT}
            onPageChange={handlePageChange}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Task Create / Edit Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        taskToEdit={taskToEdit}
        onSubmit={handleTaskSubmit}
        isSubmitting={createTaskMutation.isPending || updateTaskMutation.isPending}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setTaskToDelete(null);
        }}
        task={taskToDelete}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteTaskMutation.isPending}
      />
    </div>
  );
}
