import { Router } from 'express';
import { notesWriteRateLimiter } from '../middleware/rateLimiter.js';
import { noteMediaUpload } from '../middleware/noteMediaUpload.js';
import { getNoteMedia, uploadNoteMedia } from '../controllers/media.controller.js';
import {
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
  getNoteCategories,
  createNoteCategory,
  renameNoteCategory,
} from '../controllers/note.controller.js';

const router = Router();

// Routes
router.post('/', notesWriteRateLimiter, createNote);
router.post('/media', notesWriteRateLimiter, noteMediaUpload, uploadNoteMedia);
router.get('/media/:id', getNoteMedia);
router.get('/categories', getNoteCategories);
router.post('/categories', notesWriteRateLimiter, createNoteCategory);
router.patch('/categories', notesWriteRateLimiter, renameNoteCategory);
router.get('/', getNotes);
router.get('/:id', getNoteById);
router.patch('/:id', notesWriteRateLimiter, updateNote);
router.delete('/:id', notesWriteRateLimiter, deleteNote);

export default router;
