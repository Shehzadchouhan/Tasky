import { IUserDocument } from '../models/User.js';
import 'multer';

declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
      file?: Express.Multer.File;
      files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[];
    }
  }
}

export {};
