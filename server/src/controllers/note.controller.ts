import { Request, Response, NextFunction } from 'express';
import { Note } from '../models/Note.js';
import {
  createNoteSchema,
  updateNoteSchema,
  noteQuerySchema,
  noteIdParamSchema,
  escapeRegex,
} from '../validation/note.validation.js';
import { extractPlainText } from '../validation/noteContent.validation.js';
import { AppError } from '../errors/AppError.js';

export const createNote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const noteCount = await Note.countDocuments({ user: req.user._id });
    if (noteCount >= 500) {
      throw new AppError('Note limit reached. Maximum of 500 notes allowed.', 400);
    }

    const parsed = createNoteSchema.parse(req.body);
    const content = parsed.content ?? { type: 'doc', content: [] };
    const plainText = extractPlainText(content);
    const title = parsed.title !== undefined && parsed.title.length > 0 ? parsed.title : 'Untitled';

    const note = await Note.create({
      user: req.user._id,
      title,
      content,
      plainText,
      version: 1,
    });

    res.status(201).json({ note });
  } catch (error) {
    next(error);
  }
};

export const getNotes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const query = noteQuerySchema.parse(req.query);

    const filter: Record<string, any> = {
      user: req.user._id,
    };

    if (query.q && query.q.trim()) {
      const safeRegex = new RegExp(escapeRegex(query.q.trim()), 'i');
      filter.$or = [
        { title: safeRegex },
        { plainText: safeRegex },
      ];
    }

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const [notesDocs, total] = await Promise.all([
      Note.find(filter)
        .select('_id title plainText updatedAt')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      Note.countDocuments(filter),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const notes = notesDocs.map((doc) => ({
      id: doc._id.toString(),
      title: doc.title,
      snippet: doc.plainText ? doc.plainText.slice(0, 120) : '',
      updatedAt: doc.updatedAt,
    }));

    res.status(200).json({
      notes,
      total,
      page,
      totalPages,
    });
  } catch (error) {
    next(error);
  }
};

export const getNoteById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = noteIdParamSchema.parse(req.params);

    const note = await Note.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!note) {
      throw new AppError('Note not found', 404);
    }

    res.status(200).json({ note });
  } catch (error) {
    next(error);
  }
};

export const updateNote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = noteIdParamSchema.parse(req.params);
    const { title, content, baseVersion } = updateNoteSchema.parse(req.body);

    const updateFields: Record<string, any> = {};
    if (title !== undefined) {
      updateFields.title = title;
    }
    if (content !== undefined) {
      updateFields.content = content;
      updateFields.plainText = extractPlainText(content);
    }

    const updatedNote = await Note.findOneAndUpdate(
      { _id: id, user: req.user._id, version: baseVersion },
      { ...updateFields, $inc: { version: 1 } },
      { new: true, runValidators: true }
    );

    if (!updatedNote) {
      const existingNote = await Note.findOne({ _id: id, user: req.user._id }).select('version');
      if (existingNote) {
        res.status(409).json({
          error: 'Note version conflict',
          code: 'NOTE_CONFLICT',
          version: existingNote.version,
        });
        return;
      }
      throw new AppError('Note not found', 404);
    }

    res.status(200).json({ note: updatedNote });
  } catch (error) {
    next(error);
  }
};

export const deleteNote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = noteIdParamSchema.parse(req.params);

    await Note.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
};
