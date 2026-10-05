import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { Task } from '../src/models/Task.js';
import { backfillCompletedAt } from '../src/config/db.js';

describe('Tasks API & Security (/api/tasks)', () => {
  let userACookie: string;
  let userBCookie: string;

  const helperCreateUser = async (name: string, email: string) => {
    const res = await request(app).post('/api/auth/register').send({
      name,
      email,
      password: 'password123',
    });
    const rawCookie = res.headers['set-cookie'];
    const cookie = Array.isArray(rawCookie) ? rawCookie[0] : (rawCookie || '');
    return { user: res.body.user, cookie };
  };

  beforeEach(async () => {
    const userA = await helperCreateUser('User A', 'user_a@example.com');
    userACookie = userA.cookie;

    const userB = await helperCreateUser('User B', 'user_b@example.com');
    userBCookie = userB.cookie;
  });

  describe('Authentication Enforcement', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const getRes = await request(app).get('/api/tasks');
      expect(getRes.status).toBe(401);

      const postRes = await request(app).post('/api/tasks').send({ title: 'Task' });
      expect(postRes.status).toBe(401);

      const getByIdRes = await request(app).get('/api/tasks/507f1f77bcf86cd799439011');
      expect(getByIdRes.status).toBe(401);

      const patchRes = await request(app)
        .patch('/api/tasks/507f1f77bcf86cd799439011')
        .send({ title: 'Updated' });
      expect(patchRes.status).toBe(401);

      const deleteRes = await request(app).delete('/api/tasks/507f1f77bcf86cd799439011');
      expect(deleteRes.status).toBe(401);

      const reorderRes = await request(app)
        .post('/api/tasks/reorder')
        .send({ status: 'todo', orderedIds: [] });
      expect(reorderRes.status).toBe(401);
    });
  });

  describe('Validation & Edge Cases', () => {
    it('should return 400 when :id is not a valid MongoDB ObjectId', async () => {
      const resGet = await request(app)
        .get('/api/tasks/invalid-id-123')
        .set('Cookie', [userACookie]);
      expect(resGet.status).toBe(400);

      const resPatch = await request(app)
        .patch('/api/tasks/12345')
        .set('Cookie', [userACookie])
        .send({ title: 'Valid Title' });
      expect(resPatch.status).toBe(400);

      const resDelete = await request(app)
        .delete('/api/tasks/not-an-objectid')
        .set('Cookie', [userACookie]);
      expect(resDelete.status).toBe(400);
    });

    it('should return 404 for valid-but-nonexistent ObjectId', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .get(`/api/tasks/${nonExistentId}`)
        .set('Cookie', [userACookie]);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it('should return 400 when request body contains unknown fields (no mass assignment, client cannot set user)', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({
          title: 'Valid Task',
          user: '507f1f77bcf86cd799439011',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();

      const resExtra = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({
          title: 'Valid Task',
          unknownField: 'malicious',
        });

      expect(resExtra.status).toBe(400);
    });

    it('should return 400 when attempting to set order directly on POST or PATCH', async () => {
      const postWithOrder = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({
          title: 'Direct Order Task',
          order: 99,
        });

      expect(postWithOrder.status).toBe(400);

      const createRes = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Task for patch order test' });

      const taskId = createRes.body.task.id || createRes.body.task._id;

      const patchWithOrder = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', [userACookie])
        .send({
          order: 42,
        });

      expect(patchWithOrder.status).toBe(400);
    });

    it('should return 400 on PATCH with an empty body', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Task to update' });
      const taskId = createRes.body.task.id || createRes.body.task._id;

      const patchRes = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', [userACookie])
        .send({});

      expect(patchRes.status).toBe(400);
      expect(patchRes.body.error).toMatch(/empty/i);
    });

    it('should return 400 when NoSQL operator injection is attempted in query params (?status[$ne]=done)', async () => {
      const res = await request(app)
        .get('/api/tasks?status[$ne]=done')
        .set('Cookie', [userACookie]);

      expect(res.status).toBe(400);
    });

    it('should reject title that is empty or exceeds 120 characters with 400', async () => {
      const emptyRes = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: '   ' });
      expect(emptyRes.status).toBe(400);

      const longRes = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'a'.repeat(121) });
      expect(longRes.status).toBe(400);
    });

    it('should reject description that exceeds 1000 characters with 400', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({
          title: 'Valid Title',
          description: 'd'.repeat(1001),
        });
      expect(res.status).toBe(400);
    });

    it('should reject query limit greater than 50 with 400', async () => {
      const res = await request(app)
        .get('/api/tasks?limit=51')
        .set('Cookie', [userACookie]);
      expect(res.status).toBe(400);
    });
  });

  describe('CRUD Operations', () => {
    it('should create a task with default values and return 201', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({
          title: 'My First Task',
        });

      expect(res.status).toBe(201);
      expect(res.body.task).toBeDefined();
      expect(res.body.task.title).toBe('My First Task');
      expect(res.body.task.category).toBe('none');
      expect(res.body.task.priority).toBe('medium');
      expect(res.body.task.priorityRank).toBe(2);
      expect(res.body.task.status).toBe('todo');
      expect(res.body.task.order).toBe(0);
      expect(res.body.task.dueDate).toBeNull();
      expect(res.body.task.hasDueDate).toBe(false);
      expect(res.body.task.createdAt).toBeDefined();
      expect(res.body.task.updatedAt).toBeDefined();
    });

    it('should create a task with full custom fields and return 201', async () => {
      const dueDate = new Date('2026-12-31T23:59:59.000Z');
      const res = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({
          title: 'Complete Project',
          description: 'Finish all phase 3 tasks and tests',
          category: 'Work',
          priority: 'high',
          status: 'in-progress',
          dueDate: dueDate.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.task.title).toBe('Complete Project');
      expect(res.body.task.description).toBe('Finish all phase 3 tasks and tests');
      expect(res.body.task.category).toBe('Work');
      expect(res.body.task.priority).toBe('high');
      expect(res.body.task.priorityRank).toBe(3);
      expect(res.body.task.status).toBe('in-progress');
      expect(new Date(res.body.task.dueDate).toISOString()).toBe(dueDate.toISOString());
      expect(res.body.task.hasDueDate).toBe(true);
      expect(res.body.task.order).toBe(0);
    });

    it('should read a task by ID', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Task to read' });
      const taskId = createRes.body.task.id || createRes.body.task._id;

      const getRes = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Cookie', [userACookie]);

      expect(getRes.status).toBe(200);
      expect(getRes.body.task.title).toBe('Task to read');
    });

    it('should update a task via PATCH and automatically sync priorityRank and hasDueDate', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({
          title: 'Original Title',
          priority: 'low',
        });
      const taskId = createRes.body.task.id || createRes.body.task._id;
      expect(createRes.body.task.priorityRank).toBe(1);
      expect(createRes.body.task.hasDueDate).toBe(false);

      const targetDate = new Date('2026-11-15T12:00:00.000Z');
      const patchRes = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', [userACookie])
        .send({
          title: 'Updated Title',
          priority: 'high',
          dueDate: targetDate.toISOString(),
          status: 'done',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.task.title).toBe('Updated Title');
      expect(patchRes.body.task.priority).toBe('high');
      expect(patchRes.body.task.priorityRank).toBe(3);
      expect(patchRes.body.task.status).toBe('done');
      expect(patchRes.body.task.hasDueDate).toBe(true);
      expect(new Date(patchRes.body.task.dueDate).toISOString()).toBe(targetDate.toISOString());
    });

    it('should delete a task via DELETE, and subsequent GET returns 404', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Task to delete' });
      const taskId = createRes.body.task.id || createRes.body.task._id;

      const deleteRes = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Cookie', [userACookie]);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toMatch(/deleted/i);

      const getRes = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Cookie', [userACookie]);
      expect(getRes.status).toBe(404);
    });
  });

  describe('User Data Isolation (Multi-tenant security)', () => {
    let userATaskId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: "User A's Secret Task" });
      userATaskId = res.body.task.id || res.body.task._id;
    });

    it("should return 404 (not 403) when User B tries to read User A's task", async () => {
      const res = await request(app)
        .get(`/api/tasks/${userATaskId}`)
        .set('Cookie', [userBCookie]);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    it("should return 404 (not 403) when User B tries to update User A's task", async () => {
      const res = await request(app)
        .patch(`/api/tasks/${userATaskId}`)
        .set('Cookie', [userBCookie])
        .send({ title: 'Hacked by User B' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');

      // Verify User A's task was untouched
      const original = await Task.findById(userATaskId);
      expect(original?.title).toBe("User A's Secret Task");
    });

    it("should return 404 (not 403) when User B tries to delete User A's task", async () => {
      const res = await request(app)
        .delete(`/api/tasks/${userATaskId}`)
        .set('Cookie', [userBCookie]);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');

      // Verify User A's task still exists
      const original = await Task.findById(userATaskId);
      expect(original).not.toBeNull();
    });

    it("should ensure User B's task list does not include User A's tasks", async () => {
      await request(app)
        .post('/api/tasks')
        .set('Cookie', [userBCookie])
        .send({ title: "User B's Task" });

      const res = await request(app)
        .get('/api/tasks')
        .set('Cookie', [userBCookie]);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.tasks[0].title).toBe("User B's Task");
    });
  });

  describe('Filtering, Search, Sorting, and Pagination', () => {
    beforeEach(async () => {
      // Seed tasks for User A
      await request(app).post('/api/tasks').set('Cookie', [userACookie]).send({
        title: 'Meeting with Client [Urgent]',
        category: 'Work',
        priority: 'high',
        status: 'todo',
        dueDate: '2026-10-10T10:00:00.000Z',
      });

      await request(app).post('/api/tasks').set('Cookie', [userACookie]).send({
        title: 'Clean the kitchen',
        category: 'Home',
        priority: 'low',
        status: 'in-progress',
        dueDate: '2026-10-05T10:00:00.000Z',
      });

      await request(app).post('/api/tasks').set('Cookie', [userACookie]).send({
        title: 'Dentist appointment',
        category: 'Personal',
        priority: 'medium',
        status: 'done',
        dueDate: '2026-10-01T10:00:00.000Z',
      });

      await request(app).post('/api/tasks').set('Cookie', [userACookie]).send({
        title: 'Someday project (no date)',
        category: 'Personal',
        priority: 'low',
        status: 'todo',
        // no dueDate
      });
    });

    it('should filter tasks by status', async () => {
      const res = await request(app)
        .get('/api/tasks?status=in-progress')
        .set('Cookie', [userACookie]);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.tasks[0].title).toBe('Clean the kitchen');
    });

    it('should filter tasks by category', async () => {
      const res = await request(app)
        .get('/api/tasks?category=Personal')
        .set('Cookie', [userACookie]);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
    });

    it('should filter tasks by priority', async () => {
      const res = await request(app)
        .get('/api/tasks?priority=high')
        .set('Cookie', [userACookie]);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.tasks[0].title).toBe('Meeting with Client [Urgent]');
    });

    it('should search title safely escaping special regex characters (preventing ReDoS)', async () => {
      // Query with regex metacharacters: [Urgent]
      const res = await request(app)
        .get('/api/tasks?search=[Urgent]')
        .set('Cookie', [userACookie]);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.tasks[0].title).toBe('Meeting with Client [Urgent]');

      // Query with malicious or invalid regex pattern like (a+)+ or unclosed bracket
      const resMetachars = await request(app)
        .get('/api/tasks?search=(a+)+[unclosed')
        .set('Cookie', [userACookie]);

      expect(resMetachars.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(resMetachars.body.total).toBe(0);
    });

    it('should sort by priority rank (low < medium < high) in asc and desc order', async () => {
      // ASC: low -> medium -> high
      const resAsc = await request(app)
        .get('/api/tasks?sort=priority&order=asc')
        .set('Cookie', [userACookie]);

      expect(resAsc.status).toBe(200);
      const prioritiesAsc = resAsc.body.tasks.map((t: any) => t.priority);
      // We have two 'low', one 'medium', one 'high'
      expect(prioritiesAsc).toEqual(['low', 'low', 'medium', 'high']);

      // DESC: high -> medium -> low
      const resDesc = await request(app)
        .get('/api/tasks?sort=priority&order=desc')
        .set('Cookie', [userACookie]);

      expect(resDesc.status).toBe(200);
      const prioritiesDesc = resDesc.body.tasks.map((t: any) => t.priority);
      expect(prioritiesDesc).toEqual(['high', 'medium', 'low', 'low']);
    });

    it('should sort by dueDate with tasks having no dueDate coming last for BOTH asc and desc', async () => {
      // Dates:
      // Dentist: Oct 1
      // Clean: Oct 5
      // Meeting: Oct 10
      // Someday: null
      const resAsc = await request(app)
        .get('/api/tasks?sort=dueDate&order=asc')
        .set('Cookie', [userACookie]);

      expect(resAsc.status).toBe(200);
      const titlesAsc = resAsc.body.tasks.map((t: any) => t.title);
      expect(titlesAsc[0]).toBe('Dentist appointment');
      expect(titlesAsc[1]).toBe('Clean the kitchen');
      expect(titlesAsc[2]).toBe('Meeting with Client [Urgent]');
      expect(titlesAsc[3]).toBe('Someday project (no date)');

      const resDesc = await request(app)
        .get('/api/tasks?sort=dueDate&order=desc')
        .set('Cookie', [userACookie]);

      expect(resDesc.status).toBe(200);
      const titlesDesc = resDesc.body.tasks.map((t: any) => t.title);
      expect(titlesDesc[0]).toBe('Meeting with Client [Urgent]');
      expect(titlesDesc[1]).toBe('Clean the kitchen');
      expect(titlesDesc[2]).toBe('Dentist appointment');
      expect(titlesDesc[3]).toBe('Someday project (no date)');
    });

    it('should return totalPages: 0 when total is 0', async () => {
      const res = await request(app)
        .get('/api/tasks?status=done')
        .set('Cookie', [userBCookie]); // User B has 0 tasks

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.totalPages).toBe(0);
      expect(res.body.tasks).toEqual([]);
    });

    it('should provide deterministic pagination using _id tiebreaker across pages with identical field values', async () => {
      // Clear out user A tasks and insert 10 identical tasks
      await Task.deleteMany({});

      for (let i = 1; i <= 10; i++) {
        await request(app)
          .post('/api/tasks')
          .set('Cookie', [userACookie])
          .send({
            title: 'Identical Title',
            priority: 'medium',
            status: 'todo',
          });
      }

      // Fetch page 1 with limit 5
      const page1Res = await request(app)
        .get('/api/tasks?page=1&limit=5&sort=createdAt&order=asc')
        .set('Cookie', [userACookie]);

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.total).toBe(10);
      expect(page1Res.body.totalPages).toBe(2);
      expect(page1Res.body.tasks.length).toBe(5);

      // Fetch page 2 with limit 5
      const page2Res = await request(app)
        .get('/api/tasks?page=2&limit=5&sort=createdAt&order=asc')
        .set('Cookie', [userACookie]);

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.tasks.length).toBe(5);

      const page1Ids = page1Res.body.tasks.map((t: any) => t.id || t._id);
      const page2Ids = page2Res.body.tasks.map((t: any) => t.id || t._id);

      // Verify no duplicates between pages
      const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);

      // Verify all 10 unique tasks are covered
      const allIds = new Set([...page1Ids, ...page2Ids]);
      expect(allIds.size).toBe(10);
    });

    it('should sort by order with _id tiebreaker when sort=order is requested', async () => {
      await Task.deleteMany({});

      const t1 = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Task 1', status: 'todo' });

      const t2 = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Task 2', status: 'todo' });

      const t1Id = t1.body.task.id;
      const t2Id = t2.body.task.id;

      // Reverse their order via reorder endpoint
      await request(app)
        .post('/api/tasks/reorder')
        .set('Cookie', [userACookie])
        .send({
          status: 'todo',
          orderedIds: [t2Id, t1Id],
        });

      const getRes = await request(app)
        .get('/api/tasks?sort=order&order=asc')
        .set('Cookie', [userACookie]);

      expect(getRes.status).toBe(200);
      expect(getRes.body.tasks[0].id).toBe(t2Id);
      expect(getRes.body.tasks[0].order).toBe(0);
      expect(getRes.body.tasks[1].id).toBe(t1Id);
      expect(getRes.body.tasks[1].order).toBe(1);
    });
  });

  describe('Task Reordering & Board Support (/api/tasks/reorder)', () => {
    it('should automatically assign order to new tasks at the end of their column', async () => {
      await Task.deleteMany({});

      const t1 = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Todo 1', status: 'todo' });

      const t2 = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Todo 2', status: 'todo' });

      const prog1 = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Progress 1', status: 'in-progress' });

      expect(t1.body.task.order).toBe(0);
      expect(t2.body.task.order).toBe(1);
      expect(prog1.body.task.order).toBe(0);
    });

    it('should assign order to next slot at end of new column when status changes via PATCH', async () => {
      await Task.deleteMany({});

      // Create 2 existing tasks in "done" column (order 0 and 1)
      await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Done 1', status: 'done' });
      await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Done 2', status: 'done' });

      // Create a task in "todo" column (order 0)
      const todoRes = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Moving to Done', status: 'todo' });

      const taskId = todoRes.body.task.id;

      // Update task to "done"
      const patchRes = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', [userACookie])
        .send({ status: 'done' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.task.status).toBe('done');
      expect(patchRes.body.task.order).toBe(2);
    });

    it('should reorder tasks within a column and update their order values', async () => {
      await Task.deleteMany({});

      const t1 = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Task A', status: 'todo' });

      const t2 = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Task B', status: 'todo' });

      const t3 = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Task C', status: 'todo' });

      const idA = t1.body.task.id;
      const idB = t2.body.task.id;
      const idC = t3.body.task.id;

      const reorderRes = await request(app)
        .post('/api/tasks/reorder')
        .set('Cookie', [userACookie])
        .send({
          status: 'todo',
          orderedIds: [idC, idA, idB],
        });

      expect(reorderRes.status).toBe(200);
      expect(reorderRes.body.message).toBe('Tasks reordered successfully');

      const fetchRes = await request(app)
        .get('/api/tasks?sort=order&order=asc')
        .set('Cookie', [userACookie]);

      expect(fetchRes.body.tasks.map((t: any) => t.id)).toEqual([idC, idA, idB]);
      expect(fetchRes.body.tasks.map((t: any) => t.order)).toEqual([0, 1, 2]);
    });

    it('should change status and reorder when moving tasks across columns', async () => {
      await Task.deleteMany({});

      const t1 = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Task 1', status: 'todo' });

      const id1 = t1.body.task.id;

      const reorderRes = await request(app)
        .post('/api/tasks/reorder')
        .set('Cookie', [userACookie])
        .send({
          status: 'in-progress',
          orderedIds: [id1],
        });

      expect(reorderRes.status).toBe(200);

      const checkTask = await request(app)
        .get(`/api/tasks/${id1}`)
        .set('Cookie', [userACookie]);

      expect(checkTask.body.task.status).toBe('in-progress');
      expect(checkTask.body.task.order).toBe(0);
    });

    it('should return 404 when User B attempts to reorder User A tasks', async () => {
      await Task.deleteMany({});

      const t1 = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'User A Task', status: 'todo' });

      const userATaskId = t1.body.task.id;

      const userBReorder = await request(app)
        .post('/api/tasks/reorder')
        .set('Cookie', [userBCookie])
        .send({
          status: 'done',
          orderedIds: [userATaskId],
        });

      expect(userBReorder.status).toBe(404);
      expect(userBReorder.body.error).toBe('Task not found');
    });

    it('should return 400 for invalid, duplicate, or excessive IDs, or unknown body properties', async () => {
      // Invalid ObjectId
      const resInvalid = await request(app)
        .post('/api/tasks/reorder')
        .set('Cookie', [userACookie])
        .send({
          status: 'todo',
          orderedIds: ['not-an-objectid'],
        });
      expect(resInvalid.status).toBe(400);

      // Duplicate ObjectIds
      const validId = '507f1f77bcf86cd799439011';
      const resDup = await request(app)
        .post('/api/tasks/reorder')
        .set('Cookie', [userACookie])
        .send({
          status: 'todo',
          orderedIds: [validId, validId],
        });
      expect(resDup.status).toBe(400);
      expect(resDup.body.error).toMatch(/unique/i);

      // Unknown property (.strict check)
      const resExtra = await request(app)
        .post('/api/tasks/reorder')
        .set('Cookie', [userACookie])
        .send({
          status: 'todo',
          orderedIds: [],
          unexpected: true,
        });
      expect(resExtra.status).toBe(400);
    });
  });

  describe('Phase 5b: completedAt lifecycle and GET /api/tasks/stats', () => {
    it('should set completedAt when created with status=done, and null otherwise', async () => {
      const doneTaskRes = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Task Done', status: 'done' });
      expect(doneTaskRes.status).toBe(201);
      expect(doneTaskRes.body.task.completedAt).not.toBeNull();

      const todoTaskRes = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Task Todo', status: 'todo' });
      expect(todoTaskRes.status).toBe(201);
      expect(todoTaskRes.body.task.completedAt).toBeNull();
    });

    it('should reject client-provided completedAt in POST /api/tasks and PATCH /api/tasks/:id with 400', async () => {
      const postAttempt = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Hacked', completedAt: new Date().toISOString() });
      expect(postAttempt.status).toBe(400);

      const created = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Valid Task' });

      const patchAttempt = await request(app)
        .patch(`/api/tasks/${created.body.task.id}`)
        .set('Cookie', [userACookie])
        .send({ completedAt: new Date().toISOString() });
      expect(patchAttempt.status).toBe(400);
    });

    it('should update completedAt when status changes via PATCH and reorder', async () => {
      const taskRes = await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Lifecycle Task', status: 'todo' });
      const taskId = taskRes.body.task.id;
      expect(taskRes.body.task.completedAt).toBeNull();

      // Change to done
      const patchDone = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', [userACookie])
        .send({ status: 'done' });
      expect(patchDone.body.task.completedAt).not.toBeNull();
      const firstCompletedAt = patchDone.body.task.completedAt;

      // Move back to in-progress
      const patchProg = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('Cookie', [userACookie])
        .send({ status: 'in-progress' });
      expect(patchProg.body.task.completedAt).toBeNull();

      // Reorder into done
      const reorderDone = await request(app)
        .post('/api/tasks/reorder')
        .set('Cookie', [userACookie])
        .send({ status: 'done', orderedIds: [taskId] });
      expect(reorderDone.status).toBe(200);

      const fetchedDone = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Cookie', [userACookie]);
      expect(fetchedDone.body.task.status).toBe('done');
      expect(fetchedDone.body.task.completedAt).not.toBeNull();

      // Reorder within done preserves completedAt
      const secondCompletedAt = fetchedDone.body.task.completedAt;
      await request(app)
        .post('/api/tasks/reorder')
        .set('Cookie', [userACookie])
        .send({ status: 'done', orderedIds: [taskId] });
      const fetchedPreserved = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Cookie', [userACookie]);
      expect(fetchedPreserved.body.task.completedAt).toBe(secondCompletedAt);

      // Reorder out of done clears completedAt
      await request(app)
        .post('/api/tasks/reorder')
        .set('Cookie', [userACookie])
        .send({ status: 'todo', orderedIds: [taskId] });
      const fetchedCleared = await request(app)
        .get(`/api/tasks/${taskId}`)
        .set('Cookie', [userACookie]);
      expect(fetchedCleared.body.task.completedAt).toBeNull();
    });

    it('should backfill completedAt = updatedAt for legacy done tasks with null completedAt', async () => {
      const userRes = await request(app).get('/api/auth/me').set('Cookie', [userACookie]);
      const userId = userRes.body.user.id;

      const dummyUpdatedAt = new Date('2026-08-15T12:00:00.000Z');
      await Task.collection.insertOne({
        user: userId,
        title: 'Legacy Done Item',
        status: 'done',
        completedAt: null,
        priority: 'medium',
        priorityRank: 2,
        hasDueDate: false,
        order: 0,
        createdAt: new Date('2026-08-14T10:00:00.000Z'),
        updatedAt: dummyUpdatedAt,
      } as any);

      await backfillCompletedAt();

      const item = await Task.findOne({ title: 'Legacy Done Item' });
      expect(item?.completedAt?.toISOString()).toBe(dummyUpdatedAt.toISOString());
    });

    it('should require authentication for GET /api/tasks/stats (401)', async () => {
      const res = await request(app).get('/api/tasks/stats?tz=UTC&days=7');
      expect(res.status).toBe(401);
    });

    it('should validate query parameters and return 400 for invalid tz, days, or unexpected params', async () => {
      // Invalid timezone
      const resBadTz = await request(app)
        .get('/api/tasks/stats?tz=Fake/Invalid_Zone&days=7')
        .set('Cookie', [userACookie]);
      expect(resBadTz.status).toBe(400);

      // Invalid days (e.g. 10 or abc)
      const resBadDays = await request(app)
        .get('/api/tasks/stats?tz=UTC&days=10')
        .set('Cookie', [userACookie]);
      expect(resBadDays.status).toBe(400);

      const resStringDays = await request(app)
        .get('/api/tasks/stats?tz=UTC&days=abc')
        .set('Cookie', [userACookie]);
      expect(resStringDays.status).toBe(400);

      // Missing tz
      const resNoTz = await request(app)
        .get('/api/tasks/stats?days=7')
        .set('Cookie', [userACookie]);
      expect(resNoTz.status).toBe(400);

      // Unknown parameter (.strict)
      const resExtra = await request(app)
        .get('/api/tasks/stats?tz=UTC&days=7&extra=param')
        .set('Cookie', [userACookie]);
      expect(resExtra.status).toBe(400);
    });

    it('should return all zeros (no NaN) on empty account', async () => {
      const res = await request(app)
        .get('/api/tasks/stats?tz=UTC&days=7')
        .set('Cookie', [userACookie]);

      expect(res.status).toBe(200);
      expect(res.body.totals).toEqual({
        total: 0,
        todo: 0,
        inProgress: 0,
        done: 0,
        overdue: 0,
        completionRate: 0,
      });

      expect(res.body.byCategory).toEqual({
        Work: 0,
        Home: 0,
        Personal: 0,
        Urgent: 0,
        none: 0,
      });

      expect(res.body.byPriority).toEqual({
        low: 0,
        medium: 0,
        high: 0,
      });

      expect(res.body.completedPerDay).toHaveLength(7);
      res.body.completedPerDay.forEach((day: { date: string; count: number }) => {
        expect(day.count).toBe(0);
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('should correctly compute totals, byCategory, byPriority, and overdue tasks', async () => {
      await Task.deleteMany({});

      // 1 todo task with past due date (overdue)
      await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({
          title: 'Overdue Todo',
          status: 'todo',
          category: 'Work',
          priority: 'high',
          dueDate: '2020-01-01',
        });

      // 1 in-progress task with future due date (not overdue)
      await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({
          title: 'Future In Progress',
          status: 'in-progress',
          category: 'Personal',
          priority: 'medium',
          dueDate: '2030-01-01',
        });

      // 1 done task with past due date (done tasks are NOT overdue)
      await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({
          title: 'Done Task',
          status: 'done',
          category: 'Work',
          priority: 'low',
          dueDate: '2020-01-01',
        });

      // 1 todo task without due date
      await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({
          title: 'No Due Date',
          status: 'todo',
          category: 'Home',
          priority: 'medium',
        });

      const res = await request(app)
        .get('/api/tasks/stats?tz=UTC&days=7')
        .set('Cookie', [userACookie]);

      expect(res.status).toBe(200);
      expect(res.body.totals.total).toBe(4);
      expect(res.body.totals.todo).toBe(2);
      expect(res.body.totals.inProgress).toBe(1);
      expect(res.body.totals.done).toBe(1);
      expect(res.body.totals.overdue).toBe(1);
      // 1/4 = 25%
      expect(res.body.totals.completionRate).toBe(25);

      expect(res.body.byCategory).toEqual({
        Work: 2,
        Home: 1,
        Personal: 1,
        Urgent: 0,
        none: 0,
      });

      expect(res.body.byPriority).toEqual({
        low: 1,
        medium: 2,
        high: 1,
      });
    });

    it('should never include user A tasks in user B stats', async () => {
      await Task.deleteMany({});

      // Create tasks for User A
      await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Task A 1', status: 'done', category: 'Urgent' });
      await request(app)
        .post('/api/tasks')
        .set('Cookie', [userACookie])
        .send({ title: 'Task A 2', status: 'todo', category: 'Work' });

      // User B has no tasks
      const resB = await request(app)
        .get('/api/tasks/stats?tz=UTC&days=7')
        .set('Cookie', [userBCookie]);

      expect(resB.status).toBe(200);
      expect(resB.body.totals.total).toBe(0);
      expect(resB.body.totals.done).toBe(0);
      expect(resB.body.byCategory.Urgent).toBe(0);
      expect(resB.body.byCategory.Work).toBe(0);
    });

    it('should group completions into the correct day in the specified timezone (23:30 IST boundary test)', async () => {
      await Task.deleteMany({});
      const userRes = await request(app).get('/api/auth/me').set('Cookie', [userACookie]);
      const userId = userRes.body.user.id;

      // 2026-10-04T18:00:00.000Z in UTC is 2026-10-04.
      // In Asia/Kolkata (+05:30), it is 2026-10-04 23:30:00 IST (Day is 2026-10-04).
      // 2026-10-04T18:45:00.000Z in UTC is 2026-10-04.
      // In Asia/Kolkata (+05:30), 18:45 + 5:30 = 00:15 on 2026-10-05 IST!
      const timeInISTNextDay = new Date('2026-10-04T18:45:00.000Z');

      await Task.create({
        user: userId,
        title: 'Task near midnight',
        status: 'done',
        completedAt: timeInISTNextDay,
        priority: 'medium',
        priorityRank: 2,
        hasDueDate: false,
        order: 0,
      });

      // Request stats with Asia/Kolkata
      const resIST = await request(app)
        .get('/api/tasks/stats?tz=Asia/Kolkata&days=30')
        .set('Cookie', [userACookie]);

      expect(resIST.status).toBe(200);
      const dayInIST = resIST.body.completedPerDay.find(
        (d: { date: string; count: number }) => d.date === '2026-10-05'
      );
      expect(dayInIST?.count).toBe(1);

      // In UTC, 2026-10-04T18:45:00.000Z belongs to 2026-10-04!
      const resUTC = await request(app)
        .get('/api/tasks/stats?tz=UTC&days=30')
        .set('Cookie', [userACookie]);

      expect(resUTC.status).toBe(200);
      const dayInUTC = resUTC.body.completedPerDay.find(
        (d: { date: string; count: number }) => d.date === '2026-10-04'
      );
      expect(dayInUTC?.count).toBe(1);

      const dayInUTC5th = resUTC.body.completedPerDay.find(
        (d: { date: string; count: number }) => d.date === '2026-10-05'
      );
      expect(dayInUTC5th?.count).toBe(0);
    });
  });
});
