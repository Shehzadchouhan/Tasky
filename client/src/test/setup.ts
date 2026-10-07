import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Polyfill window.matchMedia for JSDOM
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  if (!window.ResizeObserver) {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class IntersectionObserver {
      root = null;
      rootMargin = '';
      thresholds = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as any;
  }
}

// Default mock for notesApi to prevent unhandled network requests in page tests
vi.mock('../api/notes.api.ts', () => ({
  notesApi: {
    getNotes: vi.fn().mockResolvedValue({ notes: [], total: 0, page: 1, totalPages: 0 }),
    getNoteById: vi.fn().mockResolvedValue({
      note: {
        id: 'note-default',
        title: 'Untitled',
        content: { type: 'doc', content: [] },
        plainText: '',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }),
    createNote: vi.fn().mockResolvedValue({
      note: {
        id: 'note-created',
        title: 'Untitled',
        content: { type: 'doc', content: [] },
        plainText: '',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }),
    updateNote: vi.fn().mockResolvedValue({
      note: {
        id: 'note-updated',
        title: 'Updated',
        content: { type: 'doc', content: [] },
        plainText: '',
        version: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }),
    deleteNote: vi.fn().mockResolvedValue({ ok: true }),
    flushNoteUnload: vi.fn(),
  },
}));
