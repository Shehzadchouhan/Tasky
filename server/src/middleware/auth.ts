import { Request, Response, NextFunction } from 'express';
import { COOKIE_NAME, verifyToken } from '../utils/token.js';
import { User } from '../models/User.js';
import { AppError } from '../errors/AppError.js';

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
      throw new AppError('Authentication required', 401);
    }

    let decoded: { userId: string };
    try {
      decoded = verifyToken(token);
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AppError('User not found', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
