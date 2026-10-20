import { Router } from 'express';
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

router.post('/', createTask);
router.post('/reorder', reorderTasks);
router.get('/', getTasks);
router.get('/stats', getTaskStats);
router.get('/:id', getTaskById);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;
