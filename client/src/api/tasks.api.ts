import { apiClient } from './client.ts';
import type {
  CreateTaskInput,
  DeleteTaskResponse,
  ReorderTasksInput,
  ReorderTasksResponse,
  SingleTaskResponse,
  TaskQueryParams,
  TasksResponse,
  TaskStatsResponse,
  UpdateTaskInput,
} from '../types/task.types.ts';

export const tasksApi = {
  getTasks: async (params?: TaskQueryParams): Promise<TasksResponse> => {
    const searchParams = new URLSearchParams();

    if (params) {
      if (params.status && params.status !== undefined) {
        searchParams.set('status', params.status);
      }
      if (params.category && params.category !== undefined) {
        searchParams.set('category', params.category);
      }
      if (params.priority && params.priority !== undefined) {
        searchParams.set('priority', params.priority);
      }
      if (params.search && params.search.trim()) {
        searchParams.set('search', params.search.trim());
      }
      if (params.sort) {
        searchParams.set('sort', params.sort);
      }
      if (params.order) {
        searchParams.set('order', params.order);
      }
      if (params.page !== undefined) {
        searchParams.set('page', String(params.page));
      }
      if (params.limit !== undefined) {
        searchParams.set('limit', String(params.limit));
      }
    }

    const query = searchParams.toString();
    const endpoint = query ? `/tasks?${query}` : '/tasks';
    return apiClient<TasksResponse>(endpoint, { method: 'GET' });
  },

  getStats: async (days: 7 | 14 | 30 = 7): Promise<TaskStatsResponse> => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const query = new URLSearchParams({ tz, days: String(days) }).toString();
    return apiClient<TaskStatsResponse>(`/tasks/stats?${query}`, { method: 'GET' });
  },

  getTaskById: async (id: string): Promise<SingleTaskResponse> => {
    return apiClient<SingleTaskResponse>(`/tasks/${id}`, { method: 'GET' });
  },

  createTask: async (data: CreateTaskInput): Promise<SingleTaskResponse> => {
    return apiClient<SingleTaskResponse>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateTask: async (id: string, data: UpdateTaskInput): Promise<SingleTaskResponse> => {
    return apiClient<SingleTaskResponse>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteTask: async (id: string): Promise<DeleteTaskResponse> => {
    return apiClient<DeleteTaskResponse>(`/tasks/${id}`, {
      method: 'DELETE',
    });
  },

  reorderTasks: async (data: ReorderTasksInput): Promise<ReorderTasksResponse> => {
    return apiClient<ReorderTasksResponse>('/tasks/reorder', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
