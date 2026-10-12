import { Request, Response, NextFunction } from 'express';
import { Note } from '../models/Note.js';
import { User } from '../models/User.js';
import {
  createNoteSchema,
  updateNoteSchema,
  noteQuerySchema,
  noteIdParamSchema,
  escapeRegex,
  createNoteCategorySchema,
  renameNoteCategorySchema,
} from '../validation/note.validation.js';
import { extractPlainText } from '../validation/noteContent.validation.js';
import { AppError } from '../errors/AppError.js';
import { deleteNoteMediaFiles } from './media.controller.js';
import { MediaAsset } from '../models/MediaAsset.js';

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
      category: parsed.category || '',
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
    if (query.category !== undefined) {
      filter.category = query.category;
    }

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const [notesDocs, total] = await Promise.all([
      Note.find(filter)
        .select('_id title category plainText updatedAt')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      Note.countDocuments(filter),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const notes = notesDocs.map((doc) => ({
      id: doc._id.toString(),
      title: doc.title,
      category: doc.category || '',
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
    const { title, category, content, baseVersion } = updateNoteSchema.parse(req.body);

    if (content !== undefined) {
      const referencedMedia = extractNoteMedia(content);
      if (referencedMedia.length > 0) {
        const attachedMedia = await MediaAsset.find({
          _id: { $in: referencedMedia.map((item) => item.id) },
          user: req.user._id,
          note: id,
        }).select('mimeType').lean();
        if (attachedMedia.length !== referencedMedia.length) {
          throw new AppError('Note content can only reference media uploaded to this note.', 400);
        }
        const mimeTypesById = new Map(
          attachedMedia.map((asset) => [asset._id.toString(), asset.mimeType])
        );
        if (referencedMedia.some((item) => !mimeTypesById.get(item.id)?.startsWith(`${item.type}/`))) {
          throw new AppError('Media must be inserted using its matching media type.', 400);
        }
      }
    }

    const updateFields: Record<string, any> = {};
    if (title !== undefined) {
      updateFields.title = title;
    }
    if (category !== undefined) {
      updateFields.category = category;
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

export const getNoteCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    res.status(200).json({ categories: req.user.noteCategories || [] });
  } catch (error) {
    next(error);
  }
};

export const createNoteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const { name } = createNoteCategorySchema.parse(req.body);
    const categories = req.user.noteCategories || [];

    if (categories.some((category) => category.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new AppError('A category with this name already exists', 409);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { noteCategories: name } },
      { new: true, runValidators: true }
    ).select('noteCategories');

    if (!user) throw new AppError('User not found', 404);
    res.status(201).json({ categories: user.noteCategories });
  } catch (error) {
    next(error);
  }
};

export const renameNoteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const { oldName, name } = renameNoteCategorySchema.parse(req.body);
    const categories = req.user.noteCategories || [];
    const existingName = categories.find(
      (category) => category.toLocaleLowerCase() === oldName.toLocaleLowerCase()
    );

    if (!existingName) throw new AppError('Category not found', 404);
    if (
      categories.some(
        (category) =>
          category.toLocaleLowerCase() === name.toLocaleLowerCase() &&
          category.toLocaleLowerCase() !== existingName.toLocaleLowerCase()
      )
    ) {
      throw new AppError('A category with this name already exists', 409);
    }

    const renamedCategories = categories.map((category) =>
      category === existingName ? name : category
    );
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { noteCategories: renamedCategories } },
      { new: true, runValidators: true }
    ).select('noteCategories');
    if (!user) throw new AppError('User not found', 404);

    if (existingName !== name) {
      await Note.updateMany(
        { user: req.user._id, category: existingName },
        { $set: { category: name }, $inc: { version: 1 } }
      );
    }

    res.status(200).json({ categories: user.noteCategories });
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

    const deletedNote = await Note.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });
    if (deletedNote) {
      await deleteNoteMediaFiles(id);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
};

const extractNoteMedia = (
  content: Record<string, any>
): Array<{ id: string; type: 'image' | 'video' | 'audio' }> => {
  const media = new Map<string, 'image' | 'video' | 'audio'>();
  const visit = (node: Record<string, any>) => {
    if (
      (node.type === 'image' || node.type === 'video' || node.type === 'audio') &&
      typeof node.attrs?.src === 'string'
    ) {
      try {
        const url = new URL(node.attrs.src, 'https://taskly.invalid');
        const match = url.pathname.match(/\/notes\/media\/([a-f\d]{24})$/i);
        if (match) media.set(match[1], node.type);
      } catch {
        return;
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        if (child && typeof child === 'object' && !Array.isArray(child)) visit(child);
      }
    }
  };
  visit(content);
  return [...media].map(([id, type]) => ({ id, type }));
};
