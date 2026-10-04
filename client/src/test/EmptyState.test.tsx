import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '../components/tasks/EmptyState.tsx';

describe('EmptyState Component', () => {
  it('renders default empty state when no tasks exist', () => {
    render(<EmptyState isFiltered={false} onCreateTask={vi.fn()} />);

    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
    expect(
      screen.getByText(/You are all caught up! Create your first task/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create task/i })).toBeInTheDocument();
  });

  it('renders filtered empty state when search or filters return no results', () => {
    const handleClear = vi.fn();
    render(<EmptyState isFiltered={true} onClearFilters={handleClear} />);

    expect(screen.getByText('No tasks match your filters')).toBeInTheDocument();
    expect(
      screen.getByText(/Try adjusting your search query, status, priority/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear filters/i })).toBeInTheDocument();
  });

  it('calls onClearFilters when clear filters button is clicked', async () => {
    const user = userEvent.setup();
    const handleClear = vi.fn();
    render(<EmptyState isFiltered={true} onClearFilters={handleClear} />);

    const clearButton = screen.getByRole('button', { name: /Clear filters/i });
    await user.click(clearButton);

    expect(handleClear).toHaveBeenCalledTimes(1);
  });
});
