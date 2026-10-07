import { z } from 'zod';
import mongoose from 'mongoose';
import { validateTipTapDoc } from './noteContent.validation.js';

export const escapeRegex = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const isValidObjectId = (val: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(val) && mongoose.Types.ObjectId.isValid(val);
};

export const noteIdParamSchema = z
  .object({
    id: z.string().refine(isValidObjectId, {
      message: 'Invalid note ID',
    }),
  })
  .strict();

export const tipTapContentSchema = z.any().superRefine((val, ctx) => {
  if (val === undefined || val === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Content cannot be null or undefined if provided',
    });
    return;
  }
  try {
    validateTipTapDoc(val);
  } catch (err: any) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: err.message || 'Invalid TipTap document format',
    });
  }
});

export const createNoteSchema = z
  .object({
    title: z
      .string()
      .trim()
      .max(120, 'Title cannot exceed 120 characters')
      .optional(),
    content: tipTapContentSchema.optional(),
  })
  .strict();

export const updateNoteSchema = z
  .object({
    title: z
      .string()
      .trim()
      .max(120, 'Title cannot exceed 120 characters')
      .optional(),
    content: tipTapContentSchema.optional(),
    baseVersion: z
      .number()
      .int('baseVersion must be an integer'),
  })
  .strict()
  .refine(
    (data) => data.title !== undefined || data.content !== undefined,
    {
      message: 'Request body must contain title or content to update',
    }
  );

export const noteQuerySchema = z
  .object({
    q: z
      .string()
      .max(100, 'Search query cannot exceed 100 characters')
      .optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50, 'Limit cannot exceed 50').optional().default(20),
  })
  .strict();

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type NoteQueryInput = z.infer<typeof noteQuerySchema>;
