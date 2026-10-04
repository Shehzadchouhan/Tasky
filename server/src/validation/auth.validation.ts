import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string('Name is required')
    .trim()
    .min(1, 'Name must be at least 1 character')
    .max(50, 'Name must not exceed 50 characters'),
  email: z
    .string('Email is required')
    .trim()
    .email('Invalid email address')
    .toLowerCase(),
  password: z
    .string('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must not exceed 72 characters'),
});

export const loginSchema = z.object({
  email: z
    .string('Email is required')
    .trim()
    .email('Invalid email address')
    .toLowerCase(),
  password: z
    .string('Password is required')
    .min(1, 'Password is required')
    .max(72, 'Password must not exceed 72 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
