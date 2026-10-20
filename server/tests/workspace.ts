import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';

export const createWorkspaceCookie = async (): Promise<string> => {
  const response = await request(app).get('/api/notes');
  const setCookies = response.headers['set-cookie'];
  const workspaceCookie = (Array.isArray(setCookies) ? setCookies : [setCookies])
    .find((cookie) => cookie?.startsWith('taskly_workspace='));
  if (!workspaceCookie) {
    throw new Error('The API did not issue a browser workspace cookie.');
  }
  return workspaceCookie.split(';', 1)[0];
};

export const workspaceIdFromCookie = (cookie: string): string => {
  const token = cookie.split('=', 2)[1];
  const decoded = jwt.decode(token);
  if (typeof decoded !== 'object' || decoded === null || typeof decoded.workspaceId !== 'string') {
    throw new Error('The workspace cookie does not contain a workspace ID.');
  }
  return decoded.workspaceId;
};
