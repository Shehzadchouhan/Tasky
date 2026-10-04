import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

// Fail fast on startup in production if JWT_SECRET is missing
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[Server] FATAL: JWT_SECRET must be set in production');
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

// Connect to MongoDB gracefully
await connectDB();

app.listen(PORT, () => {
  console.log(`[Server] Taskly server running on http://localhost:${PORT}`);
});
