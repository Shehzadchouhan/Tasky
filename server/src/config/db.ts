import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn('[Database] MONGODB_URI not set. Running in disconnected mode.');
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('[Database] Connected successfully to MongoDB');
  } catch (error) {
    console.warn('[Database] MongoDB connection failed. Running in disconnected mode.');
    if (error instanceof Error) {
      console.warn(`[Database] Error detail: ${error.message}`);
    }
  }
};
