import { Types } from 'mongoose';
import 'multer';

declare global {
  namespace Express {
    interface Request {
      workspaceId: Types.ObjectId;
      file?: Express.Multer.File;
      files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[];
    }
  }
}

export {};
