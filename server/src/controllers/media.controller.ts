import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { Types } from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { Note } from '../models/Note.js';
import { MediaAsset } from '../models/MediaAsset.js';
import { AppError } from '../errors/AppError.js';
import { noteIdParamSchema } from '../validation/note.validation.js';
import { ACCEPTED_MIME_TYPES } from '../middleware/noteMediaUpload.js';

const mediaDirectory = path.resolve(process.env.MEDIA_STORAGE_DIR || path.join(process.cwd(), 'uploads'));

const getSafeOriginalName = (originalName: string): string => {
  const name = originalName.replaceAll('\\', '/').split('/').pop()?.trim();
  return (name || 'media-file').slice(0, 200);
};

const getAllowedExtension = (mimeType: string): string | null => {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
  };
  return extensions[mimeType] || null;
};

export const uploadNoteMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    if (!req.file) throw new AppError('Choose an image, video, or audio file to upload.', 400);

    const { id: noteId } = noteIdParamSchema.parse({ id: req.body.noteId });
    const noteExists = await Note.exists({ _id: noteId, user: req.user._id });
    if (!noteExists) throw new AppError('Note not found', 404);

    const detectedType = await fileTypeFromBuffer(req.file.buffer);
    const mimeType = detectedType?.mime || '';
    const extension = getAllowedExtension(mimeType);
    if (!detectedType || !extension || !ACCEPTED_MIME_TYPES.has(mimeType)) {
      throw new AppError('The file contents are not a supported image, video, or audio format.', 415);
    }

    const assetId = new Types.ObjectId();
    const storedName = `${assetId.toString()}.${extension}`;
    const originalName = getSafeOriginalName(req.file.originalname);
    await mkdir(mediaDirectory, { recursive: true });
    await writeFile(path.join(mediaDirectory, storedName), req.file.buffer, { flag: 'wx' });

    try {
      await MediaAsset.create({
        _id: assetId,
        user: req.user._id,
        note: noteId,
        originalName,
        storedName,
        mimeType,
        size: req.file.size,
      });
    } catch (error) {
      await unlink(path.join(mediaDirectory, storedName));
      throw error;
    }

    res.status(201).json({
      media: {
        id: assetId.toString(),
        originalName,
        mimeType,
        size: req.file.size,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getNoteMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const { id } = noteIdParamSchema.parse(req.params);
    const asset = await MediaAsset.findOne({ _id: id, user: req.user._id })
      .select('+storedName')
      .lean();
    if (!asset) throw new AppError('Media not found', 404);

    const storedPath = path.join(mediaDirectory, asset.storedName);
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Length', asset.size);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    const stream = createReadStream(storedPath);
    stream.on('error', (error) => {
      if (res.headersSent) {
        res.destroy(error);
        return;
      }
      next(error);
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const deleteNoteMediaFiles = async (noteId: string): Promise<void> => {
  const assets = await MediaAsset.find({ note: noteId }).select('+storedName').lean();
  await MediaAsset.deleteMany({ note: noteId });
  const removals = await Promise.allSettled(
    assets.map((asset) => unlink(path.join(mediaDirectory, asset.storedName)))
  );
  for (const result of removals) {
    if (result.status === 'rejected' && (result.reason as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[Note media cleanup failed]', result.reason);
    }
  }
};
