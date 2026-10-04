import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/User.js';

describe('Auth Endpoints & Security', () => {
  const validUserData = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'password123',
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user, return 201, set HttpOnly cookie, and omit passwordHash', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.name).toBe(validUserData.name);
      expect(res.body.user.email).toBe(validUserData.email);
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.createdAt).toBeDefined();

      // passwordHash must never appear anywhere in the response
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');

      // Check cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;
      expect(cookieStr).toContain('token=');
      expect(cookieStr).toMatch(/httponly/i);

      // Verify user in database has hashed password
      const savedUser = await User.findOne({ email: validUserData.email }).select('+passwordHash');
      expect(savedUser).not.toBeNull();
      expect(savedUser?.passwordHash).toBeDefined();
      expect(savedUser?.passwordHash).not.toBe(validUserData.password);
    });

    it('should reject duplicate email with 409 Conflict', async () => {
      await request(app).post('/api/auth/register').send(validUserData);

      const res = await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already in use/i);
    });

    it('should reject password with less than 8 characters with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validUserData, password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject password with more than 72 characters with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validUserData, password: 'a'.repeat(73) });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject invalid email format with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validUserData, email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject name longer than 50 characters with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validUserData, name: 'a'.repeat(51) });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(validUserData);
    });

    it('should login with correct credentials, return 200, set HttpOnly cookie, and omit passwordHash', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: validUserData.email,
          password: validUserData.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(validUserData.email);

      // passwordHash must never appear anywhere in the response
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');

      // Check HttpOnly cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;
      expect(cookieStr).toContain('token=');
      expect(cookieStr).toMatch(/httponly/i);
    });

    it('should return 401 with generic "Invalid email or password" on wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: validUserData.email,
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('should return 401 with generic "Invalid email or password" on non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: validUserData.password,
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear auth cookie and return 200', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;
      // Cookie is cleared or expired
      expect(cookieStr).toMatch(/token=;?(.*expires=|.*max-age=0)/i);
    });
  });

  describe('GET /api/auth/me', () => {
    let authCookie: string;

    beforeEach(async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      const rawCookie = registerRes.headers['set-cookie'];
      authCookie = Array.isArray(rawCookie) ? rawCookie[0] : (rawCookie || '');
    });

    it('should return user profile with valid cookie and omit passwordHash', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [authCookie]);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(validUserData.email);
      expect(res.body.user.name).toBe(validUserData.name);

      // passwordHash must never appear anywhere in the response
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('should reject with 401 when no cookie is sent', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/authentication required/i);
    });

    it('should reject with 401 when Authorization header is sent without cookie (cookie-only auth)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer somefaketoken');

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/authentication required/i);
    });

    it('should reject with 401 when token is tampered/invalid', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', ['token=invalid.tampered.token']);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid or expired token/i);
    });
  });

  describe('Error Handling Middleware', () => {
    it('should never return stack traces when NODE_ENV is production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        // Trigger a 400 validation error
        const res = await request(app)
          .post('/api/auth/register')
          .send({});

        expect(res.body.stack).toBeUndefined();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
