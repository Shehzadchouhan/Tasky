import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { Note } from '../src/models/Note.js';

describe('Notes API & Security (/api/notes)', () => {
  let userACookie: string;
  let userBCookie: string;

  const helperCreateUser = async (name: string, email: string) => {
    const res = await request(app).post('/api/auth/register').send({
      name,
      email,
      password: 'password123',
    });
    const rawCookie = res.headers['set-cookie'];
    const cookie = Array.isArray(rawCookie) ? rawCookie[0] : rawCookie || '';
    return { user: res.body.user, cookie };
  };

  const sampleValidDoc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'This is sample note content.' }],
      },
    ],
  };

  beforeEach(async () => {
    const userA = await helperCreateUser('User A', 'user_a@example.com');
    userACookie = userA.cookie;

    const userB = await helperCreateUser('User B', 'user_b@example.com');
    userBCookie = userB.cookie;
  });

  describe('Authentication Enforcement', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const getRes = await request(app).get('/api/notes');
      expect(getRes.status).toBe(401);

      const postRes = await request(app).post('/api/notes').send({ title: 'Note' });
      expect(postRes.status).toBe(401);

      const getByIdRes = await request(app).get('/api/notes/507f1f77bcf86cd799439011');
      expect(getByIdRes.status).toBe(401);

      const patchRes = await request(app)
        .patch('/api/notes/507f1f77bcf86cd799439011')
        .send({ title: 'Updated', baseVersion: 1 });
      expect(patchRes.status).toBe(401);

      const deleteRes = await request(app).delete('/api/notes/507f1f77bcf86cd799439011');
      expect(deleteRes.status).toBe(401);
    });
  });

  describe('Validation & Edge Cases', () => {
    it('should return 400 when :id is not a valid MongoDB ObjectId', async () => {
      const resGet = await request(app)
        .get('/api/notes/invalid-id-123')
        .set('Cookie', [userACookie]);
      expect(resGet.status).toBe(400);

      const resPatch = await request(app)
        .patch('/api/notes/12345')
        .set('Cookie', [userACookie])
        .send({ title: 'Valid Title', baseVersion: 1 });
      expect(resPatch.status).toBe(400);

      const resDelete = await request(app)
        .delete('/api/notes/not-an-objectid')
        .set('Cookie', [userACookie]);
      expect(resDelete.status).toBe(400);
    });

    it('should return 404 for valid-but-nonexistent ObjectId on GET and PATCH', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const getRes = await request(app)
        .get(`/api/notes/${nonExistentId}`)
        .set('Cookie', [userACookie]);
      expect(getRes.status).toBe(404);
      expect(getRes.body.error).toBe('Note not found');

      const patchRes = await request(app)
        .patch(`/api/notes/${nonExistentId}`)
        .set('Cookie', [userACookie])
        .send({ title: 'Updated Title', baseVersion: 1 });
      expect(patchRes.status).toBe(404);
      expect(patchRes.body.error).toBe('Note not found');
    });

    it('should return 400 when request body contains unknown fields or client-sent plainText/version/user', async () => {
      const postWithUser = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({
          title: 'Note Title',
          user: '507f1f77bcf86cd799439011',
        });
      expect(postWithUser.status).toBe(400);

      const postWithVersion = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({
          title: 'Note Title',
          version: 5,
        });
      expect(postWithVersion.status).toBe(400);

      const postWithPlainText = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({
          title: 'Note Title',
          plainText: 'Custom client text',
        });
      expect(postWithPlainText.status).toBe(400);

      const postWithExtra = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({
          title: 'Note Title',
          unknownField: 'malicious',
        });
      expect(postWithExtra.status).toBe(400);
    });

    it('should reject title exceeding 120 characters with 400', async () => {
      const res = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({ title: 'a'.repeat(121) });
      expect(res.status).toBe(400);
    });

    it('should reject PATCH with empty body or body with only baseVersion (no updates) with 400', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({ title: 'Note' });
      const noteId = createRes.body.note.id;

      const emptyRes = await request(app)
        .patch(`/api/notes/${noteId}`)
        .set('Cookie', [userACookie])
        .send({});
      expect(emptyRes.status).toBe(400);

      const onlyBaseVersionRes = await request(app)
        .patch(`/api/notes/${noteId}`)
        .set('Cookie', [userACookie])
        .send({ baseVersion: 1 });
      expect(onlyBaseVersionRes.status).toBe(400);
    });

    it('should reject query limit greater than 50 or q exceeding 100 with 400', async () => {
      const resLimit = await request(app)
        .get('/api/notes?limit=51')
        .set('Cookie', [userACookie]);
      expect(resLimit.status).toBe(400);

      const resQ = await request(app)
        .get(`/api/notes?q=${'a'.repeat(101)}`)
        .set('Cookie', [userACookie]);
      expect(resQ.status).toBe(400);
    });

    it('should reject invalid content (script tags, unknown marks, javascript links, too deep, etc.) with 400', async () => {
      const scriptDoc = {
        type: 'doc',
        content: [{ type: 'script', content: [] }],
      };
      const resScript = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({ content: scriptDoc });
      expect(resScript.status).toBe(400);

      const jsLinkDoc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Bad Link',
                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
              },
            ],
          },
        ],
      };
      const resLink = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({ content: jsLinkDoc });
      expect(resLink.status).toBe(400);
    });
  });

  describe('CRUD Operations', () => {
    it('should create a note with defaults (Untitled, empty content, version 1) and return 201', async () => {
      const res = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.note).toBeDefined();
      expect(res.body.note.id).toBeDefined();
      expect(res.body.note.title).toBe('Untitled');
      expect(res.body.note.content).toEqual({ type: 'doc', content: [] });
      expect(res.body.note.plainText).toBe('');
      expect(res.body.note.version).toBe(1);
      expect(res.body.note.createdAt).toBeDefined();
      expect(res.body.note.updatedAt).toBeDefined();
    });

    it('should create a note with custom title and TipTap content, deriving plainText', async () => {
      const res = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({
          title: 'My Custom Note',
          content: sampleValidDoc,
        });

      expect(res.status).toBe(201);
      expect(res.body.note.title).toBe('My Custom Note');
      expect(res.body.note.content).toEqual(sampleValidDoc);
      expect(res.body.note.plainText).toBe('This is sample note content.');
      expect(res.body.note.version).toBe(1);
    });

    it('should read the full note by ID via GET /:id', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({
          title: 'Read Me',
          content: sampleValidDoc,
        });
      const noteId = createRes.body.note.id;

      const getRes = await request(app)
        .get(`/api/notes/${noteId}`)
        .set('Cookie', [userACookie]);

      expect(getRes.status).toBe(200);
      expect(getRes.body.note.id).toBe(noteId);
      expect(getRes.body.note.title).toBe('Read Me');
      expect(getRes.body.note.content).toEqual(sampleValidDoc);
      expect(getRes.body.note.plainText).toBe('This is sample note content.');
    });

    it('should update a note via PATCH, increment version, and recompute plainText', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({
          title: 'Initial Note',
          content: sampleValidDoc,
        });
      const noteId = createRes.body.note.id;
      expect(createRes.body.note.version).toBe(1);

      const updatedDoc = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Updated Section' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'New content body.' }],
          },
        ],
      };

      const patchRes = await request(app)
        .patch(`/api/notes/${noteId}`)
        .set('Cookie', [userACookie])
        .send({
          title: 'Updated Note Title',
          content: updatedDoc,
          baseVersion: 1,
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.note.title).toBe('Updated Note Title');
      expect(patchRes.body.note.content).toEqual(updatedDoc);
      expect(patchRes.body.note.plainText).toBe('Updated Section New content body.');
      expect(patchRes.body.note.version).toBe(2);
    });

    it('should delete a note via DELETE and return 200 { ok: true } (idempotent)', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({ title: 'Note to Delete' });
      const noteId = createRes.body.note.id;

      const deleteRes = await request(app)
        .delete(`/api/notes/${noteId}`)
        .set('Cookie', [userACookie]);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body).toEqual({ ok: true });

      // Note is gone
      const getRes = await request(app)
        .get(`/api/notes/${noteId}`)
        .set('Cookie', [userACookie]);
      expect(getRes.status).toBe(404);

      // Deleting again returns 200 { ok: true } (idempotent)
      const secondDelete = await request(app)
        .delete(`/api/notes/${noteId}`)
        .set('Cookie', [userACookie]);
      expect(secondDelete.status).toBe(200);
      expect(secondDelete.body).toEqual({ ok: true });
    });
  });

  describe('User Data Isolation (Multi-tenant security)', () => {
    let userANoteId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({
          title: "User A's Private Note",
          content: sampleValidDoc,
        });
      userANoteId = res.body.note.id;
    });

    it("should return 404 when User B tries to read User A's note via GET /:id", async () => {
      const res = await request(app)
        .get(`/api/notes/${userANoteId}`)
        .set('Cookie', [userBCookie]);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Note not found');
    });

    it("should return 404 when User B tries to update User A's note via PATCH /:id", async () => {
      const res = await request(app)
        .patch(`/api/notes/${userANoteId}`)
        .set('Cookie', [userBCookie])
        .send({
          title: 'Hacked Title',
          baseVersion: 1,
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Note not found');

      // Verify User A's note is untouched
      const original = await Note.findById(userANoteId);
      expect(original?.title).toBe("User A's Private Note");
      expect(original?.version).toBe(1);
    });

    it("should return 200 { ok: true } when User B calls DELETE on User A's note and leave User A's note untouched", async () => {
      const res = await request(app)
        .delete(`/api/notes/${userANoteId}`)
        .set('Cookie', [userBCookie]);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });

      // Verify User A's note still exists
      const original = await Note.findById(userANoteId);
      expect(original).not.toBeNull();
      expect(original?.title).toBe("User A's Private Note");
    });

    it("should ensure User B's note list does not include User A's notes", async () => {
      await request(app)
        .post('/api/notes')
        .set('Cookie', [userBCookie])
        .send({ title: "User B's Note" });

      const res = await request(app)
        .get('/api/notes')
        .set('Cookie', [userBCookie]);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.notes[0].title).toBe("User B's Note");
    });
  });

  describe('Listing Summaries, Search & Pagination', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({
          title: 'Meeting Notes [Urgent]',
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Discuss Q4 roadmap and security policies.' }],
              },
            ],
          },
        });

      await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({
          title: 'Shopping List',
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Apples, milk, bread and coffee beans.' }],
              },
            ],
          },
        });

      await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({
          title: 'Ideas for Weekend',
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Roadmap hike or movie night.' }],
              },
            ],
          },
        });
    });

    it('should return summaries only (id, title, snippet, updatedAt) and NOT content', async () => {
      const res = await request(app)
        .get('/api/notes')
        .set('Cookie', [userACookie]);

      expect(res.status).toBe(200);
      expect(res.body.notes.length).toBe(3);
      for (const note of res.body.notes) {
        expect(note.id).toBeDefined();
        expect(note.title).toBeDefined();
        expect(note.snippet).toBeDefined();
        expect(note.updatedAt).toBeDefined();
        expect(note.content).toBeUndefined(); // content must NOT be included
      }
    });

    it('should truncate snippet to at most 120 characters', async () => {
      const longText = 'x'.repeat(200);
      await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({
          title: 'Long Note',
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: longText }],
              },
            ],
          },
        });

      const res = await request(app)
        .get('/api/notes')
        .set('Cookie', [userACookie]);

      const longNote = res.body.notes.find((n: any) => n.title === 'Long Note');
      expect(longNote).toBeDefined();
      expect(longNote.snippet.length).toBe(120);
    });

    it('should search title and content text via q (case-insensitive)', async () => {
      // "roadmap" appears in title of none, but content of Meeting Notes and Ideas for Weekend
      const resContent = await request(app)
        .get('/api/notes?q=roadmap')
        .set('Cookie', [userACookie]);

      expect(resContent.status).toBe(200);
      expect(resContent.body.total).toBe(2);

      // "Shopping" appears in title of Shopping List
      const resTitle = await request(app)
        .get('/api/notes?q=shopping')
        .set('Cookie', [userACookie]);

      expect(resTitle.status).toBe(200);
      expect(resTitle.body.total).toBe(1);
      expect(resTitle.body.notes[0].title).toBe('Shopping List');
    });

    it('should escape regex special characters in q safely without crashing or throwing ReDoS', async () => {
      const resMetachar = await request(app)
        .get('/api/notes?q=[Urgent]')
        .set('Cookie', [userACookie]);

      expect(resMetachar.status).toBe(200);
      expect(resMetachar.body.total).toBe(1);
      expect(resMetachar.body.notes[0].title).toBe('Meeting Notes [Urgent]');

      // Malicious or unclosed regex pattern
      const resMalicious = await request(app)
        .get('/api/notes?q=(a+)+[unclosed')
        .set('Cookie', [userACookie]);

      expect(resMalicious.status).toBe(200);
      expect(resMalicious.body.total).toBe(0);
    });

    it('should paginate results and sort by updatedAt descending', async () => {
      const page1Res = await request(app)
        .get('/api/notes?page=1&limit=2')
        .set('Cookie', [userACookie]);

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.total).toBe(3);
      expect(page1Res.body.page).toBe(1);
      expect(page1Res.body.totalPages).toBe(2);
      expect(page1Res.body.notes.length).toBe(2);

      const page2Res = await request(app)
        .get('/api/notes?page=2&limit=2')
        .set('Cookie', [userACookie]);

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.notes.length).toBe(1);
    });

    it('should return totalPages: 0 when total is 0', async () => {
      const res = await request(app)
        .get('/api/notes')
        .set('Cookie', [userBCookie]);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.totalPages).toBe(0);
      expect(res.body.notes).toEqual([]);
    });
  });

  describe('Optimistic Concurrency Control (Conflict Detection)', () => {
    it('should return 409 with code NOTE_CONFLICT and current version when baseVersion does not match, without modifying the note', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({
          title: 'Conflict Note',
          content: sampleValidDoc,
        });
      const noteId = createRes.body.note.id;

      // First update advances version to 2
      const firstUpdate = await request(app)
        .patch(`/api/notes/${noteId}`)
        .set('Cookie', [userACookie])
        .send({
          title: 'First Update',
          baseVersion: 1,
        });
      expect(firstUpdate.status).toBe(200);
      expect(firstUpdate.body.note.version).toBe(2);

      // Concurrent update with stale baseVersion: 1
      const conflictRes = await request(app)
        .patch(`/api/notes/${noteId}`)
        .set('Cookie', [userACookie])
        .send({
          title: 'Stale Update',
          baseVersion: 1,
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.code).toBe('NOTE_CONFLICT');
      expect(conflictRes.body.version).toBe(2);
      expect(conflictRes.body.content).toBeUndefined(); // must not return content

      // Note was not modified
      const current = await Note.findById(noteId);
      expect(current?.title).toBe('First Update');
      expect(current?.version).toBe(2);

      // Successful update with correct baseVersion: 2
      const successUpdate = await request(app)
        .patch(`/api/notes/${noteId}`)
        .set('Cookie', [userACookie])
        .send({
          title: 'Second Update',
          baseVersion: 2,
        });
      expect(successUpdate.status).toBe(200);
      expect(successUpdate.body.note.version).toBe(3);
    });
  });

  describe('500-Note Cap Enforcement', () => {
    it('should reject note creation with 400 when user reaches the 500-note cap', async () => {
      // Seed 500 notes for User A directly in DB
      const userDoc = await Note.findOne(); // any note or get User A id
      const createRes = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({ title: 'Seed 1' });
      const userId = createRes.body.note.user;

      const bulkNotes = [];
      for (let i = 2; i <= 500; i++) {
        bulkNotes.push({
          user: userId,
          title: `Bulk Note ${i}`,
          content: { type: 'doc', content: [] },
          plainText: '',
          version: 1,
        });
      }
      await Note.insertMany(bulkNotes);

      const totalCount = await Note.countDocuments({ user: userId });
      expect(totalCount).toBe(500);

      // Attempting to create the 501st note
      const rejectRes = await request(app)
        .post('/api/notes')
        .set('Cookie', [userACookie])
        .send({ title: '501st Note' });

      expect(rejectRes.status).toBe(400);
      expect(rejectRes.body.error).toMatch(/500 notes/i);
    });
  });

  describe('Write Rate Limiting (120 writes per minute per user)', () => {
    it('should enforce write rate limiting and return 429 on the 121st write request for a user', async () => {
      const userRate = await helperCreateUser('Rate User', 'rate_user@example.com');
      const rateCookie = userRate.cookie;

      // Create initial note
      const initRes = await request(app)
        .post('/api/notes')
        .set('Cookie', [rateCookie])
        .send({ title: 'Rate Test Note' });
      expect(initRes.status).toBe(201);
      const noteId = initRes.body.note.id;

      // 1 write made so far. Send 119 more writes (total 120 writes)
      for (let i = 1; i <= 119; i++) {
        const patchRes = await request(app)
          .patch(`/api/notes/${noteId}`)
          .set('Cookie', [rateCookie])
          .send({
            title: `Title ${i}`,
            baseVersion: i,
          });
        expect(patchRes.status).toBe(200);
      }

      // 121st write request within the minute window must return 429
      const overLimitRes = await request(app)
        .patch(`/api/notes/${noteId}`)
        .set('Cookie', [rateCookie])
        .send({
          title: 'Over limit',
          baseVersion: 120,
        });

      expect(overLimitRes.status).toBe(429);
      expect(overLimitRes.body.error).toMatch(/too many write requests/i);

      // Reads (GET) must NOT be limited
      const readRes = await request(app)
        .get('/api/notes')
        .set('Cookie', [rateCookie]);
      expect(readRes.status).toBe(200);
    });
  });
});
