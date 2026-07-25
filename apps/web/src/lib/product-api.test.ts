import { describe, expect, it, vi } from 'vitest';
import { productApi } from './product-api';

describe('identity and collaboration API adapter', () => {
  it('logs in with same-origin credentials and returns the member', async () => {
    const request = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            member: {
              id: 'owner-1',
              workspaceId: 'workspace-demo',
              name: 'Owner',
              email: 'owner@example.com',
              role: 'owner',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );

    const session = await productApi.login(
      'owner@example.com',
      'correct horse battery staple',
      request as typeof fetch,
    );

    expect(session.member.role).toBe('owner');
    expect(request).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }),
    );
  });

  it('creates an editor invitation through the owner-only endpoint', async () => {
    const request = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 'invite-1',
            email: 'editor@example.com',
            role: 'editor',
            token: 'one-time-token',
            expiresAt: '2026-07-25T00:00:00.000Z',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
    );

    const invitation = await productApi.invite(
      'editor@example.com',
      'editor',
      request as typeof fetch,
    );

    expect(invitation.token).toBe('one-time-token');
    expect(request).toHaveBeenCalledWith(
      '/api/invitations',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }),
    );
  });
});
