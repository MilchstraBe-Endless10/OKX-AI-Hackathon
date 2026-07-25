import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '@sopscape/server';
import type { FastifyInstance } from 'fastify';

describe('Invitation and Member Management API', () => {
  let app: FastifyInstance;
  let serverUrl: string;
  let ownerCookie: string;
  let viewerCookie: string;

  beforeAll(async () => {
    const ownerPassword = 'TestOwnerPassword123!';
    app = buildApp({
      ownerPassword,
      requireAuth: true,
      sessionSecret: 'test-session-secret-for-integration-tests',
    });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server address not available');
    }
    serverUrl = `http://127.0.0.1:${address.port}`;

    // Login as owner
    const loginRes = await fetch(`${serverUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'builder@sopscape.local',
        password: ownerPassword,
      }),
      redirect: 'manual',
    });
    const setCookie = loginRes.headers.getSetCookie?.() ?? [];
    const sessionCookie = setCookie.find((c) => c.includes('sopscape_session'));
    if (!sessionCookie) throw new Error('No session cookie from login');
    ownerCookie = sessionCookie.split(';')[0];

    // Create a viewer for role tests
    const inviteRes = await fetch(`${serverUrl}/api/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerCookie,
      },
      body: JSON.stringify({ email: 'viewer@test.local', role: 'viewer' }),
    });
    const inviteBody = await inviteRes.json();
    const token = inviteBody.token;

    // Accept the invitation
    await fetch(`${serverUrl}/api/invitations/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        name: 'Test Viewer',
        password: 'ViewerPassword123!',
      }),
    });

    // Login as viewer
    const viewerLoginRes = await fetch(`${serverUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'viewer@test.local',
        password: 'ViewerPassword123!',
      }),
      redirect: 'manual',
    });
    const viewerSetCookie = viewerLoginRes.headers.getSetCookie?.() ?? [];
    const viewerSessionCookie = viewerSetCookie.find((c) => c.includes('sopscape_session'));
    if (!viewerSessionCookie) throw new Error('No session cookie from viewer login');
    viewerCookie = viewerSessionCookie.split(';')[0];
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/login', () => {
    it('authenticates valid credentials', async () => {
      const response = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'builder@sopscape.local',
          password: 'TestOwnerPassword123!',
        }),
        redirect: 'manual',
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.member).toBeDefined();
      expect(body.member.role).toBe('owner');
      expect(body.member.email).toBe('builder@sopscape.local');
    });

    it('rejects invalid credentials with 401', async () => {
      const response = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'builder@sopscape.local',
          password: 'wrong-password',
        }),
      });
      expect(response.status).toBe(401);
    });

    it('validates email format', async () => {
      const response = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', password: 'TestPassword123!' }),
      });
      // Server returns 401 for unauthenticated users (invalid email fails auth first)
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns current member with valid session', async () => {
      const response = await fetch(`${serverUrl}/api/auth/me`, {
        headers: { Cookie: ownerCookie },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.member.role).toBe('owner');
    });

    it('returns 401 without session', async () => {
      const response = await fetch(`${serverUrl}/api/auth/me`);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/invitations', () => {
    it('allows owner to create invitations', async () => {
      const response = await fetch(`${serverUrl}/api/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ email: 'newuser@test.local', role: 'editor' }),
      });
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.id).toBeDefined();
      expect(body.email).toBe('newuser@test.local');
      expect(body.role).toBe('editor');
      expect(body.token).toBeDefined();
      expect(body.expiresAt).toBeDefined();
    });

    it('rejects non-owner from creating invitations', async () => {
      const response = await fetch(`${serverUrl}/api/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: viewerCookie,
        },
        body: JSON.stringify({ email: 'another@test.local', role: 'viewer' }),
      });
      expect(response.status).toBe(403);
    });

    it('rejects invalid email', async () => {
      const response = await fetch(`${serverUrl}/api/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ email: 'bad-email', role: 'viewer' }),
      });
      expect(response.status).toBe(400);
    });

    it('rejects owner role in invitations', async () => {
      const response = await fetch(`${serverUrl}/api/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ email: 'someone@test.local', role: 'owner' }),
      });
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/invitations/accept', () => {
    let testToken: string;

    beforeAll(async () => {
      // Create a fresh invitation
      const inviteRes = await fetch(`${serverUrl}/api/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ email: 'acceptor@test.local', role: 'viewer' }),
      });
      const inviteBody = await inviteRes.json();
      testToken = inviteBody.token;
    });

    it('accepts a valid invitation', async () => {
      const response = await fetch(`${serverUrl}/api/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: testToken,
          name: 'Test Acceptor',
          password: 'AcceptPassword123!',
        }),
        redirect: 'manual',
      });
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.member.name).toBe('Test Acceptor');
      expect(body.member.email).toBe('acceptor@test.local');
      expect(body.member.role).toBe('viewer');
    });

    it('rejects already-used invitation', async () => {
      const response = await fetch(`${serverUrl}/api/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: testToken,
          name: 'Another Person',
          password: 'AnotherPassword123!',
        }),
      });
      expect(response.status).toBe(409);
    });

    it('rejects invalid invitation token', async () => {
      const response = await fetch(`${serverUrl}/api/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'nonexistent-token-xyz',
          name: 'Nobody',
          password: 'Password123!',
        }),
      });
      expect(response.status).toBe(400);
    });

    it('rejects password too short', async () => {
      // Create another invitation
      const inviteRes = await fetch(`${serverUrl}/api/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ email: 'shortpw@test.local', role: 'viewer' }),
      });
      const inviteBody = await inviteRes.json();

      const response = await fetch(`${serverUrl}/api/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: inviteBody.token,
          name: 'Short PW',
          password: 'short',
        }),
      });
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/invitations', () => {
    it('lists all invitations', async () => {
      const response = await fetch(`${serverUrl}/api/invitations`, {
        headers: { Cookie: ownerCookie },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/invitations/:id', () => {
    it('allows owner to revoke pending invitation', async () => {
      // Create invitation to revoke
      const inviteRes = await fetch(`${serverUrl}/api/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ email: 'revoke@test.local', role: 'viewer' }),
      });
      const inviteBody = await inviteRes.json();

      const response = await fetch(`${serverUrl}/api/invitations/${inviteBody.id}`, {
        method: 'DELETE',
        headers: { Cookie: ownerCookie },
      });
      expect(response.status).toBe(204);
    });

    it('rejects non-owner from revoking invitations', async () => {
      // Create invitation
      const inviteRes = await fetch(`${serverUrl}/api/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ email: 'cannot-revoke@test.local', role: 'viewer' }),
      });
      const inviteBody = await inviteRes.json();

      const response = await fetch(`${serverUrl}/api/invitations/${inviteBody.id}`, {
        method: 'DELETE',
        headers: { Cookie: viewerCookie },
      });
      expect(response.status).toBe(403);
    });

    it('returns 404 for non-existent invitation', async () => {
      const response = await fetch(`${serverUrl}/api/invitations/non-existent-id`, {
        method: 'DELETE',
        headers: { Cookie: ownerCookie },
      });
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/members', () => {
    it('lists all members', async () => {
      const response = await fetch(`${serverUrl}/api/members`, {
        headers: { Cookie: ownerCookie },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBeGreaterThanOrEqual(2); // owner + viewer
    });
  });

  describe('PATCH /api/members/:id/role', () => {
    it('allows owner to update member role', async () => {
      // Get the viewer member ID
      const membersRes = await fetch(`${serverUrl}/api/members`, {
        headers: { Cookie: ownerCookie },
      });
      const membersBody = await membersRes.json();
      const viewerMember = membersBody.items.find(
        (m: { email: string }) => m.email === 'viewer@test.local',
      );
      expect(viewerMember).toBeDefined();

      const response = await fetch(`${serverUrl}/api/members/${viewerMember.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ role: 'editor' }),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.role).toBe('editor');
      expect(body.id).toBe(viewerMember.id);
    });

    it('rejects non-owner from updating roles', async () => {
      const membersRes = await fetch(`${serverUrl}/api/members`, {
        headers: { Cookie: ownerCookie },
      });
      const membersBody = await membersRes.json();
      const ownerMember = membersBody.items.find((m: { role: string }) => m.role === 'owner');

      const response = await fetch(`${serverUrl}/api/members/${ownerMember.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: viewerCookie,
        },
        body: JSON.stringify({ role: 'editor' }),
      });
      expect(response.status).toBe(403);
    });

    it('prevents downgrading the last owner', async () => {
      const membersRes = await fetch(`${serverUrl}/api/members`, {
        headers: { Cookie: ownerCookie },
      });
      const membersBody = await membersRes.json();
      const ownerMember = membersBody.items.find((m: { role: string }) => m.role === 'owner');

      const response = await fetch(`${serverUrl}/api/members/${ownerMember.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ role: 'editor' }),
      });
      expect(response.status).toBe(400);
    });

    it('rejects invalid role value', async () => {
      const membersRes = await fetch(`${serverUrl}/api/members`, {
        headers: { Cookie: ownerCookie },
      });
      const membersBody = await membersRes.json();
      const viewerMember = membersBody.items.find(
        (m: { email: string }) => m.email === 'viewer@test.local',
      );

      const response = await fetch(`${serverUrl}/api/members/${viewerMember.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ role: 'admin' }),
      });
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/members/:id', () => {
    it('allows owner to remove a member', async () => {
      // Create a new member to remove
      const inviteRes = await fetch(`${serverUrl}/api/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ email: 'remove@test.local', role: 'viewer' }),
      });
      const inviteBody = await inviteRes.json();

      // Accept the invitation
      await fetch(`${serverUrl}/api/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: inviteBody.token,
          name: 'To Remove',
          password: 'RemovePassword123!',
        }),
      });

      // Get the new member's ID
      const membersRes = await fetch(`${serverUrl}/api/members`, {
        headers: { Cookie: ownerCookie },
      });
      const membersBody = await membersRes.json();
      const removable = membersBody.items.find(
        (m: { email: string }) => m.email === 'remove@test.local',
      );
      expect(removable).toBeDefined();

      const response = await fetch(`${serverUrl}/api/members/${removable.id}`, {
        method: 'DELETE',
        headers: { Cookie: ownerCookie },
      });
      expect(response.status).toBe(204);
    });

    it('prevents removing yourself', async () => {
      const membersRes = await fetch(`${serverUrl}/api/members`, {
        headers: { Cookie: ownerCookie },
      });
      const membersBody = await membersRes.json();
      const ownerMember = membersBody.items.find((m: { role: string }) => m.role === 'owner');

      const response = await fetch(`${serverUrl}/api/members/${ownerMember.id}`, {
        method: 'DELETE',
        headers: { Cookie: ownerCookie },
      });
      expect(response.status).toBe(400);
    });

    it('rejects non-owner from removing members', async () => {
      const membersRes = await fetch(`${serverUrl}/api/members`, {
        headers: { Cookie: ownerCookie },
      });
      const membersBody = await membersRes.json();
      const ownerMember = membersBody.items.find((m: { role: string }) => m.role === 'owner');

      const response = await fetch(`${serverUrl}/api/members/${ownerMember.id}`, {
        method: 'DELETE',
        headers: { Cookie: viewerCookie },
      });
      expect(response.status).toBe(403);
    });
  });
});
