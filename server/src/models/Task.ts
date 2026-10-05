import mongoose, { Document, Schema, Types } from 'mongoose';

export type TaskCategory = 'Work' | 'Home' | 'Personal' | 'Urgent' | 'none';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in-progress' | 'done';

export const PRIORITY_RANKS: Record<TaskPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export interface ITask {
  user: Types.ObjectId;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  priorityRank: number;
  status: TaskStatus;
  dueDate: Date | null;
  hasDueDate: boolean;
  order: number;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaskDocument extends ITask, Document {}

const taskSchema = new Schema<ITaskDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    category: {
      type: String,
      enum: ['Work', 'Home', 'Personal', 'Urgent', 'none'],
      default: 'none',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    priorityRank: {
      type: Number,
      default: 2,
    },
    status: {
      type: String,
      enum: ['todo', 'in-progress', 'done'],
      default: 'todo',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    hasDueDate: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
taskSchema.index({ user: 1, status: 1 });
taskSchema.index({ user: 1, dueDate: 1 });
taskSchema.index({ user: 1, completedAt: 1 });

taskSchema.pre('save', function (next) {
  if (this.isModified('priority') || this.priorityRank === undefined) {
    this.priorityRank = PRIORITY_RANKS[this.priority] || 2;
  }
  if (this.isModified('dueDate') || this.hasDueDate === undefined) {
    this.hasDueDate = Boolean(this.dueDate);
  }
  next();
});

taskSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as Record<string, any>;
  if (update) {
    if (update.priority && PRIORITY_RANKS[update.priority as TaskPriority]) {
      update.priorityRank = PRIORITY_RANKS[update.priority as TaskPriority];
    }
    if ('dueDate' in update) {
      update.hasDueDate = Boolean(update.dueDate);
    }

    if (update.$set) {
      if (update.$set.priority && PRIORITY_RANKS[update.$set.priority as TaskPriority]) {
        update.$set.priorityRank = PRIORITY_RANKS[update.$set.priority as TaskPriority];
      }
      if ('dueDate' in update.$set) {
        update.$set.hasDueDate = Boolean(update.$set.dueDate);
      }
    }
  }
  next();
});

taskSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    return ret;
  },
});

export const Task = mongoose.model<ITaskDocument>('Task', taskSchema);
