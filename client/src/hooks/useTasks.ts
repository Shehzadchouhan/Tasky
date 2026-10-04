import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { tasksApi } from '../api/tasks.api.ts';
import type {
  CreateTaskInput,
  TaskQueryParams,
  TasksResponse,
  UpdateTaskInput,
} from '../types/task.types.ts';

export function useTasksQuery(params: TaskQueryParams) {
  return useQuery<TasksResponse>({
    queryKey: ['tasks', params],
    queryFn: () => tasksApi.getTasks(params),
    placeholderData: keepPreviousData,
  });
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
