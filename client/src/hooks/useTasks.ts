import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { tasksApi } from '../api/tasks.api.ts';
import { useToast } from './useToast.ts';
import type {
  CreateTaskInput,
  Task,
  TaskCategory,
  TaskPriority,
  TaskQueryParams,
  TasksResponse,
  TaskStatus,
  UpdateTaskInput,
} from '../types/task.types.ts';

export function useTasksQuery(
  params: TaskQueryParams,
  options?: { enabled?: boolean }
) {
  return useQuery<TasksResponse>({
    queryKey: ['tasks', params],
    queryFn: () => tasksApi.getTasks(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  });
}

const EMPTY_TASKS: Task[] = [];

export function useBoardColumnsQuery(
  filters: {
    category?: TaskCategory;
    priority?: TaskPriority;
    search?: string;
  },
  limit = 50
) {
  const todoQuery = useTasksQuery({
    status: 'todo',
    category: filters.category,
    priority: filters.priority,
    search: filters.search,
    sort: 'order',
    order: 'asc',
    limit,
    page: 1,
  });

  const inProgressQuery = useTasksQuery({
    status: 'in-progress',
    category: filters.category,
    priority: filters.priority,
    search: filters.search,
    sort: 'order',
    order: 'asc',
    limit,
    page: 1,
  });

  const doneQuery = useTasksQuery({
    status: 'done',
    category: filters.category,
    priority: filters.priority,
    search: filters.search,
    sort: 'order',
    order: 'asc',
    limit,
    page: 1,
  });

  return {
    columns: {
      todo: todoQuery.data?.tasks || EMPTY_TASKS,
      'in-progress': inProgressQuery.data?.tasks || EMPTY_TASKS,
      done: doneQuery.data?.tasks || EMPTY_TASKS,
    },
    totals: {
      todo: todoQuery.data?.total || 0,
      'in-progress': inProgressQuery.data?.total || 0,
      done: doneQuery.data?.total || 0,
    },
    queries: {
      todo: todoQuery,
      'in-progress': inProgressQuery,
      done: doneQuery,
    },
    isLoading: todoQuery.isLoading || inProgressQuery.isLoading || doneQuery.isLoading,
    isError: todoQuery.isError || inProgressQuery.isError || doneQuery.isError,
    error: todoQuery.error || inProgressQuery.error || doneQuery.error,
    refetch: () => {
      todoQuery.refetch();
      inProgressQuery.refetch();
      doneQuery.refetch();
    },
  };
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskInput) => tasksApi.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskInput }) =>
      tasksApi.updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// Module-level queue state for serialized reorder mutations
let inFlightReorders = 0;
let reorderPromiseChain: Promise<any> = Promise.resolve();
let snapshotData: [readonly unknown[], unknown][] | null = null;

export interface SerializedReorderParams {
  targetStatus: TaskStatus;
  targetOrderedIds: string[];
  sourceStatus?: TaskStatus;
  sourceOrderedIds?: string[];
  // Map of all task objects for quick cache synthesis
  tasksMap: Map<string, Task>;
}

export function useSerializedReorderTasks() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const reorderTasks = async ({
    targetStatus,
    targetOrderedIds,
    sourceStatus,
    sourceOrderedIds,
    tasksMap,
  }: SerializedReorderParams): Promise<void> => {
    inFlightReorders++;

    if (inFlightReorders === 1) {
      // Cancel outgoing queries and snapshot current cache
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      snapshotData = queryClient.getQueriesData({ queryKey: ['tasks'] });
    }

    // Apply optimistic updates to matching queries in the cache
    queryClient.setQueriesData<TasksResponse>({ queryKey: ['tasks'] }, (oldData) => {
      if (!oldData) return oldData;

      // Check if this query is a status-specific query
      // Look through query cache entries
      return oldData;
    });

    // Specifically update the status-scoped queries in the TanStack cache
    const updateColumnCache = (
      status: TaskStatus,
      orderedIds: string[],
      newStatusForItems: TaskStatus
    ) => {
      const matchingQueries = queryClient.getQueryCache().findAll({ queryKey: ['tasks'] });

      for (const query of matchingQueries) {
        const queryKey = query.queryKey as [string, TaskQueryParams | undefined];
        const params = queryKey[1];

        if (params && params.status === status) {
          const oldData = query.state.data as TasksResponse | undefined;
          if (!oldData) continue;

          const updatedTasks: Task[] = [];
          for (let index = 0; index < orderedIds.length; index++) {
            const id = orderedIds[index];
            const existing = tasksMap.get(id);
            if (existing) {
              updatedTasks.push({
                ...existing,
                status: newStatusForItems,
                order: index,
              });
            }
          }

          queryClient.setQueryData<TasksResponse>(query.queryKey, {
            ...oldData,
            tasks: updatedTasks,
            total: updatedTasks.length,
          });
        }
      }
    };

    // Update target column
    updateColumnCache(targetStatus, targetOrderedIds, targetStatus);

    // If cross-column move, also update source column
    if (sourceStatus && sourceStatus !== targetStatus && sourceOrderedIds) {
      updateColumnCache(sourceStatus, sourceOrderedIds, sourceStatus);
    }

    // Chain the network mutation to ensure only one in-flight request at a time
    const executeMutation = async () => {
      try {
        await tasksApi.reorderTasks({
          status: targetStatus,
          orderedIds: targetOrderedIds,
        });

        if (sourceStatus && sourceStatus !== targetStatus && sourceOrderedIds) {
          await tasksApi.reorderTasks({
            status: sourceStatus,
            orderedIds: sourceOrderedIds,
          });
        }
      } catch (err) {
        // Rollback immediately on error
        if (snapshotData) {
          for (const [key, value] of snapshotData) {
            queryClient.setQueryData(key, value);
          }
        }
        showToast(
          err instanceof Error ? err.message : 'Failed to reorder tasks. Reverting changes.',
          'error'
        );
        throw err;
      } finally {
        inFlightReorders--;
        if (inFlightReorders === 0) {
          snapshotData = null;
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
      }
    };

    const taskPromise = reorderPromiseChain.then(executeMutation, executeMutation);
    reorderPromiseChain = taskPromise.catch(() => {});
    return taskPromise;
  };

  return { reorderTasks };
}
