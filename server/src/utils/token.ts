import jwt, { SignOptions } from 'jsonwebtoken';
import { Response, CookieOptions } from 'express';

export const COOKIE_NAME = 'token';

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET must be set in production');
    }
    return 'dev_jwt_secret_fallback_key';
  }
  return secret;
};

export const signToken = (userId: string): string => {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign({ userId }, secret, options);
};

export const verifyToken = (token: string): { userId: string } => {
  const secret = getJwtSecret();
  return jwt.verify(token, secret) as { userId: string };
};

export const getAuthCookieOptions = (): CookieOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/',
  };
};

export const setAuthCookie = (res: Response, token: string): void => {
  res.cookie(COOKIE_NAME, token, getAuthCookieOptions());
};

export const clearAuthCookie = (res: Response): void => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
  });
};
