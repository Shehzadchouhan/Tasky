import mongoose, { Document, Schema, Types } from 'mongoose';

export interface INote {
  user: Types.ObjectId;
  title: string;
  content: Record<string, any>;
  plainText: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface INoteDocument extends INote, Document {}

const noteSchema = new Schema<INoteDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 120,
      default: 'Untitled',
    },
    content: {
      type: Schema.Types.Mixed,
      required: true,
      default: () => ({ type: 'doc', content: [] }),
    },
    plainText: {
      type: String,
      default: '',
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user notes sorted by updatedAt descending
noteSchema.index({ user: 1, updatedAt: -1 });

noteSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    return ret;
  },
});

export const Note = mongoose.model<INoteDocument>('Note', noteSchema);
