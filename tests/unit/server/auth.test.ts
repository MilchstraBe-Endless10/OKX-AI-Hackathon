import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '@sopscape/server';
import type { FastifyInstance } from 'fastify';

function sessionCookie(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) throw new Error('SESSION_COOKIE_MISSING');
  return value.split(';', 1)[0] ?? '';
}

describe('formal identity, RBAC and collaboration invitations', () => {
  let app: FastifyInstance;
  let ownerCookie = '';
  let invitationToken = '';
  let viewerInvitationToken = '';

  beforeAll(() => {
    app = buildApp({
      databasePath: ':memory:',
      requireAuth: true,
      ownerPassword: 'correct horse battery staple',
      sessionSecret: 'unit-test-session-secret',
      publicAppOrigin: 'https://sopscape.example',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks protected product APIs without a session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/sops' });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('UNAUTHORIZED');
  });

  it('rejects an invalid password without revealing which credential failed', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'builder@sopscape.local', password: 'wrong-password' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().message).toBe('邮箱或密码错误');
  });

  it('creates an HttpOnly owner session and returns the current identity', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'builder@sopscape.local',
        password: 'correct horse battery staple',
      },
    });
    expect(login.statusCode).toBe(200);
    expect(String(login.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(login.headers['set-cookie'])).toContain('SameSite=Strict');
    ownerCookie = sessionCookie(login);

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: ownerCookie },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().member).toMatchObject({
      email: 'builder@sopscape.local',
      role: 'owner',
    });
  });

  it('allows an owner to issue a one-time editor invitation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/invitations',
      headers: { cookie: ownerCookie },
      payload: { email: 'editor@example.com', role: 'editor' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      email: 'editor@example.com',
      role: 'editor',
    });
    expect(response.json().token).toEqual(expect.any(String));
    invitationToken = response.json().token;

    const viewer = await app.inject({
      method: 'POST',
      url: '/api/invitations',
      headers: { cookie: ownerCookie },
      payload: { email: 'viewer@example.com', role: 'viewer' },
    });
    expect(viewer.statusCode).toBe(201);
    viewerInvitationToken = viewer.json().token;
  });

  it('keeps a viewer read-only across protected product APIs', async () => {
    const accepted = await app.inject({
      method: 'POST',
      url: '/api/invitations/accept',
      payload: {
        token: viewerInvitationToken,
        name: 'Read Only Reviewer',
        password: 'viewer-password-123',
      },
    });
    expect(accepted.statusCode).toBe(201);
    const viewerCookie = sessionCookie(accepted);

    const read = await app.inject({
      method: 'GET',
      url: '/api/sops',
      headers: { cookie: viewerCookie },
    });
    expect(read.statusCode).toBe(200);

    const write = await app.inject({
      method: 'POST',
      url: '/api/sops',
      headers: { cookie: viewerCookie },
      payload: { title: 'Forbidden', content: 'Viewer must not create an SOP.' },
    });
    expect(write.statusCode).toBe(403);
    expect(write.json().code).toBe('FORBIDDEN');
  });

  it('blocks state changes from an untrusted browser origin', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/invitations',
      headers: {
        cookie: ownerCookie,
        origin: 'https://attacker.example',
      },
      payload: { email: 'blocked@example.com', role: 'viewer' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('CSRF_BLOCKED');
  });

  it('accepts the invitation once, creates an editor session and rejects replay', async () => {
    const accepted = await app.inject({
      method: 'POST',
      url: '/api/invitations/accept',
      payload: {
        token: invitationToken,
        name: 'Security Editor',
        password: 'editor-password-123',
      },
    });
    expect(accepted.statusCode).toBe(201);
    expect(accepted.json().member.role).toBe('editor');
    const editorCookie = sessionCookie(accepted);

    const forbidden = await app.inject({
      method: 'POST',
      url: '/api/invitations',
      headers: { cookie: editorCookie },
      payload: { email: 'viewer@example.com', role: 'viewer' },
    });
    expect(forbidden.statusCode).toBe(403);

    const replay = await app.inject({
      method: 'POST',
      url: '/api/invitations/accept',
      payload: {
        token: invitationToken,
        name: 'Replay',
        password: 'another-password-123',
      },
    });
    expect(replay.statusCode).toBe(409);
    expect(replay.json().code).toBe('INVITATION_ALREADY_USED');
  });

  it('invalidates the current session on logout', async () => {
    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: ownerCookie },
    });
    expect(logout.statusCode).toBe(204);

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: ownerCookie },
    });
    expect(me.statusCode).toBe(401);
  });
});
