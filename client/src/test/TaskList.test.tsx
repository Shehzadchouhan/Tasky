import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskCard } from '../components/tasks/TaskCard.tsx';
import type { Task } from '../types/task.types.ts';

describe('TaskCard & Task List rendering', () => {
  const sampleTask: Task = {
    id: '65f1a2b3c4d5e6f7a8b9c0d1',
    title: 'Deploy Production Release',
    description: 'Prepare staging build and deploy to cluster',
    category: 'Work',
    priority: 'high',
    priorityRank: 3,
    status: 'todo',
    dueDate: '2026-10-03T10:00:00.000Z', // Yesterday relative to 2026-10-04
    hasDueDate: true,
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  };

  it('renders task details correctly including badges', () => {
    render(
      <TaskCard
        task={sampleTask}
        onToggleDone={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Deploy Production Release')).toBeInTheDocument();
    expect(screen.getByText('Prepare staging build and deploy to cluster')).toBeInTheDocument();
    expect(screen.getByText('High Priority')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();
  });

  it('displays red Overdue badge when due date is past and status is not done', () => {
    render(
      <TaskCard
        task={sampleTask}
        onToggleDone={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId('overdue-badge')).toBeInTheDocument();
    expect(screen.getByText(/Overdue/i)).toBeInTheDocument();
  });

  it('does NOT display Overdue badge when task status is done', () => {
    const doneTask: Task = {
      ...sampleTask,
      status: 'done',
    };

    render(
      <TaskCard
        task={doneTask}
        onToggleDone={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByTestId('overdue-badge')).not.toBeInTheDocument();
  });

  it('triggers onToggleDone callback when check button is clicked', async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();

    render(
      <TaskCard
        task={sampleTask}
        onToggleDone={handleToggle}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const toggleButton = screen.getByRole('button', {
      name: /Mark "Deploy Production Release" as done/i,
    });
    await user.click(toggleButton);

    expect(handleToggle).toHaveBeenCalledTimes(1);
    expect(handleToggle).toHaveBeenCalledWith(sampleTask);
  });
});
