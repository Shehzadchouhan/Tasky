import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // max 100 requests per 15 minutes per IP
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  validate: { trustProxy: false },
  message: {
    error: 'Too many requests, please try again later',
  },
});

export const assistantRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  validate: { trustProxy: false },
  message: {
    error: 'Assistant request limit reached. Please try again later.',
  },
});

export const notesWriteRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 120, // max 120 write requests per minute per user
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { trustProxy: false },
  keyGenerator: (req) => {
    return (req as any).user?._id?.toString() || 'anonymous';
  },
  message: {
    error: 'Too many write requests, please try again later',
  },
});

