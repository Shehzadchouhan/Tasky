import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError.js';

const { JsonWebTokenError, TokenExpiredError } = jwt;

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

  // Custom AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
      ...(!isProduction && err.statusCode === 500 ? { stack: err.stack } : {}),
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

  // JWT Errors
  if (err instanceof JsonWebTokenError || err instanceof TokenExpiredError) {
    res.status(401).json({
      error: 'Invalid or expired token',
    });
    return;
  }

  // Fallback 500 Internal Server Error
  if (!isProduction) {
    console.error('[Unhandled Error]', err);
  }

  res.status(500).json({
    error: 'Internal server error',
    ...(!isProduction ? { stack: err.stack } : {}),
  });
};
