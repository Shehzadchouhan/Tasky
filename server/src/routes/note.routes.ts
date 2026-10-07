import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { notesWriteRateLimiter } from '../middleware/rateLimiter.js';
import {
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
} from '../controllers/note.controller.js';

const router = Router();

// Protect all note routes with authentication
router.use(requireAuth);

// Routes
router.post('/', notesWriteRateLimiter, createNote);
router.get('/', getNotes);
router.get('/:id', getNoteById);
router.patch('/:id', notesWriteRateLimiter, updateNote);
router.delete('/:id', notesWriteRateLimiter, deleteNote);

export default router;
