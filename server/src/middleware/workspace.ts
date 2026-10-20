import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { getWorkspaceSecret } from '../utils/token.js';

const WORKSPACE_COOKIE = 'taskly_workspace';
const LEGACY_AUTH_COOKIE = 'token';
const WORKSPACE_MAX_AGE = 10 * 365 * 24 * 60 * 60 * 1000;

export const workspaceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = req.cookies?.[WORKSPACE_COOKIE];
  let workspaceId: string | undefined;
  let hasValidWorkspaceToken = false;

  if (token) {
    try {
      const decoded = jwt.verify(token, getWorkspaceSecret());
      if (
        typeof decoded === 'object' &&
        decoded !== null &&
        typeof decoded.workspaceId === 'string' &&
        mongoose.isValidObjectId(decoded.workspaceId)
      ) {
        workspaceId = decoded.workspaceId;
        hasValidWorkspaceToken = true;
      }
    } catch {
      workspaceId = undefined;
    }
  }

  const legacyToken = req.cookies?.[LEGACY_AUTH_COOKIE];
  if (!workspaceId && legacyToken) {
    try {
      const decoded = jwt.verify(legacyToken, getWorkspaceSecret());
      if (
        typeof decoded === 'object' &&
        decoded !== null &&
        typeof decoded.userId === 'string' &&
        mongoose.isValidObjectId(decoded.userId)
      ) {
        workspaceId = decoded.userId;
      }
    } catch {
      workspaceId = undefined;
    }
  }

  if (!workspaceId) {
    workspaceId = new mongoose.Types.ObjectId().toString();
  }

  if (!hasValidWorkspaceToken) {
    const isProduction = process.env.NODE_ENV === 'production';
    const workspaceToken = jwt.sign(
      { workspaceId },
      getWorkspaceSecret(),
      { expiresIn: '3650d' }
    );
    res.cookie(WORKSPACE_COOKIE, workspaceToken, {
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      maxAge: WORKSPACE_MAX_AGE,
      path: '/',
    });
  }

  if (legacyToken) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie(LEGACY_AUTH_COOKIE, {
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      path: '/',
    });
  }

  req.workspaceId = new mongoose.Types.ObjectId(workspaceId);
  next();
};
