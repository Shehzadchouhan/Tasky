import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { KanbanBoard } from '../components/tasks/KanbanBoard.tsx';
import { DashboardPage } from '../pages/DashboardPage.tsx';
import { ToastProvider } from '../context/ToastContext.tsx';
import { useSerializedReorderTasks } from '../hooks/useTasks.ts';
import { tasksApi } from '../api/tasks.api.ts';
import type { Task, TasksResponse } from '../types/task.types.ts';

// Mock tasksApi
vi.mock('../api/tasks.api.ts', () => ({
  tasksApi: {
    getTasks: vi.fn(),
    reorderTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

describe('KanbanBoard & Reorder Support', () => {
  let queryClient: QueryClient;

  const mockTodoTasks: Task[] = [
    {
      id: 'task-1',
      title: 'First Todo Task',
      description: 'First description',
      category: 'Work',
      priority: 'high',
      priorityRank: 3,
      status: 'todo',
      dueDate: null,
      hasDueDate: false,
      order: 0,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'task-2',
      title: 'Second Todo Task',
      description: 'Second description',
      category: 'Personal',
      priority: 'medium',
      priorityRank: 2,
      status: 'todo',
      dueDate: null,
      hasDueDate: false,
      order: 1,
      createdAt: '2026-10-01T01:00:00.000Z',
      updatedAt: '2026-10-01T01:00:00.000Z',
    },
  ];

  const mockInProgressTasks: Task[] = [
    {
      id: 'task-3',
      title: 'In Progress Task',
      description: 'Progress description',
      category: 'Work',
      priority: 'low',
      priorityRank: 1,
      status: 'in-progress',
      dueDate: null,
      hasDueDate: false,
      order: 0,
      createdAt: '2026-10-01T02:00:00.000Z',
      updatedAt: '2026-10-01T02:00:00.000Z',
    },
  ];

  const mockDoneTasks: Task[] = [
    {
      id: 'task-4',
      title: 'Done Task',
      description: 'Done description',
      category: 'Home',
      priority: 'medium',
      priorityRank: 2,
      status: 'done',
      dueDate: null,
      hasDueDate: false,
      order: 0,
      createdAt: '2026-10-01T03:00:00.000Z',
      updatedAt: '2026-10-01T03:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Infinity,
        },
      },
    });

    // Default mock implementation: return tasks based on status param
    vi.mocked(tasksApi.getTasks).mockImplementation(async (params) => {
      if (params?.status === 'todo') {
        return {
          tasks: mockTodoTasks,
          total: mockTodoTasks.length,
          page: 1,
          totalPages: 1,
        };
      }
      if (params?.status === 'in-progress') {
        return {
          tasks: mockInProgressTasks,
          total: mockInProgressTasks.length,
          page: 1,
          totalPages: 1,
        };
      }
      if (params?.status === 'done') {
        return {
          tasks: mockDoneTasks,
          total: mockDoneTasks.length,
          page: 1,
          totalPages: 1,
        };
      }
      return {
        tasks: [...mockTodoTasks, ...mockInProgressTasks, ...mockDoneTasks],
        total: 4,
        page: 1,
        totalPages: 1,
      };
    });
  });

  const renderKanbanBoard = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <KanbanBoard
            category="all"
            priority="all"
            search=""
            onToggleDone={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            {...props}
          />
        </ToastProvider>
      </QueryClientProvider>
    );
  };

  it('renders all 3 columns (To Do, In Progress, Done) with correct titles and count pills', async () => {
    renderKanbanBoard();

    await waitFor(() => {
      expect(screen.getByTestId('kanban-column-todo')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-column-in-progress')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-column-done')).toBeInTheDocument();
    });

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();

    expect(screen.getByTestId('column-count-todo')).toHaveTextContent('2');
    expect(screen.getByTestId('column-count-in-progress')).toHaveTextContent('1');
    expect(screen.getByTestId('column-count-done')).toHaveTextContent('1');

    expect(screen.getByText('First Todo Task')).toBeInTheDocument();
    expect(screen.getByText('Second Todo Task')).toBeInTheDocument();
    expect(screen.getByText('In Progress Task')).toBeInTheDocument();
    expect(screen.getByText('Done Task')).toBeInTheDocument();
  });

  it('disables drag-and-drop and shows explanatory banner when filter or search is active', async () => {
    renderKanbanBoard({ search: 'First' });

    await waitFor(() => {
      expect(screen.getByTestId('filter-disabled-banner')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Drag-and-drop reordering is disabled while search or filters are active/i)
    ).toBeInTheDocument();

    const handle = screen.getByLabelText(/Drag handle for First Todo Task/i);
    expect(handle).toBeDisabled();
  });

  it('displays "Showing X of N" warning pill and disables dragging when column has more tasks than loaded', async () => {
    vi.mocked(tasksApi.getTasks).mockImplementation(async (params) => {
      if (params?.status === 'todo') {
        return {
          tasks: mockTodoTasks,
          total: 10, // 10 total but only 2 loaded!
          page: 1,
          totalPages: 1,
        };
      }
      return {
        tasks: [],
        total: 0,
        page: 1,
        totalPages: 0,
      };
    });

    renderKanbanBoard();

    await waitFor(() => {
      expect(screen.getByTestId('truncated-warning-todo')).toBeInTheDocument();
    });

    expect(screen.getByText('Showing 2 of 10')).toBeInTheDocument();

    const handle = screen.getByLabelText(/Drag handle for First Todo Task/i);
    expect(handle).toBeDisabled();
  });

  it('performs optimistic rollback and shows error toast when reordering fails on server', async () => {
    vi.mocked(tasksApi.reorderTasks).mockRejectedValueOnce(new Error('Network error during reorder'));

    const tasksMap = new Map<string, Task>();
    mockTodoTasks.forEach((t) => tasksMap.set(t.id, t));

    // Initialize the query cache for todo
    const queryKey = [
      'tasks',
      {
        status: 'todo',
        category: undefined,
        priority: undefined,
        search: undefined,
        sort: 'order',
        order: 'asc',
        limit: 50,
        page: 1,
      },
    ];

    queryClient.setQueryData(queryKey, {
      tasks: [...mockTodoTasks],
      total: 2,
      page: 1,
      totalPages: 1,
    });

    let hookResult: ReturnType<typeof useSerializedReorderTasks> | undefined;
    function TestHookComponent() {
      hookResult = useSerializedReorderTasks();
      return <div>Hook Ready</div>;
    }

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <TestHookComponent />
        </ToastProvider>
      </QueryClientProvider>
    );

    // Call reorderTasks with reversed order inside act
    await act(async () => {
      try {
        await hookResult!.reorderTasks({
          targetStatus: 'todo',
          targetOrderedIds: ['task-2', 'task-1'],
          tasksMap,
        });
      } catch {
        // expected failure
      }
    });

    // Verify error toast appears in DOM
    await waitFor(() => {
      const toast = screen.getByRole('status');
      expect(toast).toHaveTextContent(/Network error during reorder|Failed to reorder tasks/i);
    });

    // Verify cache rolled back to original order ['task-1', 'task-2']
    const cachedData = queryClient.getQueryData<TasksResponse>(queryKey);
    expect(cachedData?.tasks.map((t) => t.id)).toEqual(['task-1', 'task-2']);
  });

  it('DashboardPage: keeps view choice in URL, hides status filter and pagination in board view', async () => {
    render(
      <MemoryRouter initialEntries={['/?view=board']}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <DashboardPage />
          </ToastProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('kanban-board-container')).toBeInTheDocument();
    });

    // Requirement 7: In board view, hide status filter and pagination bar
    expect(screen.queryByLabelText(/^Status:/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Pagination/i)).not.toBeInTheDocument();

    // Verify View Toggle indicates Board is active
    const boardBtn = screen.getByTestId('view-toggle-board');
    expect(boardBtn).toHaveAttribute('aria-pressed', 'true');

    // Click List view toggle
    const user = userEvent.setup();
    const listBtn = screen.getByTestId('view-toggle-list');
    await user.click(listBtn);

    // In list view: status filter is visible!
    await waitFor(() => {
      expect(screen.getByLabelText(/^Status:/i)).toBeInTheDocument();
    });
  });
});
