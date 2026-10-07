import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNoteAutoSave } from '../hooks/useNoteAutoSave.ts';
import { notesApi } from '../api/notes.api.ts';
import { ApiClientError } from '../api/client.ts';
import type { Note } from '../types/note.types.ts';

// Mock notesApi
vi.mock('../api/notes.api.ts', () => ({
  notesApi: {
    getNoteById: vi.fn(),
    updateNote: vi.fn(),
    flushNoteUnload: vi.fn(),
  },
}));

describe('Notes Auto-Save Engine & Optimistic Concurrency Control', () => {
  const sampleNote: Note = {
    id: 'note-123',
    title: 'Initial Title',
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Initial body' }] }] },
    plainText: 'Initial body',
    version: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers exactly one debounced save (800ms) after typing', async () => {
    const updatedNote: Note = { ...sampleNote, title: 'Updated Title', version: 2 };
    vi.mocked(notesApi.updateNote).mockResolvedValueOnce({ note: updatedNote });

    const handleNoteUpdated = vi.fn();
    const { result } = renderHook(() =>
      useNoteAutoSave({
        note: sampleNote,
        onNoteUpdated: handleNoteUpdated,
      })
    );

    // Initial state is saved
    expect(result.current.status).toBe('saved');

    // User types in title
    act(() => {
      result.current.updateTitle('Updated Title');
    });

    // Before 800ms, updateNote is NOT called
    expect(notesApi.updateNote).not.toHaveBeenCalled();

    // Advance 799ms
    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(notesApi.updateNote).not.toHaveBeenCalled();

    // Advance past 800ms
    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    // Exactly one save dispatched
    expect(notesApi.updateNote).toHaveBeenCalledTimes(1);
    expect(notesApi.updateNote).toHaveBeenCalledWith('note-123', {
      title: 'Updated Title',
      content: sampleNote.content,
      baseVersion: 1,
    });
    expect(handleNoteUpdated).toHaveBeenCalledWith(updatedNote);
    expect(result.current.status).toBe('saved');
  });

  it('does not run parallel saves on rapid consecutive edits; queues latest content for second save', async () => {
    let resolveFirstSave: (val: any) => void;
    const firstSavePromise = new Promise((resolve) => {
      resolveFirstSave = resolve;
    });

    vi.mocked(notesApi.updateNote)
      .mockImplementationOnce(() => firstSavePromise as any)
      .mockResolvedValueOnce({
        note: { ...sampleNote, title: 'Final Title', version: 3 },
      });

    const handleNoteUpdated = vi.fn();
    const { result } = renderHook(() =>
      useNoteAutoSave({
        note: sampleNote,
        onNoteUpdated: handleNoteUpdated,
      })
    );

    // First edit
    act(() => {
      result.current.updateTitle('First In-Flight');
    });

    // Fire timer for first edit
    act(() => {
      vi.advanceTimersByTime(800);
    });

    // First save is now in-flight
    expect(notesApi.updateNote).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('saving');

    // Rapid second & third edits while first is in-flight
    act(() => {
      result.current.updateTitle('Second Edit');
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    act(() => {
      result.current.updateTitle('Final Title');
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });

    // No parallel second save yet while first is in-flight
    expect(notesApi.updateNote).toHaveBeenCalledTimes(1);

    // Now resolve first save
    await act(async () => {
      resolveFirstSave!({
        note: { ...sampleNote, title: 'First In-Flight', version: 2 },
      });
    });

    // Queued latest save should now execute with incremented baseVersion: 2
    expect(notesApi.updateNote).toHaveBeenCalledTimes(2);
    expect(notesApi.updateNote).toHaveBeenLastCalledWith('note-123', {
      title: 'Final Title',
      content: sampleNote.content,
      baseVersion: 2,
    });
    expect(result.current.status).toBe('saved');
  });

  it('cycles through status transitions: saving -> saved on success, and saving -> error on failure (keeping unsaved text)', async () => {
    vi.mocked(notesApi.updateNote).mockRejectedValueOnce(
      new ApiClientError('Server Error', 500)
    );

    const { result } = renderHook(() =>
      useNoteAutoSave({
        note: sampleNote,
        onNoteUpdated: vi.fn(),
      })
    );

    act(() => {
      result.current.updateTitle('Failing Edit');
    });

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(result.current.status).toBe('error');
    // Keeps unsaved text in memory
    expect(result.current.title).toBe('Failing Edit');

    // Now test retrySave
    vi.mocked(notesApi.updateNote).mockResolvedValueOnce({
      note: { ...sampleNote, title: 'Failing Edit', version: 2 },
    });

    await act(async () => {
      result.current.retrySave();
    });

    expect(result.current.status).toBe('saved');
  });

  it('flushes pending save when switching notes or manual flush is invoked', async () => {
    vi.mocked(notesApi.updateNote).mockResolvedValueOnce({
      note: { ...sampleNote, title: 'Flushed Title', version: 2 },
    });

    const { result } = renderHook(() =>
      useNoteAutoSave({
        note: sampleNote,
        onNoteUpdated: vi.fn(),
      })
    );

    act(() => {
      result.current.updateTitle('Flushed Title');
    });

    // Instead of waiting 800ms, flush immediately
    await act(async () => {
      await result.current.flush();
    });

    expect(notesApi.updateNote).toHaveBeenCalledTimes(1);
    expect(notesApi.updateNote).toHaveBeenCalledWith('note-123', {
      title: 'Flushed Title',
      content: sampleNote.content,
      baseVersion: 1,
    });
    expect(result.current.status).toBe('saved');
  });

  it('handles 409 NOTE_CONFLICT: stops auto-save, shows conflict banner, and supports both Reload latest and Keep mine', async () => {
    const conflictError = new ApiClientError('Version Conflict', 409, undefined, 'NOTE_CONFLICT');
    (conflictError as any).version = 3;
    vi.mocked(notesApi.updateNote).mockRejectedValueOnce(conflictError);

    const handleNoteUpdated = vi.fn();
    const { result } = renderHook(() =>
      useNoteAutoSave({
        note: sampleNote,
        onNoteUpdated: handleNoteUpdated,
      })
    );

    act(() => {
      result.current.updateTitle('My Local Change');
    });

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    // Conflict state is now active
    expect(result.current.hasConflict).toBe(true);
    expect(result.current.status).toBe('error');

    // Further edits do NOT schedule auto-saves while in conflict
    act(() => {
      result.current.updateTitle('Another Edit During Conflict');
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(notesApi.updateNote).toHaveBeenCalledTimes(1); // No new save calls

    // Test 1: "Keep mine" button
    vi.mocked(notesApi.getNoteById).mockResolvedValueOnce({
      note: { ...sampleNote, title: 'Server Conflict Title', version: 3 },
    });
    vi.mocked(notesApi.updateNote).mockResolvedValueOnce({
      note: { ...sampleNote, title: 'Another Edit During Conflict', version: 4 },
    });

    await act(async () => {
      await result.current.keepMine();
    });

    expect(notesApi.getNoteById).toHaveBeenCalledWith('note-123');
    expect(notesApi.updateNote).toHaveBeenCalledWith('note-123', {
      title: 'Another Edit During Conflict',
      content: sampleNote.content,
      baseVersion: 3, // uses updated baseVersion from server
    });
    expect(result.current.hasConflict).toBe(false);
    expect(result.current.status).toBe('saved');

    // Now test "Reload latest" on another conflict
    vi.mocked(notesApi.updateNote).mockRejectedValueOnce(conflictError);
    act(() => {
      result.current.updateTitle('New Conflict Attempt');
    });
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current.hasConflict).toBe(true);

    vi.mocked(notesApi.getNoteById).mockResolvedValueOnce({
      note: {
        ...sampleNote,
        title: 'Server Authoritative Title',
        content: { type: 'doc', content: [] },
        version: 5,
      },
    });

    await act(async () => {
      await result.current.reloadLatest();
    });

    expect(result.current.hasConflict).toBe(false);
    expect(result.current.title).toBe('Server Authoritative Title');
    expect(result.current.status).toBe('saved');
  });
});
