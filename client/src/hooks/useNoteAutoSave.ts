import { useState, useEffect, useRef, useCallback } from 'react';
import { notesApi } from '../api/notes.api.ts';
import { ApiClientError } from '../api/client.ts';
import type { Note, NoteSaveStatus } from '../types/note.types.ts';

interface UseNoteAutoSaveOptions {
  note: Note | null;
  onNoteUpdated: (updatedNote: Note) => void;
}

export function useNoteAutoSave({ note, onNoteUpdated }: UseNoteAutoSaveOptions) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState<Record<string, any>>(note?.content || { type: 'doc', content: [] });
  const [status, setStatus] = useState<NoteSaveStatus>('saved');
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictVersion, setConflictVersion] = useState<number | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const activeNoteIdRef = useRef<string | null>(note?.id || null);
  const currentVersionRef = useRef<number>(note?.version || 1);
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  const isDirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const pendingPayloadRef = useRef<{ title: string; content: Record<string, any> } | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  titleRef.current = title;
  contentRef.current = content;

  // When active note changes, reset local state
  useEffect(() => {
    if (!note) {
      activeNoteIdRef.current = null;
      setTitle('');
      setContent({ type: 'doc', content: [] });
      setStatus('saved');
      setHasConflict(false);
      setConflictVersion(null);
      isDirtyRef.current = false;
      return;
    }

    if (activeNoteIdRef.current !== note.id) {
      activeNoteIdRef.current = note.id;
      currentVersionRef.current = note.version;
      setTitle(note.title);
      setContent(note.content || { type: 'doc', content: [] });
      setStatus('saved');
      setHasConflict(false);
      setConflictVersion(null);
      isDirtyRef.current = false;
      pendingPayloadRef.current = null;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    } else {
      // Sync version if updated externally
      currentVersionRef.current = note.version;
    }
  }, [note?.id, note?.version]);

  const executeSave = useCallback(
    async (payloadToSave: { title: string; content: Record<string, any> }) => {
      const noteId = activeNoteIdRef.current;
      if (!noteId) return;

      inFlightRef.current = true;
      setStatus('saving');

      try {
        const res = await notesApi.updateNote(noteId, {
          title: payloadToSave.title,
          content: payloadToSave.content,
          baseVersion: currentVersionRef.current,
        });

        currentVersionRef.current = res.note.version;
        onNoteUpdated(res.note);

        // Check if additional edits were queued while in-flight
        if (pendingPayloadRef.current) {
          const nextPayload = pendingPayloadRef.current;
          pendingPayloadRef.current = null;
          await executeSave(nextPayload);
        } else {
          isDirtyRef.current = false;
          setStatus('saved');
          inFlightRef.current = false;
        }
      } catch (err) {
        inFlightRef.current = false;
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
    [onNoteUpdated]
  );

  const scheduleAutoSave = useCallback(() => {
    if (hasConflict) return;
    isDirtyRef.current = true;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const payload = { title: titleRef.current, content: contentRef.current };
      if (inFlightRef.current) {
        pendingPayloadRef.current = payload;
      } else {
        executeSave(payload);
      }
    }, 800);
  }, [hasConflict, executeSave]);

  const updateTitle = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      titleRef.current = newTitle;
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

    if (!isDirtyRef.current || hasConflict || !activeNoteIdRef.current) {
      return;
    }

    const payload = { title: titleRef.current, content: contentRef.current };
    if (inFlightRef.current) {
      pendingPayloadRef.current = payload;
    } else {
      await executeSave(payload);
    }
  }, [hasConflict, executeSave]);

  // Window exit / beforeunload guard with keepalive fetch
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current && activeNoteIdRef.current && !hasConflict) {
        notesApi.flushNoteUnload(activeNoteIdRef.current, {
          title: titleRef.current,
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
      setContent(res.note.content || { type: 'doc', content: [] });
      titleRef.current = res.note.title;
      contentRef.current = res.note.content || { type: 'doc', content: [] };
      setHasConflict(false);
      setConflictVersion(null);
      isDirtyRef.current = false;
      pendingPayloadRef.current = null;
      setStatus('saved');
      setReloadTrigger((prev) => prev + 1);
      onNoteUpdated(res.note);
    } catch {
      setStatus('error');
    }
  }, [onNoteUpdated]);

  // Conflict resolution 2: Keep mine (overwrite with local draft after syncing latest version)
  const keepMine = useCallback(async () => {
    const noteId = activeNoteIdRef.current;
    if (!noteId) return;

    try {
      setStatus('saving');
      const latest = await notesApi.getNoteById(noteId);
      currentVersionRef.current = latest.note.version;
      setHasConflict(false);
      setConflictVersion(null);
      await executeSave({ title: titleRef.current, content: contentRef.current });
    } catch {
      setStatus('error');
    }
  }, [executeSave]);

  const retrySave = useCallback(() => {
    if (!activeNoteIdRef.current) return;
    executeSave({ title: titleRef.current, content: contentRef.current });
  }, [executeSave]);

  return {
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
  };
}
