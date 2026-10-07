import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { notesApi } from '../api/notes.api.ts';
import type {
  NoteQueryParams,
  NoteListResponse,
  SingleNoteResponse,
  CreateNoteInput,
  UpdateNoteInput,
} from '../types/note.types.ts';

export function useNotesListQuery(
  params: NoteQueryParams,
  options?: { enabled?: boolean }
) {
  return useQuery<NoteListResponse>({
    queryKey: ['notes', 'list', params],
    queryFn: () => notesApi.getNotes(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  });
}

export function useNoteQuery(
  id: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery<SingleNoteResponse>({
    queryKey: ['notes', 'detail', id],
    queryFn: () => {
      if (!id) throw new Error('Note ID is required');
      return notesApi.getNoteById(id);
    },
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateNoteInput) => notesApi.createNote(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notes', 'list'] });
      queryClient.setQueryData(['notes', 'detail', data.note.id], data);
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNoteInput }) =>
      notesApi.updateNote(id, data),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['notes', 'detail', variables.id], data);
      queryClient.invalidateQueries({ queryKey: ['notes', 'list'] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notesApi.deleteNote(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ['notes', 'detail', id] });
      queryClient.invalidateQueries({ queryKey: ['notes', 'list'] });
    },
  });
}
