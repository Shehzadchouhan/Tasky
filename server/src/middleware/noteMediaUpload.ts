import multer from 'multer';
import { AppError } from '../errors/AppError.js';

const MAX_MEDIA_SIZE = 50 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
]);

export const noteMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MEDIA_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      callback(new AppError('Only supported image, video, and audio files can be uploaded.', 415));
      return;
    }
    callback(null, true);
  },
}).single('file');

export { ACCEPTED_MIME_TYPES, MAX_MEDIA_SIZE };
