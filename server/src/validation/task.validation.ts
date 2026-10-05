import { z } from 'zod';
import mongoose from 'mongoose';

export const escapeRegex = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const isValidObjectId = (val: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(val) && mongoose.Types.ObjectId.isValid(val);
};

export const taskIdParamSchema = z
  .object({
    id: z.string().refine(isValidObjectId, {
      message: 'Invalid task ID',
    }),
  })
  .strict();

export const createTaskSchema = z
  .object({
    title: z
      .string('Title is required')
      .trim()
      .min(1, 'Title must be between 1 and 120 characters')
      .max(120, 'Title must be between 1 and 120 characters'),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional()
      .default(''),
    category: z
      .enum(['Work', 'Home', 'Personal', 'Urgent', 'none'] as const)
      .optional()
      .default('none'),
    priority: z
      .enum(['low', 'medium', 'high'] as const)
      .optional()
      .default('medium'),
    status: z
      .enum(['todo', 'in-progress', 'done'] as const)
      .optional()
      .default('todo'),
    dueDate: z
      .preprocess((val) => (val === '' ? null : val), z.coerce.date().nullable().optional())
      .default(null),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title must be between 1 and 120 characters')
      .max(120, 'Title must be between 1 and 120 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(1000, 'Description cannot exceed 1000 characters')
      .nullable()
      .optional(),
    category: z
      .enum(['Work', 'Home', 'Personal', 'Urgent', 'none'] as const)
      .optional(),
    priority: z
      .enum(['low', 'medium', 'high'] as const)
      .optional(),
    status: z
      .enum(['todo', 'in-progress', 'done'] as const)
      .optional(),
    dueDate: z
      .preprocess((val) => (val === '' ? null : val), z.coerce.date().nullable().optional()),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Request body cannot be empty',
  });

export const reorderTasksSchema = z
  .object({
    status: z.enum(['todo', 'in-progress', 'done'] as const),
    orderedIds: z
      .array(
        z.string().refine(isValidObjectId, {
          message: 'Invalid task ID',
        })
      )
      .max(200, 'Cannot reorder more than 200 tasks')
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Task IDs must be unique',
      }),
  })
  .strict();

export const taskQuerySchema = z
  .object({
    status: z.enum(['todo', 'in-progress', 'done'] as const).optional(),
    category: z.enum(['Work', 'Home', 'Personal', 'Urgent', 'none'] as const).optional(),
    priority: z.enum(['low', 'medium', 'high'] as const).optional(),
    search: z.string().trim().optional(),
    sort: z.enum(['dueDate', 'createdAt', 'priority', 'order'] as const).optional().default('createdAt'),
    order: z.enum(['asc', 'desc'] as const).optional().default('desc'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50, 'Limit cannot exceed 50').optional().default(10),
  })
  .strict();

const isValidIANATimezone = (tz: string): boolean => {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const taskStatsQuerySchema = z
  .object({
    tz: z
      .string('Timezone is required')
      .min(1, 'Timezone is required')
      .refine(isValidIANATimezone, {
        message: 'Invalid IANA timezone',
      }),
    days: z.preprocess(
      (val) => (val === undefined ? 7 : Number(val)),
      z.union([z.literal(7), z.literal(14), z.literal(30)], {
        message: 'Days must be 7, 14, or 30',
      })
    ),
  })
  .strict();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ReorderTasksInput = z.infer<typeof reorderTasksSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;
export type TaskStatsQueryInput = z.infer<typeof taskStatsQuerySchema>;
