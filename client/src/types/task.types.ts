export type TaskCategory = 'Work' | 'Home' | 'Personal' | 'Urgent' | 'none';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in-progress' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  priorityRank: number;
  status: TaskStatus;
  dueDate: string | null;
  hasDueDate: boolean;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
}

export type TaskSortField = 'createdAt' | 'dueDate' | 'priority' | 'order';
export type SortOrder = 'asc' | 'desc';
export type TaskViewMode = 'list' | 'board';

export interface ReorderTasksInput {
  status: TaskStatus;
  orderedIds: string[];
}

export interface ReorderTasksResponse {
  message: string;
}

export interface TaskQueryParams {
  status?: TaskStatus;
  category?: TaskCategory;
  priority?: TaskPriority;
  search?: string;
  sort?: TaskSortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}

export interface TasksResponse {
  tasks: Task[];
  total: number;
  page: number;
  totalPages: number;
}

export interface SingleTaskResponse {
  task: Task;
}

export interface DeleteTaskResponse {
  message: string;
}
