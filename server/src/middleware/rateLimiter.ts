import rateLimit from 'express-rate-limit';

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
  limit: 120, // max 120 write requests per minute per workspace
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: { trustProxy: false },
  keyGenerator: (req) => req.workspaceId.toString(),
  message: {
    error: 'Too many write requests, please try again later',
  },
});
