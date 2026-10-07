export interface NoteSummary {
  id: string;
  title: string;
  snippet: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  user?: string;
  title: string;
  content: Record<string, any>;
  plainText: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoteListResponse {
  notes: NoteSummary[];
  total: number;
  page: number;
  totalPages: number;
}

export interface SingleNoteResponse {
  note: Note;
}

export interface CreateNoteInput {
  title?: string;
  content?: Record<string, any>;
}

export interface UpdateNoteInput {
  title?: string;
  content?: Record<string, any>;
  baseVersion: number;
}

export interface NoteQueryParams {
  q?: string;
  page?: number;
  limit?: number;
}

export type NoteSaveStatus = 'saved' | 'saving' | 'error';
