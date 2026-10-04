import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { Task } from '../src/models/Task.js';

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
          order: 3,
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
      expect(res.body.task.order).toBe(3);
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
  });
});
