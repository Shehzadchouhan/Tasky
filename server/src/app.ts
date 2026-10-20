import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import taskRoutes from './routes/task.routes.js';
import assistantRoutes from './routes/assistant.routes.js';
import noteRoutes from './routes/note.routes.js';
import { workspaceMiddleware } from './middleware/workspace.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());

const getClientOrigin = (rawUrl?: string): string => {
  if (!rawUrl) return 'http://localhost:5173';
  try {
    const parsed = new URL(rawUrl);
    return parsed.origin;
  } catch {
    return rawUrl.replace(/\/+$/, '');
  }
};

app.use(
  cors({
    origin: getClientOrigin(process.env.CLIENT_URL),
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/api/tasks', workspaceMiddleware, taskRoutes);
app.use('/api/assistant', workspaceMiddleware, assistantRoutes);
app.use('/api/notes', workspaceMiddleware, noteRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Taskly API is running. Check /api/health for system status.',
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    message: 'Taskly API is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
  });
});

// Central Error Handling Middleware
app.use(errorHandler);

export default app;
