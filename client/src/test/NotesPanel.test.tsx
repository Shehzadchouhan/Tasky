import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { NotesPanel } from '../components/notes/NotesPanel.tsx';
import { DashboardPage } from '../pages/DashboardPage.tsx';
import { ToastProvider } from '../context/ToastContext.tsx';
import { notesApi } from '../api/notes.api.ts';
import type { NoteSummary, Note } from '../types/note.types.ts';

// Mock notesApi
vi.mock('../api/notes.api.ts', () => ({
  notesApi: {
    getNotes: vi.fn(),
    getNoteById: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    flushNoteUnload: vi.fn(),
  },
}));

// Mock tasksApi for DashboardPage
vi.mock('../api/tasks.api.ts', () => ({
  tasksApi: {
    getTasks: vi.fn().mockResolvedValue({ tasks: [], total: 0, page: 1, totalPages: 0 }),
    getStats: vi.fn().mockResolvedValue({
      totals: { total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0, completionRate: 0 },
      completedPerDay: [],
      byCategory: {},
      byPriority: {},
    }),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

describe('NotesPanel Component & Responsive Dashboard Integration', () => {
  let queryClient: QueryClient;

  const mockNotes: NoteSummary[] = [
    {
      id: 'note-1',
      title: 'Sprint Planning',
      snippet: 'Discussed tasks for phase 2 and team allocation.',
      updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15m ago
    },
    {
      id: 'note-2',
      title: 'Architecture Overview',
      snippet: 'Diagram of microservices and DB connections.',
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h ago
    },
  ];

  const mockActiveNote: Note = {
    id: 'note-1',
    title: 'Sprint Planning',
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Full note content' }] }],
    },
    plainText: 'Full note content',
    version: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    localStorage.clear();

    vi.mocked(notesApi.getNotes).mockResolvedValue({
      notes: mockNotes,
      total: mockNotes.length,
      page: 1,
      totalPages: 1,
    });
    vi.mocked(notesApi.getNoteById).mockResolvedValue({ note: mockActiveNote });
  });

  const renderComponent = (ui: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/']}>
            {ui}
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );
  };

  it('renders list of note summaries including titles, snippets, and relative times', async () => {
    renderComponent(
      <NotesPanel
        selectedNoteId="note-1"
        onSelectNote={vi.fn()}
      />
    );

    // Verify notes are rendered
    await waitFor(() => {
      expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
      expect(screen.getByText('Architecture Overview')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Discussed tasks for phase 2 and team allocation.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Diagram of microservices and DB connections.')
    ).toBeInTheDocument();

    // Check relative times
    expect(screen.getByText('15m ago')).toBeInTheDocument();
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });

  it('asks for confirmation via accessible modal when delete is clicked, and performs deletion', async () => {
    const user = userEvent.setup();
    vi.mocked(notesApi.deleteNote).mockResolvedValueOnce({ ok: true });
    const handleSelectNote = vi.fn();

    renderComponent(
      <NotesPanel
        selectedNoteId="note-1"
        onSelectNote={handleSelectNote}
      />
    );

    // Wait for note to load
    await waitFor(() => {
      expect(screen.getByDisplayValue('Sprint Planning')).toBeInTheDocument();
    });

    // Click Delete Note button
    const deleteButton = screen.getByRole('button', { name: /Delete note/i });
    await user.click(deleteButton);

    // Accessible confirmation dialog should appear with title and focus trap
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: 'Delete Note' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(notesApi.deleteNote).toHaveBeenCalledWith('note-1');
    });

    // Automatically selects next note (note-2)
    expect(handleSelectNote).toHaveBeenCalledWith('note-2');
  });

  it('renders the segmented Notes | Tasks switch on DashboardPage for mobile / below 1024px', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/?tab=notes']}>
            <DashboardPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Segmented tab list exists
    const tabList = screen.getByRole('tablist', { name: /View selection/i });
    expect(tabList).toBeInTheDocument();

    const notesTab = screen.getByRole('tab', { name: 'Notes' });
    const tasksTab = screen.getByRole('tab', { name: 'Tasks' });

    expect(notesTab).toBeInTheDocument();
    expect(tasksTab).toBeInTheDocument();
    expect(notesTab).toHaveAttribute('aria-selected', 'true');
    expect(tasksTab).toHaveAttribute('aria-selected', 'false');
  });

  it('remembers the collapsed state of the Notes panel in localStorage', async () => {
    // Initial state: not collapsed
    expect(localStorage.getItem('notes_panel_collapsed')).toBeNull();

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/']}>
            <DashboardPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Find collapse button
    const collapseBtn = screen.getByRole('button', { name: /Collapse Notes panel/i });
    expect(collapseBtn).toBeInTheDocument();

    // Click collapse
    const user = userEvent.setup();
    await user.click(collapseBtn);

    // localStorage should now store 'true'
    expect(localStorage.getItem('notes_panel_collapsed')).toBe('true');

    // Rerender page: should initialize from localStorage as collapsed
    rerender(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/']}>
            <DashboardPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );

    expect(screen.getByRole('button', { name: /Expand Notes panel/i })).toBeInTheDocument();
  });
});
