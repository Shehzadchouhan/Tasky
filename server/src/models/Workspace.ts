import mongoose, { Document, Schema } from 'mongoose';

export interface IWorkspaceDocument extends Document {
  noteCategories: string[];
}

const workspaceSchema = new Schema<IWorkspaceDocument>({
  noteCategories: {
    type: [String],
    default: [],
  },
});

export const Workspace = mongoose.model<IWorkspaceDocument>('Workspace', workspaceSchema);
