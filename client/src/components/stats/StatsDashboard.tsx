import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Percent,
  Plus,
  RefreshCw,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useTaskStatsQuery } from '../../hooks/useTasks.ts';
import { Button } from '../common/Button.tsx';
import type { TaskCategory } from '../../types/task.types.ts';

interface StatsDashboardProps {
  onCreateTask: () => void;
}

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  Work: '#3b82f6',
  Home: '#10b981',
  Personal: '#8b5cf6',
  Urgent: '#f43f5e',
  none: '#64748b',
};

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  Work: 'Work',
  Home: 'Home',
  Personal: 'Personal',
  Urgent: 'Urgent',
  none: 'Uncategorized',
};

export function StatsDashboard({ onCreateTask }: StatsDashboardProps) {
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const { data, isLoading, isError, error, refetch } = useTaskStatsQuery(days);

  const categoryChartData = useMemo(() => {
    if (!data?.byCategory) return [];
    return (Object.keys(data.byCategory) as TaskCategory[])
      .map((cat) => ({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        count: data.byCategory[cat] || 0,
        color: CATEGORY_COLORS[cat] || '#6c63ff',
      }))
      .filter((item) => item.count > 0);
  }, [data?.byCategory]);

  const formattedCompletedPerDay = useMemo(() => {
    if (!data?.completedPerDay) return [];
    return data.completedPerDay.map((item) => {
      const parts = item.date.split('-');
      const shortDate = parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : item.date;
      return {
        ...item,
        shortDate,
      };
    });
  }, [data?.completedPerDay]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="w-full flex flex-col gap-6" data-testid="stats-loading">
        {/* KPI Skeleton Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white dark:bg-[#252538] border border-slate-200/80 dark:border-white/10 animate-pulse"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700" />
              </div>
              <div className="w-16 h-8 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
              <div className="w-28 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>

        {/* Charts Skeleton Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#252538] border border-slate-200/80 dark:border-white/10 animate-pulse h-80" />
          <div className="p-5 rounded-2xl bg-white dark:bg-[#252538] border border-slate-200/80 dark:border-white/10 animate-pulse h-80" />
        </div>
      </div>
    );
  }

  // Error state with retry
  if (isError || !data) {
    return (
      <div
        role="alert"
        data-testid="stats-error"
        className="flex flex-col items-center justify-center p-8 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-center gap-3 my-4"
      >
        <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" />
        <h3 className="text-base font-semibold text-rose-900 dark:text-rose-300">
          Failed to load stats
        </h3>
        <p className="text-xs sm:text-sm text-rose-700 dark:text-rose-400 max-w-md">
          {error instanceof Error ? error.message : 'An unexpected error occurred while fetching task analytics.'}
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
    );
  }

  const { totals } = data;

  // Friendly Empty State when there are no tasks yet
  if (totals.total === 0) {
    return (
      <div
        data-testid="stats-empty"
        className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-white dark:bg-[#252538] border border-slate-200/80 dark:border-white/10 my-4 shadow-xs"
      >
        <div className="w-16 h-16 rounded-2xl bg-[#6c63ff]/10 dark:bg-[#6c63ff]/20 flex items-center justify-center text-[#6c63ff] mb-4">
          <Calendar className="w-8 h-8" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          No statistics available yet
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mb-6">
          Create your first task to start tracking your daily progress, completion rate, and category insights.
        </p>
        <Button type="button" variant="primary" size="md" onClick={onCreateTask}>
          <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
          Create First Task
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6" data-testid="stats-dashboard">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tasks */}
        <div
          data-testid="kpi-total"
          className="p-5 rounded-2xl bg-white dark:bg-[#252538] border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Tasks
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ClipboardList className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {totals.total}
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {totals.todo} to-do &bull; {totals.inProgress} in progress
            </p>
          </div>
        </div>

        {/* Completed Tasks */}
        <div
          data-testid="kpi-done"
          className="p-5 rounded-2xl bg-white dark:bg-[#252538] border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Completed
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {totals.done}
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Finished successfully
            </p>
          </div>
        </div>

        {/* Overdue Tasks */}
        <div
          data-testid="kpi-overdue"
          className="p-5 rounded-2xl bg-white dark:bg-[#252538] border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Overdue
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                totals.overdue > 0
                  ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-400'
              }`}
            >
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`text-3xl font-extrabold ${
                totals.overdue > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {totals.overdue}
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {totals.overdue > 0 ? 'Past deadline' : 'No overdue tasks'}
            </p>
          </div>
        </div>

        {/* Completion Rate */}
        <div
          data-testid="kpi-rate"
          className="p-5 rounded-2xl bg-white dark:bg-[#252538] border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Completion Rate
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#6c63ff]/10 dark:bg-[#6c63ff]/20 text-[#6c63ff] flex items-center justify-center">
              <Percent className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-[#6c63ff]">
                {totals.completionRate}%
              </span>
            </div>
            {/* Visual progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-[#6c63ff] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, totals.completionRate))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Tasks Completed Per Day */}
        <div
          role="region"
          aria-label="Completed tasks per day chart"
          className="p-5 rounded-2xl bg-white dark:bg-[#252538] border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-col"
        >
          {/* Header & Days Selector Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Completion Trend
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tasks marked done per day
              </p>
            </div>

            {/* Days Toggle (7, 14, 30) */}
            <div
              role="group"
              aria-label="Time range selector"
              className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#1e1e2f] border border-slate-200 dark:border-white/10 shrink-0 self-start sm:self-auto"
            >
              {([7, 14, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  data-testid={`range-${d}d`}
                  onClick={() => setDays(d)}
                  aria-pressed={days === d}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    days === d
                      ? 'bg-white dark:bg-[#252538] text-[#6c63ff] shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {d}D
                </button>
              ))}
            </div>
          </div>

          {/* Recharts Bar Chart */}
          <div className="w-full h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={formattedCompletedPerDay}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-slate-200 dark:stroke-slate-700/60"
                  vertical={false}
                />
                <XAxis
                  dataKey="shortDate"
                  tick={{ fontSize: 11 }}
                  className="text-slate-400 dark:text-slate-500"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  className="text-slate-400 dark:text-slate-500"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(108, 99, 255, 0.08)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="p-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs shadow-lg border border-slate-700 dark:border-slate-200">
                          <p className="font-semibold">{item.date}</p>
                          <p className="mt-0.5 text-[#6c63ff] font-bold">
                            {item.count} {item.count === 1 ? 'task' : 'tasks'} completed
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Completed"
                  fill="#6c63ff"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Visually hidden accessible data table alternative */}
          <div className="sr-only">
            <table>
              <caption>Tasks completed per day over the last {days} days</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Completed Tasks</th>
                </tr>
              </thead>
              <tbody>
                {data.completedPerDay.map((d) => (
                  <tr key={d.date}>
                    <td>{d.date}</td>
                    <td>{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart 2: Tasks by Category */}
        <div
          role="region"
          aria-label="Tasks by category chart"
          className="p-5 rounded-2xl bg-white dark:bg-[#252538] border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-col"
        >
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Category Distribution
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Breakdown of all tasks by category
            </p>
          </div>

          {categoryChartData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-slate-400">
              No categorized tasks to display.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
              {/* Donut Chart */}
              <div className="w-48 h-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={74}
                      paddingAngle={3}
                    >
                      {categoryChartData.map((entry) => (
                        <Cell key={entry.category} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          const pct = totals.total > 0 ? Math.round((item.count / totals.total) * 100) : 0;
                          return (
                            <div className="p-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs shadow-lg border border-slate-700 dark:border-slate-200">
                              <p className="font-semibold">{item.label}</p>
                              <p className="mt-0.5" style={{ color: item.color }}>
                                {item.count} tasks ({pct}%)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Accessible Legend & Badges (does not rely on color alone) */}
              <div className="flex-1 flex flex-col gap-2 w-full">
                {categoryChartData.map((item) => {
                  const pct = totals.total > 0 ? Math.round((item.count / totals.total) * 100) : 0;
                  return (
                    <div
                      key={item.category}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-[#1e1e2f] border border-slate-200/60 dark:border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                          aria-hidden="true"
                        />
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {item.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-semibold">
                        <span className="text-slate-900 dark:text-white">{item.count}</span>
                        <span className="text-slate-400 dark:text-slate-500 font-normal">
                          ({pct}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Visually hidden accessible data table alternative */}
          <div className="sr-only">
            <table>
              <caption>Tasks grouped by category</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Count</th>
                  <th scope="col">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {categoryChartData.map((item) => {
                  const pct = totals.total > 0 ? Math.round((item.count / totals.total) * 100) : 0;
                  return (
                    <tr key={item.category}>
                      <td>{item.label}</td>
                      <td>{item.count}</td>
                      <td>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
