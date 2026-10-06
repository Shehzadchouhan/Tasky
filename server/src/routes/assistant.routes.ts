import { Router } from 'express';
import { chatWithAssistant, confirmTaskDeletion } from '../controllers/assistant.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { assistantRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(requireAuth, assistantRateLimiter);
router.post('/chat', chatWithAssistant);
router.post('/confirm-delete', confirmTaskDeletion);

export default router;
