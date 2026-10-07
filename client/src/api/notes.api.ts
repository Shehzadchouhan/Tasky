import { apiClient } from './client.ts';
import type {
  NoteListResponse,
  SingleNoteResponse,
  CreateNoteInput,
  UpdateNoteInput,
  NoteQueryParams,
} from '../types/note.types.ts';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const notesApi = {
  getNotes: async (params?: NoteQueryParams): Promise<NoteListResponse> => {
    const searchParams = new URLSearchParams();

    if (params) {
      if (params.q && params.q.trim()) {
        searchParams.set('q', params.q.trim());
      }
      if (params.page !== undefined) {
        searchParams.set('page', String(params.page));
      }
      if (params.limit !== undefined) {
        searchParams.set('limit', String(params.limit));
      }
    }

    const query = searchParams.toString();
    const endpoint = query ? `/notes?${query}` : '/notes';
    return apiClient<NoteListResponse>(endpoint, { method: 'GET' });
  },

  getNoteById: async (id: string): Promise<SingleNoteResponse> => {
    return apiClient<SingleNoteResponse>(`/notes/${id}`, { method: 'GET' });
  },

  createNote: async (data: CreateNoteInput): Promise<SingleNoteResponse> => {
    return apiClient<SingleNoteResponse>('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateNote: async (id: string, data: UpdateNoteInput): Promise<SingleNoteResponse> => {
    return apiClient<SingleNoteResponse>(`/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteNote: async (id: string): Promise<{ ok: boolean }> => {
    return apiClient<{ ok: boolean }>(`/notes/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Flush note save on window exit / beforeunload using fetch keepalive
   * to guarantee the browser does not cancel in-flight network requests.
   */
  flushNoteUnload: (id: string, data: UpdateNoteInput): void => {
    try {
      const url = `${BASE_URL.replace(/\/+$/, '')}/notes/${id}`;
      fetch(url, {
        method: 'PATCH',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
    } catch {
      // Ignored during unload
    }
  },
};
