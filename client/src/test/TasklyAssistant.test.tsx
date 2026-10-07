import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TasklyAssistant } from '../components/assistant/TasklyAssistant.tsx';
import { assistantApi } from '../api/assistant.api.ts';
import { ApiClientError } from '../api/client.ts';

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('TasklyAssistant Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps typed text on failure and the Add manually button works', async () => {
    const user = userEvent.setup();
    const handleOpenModal = vi.fn();

    vi.spyOn(assistantApi, 'chat').mockRejectedValueOnce(
      new Error('The assistant is busy right now. Please try again in a moment.')
    );

    renderWithQueryClient(<TasklyAssistant onOpenTaskModal={handleOpenModal} />);

    // Open assistant
    const openButton = screen.getByRole('button', { name: /Open Taskly AI assistant/i });
    await user.click(openButton);

    const input = screen.getByRole('textbox', { name: /Message the Taskly assistant/i });
    await user.type(input, 'Buy groceries tomorrow');

    const sendButton = screen.getByRole('button', { name: /Send message/i });
    await user.click(sendButton);

    // Wait for generic error message
    await waitFor(() => {
      expect(
        screen.getByText('The assistant is busy right now. Please try again in a moment.')
      ).toBeInTheDocument();
    });

    // Check that typed text was retained in the input
    expect(input).toHaveValue('Buy groceries tomorrow');

    // Check that Retry and Add manually buttons appear
    const retryButton = screen.getByRole('button', { name: /Retry/i });
    const addManuallyButton = screen.getByRole('button', { name: /Add manually/i });
    expect(retryButton).toBeInTheDocument();
    expect(addManuallyButton).toBeInTheDocument();

    // Click Add manually button
    await user.click(addManuallyButton);
    expect(handleOpenModal).toHaveBeenCalledTimes(1);
    expect(handleOpenModal).toHaveBeenCalledWith('Buy groceries tomorrow');
  });

  it('disables input and shows Working... status while request is in flight', async () => {
    const user = userEvent.setup();
    let resolveChat!: (value: { message: string }) => void;
    const chatPromise = new Promise<{ message: string }>((resolve) => {
      resolveChat = resolve;
    });

    vi.spyOn(assistantApi, 'chat').mockImplementationOnce(() => chatPromise);

    renderWithQueryClient(<TasklyAssistant />);

    const openButton = screen.getByRole('button', { name: /Open Taskly AI assistant/i });
    await user.click(openButton);

    const input = screen.getByRole('textbox', { name: /Message the Taskly assistant/i });
    await user.type(input, 'Schedule dentist');

    const sendButton = screen.getByRole('button', { name: /Send message/i });
    await user.click(sendButton);

    // Should show "Working..." status and disable input
    expect(screen.getByRole('status')).toHaveTextContent('Working...');
    expect(input).toBeDisabled();

    // Resolve request
    resolveChat({ message: 'Task scheduled.' });

    await waitFor(() => {
      expect(input).not.toBeDisabled();
      expect(screen.getByText('Task scheduled.')).toBeInTheDocument();
    });
  });

  it('clears messages on close but preserves unsent draft text', async () => {
    const user = userEvent.setup();
    vi.spyOn(assistantApi, 'chat').mockResolvedValueOnce({ message: 'Task created!' });

    renderWithQueryClient(<TasklyAssistant />);

    // Open assistant
    await user.click(screen.getByRole('button', { name: /Open Taskly AI assistant/i }));

    const input = screen.getByRole('textbox', { name: /Message the Taskly assistant/i });
    await user.type(input, 'Hello world');
    await user.click(screen.getByRole('button', { name: /Send message/i }));

    await waitFor(() => {
      expect(screen.getByText('Task created!')).toBeInTheDocument();
    });

    // Type unsent draft text
    await user.type(input, 'Unsent draft note');

    // Close assistant
    await user.click(screen.getByRole('button', { name: /Close assistant/i }));
    expect(screen.queryByLabelText('Taskly AI assistant')).not.toBeInTheDocument();

    // Reopen assistant
    await user.click(screen.getByRole('button', { name: /Open Taskly AI assistant/i }));

    // Previous message history is cleared, but draft text is preserved
    expect(screen.queryByText('Task created!')).not.toBeInTheDocument();
    const reopenedInput = screen.getByRole('textbox', { name: /Message the Taskly assistant/i });
    expect(reopenedInput).toHaveValue('Unsent draft note');
  });

  it('marks pending delete cards as expired after 2 minutes', async () => {
    const user = userEvent.setup();
    const realDateNow = Date.now;
    let mockCurrentTime = 1_000_000;

    vi.spyOn(Date, 'now').mockImplementation(() => mockCurrentTime);

    vi.spyOn(assistantApi, 'chat').mockResolvedValueOnce({
      message: 'Would you like to delete this task?',
      pendingDelete: { taskId: '670000000000000000000001', title: 'Task to expire' },
    });

    renderWithQueryClient(<TasklyAssistant />);

    await user.click(screen.getByRole('button', { name: /Open Taskly AI assistant/i }));
    const input = screen.getByRole('textbox', { name: /Message the Taskly assistant/i });
    await user.type(input, 'Delete task');
    await user.click(screen.getByRole('button', { name: /Send message/i }));

    await waitFor(() => {
      expect(screen.getByText(/Delete “Task to expire”\?/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    });

    // Advance time by more than 2 minutes (130 seconds)
    mockCurrentTime += 130_000;

    // Trigger re-render by typing something
    await user.type(input, 'a');

    await waitFor(() => {
      expect(screen.getByText(/Deletion request for “Task to expire” expired\./i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
    });

    vi.spyOn(Date, 'now').mockImplementation(realDateNow);
  });

  it('shows only Add manually and preserves typed text on AI_QUOTA error code', async () => {
    const user = userEvent.setup();
    vi.spyOn(assistantApi, 'chat').mockRejectedValueOnce(
      new ApiClientError('Arbitrary quota text', 429, undefined, 'AI_QUOTA')
    );

    renderWithQueryClient(<TasklyAssistant />);
    await user.click(screen.getByRole('button', { name: /Open Taskly AI assistant/i }));
    const input = screen.getByRole('textbox', { name: /Message the Taskly assistant/i });
    await user.type(input, 'Buy groceries tomorrow');
    await user.click(screen.getByRole('button', { name: /Send message/i }));

    await waitFor(() => {
      expect(screen.getByText('Arbitrary quota text')).toBeInTheDocument();
    });

    expect(input).toHaveValue('Buy groceries tomorrow');
    expect(screen.getByRole('button', { name: /Add manually/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument();
  });

  it('shows both Retry and Add manually on AI_BUSY error code regardless of text', async () => {
    const user = userEvent.setup();
    vi.spyOn(assistantApi, 'chat').mockRejectedValueOnce(
      new ApiClientError('Arbitrary busy text', 503, undefined, 'AI_BUSY')
    );

    renderWithQueryClient(<TasklyAssistant />);
    await user.click(screen.getByRole('button', { name: /Open Taskly AI assistant/i }));
    const input = screen.getByRole('textbox', { name: /Message the Taskly assistant/i });
    await user.type(input, 'Finish homework Friday');
    await user.click(screen.getByRole('button', { name: /Send message/i }));

    await waitFor(() => {
      expect(screen.getByText('Arbitrary busy text')).toBeInTheDocument();
    });

    expect(input).toHaveValue('Finish homework Friday');
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add manually/i })).toBeInTheDocument();
  });
});
