import { Search, ArrowUpDown, X, LayoutList, Columns3, BarChart3 } from 'lucide-react';
import type {
  TaskCategory,
  TaskPriority,
  TaskSortField,
  TaskStatus,
  SortOrder,
  TaskViewMode,
} from '../../types/task.types.ts';

interface TaskControlsProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: TaskStatus | 'all';
  onStatusChange: (status: TaskStatus | 'all') => void;
  category: TaskCategory | 'all';
  onCategoryChange: (category: TaskCategory | 'all') => void;
  priority: TaskPriority | 'all';
  onPriorityChange: (priority: TaskPriority | 'all') => void;
  sort: TaskSortField;
  onSortChange: (sort: TaskSortField) => void;
  order: SortOrder;
  onOrderToggle: () => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  view: TaskViewMode;
  onViewChange: (view: TaskViewMode) => void;
}

export function TaskControls({
  search,
  onSearchChange,
  status,
  onStatusChange,
  category,
  onCategoryChange,
  priority,
  onPriorityChange,
  sort,
  onSortChange,
  order,
  onOrderToggle,
  onResetFilters,
  hasActiveFilters,
  view,
  onViewChange,
}: TaskControlsProps) {
  const isBoardView = view === 'board';
  const isStatsView = view === 'stats';

  const viewToggleGroup = (
    <div
      role="group"
      aria-label="View mode toggle"
      className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#1e1e2f] border border-slate-200 dark:border-white/10 shrink-0"
    >
      <button
        type="button"
        data-testid="view-toggle-list"
        onClick={() => onViewChange('list')}
        aria-pressed={view === 'list'}
        aria-label="List view"
        title="List view"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
          view === 'list'
            ? 'bg-white dark:bg-[#252538] text-[#6c63ff] shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <LayoutList className="w-4 h-4" aria-hidden="true" />
        <span>List</span>
      </button>
      <button
        type="button"
        data-testid="view-toggle-board"
        onClick={() => onViewChange('board')}
        aria-pressed={view === 'board'}
        aria-label="Board view"
        title="Board view"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
          view === 'board'
            ? 'bg-white dark:bg-[#252538] text-[#6c63ff] shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Columns3 className="w-4 h-4" aria-hidden="true" />
        <span>Board</span>
      </button>
      <button
        type="button"
        data-testid="view-toggle-stats"
        onClick={() => onViewChange('stats')}
        aria-pressed={view === 'stats'}
        aria-label="Stats view"
        title="Stats view"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
          view === 'stats'
            ? 'bg-white dark:bg-[#252538] text-[#6c63ff] shadow-xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <BarChart3 className="w-4 h-4" aria-hidden="true" />
        <span>Stats</span>
      </button>
    </div>
  );

  if (isStatsView) {
    return (
      <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#252538] border border-slate-200/80 dark:border-white/10 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Analytics & Insights</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Track task completion trends and performance breakdown</p>
        </div>
        {viewToggleGroup}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3.5 p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#252538] border border-slate-200/80 dark:border-white/10 shadow-xs">
      {/* Top Row: Search, View Toggle, and Sort Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <label htmlFor="task-search-input" className="sr-only">
            Search tasks
          </label>
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="task-search-input"
            type="search"
            placeholder="Search tasks by title..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-9 py-2 rounded-xl text-sm bg-slate-50 dark:bg-[#1e1e2f] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:border-[#6c63ff] focus-visible:ring-2 focus-visible:ring-[#6c63ff]/30 transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search text"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* View Toggle (List vs Board vs Stats) */}
        {viewToggleGroup}

        {/* Sort Field & Order Toggle (Shown in List view) */}
        {!isBoardView && (
          <div className="flex items-center gap-2">
            <label htmlFor="task-sort-select" className="sr-only">
              Sort by
            </label>
            <select
              id="task-sort-select"
              value={sort}
              onChange={(e) => onSortChange(e.target.value as TaskSortField)}
              className="px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-[#1e1e2f] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:border-[#6c63ff] focus-visible:ring-2 focus-visible:ring-[#6c63ff]/30 cursor-pointer"
            >
              <option value="createdAt">Date Created</option>
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
            </select>

            <button
              type="button"
              onClick={onOrderToggle}
              aria-label={`Sort order: currently ${order === 'asc' ? 'ascending' : 'descending'}. Click to toggle.`}
              className="p-2 rounded-xl bg-slate-50 dark:bg-[#1e1e2f] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff]"
              title={`Sort order: ${order.toUpperCase()}`}
            >
              <ArrowUpDown className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Row: Filter Dropdowns and Reset */}
      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-white/5">
        {/* Status Filter (Hidden in Board View per Requirement 7) */}
        {!isBoardView && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <label htmlFor="status-filter" className="font-medium shrink-0">
              Status:
            </label>
            <select
              id="status-filter"
              value={status}
              onChange={(e) => onStatusChange(e.target.value as TaskStatus | 'all')}
              className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-[#1e1e2f] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff]/30 cursor-pointer"
            >
              <option value="all">All</option>
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
        )}

        {/* Category Filter */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <label htmlFor="category-filter" className="font-medium shrink-0">
            Category:
          </label>
          <select
            id="category-filter"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value as TaskCategory | 'all')}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-[#1e1e2f] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff]/30 cursor-pointer"
          >
            <option value="all">All</option>
            <option value="Work">Work</option>
            <option value="Home">Home</option>
            <option value="Personal">Personal</option>
            <option value="Urgent">Urgent</option>
            <option value="none">None</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <label htmlFor="priority-filter" className="font-medium shrink-0">
            Priority:
          </label>
          <select
            id="priority-filter"
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value as TaskPriority | 'all')}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-[#1e1e2f] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff]/30 cursor-pointer"
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="ml-auto text-xs font-semibold text-[#6c63ff] hover:text-[#5750d6] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff] rounded-sm cursor-pointer"
          >
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}
