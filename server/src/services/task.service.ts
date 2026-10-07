import mongoose from 'mongoose';
import { Task, ITaskDocument, PRIORITY_RANKS, TaskPriority } from '../models/Task.js';
import {
  createTaskSchema,
  updateTaskSchema,
  CreateTaskInput,
  UpdateTaskInput,
} from '../validation/task.validation.js';
import { AppError } from '../errors/AppError.js';

export const createTaskRecord = async (
  userId: mongoose.Types.ObjectId,
  data: CreateTaskInput
): Promise<ITaskDocument> => {
  const validatedData = createTaskSchema.parse(data);
  const priorityRank = PRIORITY_RANKS[validatedData.priority as TaskPriority] || 2;
  const hasDueDate = Boolean(validatedData.dueDate);
  const status = validatedData.status || 'todo';
  const completedAt = status === 'done' ? new Date() : null;

  const lastTask = await Task.findOne({
    user: userId,
    status,
  })
    .sort({ order: -1 })
    .select('order');

  const order = lastTask !== null && typeof lastTask.order === 'number' ? lastTask.order + 1 : 0;

  return Task.create({
    ...validatedData,
    status,
    completedAt,
    priorityRank,
    hasDueDate,
    order,
    user: userId,
  });
};

export const updateTaskRecord = async (
  userId: mongoose.Types.ObjectId,
  taskId: string,
  updates: UpdateTaskInput
): Promise<ITaskDocument> => {
  if (!mongoose.isValidObjectId(taskId)) {
    throw new AppError('Invalid task ID', 400);
  }

  const validatedData = updateTaskSchema.parse(updates);

  const existingTask = await Task.findOne({
    _id: taskId,
    user: userId,
  });

  if (!existingTask) {
    throw new AppError('Task not found', 404);
  }

  const updatePayload: Record<string, any> = { ...validatedData };

  if (validatedData.priority) {
    updatePayload.priorityRank = PRIORITY_RANKS[validatedData.priority as TaskPriority];
  }

  if ('dueDate' in validatedData) {
    updatePayload.hasDueDate = Boolean(validatedData.dueDate);
  }

  if (validatedData.status && validatedData.status !== existingTask.status) {
    const lastTaskInNewCol = await Task.findOne({
      user: userId,
      status: validatedData.status,
    })
      .sort({ order: -1 })
      .select('order');

    updatePayload.order =
      lastTaskInNewCol !== null && typeof lastTaskInNewCol.order === 'number'
        ? lastTaskInNewCol.order + 1
        : 0;

    if (validatedData.status === 'done') {
      updatePayload.completedAt = new Date();
    } else {
      updatePayload.completedAt = null;
    }
  }

  const task = await Task.findOneAndUpdate(
    {
      _id: taskId,
      user: userId,
    },
    {
      $set: updatePayload,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!task) {
    throw new AppError('Task not found', 404);
  }

  return task;
};
