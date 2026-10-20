import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';
import { MulterError } from 'multer';

interface MongoDuplicateKeyError extends Error {
  code: number;
  keyValue?: Record<string, unknown>;
}

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (err instanceof MulterError || err.name === 'MulterError') {
    const multerCode = (err as any).code;
    const statusCode = multerCode === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(statusCode).json({
      error: multerCode === 'LIMIT_FILE_SIZE'
        ? 'Media uploads cannot exceed 50 MB.'
        : 'Invalid media upload.',
    });
    return;
  }

  // Custom AppError
  if (err instanceof AppError || ('statusCode' in err && typeof (err as any).statusCode === 'number')) {
    const statusCode = (err as any).statusCode || 500;
    res.status(statusCode).json({
      error: err.message,
      ...((err as any).code ? { code: (err as any).code } : {}),
      ...((err as any).details ? { details: (err as any).details } : {}),
      ...(!isProduction && statusCode === 500 ? { stack: err.stack } : {}),
    });
    return;
  }

  // Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      error: formattedErrors[0]?.message || 'Validation failed',
      details: formattedErrors,
    });
    return;
  }

  // MongoDB Duplicate Key Error (11000)
  if ((err as MongoDuplicateKeyError).code === 11000) {
    res.status(409).json({
      error: 'Email already in use',
    });
    return;
  }

  // Fallback 500 Internal Server Error
  console.error('[Unhandled Server Error]', err);

  res.status(500).json({
    error: 'Internal server error',
    ...(!isProduction ? { stack: err.stack } : {}),
  });
};
