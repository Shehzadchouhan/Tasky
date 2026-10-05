import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Task, PRIORITY_RANKS, TaskPriority } from '../models/Task.js';
import {
  createTaskSchema,
  updateTaskSchema,
  taskQuerySchema,
  taskIdParamSchema,
  reorderTasksSchema,
  taskStatsQuerySchema,
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
    const completedAt = status === 'done' ? new Date() : null;

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
      completedAt,
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

      if (validatedData.status === 'done') {
        updatePayload.completedAt = new Date();
      } else {
        updatePayload.completedAt = null;
      }
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
      }).select('_id status completedAt');

      if (userTasks.length !== orderedIds.length) {
        throw new AppError('Task not found', 404);
      }

      const taskMap = new Map(userTasks.map((t) => [t._id.toString(), t]));
      const now = new Date();

      const operations = orderedIds.map((id, index) => {
        const existing = taskMap.get(id);
        let taskCompletedAt: Date | null = null;
        if (status === 'done') {
          taskCompletedAt = existing?.status === 'done' && existing.completedAt ? existing.completedAt : now;
        }

        return {
          updateOne: {
            filter: { _id: id, user: userId },
            update: { $set: { status, order: index, completedAt: taskCompletedAt } },
          },
        };
      });

      await Task.bulkWrite(operations);
    }

    res.status(200).json({
      message: 'Tasks reordered successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getTaskStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const { tz, days } = taskStatsQuerySchema.parse(req.query);
    const userId = new mongoose.Types.ObjectId(req.user._id);

    // Calculate calendar dates for the last `days` in user's timezone
    const now = new Date();
    const todayInTz = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
    const [y, m, d] = todayInTz.split('-').map(Number);
    const targetUtc = new Date(Date.UTC(y, m - 1, d));

    const dateList: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(targetUtc);
      day.setUTCDate(targetUtc.getUTCDate() - i);
      dateList.push(day.toISOString().slice(0, 10));
    }

    // Single aggregation query scoped to user
    const [facetResult] = await Task.aggregate([
      {
        $match: {
          user: userId,
        },
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                todo: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
                inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
                done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
                overdue: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $ne: ['$status', 'done'] },
                          { $eq: ['$hasDueDate', true] },
                          { $ne: ['$dueDate', null] },
                          {
                            $lt: [
                              {
                                $dateToString: {
                                  format: '%Y-%m-%d',
                                  date: '$dueDate',
                                  timezone: tz,
                                },
                              },
                              todayInTz,
                            ],
                          },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          byCategory: [
            {
              $group: {
                _id: '$category',
                count: { $sum: 1 },
              },
            },
          ],
          byPriority: [
            {
              $group: {
                _id: '$priority',
                count: { $sum: 1 },
              },
            },
          ],
          completedPerDay: [
            {
              $match: {
                status: 'done',
                completedAt: { $ne: null },
              },
            },
            {
              $project: {
                dateStr: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$completedAt',
                    timezone: tz,
                  },
                },
              },
            },
            {
              $group: {
                _id: '$dateStr',
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const totalsDoc = facetResult?.totals?.[0] || {
      total: 0,
      todo: 0,
      inProgress: 0,
      done: 0,
      overdue: 0,
    };

    const total = totalsDoc.total || 0;
    const done = totalsDoc.done || 0;
    const completionRate = total > 0 ? Math.round((done / total) * 1000) / 10 : 0;

    const totals = {
      total,
      todo: totalsDoc.todo || 0,
      inProgress: totalsDoc.inProgress || 0,
      done,
      overdue: totalsDoc.overdue || 0,
      completionRate,
    };

    const byCategory: Record<string, number> = {
      Work: 0,
      Home: 0,
      Personal: 0,
      Urgent: 0,
      none: 0,
    };
    for (const item of facetResult?.byCategory || []) {
      if (item._id && item._id in byCategory) {
        byCategory[item._id] = item.count;
      }
    }

    const byPriority: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
    };
    for (const item of facetResult?.byPriority || []) {
      if (item._id && item._id in byPriority) {
        byPriority[item._id] = item.count;
      }
    }

    const completedMap = new Map<string, number>();
    for (const item of facetResult?.completedPerDay || []) {
      if (item._id) {
        completedMap.set(item._id, item.count);
      }
    }

    const completedPerDay = dateList.map((date) => ({
      date,
      count: completedMap.get(date) || 0,
    }));

    res.status(200).json({
      totals,
      completedPerDay,
      byCategory,
      byPriority,
    });
  } catch (error) {
    next(error);
  }
};
