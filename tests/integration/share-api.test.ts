import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '@sopscape/server';
import type { FastifyInstance } from 'fastify';

describe('Share API Integration', () => {
  let app: FastifyInstance;
  let serverUrl: string;
  let ownerCookie: string;
  let rehearsalId: string;

  beforeAll(async () => {
    app = buildApp({
      ownerPassword: 'TestOwnerPassword123!',
      requireAuth: true,
      sessionSecret: 'test-share-secret',
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
        password: 'TestOwnerPassword123!',
      }),
      redirect: 'manual',
    });
    const setCookie = loginRes.headers.getSetCookie?.() ?? [];
    const sessionCookie = setCookie.find((c) => c.includes('sopscape_session'));
    if (!sessionCookie) throw new Error('No session cookie');
    ownerCookie = sessionCookie.split(';')[0];

    // Generate a rehearsal to share
    const genRes = await fetch(`${serverUrl}/a2mcp/generate-rehearsal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test SOP',
        content: 'Test content for sharing',
      }),
    });
    const genBody = await genRes.json();
    rehearsalId = genBody.rehearsalId;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/shares', () => {
    it('creates a share link for a rehearsal', async () => {
      const response = await fetch(`${serverUrl}/api/shares`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({
          rehearsalId,
          maxViews: 10,
        }),
      });
      if (response.status !== 201) {
        console.error('Share creation error:', await response.json());
      }
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.shareId).toBeDefined();
      expect(body.shareToken).toBeDefined();
      expect(body.shareUrl).toBeDefined();
      expect(body.maxViews).toBe(10);
    });

    it('creates a permanent share with no view limit', async () => {
      const response = await fetch(`${serverUrl}/api/shares`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ rehearsalId, expiresAt: null, maxViews: -1 }),
      });
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.expiresAt).toBeNull();
      expect(body.maxViews).toBe(-1);
    });

    it('rejects invalid rehearsal ID', async () => {
      const response = await fetch(`${serverUrl}/api/shares`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({
          rehearsalId: '00000000-0000-0000-0000-000000000000',
          maxViews: -1,
        }),
      });
      expect(response.status).toBe(404);
    });

    it('rejects unauthenticated requests', async () => {
      const response = await fetch(`${serverUrl}/api/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rehearsalId, maxViews: -1 }),
      });
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/shares/:token', () => {
    let shareToken: string;

    beforeAll(async () => {
      const createRes = await fetch(`${serverUrl}/api/shares`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ rehearsalId, expiresAt: null, maxViews: 5 }),
      });
      const createBody = await createRes.json();
      shareToken = createBody.shareToken;
    });

    it('returns shared rehearsal data without authentication', async () => {
      const response = await fetch(`${serverUrl}/api/shares/${shareToken}`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.shareId).toBeDefined();
      expect(body.council).toBeDefined();
      expect(body.passport).toBeDefined();
      expect(body.decisions).toBeDefined();
    });

    it('increments view count on each access', async () => {
      // Access twice
      await fetch(`${serverUrl}/api/shares/${shareToken}`);
      await fetch(`${serverUrl}/api/shares/${shareToken}`);

      // Check shares list for view count
      const sharesRes = await fetch(`${serverUrl}/api/rehearsals/${rehearsalId}/shares`, {
        headers: { Cookie: ownerCookie },
      });
      const sharesBody = await sharesRes.json();
      const share = sharesBody.shares.find(
        (s: { id: string }) =>
          s.id === sharesBody.shares.find((x: { maxViews: number }) => x.maxViews === 5)?.id,
      );
      expect(share).toBeDefined();
      expect(share.viewCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/rehearsals/:id/shares', () => {
    it('lists shares for a rehearsal', async () => {
      const response = await fetch(`${serverUrl}/api/rehearsals/${rehearsalId}/shares`, {
        headers: { Cookie: ownerCookie },
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(Array.isArray(body.shares)).toBe(true);
      expect(body.shares.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/shares/:id', () => {
    it('allows creator to delete a share', async () => {
      // Create a share to delete
      const createRes = await fetch(`${serverUrl}/api/shares`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ rehearsalId, expiresAt: null, maxViews: -1 }),
      });
      const createBody = await createRes.json();

      // List shares to get the ID
      const listRes = await fetch(`${serverUrl}/api/rehearsals/${rehearsalId}/shares`, {
        headers: { Cookie: ownerCookie },
      });
      const listBody = await listRes.json();
      const share = listBody.shares.find((s: { id: string }) => s.id === createBody.shareId);
      expect(share).toBeDefined();

      const response = await fetch(`${serverUrl}/api/shares/${share.id}`, {
        method: 'DELETE',
        headers: { Cookie: ownerCookie },
      });
      expect(response.status).toBe(204);
    });

    it('returns 404 for non-existent share', async () => {
      const response = await fetch(`${serverUrl}/api/shares/00000000-0000-0000-0000-000000000000`, {
        method: 'DELETE',
        headers: { Cookie: ownerCookie },
      });
      expect(response.status).toBe(404);
    });
  });
});
