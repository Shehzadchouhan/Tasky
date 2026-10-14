import { useState, useEffect, useRef, useCallback } from 'react';
import { notesApi } from '../api/notes.api.ts';
import { ApiClientError } from '../api/client.ts';
import type { Note, NoteSaveStatus } from '../types/note.types.ts';

const AUTO_SAVE_DEBOUNCE_MS = 1500;

interface NotePayload {
  title: string;
  category: string;
  content: Record<string, any>;
}

const arePayloadsEqual = (left: NotePayload, right: NotePayload): boolean =>
  left.title === right.title &&
  left.category === right.category &&
  JSON.stringify(left.content) === JSON.stringify(right.content);

interface UseNoteAutoSaveOptions {
  note: Note | null;
  onNoteUpdated: (updatedNote: Note) => void;
}

export function useNoteAutoSave({ note, onNoteUpdated }: UseNoteAutoSaveOptions) {
  const [title, setTitle] = useState(note?.title || '');
  const [category, setCategory] = useState(note?.category || '');
  const [content, setContent] = useState<Record<string, any>>(note?.content || { type: 'doc', content: [] });
  const [status, setStatus] = useState<NoteSaveStatus>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictVersion, setConflictVersion] = useState<number | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const activeNoteIdRef = useRef<string | null>(note?.id || null);
  const currentVersionRef = useRef<number>(note?.version || 1);
  const titleRef = useRef(title);
  const categoryRef = useRef(category);
  const contentRef = useRef(content);
  const isDirtyRef = useRef(false);
  const lastSaveSucceededRef = useRef(true);
  const inFlightRef = useRef(false);
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const pendingPayloadRef = useRef<NotePayload | null>(null);
  const inFlightPayloadRef = useRef<NotePayload | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  titleRef.current = title;
  categoryRef.current = category;
  contentRef.current = content;

  const getCurrentPayload = useCallback(
    (): NotePayload => ({
      title: titleRef.current,
      category: categoryRef.current,
      content: contentRef.current,
    }),
    []
  );

  // When active note changes, reset local state
  useEffect(() => {
    if (!note) {
      activeNoteIdRef.current = null;
      setTitle('');
      setCategory('');
      setContent({ type: 'doc', content: [] });
      setStatus('saved');
      setSaveError(null);
      setHasConflict(false);
      setConflictVersion(null);
      isDirtyRef.current = false;
      lastSaveSucceededRef.current = true;
      return;
    }

    if (activeNoteIdRef.current !== note.id) {
      activeNoteIdRef.current = note.id;
      currentVersionRef.current = note.version;
      titleRef.current = note.title;
      categoryRef.current = note.category || '';
      contentRef.current = note.content || { type: 'doc', content: [] };
      setTitle(note.title);
      setCategory(note.category || '');
      setContent(note.content || { type: 'doc', content: [] });
      setStatus('saved');
      setSaveError(null);
      setHasConflict(false);
      setConflictVersion(null);
      isDirtyRef.current = false;
      lastSaveSucceededRef.current = true;
      pendingPayloadRef.current = null;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    } else {
      // Sync version if updated externally (do not downgrade to stale cache)
      if (note.version > currentVersionRef.current) {
        currentVersionRef.current = note.version;
      }
    }
  }, [note?.id, note?.version]);

  const executeSave = useCallback(
    async function executeNoteSave(payloadToSave: NotePayload) {
      const noteId = activeNoteIdRef.current;
      if (!noteId) return;

      inFlightRef.current = true;
      inFlightPayloadRef.current = payloadToSave;
      lastSaveSucceededRef.current = false;
      setSaveError(null);
      setStatus('saving');

      try {
        const res = await notesApi.updateNote(noteId, {
          title: payloadToSave.title,
          category: payloadToSave.category,
          content: payloadToSave.content,
          baseVersion: currentVersionRef.current,
        });

        currentVersionRef.current = res.note.version;
        onNoteUpdated(res.note);

        // Check if additional edits were queued while in-flight
        if (pendingPayloadRef.current) {
          const nextPayload = pendingPayloadRef.current;
          pendingPayloadRef.current = null;
          await executeNoteSave(nextPayload);
        } else {
          inFlightRef.current = false;
          inFlightPayloadRef.current = null;
          const hasUnpersistedChanges = !arePayloadsEqual(payloadToSave, getCurrentPayload());
          isDirtyRef.current = hasUnpersistedChanges;
          lastSaveSucceededRef.current = !hasUnpersistedChanges;
          setStatus(hasUnpersistedChanges ? 'unsaved' : 'saved');
        }
      } catch (err) {
        inFlightRef.current = false;
        inFlightPayloadRef.current = null;
        lastSaveSucceededRef.current = false;
        setSaveError(
          err instanceof Error && err.message
            ? err.message
            : 'Unable to save this note. Check your connection and try again.'
        );
        if (err instanceof ApiClientError && (err.status === 409 || err.code === 'NOTE_CONFLICT')) {
          setHasConflict(true);
          // If server provided current version in error details or payload
          const v = (err as any).version || currentVersionRef.current + 1;
          setConflictVersion(v);
          setStatus('error');
        } else {
          setStatus('error');
        }
      }
    },
    [getCurrentPayload, onNoteUpdated]
  );

  const startSave = useCallback(
    (payload: NotePayload) => {
      const promise = executeSave(payload);
      savePromiseRef.current = promise;
      void promise.then(
        () => {
          if (savePromiseRef.current === promise) savePromiseRef.current = null;
        },
        () => {
          if (savePromiseRef.current === promise) savePromiseRef.current = null;
        }
      );
      return promise;
    },
    [executeSave]
  );

  const scheduleAutoSave = useCallback(() => {
    if (hasConflict) return;
    isDirtyRef.current = true;
    setSaveError(null);
    setStatus('unsaved');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const payload = getCurrentPayload();
      if (inFlightRef.current) {
        pendingPayloadRef.current = payload;
      } else {
        void startSave(payload);
      }
    }, AUTO_SAVE_DEBOUNCE_MS);
  }, [getCurrentPayload, hasConflict, startSave]);

  const updateTitle = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      titleRef.current = newTitle;
      scheduleAutoSave();
    },
    [scheduleAutoSave]
  );

  const updateCategory = useCallback(
    (newCategory: string) => {
      setCategory(newCategory);
      categoryRef.current = newCategory;
      scheduleAutoSave();
    },
    [scheduleAutoSave]
  );

  const updateContent = useCallback(
    (newContent: Record<string, any>) => {
      setContent(newContent);
      contentRef.current = newContent;
      scheduleAutoSave();
    },
    [scheduleAutoSave]
  );

  // Synchronous or immediate flush (on note switch, panel collapse, or unmount)
  const flush = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (hasConflict) return false;
    if (!isDirtyRef.current || !activeNoteIdRef.current) {
      return lastSaveSucceededRef.current;
    }

    const payload = getCurrentPayload();
    if (inFlightRef.current) {
      const inFlightPayload = inFlightPayloadRef.current;
      if (
        pendingPayloadRef.current ||
        !inFlightPayload ||
        payload.title !== inFlightPayload.title ||
        payload.category !== inFlightPayload.category ||
        payload.content !== inFlightPayload.content
      ) {
        pendingPayloadRef.current = payload;
      }
      await savePromiseRef.current;
      return lastSaveSucceededRef.current;
    } else {
      await startSave(payload);
      return lastSaveSucceededRef.current;
    }
  }, [getCurrentPayload, hasConflict, startSave]);

  // Window exit / beforeunload guard with keepalive fetch
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current && activeNoteIdRef.current && !hasConflict) {
        notesApi.flushNoteUnload(activeNoteIdRef.current, {
          title: titleRef.current,
          category: categoryRef.current,
          content: contentRef.current,
          baseVersion: currentVersionRef.current,
        });
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasConflict]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (isDirtyRef.current && activeNoteIdRef.current && !hasConflict && !inFlightRef.current) {
        notesApi.flushNoteUnload(activeNoteIdRef.current, {
          title: titleRef.current,
          category: categoryRef.current,
          content: contentRef.current,
          baseVersion: currentVersionRef.current,
        });
      }
    };
  }, [hasConflict]);

  // Conflict resolution 1: Reload latest
  const reloadLatest = useCallback(async () => {
    const noteId = activeNoteIdRef.current;
    if (!noteId) return;

    try {
      setStatus('saving');
      const res = await notesApi.getNoteById(noteId);
      currentVersionRef.current = res.note.version;
      setTitle(res.note.title);
      setCategory(res.note.category || '');
      setContent(res.note.content || { type: 'doc', content: [] });
      titleRef.current = res.note.title;
      categoryRef.current = res.note.category || '';
      contentRef.current = res.note.content || { type: 'doc', content: [] };
      setHasConflict(false);
      setConflictVersion(null);
      isDirtyRef.current = false;
      pendingPayloadRef.current = null;
      setSaveError(null);
      setStatus('saved');
      setReloadTrigger((prev) => prev + 1);
      onNoteUpdated(res.note);
    } catch (error) {
      setSaveError(
        error instanceof Error && error.message
          ? error.message
          : 'Unable to reload the note. Check your connection and try again.'
      );
      setStatus('error');
    }
  }, [onNoteUpdated]);

  // Conflict resolution 2: Keep mine (overwrite with local draft after syncing latest version)
  const keepMine = useCallback(async () => {
    const noteId = activeNoteIdRef.current;
    if (!noteId) return;

    try {
      setStatus('saving');
      setSaveError(null);
      const latest = await notesApi.getNoteById(noteId);
      currentVersionRef.current = latest.note.version;
      setHasConflict(false);
      setConflictVersion(null);
      await startSave({ title: titleRef.current, category: categoryRef.current, content: contentRef.current });
    } catch (error) {
      setSaveError(
        error instanceof Error && error.message
          ? error.message
          : 'Unable to resolve the note conflict. Check your connection and try again.'
      );
      setStatus('error');
    }
  }, [startSave]);

  const retrySave = useCallback(async () => {
    if (!activeNoteIdRef.current) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const payload = getCurrentPayload();
    pendingPayloadRef.current = null;
    isDirtyRef.current = true;
    setSaveError(null);
    if (inFlightRef.current) {
      pendingPayloadRef.current = payload;
      await savePromiseRef.current;
      return;
    }

    await startSave(payload);
  }, [getCurrentPayload, startSave]);

  return {
    title,
    category,
    content,
    status,
    saveError,
    hasConflict,
    conflictVersion,
    reloadTrigger,
    updateTitle,
    updateCategory,
    updateContent,
    flush,
    reloadLatest,
    keepMine,
    retrySave,
  };
}
