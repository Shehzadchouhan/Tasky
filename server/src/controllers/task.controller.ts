import { Request, Response, NextFunction } from 'express';
import { Task, PRIORITY_RANKS, TaskPriority } from '../models/Task.js';
import {
  createTaskSchema,
  updateTaskSchema,
  taskQuerySchema,
  taskIdParamSchema,
  reorderTasksSchema,
  escapeRegex,
} from '../validation/task.validation.js';
import { AppError } from '../errors/AppError.js';

export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const validatedData = createTaskSchema.parse(req.body);
    const priorityRank = PRIORITY_RANKS[validatedData.priority as TaskPriority] || 2;
    const hasDueDate = Boolean(validatedData.dueDate);
    const status = validatedData.status || 'todo';

    const lastTask = await Task.findOne({
      user: req.user._id,
      status,
    })
      .sort({ order: -1 })
      .select('order');

    const order = lastTask !== null && typeof lastTask.order === 'number' ? lastTask.order + 1 : 0;

    const task = await Task.create({
      ...validatedData,
      status,
      priorityRank,
      hasDueDate,
      order,
      user: req.user._id,
    });

    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
};

export const getTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const query = taskQuerySchema.parse(req.query);

    const filter: Record<string, any> = {
      user: req.user._id,
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.category) {
      filter.category = query.category;
    }

    if (query.priority) {
      filter.priority = query.priority;
    }

    if (query.search) {
      filter.title = { $regex: escapeRegex(query.search), $options: 'i' };
    }

    const sortDir: 1 | -1 = query.order === 'asc' ? 1 : -1;
    let sortOptions: Record<string, 1 | -1>;

    if (query.sort === 'dueDate') {
      // Tasks with no dueDate must always come last, for both asc and desc
      sortOptions = {
        hasDueDate: -1,
        dueDate: sortDir,
        _id: sortDir,
      };
    } else if (query.sort === 'order') {
      sortOptions = {
        order: sortDir,
        _id: sortDir,
      };
    } else if (query.sort === 'priority') {
      // low < medium < high
      sortOptions = {
        priorityRank: sortDir,
        _id: sortDir,
      };
    } else {
      // default: createdAt
      sortOptions = {
        createdAt: sortDir,
        _id: sortDir,
      };
    }

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      Task.find(filter).sort(sortOptions).skip(skip).limit(limit),
      Task.countDocuments(filter),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    res.status(200).json({
      tasks,
      total,
      page,
      totalPages,
    });
  } catch (error) {
    next(error);
  }
};

export const getTaskById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = taskIdParamSchema.parse(req.params);

    const task = await Task.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    res.status(200).json({ task });
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = taskIdParamSchema.parse(req.params);
    const validatedData = updateTaskSchema.parse(req.body);

    const existingTask = await Task.findOne({
      _id: id,
      user: req.user._id,
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
        user: req.user._id,
        status: validatedData.status,
      })
        .sort({ order: -1 })
        .select('order');

      updatePayload.order =
        lastTaskInNewCol !== null && typeof lastTaskInNewCol.order === 'number'
          ? lastTaskInNewCol.order + 1
          : 0;
    }

    const task = await Task.findOneAndUpdate(
      {
        _id: id,
        user: req.user._id,
      },
      {
        $set: updatePayload,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({ task });
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { id } = taskIdParamSchema.parse(req.params);

    const task = await Task.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    res.status(200).json({
      message: 'Task deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const reorderTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const userId = req.user._id;
    const { status, orderedIds } = reorderTasksSchema.parse(req.body);

    if (orderedIds.length > 0) {
      const userTasks = await Task.find({
        _id: { $in: orderedIds },
        user: userId,
      }).select('_id');

      if (userTasks.length !== orderedIds.length) {
        throw new AppError('Task not found', 404);
      }

      const operations = orderedIds.map((id, index) => ({
        updateOne: {
          filter: { _id: id, user: userId },
          update: { $set: { status, order: index } },
        },
      }));

      await Task.bulkWrite(operations);
    }

    res.status(200).json({
      message: 'Tasks reordered successfully',
    });
  } catch (error) {
    next(error);
  }
};
