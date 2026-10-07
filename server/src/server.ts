import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

// Fail fast on startup in production if JWT_SECRET is missing
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[Server] FATAL: JWT_SECRET must be set in production');
  process.exit(1);
}

const DEFAULT_PORT = Number(process.env.PORT || 5000);
const MAX_PORT_RETRIES = 10;

const startServer = async (port: number, attempt = 1): Promise<void> => {
  const server = app.listen(port, () => {
    console.log(`[Server] Taskly server running on http://localhost:${port}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      if (attempt >= MAX_PORT_RETRIES) {
        console.error(`[Server] Could not start on port ${port} after ${MAX_PORT_RETRIES} attempts.`);
        process.exit(1);
      }

      const nextPort = port + 1;
      console.warn(`[Server] Port ${port} is busy. Retrying on ${nextPort}...`);
      void startServer(nextPort, attempt + 1);
      return;
    }

    console.error('[Server] Failed to start server:', error);
    process.exit(1);
  });
};

// Connect to MongoDB gracefully
await connectDB();

await startServer(DEFAULT_PORT);
