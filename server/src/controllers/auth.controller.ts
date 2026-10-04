import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { User, IUserDocument } from '../models/User.js';
import { registerSchema, loginSchema } from '../validation/auth.validation.js';
import { signToken, setAuthCookie, clearAuthCookie } from '../utils/token.js';
import { AppError } from '../errors/AppError.js';

interface UserResponse {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

const formatUserResponse = (user: IUserDocument): UserResponse => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
});

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const existingUser = await User.findOne({ email: validatedData.email });
    if (existingUser) {
      throw new AppError('Email already in use', 409);
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(validatedData.password, saltRounds);

    const newUser = await User.create({
      name: validatedData.name,
      email: validatedData.email,
      passwordHash,
    });

    const token = signToken(newUser._id.toString());
    setAuthCookie(res, token);

    res.status(201).json({
      user: formatUserResponse(newUser),
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await User.findOne({ email: validatedData.email }).select('+passwordHash');
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isMatch = await bcrypt.compare(validatedData.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = signToken(user._id.toString());
    setAuthCookie(res, token);

    res.status(200).json({
      user: formatUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  _req: Request,
  res: Response
): Promise<void> => {
  clearAuthCookie(res);
  res.status(200).json({
    message: 'Logged out successfully',
  });
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    res.status(200).json({
      user: formatUserResponse(req.user),
    });
  } catch (error) {
    next(error);
  }
};
