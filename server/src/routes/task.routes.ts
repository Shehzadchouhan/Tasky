import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createTask,
  getTasks,
  getTaskStats,
  getTaskById,
  updateTask,
  deleteTask,
  reorderTasks,
} from '../controllers/task.controller.js';

const router = Router();

// Protect all task endpoints
router.use(requireAuth);

router.post('/', createTask);
router.post('/reorder', reorderTasks);
router.get('/', getTasks);
router.get('/stats', getTaskStats);
router.get('/:id', getTaskById);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;
