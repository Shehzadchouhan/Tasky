import { useState, useEffect, useMemo, lazy, Suspense, useRef } from 'react';
import {
  Search,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
  FileText,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../common/Button.tsx';
import { NoteListItem } from './NoteListItem.tsx';
import { DeleteNoteModal } from './DeleteNoteModal.tsx';
import { useNotesListQuery, useNoteQuery, useCreateNote, useDeleteNote } from '../../hooks/useNotes.ts';
import { useNoteAutoSave } from '../../hooks/useNoteAutoSave.ts';
import { useDebounce } from '../../hooks/useDebounce.ts';
import { useToast } from '../../hooks/useToast.ts';
import type { Note } from '../../types/note.types.ts';

// Lazy-load TipTap editor to keep initial bundle small
const TipTapEditor = lazy(() => import('./TipTapEditor.tsx'));

function EditorSkeleton() {
  return (
    <div className="w-full h-80 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse flex flex-col p-4 gap-3 border border-slate-200 dark:border-white/10">
      <div className="h-8 bg-slate-200 dark:bg-white/10 rounded-md w-full" />
      <div className="h-4 bg-slate-200 dark:bg-white/10 rounded-md w-3/4 mt-4" />
      <div className="h-4 bg-slate-200 dark:bg-white/10 rounded-md w-5/6" />
      <div className="h-4 bg-slate-200 dark:bg-white/10 rounded-md w-2/3" />
    </div>
  );
}

interface NotesPanelProps {
  selectedNoteId: string | null;
  onSelectNote: (id: string | null) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function NotesPanel({
  selectedNoteId,
  onSelectNote,
  isCollapsed = false,
  onToggleCollapse,
}: NotesPanelProps) {
  const { showToast } = useToast();
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [page, setPage] = useState(1);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Queries & Mutations
  const listParams = useMemo(
    () => ({
      q: debouncedSearch.trim() || undefined,
      page,
      limit: 20,
    }),
    [debouncedSearch, page]
  );

  const {
    data: listData,
    isLoading: isListLoading,
    isError: isListError,
    error: listError,
    refetch: refetchList,
  } = useNotesListQuery(listParams);

  const {
    data: activeNoteData,
    isLoading: isNoteLoading,
    isError: isNoteError,
    refetch: refetchActiveNote,
  } = useNoteQuery(selectedNoteId);

  const createNoteMutation = useCreateNote();
  const deleteNoteMutation = useDeleteNote();

  const notes = listData?.notes || [];
  const total = listData?.total || 0;
  const totalPages = listData?.totalPages || 0;

  // Auto-select first note if none selected and notes exist
  useEffect(() => {
    if (!selectedNoteId && notes.length > 0 && !isListLoading) {
      onSelectNote(notes[0].id);
    }
  }, [selectedNoteId, notes, isListLoading, onSelectNote]);

  const activeNote = activeNoteData?.note || null;

  // Auto-save engine
  const handleNoteUpdated = (_updatedNote: Note) => {
    refetchList();
  };

  const {
    title,
    content,
    status,
    hasConflict,
    conflictVersion,
    reloadTrigger,
    updateTitle,
    updateContent,
    flush,
    reloadLatest,
    keepMine,
    retrySave,
  } = useNoteAutoSave({
    note: activeNote,
    onNoteUpdated: handleNoteUpdated,
  });

  // Flush when note changes or panel collapses
  const prevSelectedNoteIdRef = useRef(selectedNoteId);
  useEffect(() => {
    if (prevSelectedNoteIdRef.current && prevSelectedNoteIdRef.current !== selectedNoteId) {
      flush();
    }
    prevSelectedNoteIdRef.current = selectedNoteId;
  }, [selectedNoteId, flush]);

  const handleToggleCollapse = () => {
    flush();
    if (onToggleCollapse) {
      onToggleCollapse();
    }
  };

  // Create Note
  const handleCreateNote = async () => {
    try {
      await flush();
      const res = await createNoteMutation.mutateAsync({});
      showToast('New note created', 'success');
      onSelectNote(res.note.id);
    } catch (err: any) {
      showToast(err?.message || 'Failed to create note', 'error');
    }
  };

  // Delete Note Confirm
  const handleDeleteConfirm = async (id: string) => {
    try {
      await deleteNoteMutation.mutateAsync(id);
      showToast('Note deleted', 'success');

      // Select next available note
      const remaining = notes.filter((n) => n.id !== id);
      if (remaining.length > 0) {
        onSelectNote(remaining[0].id);
      } else {
        onSelectNote(null);
      }
    } catch {
      showToast('Failed to delete note', 'error');
    }
  };

  if (isCollapsed) {
    return (
      <div className="hidden lg:flex flex-col items-center py-4 px-2 border-r border-slate-200 dark:border-white/10 bg-white dark:bg-[#252538] w-14 shrink-0 transition-all">
        <button
          type="button"
          onClick={handleToggleCollapse}
          aria-label="Expand Notes panel"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c63ff]"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <span
          className="[writing-mode:vertical-rl] mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none"
        >
          Notes
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full w-full gap-4 lg:gap-6 min-h-[600px]">
      {/* LEFT: Summaries List Rail */}
      <div className="w-full md:w-80 lg:w-84 xl:w-96 flex flex-col shrink-0 rounded-2xl bg-white dark:bg-[#252538] border border-slate-200 dark:border-white/10 shadow-xs p-4 gap-3">
        {/* Header: Title + Collapse + New Note */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            {onToggleCollapse && (
              <button
                type="button"
                onClick={handleToggleCollapse}
                aria-label="Collapse Notes panel"
                className="hidden lg:inline-flex p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText className="w-5 h-5 text-indigo-500" />
              Notes
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-medium">
              {total}
            </span>
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleCreateNote}
            disabled={createNoteMutation.isPending}
            className="shadow-xs text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Note
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            placeholder="Search notes..."
            aria-label="Search notes"
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-[#1e1e2f] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6c63ff]/50 transition-all"
          />
        </div>

        {/* List Content Area */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 max-h-[500px] md:max-h-[650px]">
          {isListLoading ? (
            <div className="flex flex-col gap-2 my-2" data-testid="notes-loading">
              <div className="h-18 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" />
              <div className="h-18 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" />
              <div className="h-18 rounded-xl bg-slate-100 dark:bg-white/5 animate-pulse" />
            </div>
          ) : isListError ? (
            <div
              role="alert"
              className="flex flex-col items-center justify-center p-6 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-center gap-2 my-4"
            >
              <AlertCircle className="w-6 h-6 text-rose-500" />
              <p className="text-xs font-medium text-rose-700 dark:text-rose-400">
                {listError instanceof Error ? listError.message : 'Unable to load notes.'}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => refetchList()}
                className="mt-1 text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            </div>
          ) : notes.length === 0 ? (
            debouncedSearch ? (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 dark:text-slate-400 my-auto">
                <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No notes found
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Try adjusting your search query.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center gap-3 my-auto">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    No notes yet
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Capture your ideas, drafts, and meeting minutes.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleCreateNote}
                  className="text-xs"
                >
                  Create your first note
                </Button>
              </div>
            )
          ) : (
            notes.map((n) => (
              <NoteListItem
                key={n.id}
                note={n}
                isSelected={n.id === selectedNoteId}
                onSelect={(id) => onSelectNote(id)}
              />
            ))
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5 text-xs text-slate-500">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 h-7"
                aria-label="Previous page"
              >
                &larr;
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1 h-7"
                aria-label="Next page"
              >
                &rarr;
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Selected Note Editor Workspace */}
      <div className="flex-1 flex flex-col rounded-2xl bg-white dark:bg-[#252538] border border-slate-200 dark:border-white/10 shadow-xs p-4 sm:p-6 gap-4 min-w-0">
        {!selectedNoteId || (!activeNote && !isNoteLoading) ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              Select or create a note
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm">
              Choose a note from the list on the left or click &ldquo;New Note&rdquo; to start drafting.
            </p>
            <Button type="button" variant="primary" size="md" onClick={handleCreateNote}>
              <Plus className="w-4 h-4 mr-1" />
              New Note
            </Button>
          </div>
        ) : isNoteLoading && !activeNote ? (
          <div className="flex-1 flex flex-col gap-4">
            <div className="h-10 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse w-1/2" />
            <EditorSkeleton />
          </div>
        ) : isNoteError && !activeNote ? (
          <div
            role="alert"
            className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40"
          >
            <AlertCircle className="w-8 h-8 text-rose-500" />
            <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-400">
              Failed to load note
            </h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => refetchActiveNote()}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Retry
            </Button>
          </div>
        ) : (
          <>
            {/* OCC Conflict Banner (409) */}
            {hasConflict && (
              <div
                role="alert"
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/50 text-amber-900 dark:text-amber-200 animate-in fade-in"
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">
                      Version Conflict Detected
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      This note was updated in another session (v{conflictVersion}). Choose how to resolve:
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={reloadLatest}
                    className="text-xs"
                  >
                    Reload latest
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={keepMine}
                    className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Keep mine
                  </Button>
                </div>
              </div>
            )}

            {/* Note Header: Title Input + Status Indicator + Delete Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
              <input
                type="text"
                value={title}
                onChange={(e) => updateTitle(e.target.value)}
                placeholder="Untitled"
                maxLength={120}
                aria-label="Note title"
                className="text-xl sm:text-2xl font-bold bg-transparent border-0 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0 flex-1 truncate"
              />

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                {/* Save Status Badge */}
                <div className="flex items-center gap-1.5 text-xs">
                  {status === 'saving' && (
                    <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                      Saving...
                    </span>
                  )}
                  {status === 'saved' && (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Check className="w-3.5 h-3.5" />
                      Saved
                    </span>
                  )}
                  {status === 'error' && !hasConflict && (
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Error
                      </span>
                      <button
                        type="button"
                        onClick={retrySave}
                        className="text-xs underline text-slate-500 hover:text-slate-800 dark:hover:text-white"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteModalOpen(true)}
                  aria-label="Delete note"
                  className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Lazy-Loaded TipTap Rich Editor */}
            <Suspense fallback={<EditorSkeleton />}>
              <TipTapEditor
                noteId={activeNote!.id}
                initialContent={content}
                onContentChange={updateContent}
                reloadTrigger={reloadTrigger}
              />
            </Suspense>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteNoteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        note={activeNote}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteNoteMutation.isPending}
      />
    </div>
  );
}
