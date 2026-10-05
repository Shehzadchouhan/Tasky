import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatsDashboard } from '../components/stats/StatsDashboard.tsx';
import { tasksApi } from '../api/tasks.api.ts';
import type { TaskStatsResponse } from '../types/task.types.ts';

// Mock Recharts ResponsiveContainer to render children reliably in JSDOM
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 500, height: 300 }}>{children}</div>
    ),
  };
});

// Mock tasksApi
vi.mock('../api/tasks.api.ts', () => ({
  tasksApi: {
    getStats: vi.fn(),
  },
}));

describe('StatsDashboard Component', () => {
  let queryClient: QueryClient;
  const mockOnCreateTask = vi.fn();

  const mockStatsData: TaskStatsResponse = {
    totals: {
      total: 10,
      todo: 4,
      inProgress: 3,
      done: 3,
      overdue: 2,
      completionRate: 30,
    },
    completedPerDay: [
      { date: '2026-09-29', count: 0 },
      { date: '2026-09-30', count: 1 },
      { date: '2026-10-01', count: 0 },
      { date: '2026-10-02', count: 0 },
      { date: '2026-10-03', count: 1 },
      { date: '2026-10-04', count: 0 },
      { date: '2026-10-05', count: 1 },
    ],
    byCategory: {
      Work: 5,
      Home: 2,
      Personal: 2,
      Urgent: 1,
      none: 0,
    },
    byPriority: {
      low: 2,
      medium: 5,
      high: 3,
    },
  };

  const mockEmptyStatsData: TaskStatsResponse = {
    totals: {
      total: 0,
      todo: 0,
      inProgress: 0,
      done: 0,
      overdue: 0,
      completionRate: 0,
    },
    completedPerDay: [
      { date: '2026-09-29', count: 0 },
      { date: '2026-09-30', count: 0 },
      { date: '2026-10-01', count: 0 },
      { date: '2026-10-02', count: 0 },
      { date: '2026-10-03', count: 0 },
      { date: '2026-10-04', count: 0 },
      { date: '2026-10-05', count: 0 },
    ],
    byCategory: {
      Work: 0,
      Home: 0,
      Personal: 0,
      Urgent: 0,
      none: 0,
    },
    byPriority: {
      low: 0,
      medium: 0,
      high: 0,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <StatsDashboard onCreateTask={mockOnCreateTask} />
      </QueryClientProvider>
    );

  it('renders loading skeleton while query is in progress', () => {
    vi.mocked(tasksApi.getStats).mockReturnValue(new Promise(() => {})); // Never resolves
    renderComponent();

    expect(screen.getByTestId('stats-loading')).toBeInTheDocument();
  });

  it('renders KPI cards with accurate mock data values', async () => {
    vi.mocked(tasksApi.getStats).mockResolvedValue(mockStatsData);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('stats-dashboard')).toBeInTheDocument();
    });

    // Check KPI cards
    const totalCard = screen.getByTestId('kpi-total');
    expect(totalCard).toHaveTextContent('10');
    expect(totalCard).toHaveTextContent('4 to-do • 3 in progress');

    const doneCard = screen.getByTestId('kpi-done');
    expect(doneCard).toHaveTextContent('3');

    const overdueCard = screen.getByTestId('kpi-overdue');
    expect(overdueCard).toHaveTextContent('2');

    const rateCard = screen.getByTestId('kpi-rate');
    expect(rateCard).toHaveTextContent('30%');
  });

  it('renders accessible data table alternatives for screen readers', async () => {
    vi.mocked(tasksApi.getStats).mockResolvedValue(mockStatsData);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('stats-dashboard')).toBeInTheDocument();
    });

    // Chart regions
    expect(screen.getByRole('region', { name: /completed tasks per day chart/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /tasks by category chart/i })).toBeInTheDocument();

    // Accessible tables
    expect(screen.getByText(/tasks completed per day over the last 7 days/i)).toBeInTheDocument();
    expect(screen.getByText(/tasks grouped by category/i)).toBeInTheDocument();
  });

  it('renders friendly empty state when user has zero tasks and triggers onCreateTask CTA', async () => {
    vi.mocked(tasksApi.getStats).mockResolvedValue(mockEmptyStatsData);
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('stats-empty')).toBeInTheDocument();
    });

    expect(screen.getByText(/no statistics available yet/i)).toBeInTheDocument();
    const ctaButton = screen.getByRole('button', { name: /create first task/i });
    expect(ctaButton).toBeInTheDocument();

    await user.click(ctaButton);
    expect(mockOnCreateTask).toHaveBeenCalledTimes(1);
  });

  it('renders error state on API failure and retries when clicking retry', async () => {
    vi.mocked(tasksApi.getStats).mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('stats-error')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /failed to load stats/i })).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();

    // Now mock success for retry
    vi.mocked(tasksApi.getStats).mockResolvedValueOnce(mockStatsData);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByTestId('stats-dashboard')).toBeInTheDocument();
    });
    expect(screen.getByTestId('kpi-total')).toHaveTextContent('10');
  });

  it('switches time range (7D, 14D, 30D) and refetches', async () => {
    vi.mocked(tasksApi.getStats).mockResolvedValue(mockStatsData);
    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('stats-dashboard')).toBeInTheDocument();
    });

    expect(tasksApi.getStats).toHaveBeenCalledWith(7);

    // Click 14D button
    const btn14 = screen.getByTestId('range-14d');
    await user.click(btn14);

    await waitFor(() => {
      expect(tasksApi.getStats).toHaveBeenCalledWith(14);
    });

    // Click 30D button
    const btn30 = screen.getByTestId('range-30d');
    await user.click(btn30);

    await waitFor(() => {
      expect(tasksApi.getStats).toHaveBeenCalledWith(30);
    });
  });
});
