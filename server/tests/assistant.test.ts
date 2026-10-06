import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { Task } from '../src/models/Task.js';

describe('Taskly assistant fast task actions', () => {
  let cookie: string;

  beforeEach(async () => {
    const register = await request(app).post('/api/auth/register').send({
      name: 'Assistant User',
      email: 'assistant@example.com',
      password: 'password123',
    });
    const rawCookie = register.headers['set-cookie'];
    cookie = Array.isArray(rawCookie) ? rawCookie[0] : rawCookie || '';
  });

  it('marks a clearly named task as done without calling Gemini', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .set('Cookie', [cookie])
      .send({ title: 'Report', status: 'in-progress' });

    const response = await request(app)
      .post('/api/assistant/chat')
      .set('Cookie', [cookie])
      .send({ message: 'I want the report task as done' });

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('as complete');
    const task = await Task.findById(created.body.task.id);
    expect(task?.status).toBe('done');
    expect(task?.completedAt).toBeInstanceOf(Date);
  });

  it('answers in-progress task questions directly', async () => {
    await request(app)
      .post('/api/tasks')
      .set('Cookie', [cookie])
      .send({ title: 'Report', status: 'in-progress' });

    const response = await request(app)
      .post('/api/assistant/chat')
      .set('Cookie', [cookie])
      .send({ message: 'Can you tell my task that in progress?' });

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('Report');
    expect(response.body.message).toContain('in progress');
  });

  it('asks which task when a completion request does not identify one', async () => {
    const response = await request(app)
      .post('/api/assistant/chat')
      .set('Cookie', [cookie])
      .send({ message: 'Please mark it as done' });

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('Which task');
  });

  it('uses the fallback model when Gemini reports temporary high demand', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-api-key');
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.8-flash');
    vi.stubEnv('GEMINI_FALLBACK_MODEL', 'gemini-flash-latest');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { message: 'Model is experiencing high demand.' },
      }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        steps: [{
          type: 'model_output',
          content: [{ type: 'text', text: 'Hello! How can I help?' }],
        }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const response = await request(app)
        .post('/api/assistant/chat')
        .set('Cookie', [cookie])
        .send({ message: 'Hello' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Hello! How can I help?');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('gemini-3.8-flash');
      expect(JSON.parse(fetchMock.mock.calls[1][1].body).model).toBe('gemini-flash-latest');
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
