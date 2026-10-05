import mongoose from 'mongoose';
import { Task } from '../models/Task.js';

export const backfillCompletedAt = async (): Promise<void> => {
  try {
    await Task.updateMany(
      { status: 'done', completedAt: { $in: [null, undefined] } },
      [{ $set: { completedAt: '$updatedAt' } }]
    );
  } catch (error) {
    console.warn('[Database] Failed to backfill completedAt:', error);
  }
};

export const connectDB = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn('[Database] MONGODB_URI not set. Running in disconnected mode.');
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('[Database] Connected successfully to MongoDB');
    await backfillCompletedAt();
  } catch (error) {
    console.warn('[Database] MongoDB connection failed. Running in disconnected mode.');
    if (error instanceof Error) {
      console.warn(`[Database] Error detail: ${error.message}`);
    }
  }
};
