import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMediaAsset {
  user: Types.ObjectId;
  note: Types.ObjectId;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
}

export interface IMediaAssetDocument extends IMediaAsset, Document {}

const mediaAssetSchema = new Schema<IMediaAssetDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    note: { type: Schema.Types.ObjectId, ref: 'Note', required: true, index: true },
    originalName: { type: String, required: true, maxlength: 200 },
    storedName: { type: String, required: true, unique: true, select: false },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const MediaAsset = mongoose.model<IMediaAssetDocument>('MediaAsset', mediaAssetSchema);
