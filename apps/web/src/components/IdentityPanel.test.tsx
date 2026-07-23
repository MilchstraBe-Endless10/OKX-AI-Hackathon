import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IdentityPanel from './IdentityPanel';

describe('IdentityPanel', () => {
  it('shows a login boundary and authenticates the owner', async () => {
    const me = vi.fn(async () => Promise.reject(new Error('请先登录')));
    const login = vi.fn(async () => ({
      member: {
        id: 'owner-1',
        workspaceId: 'workspace-demo',
        name: 'Owner',
        email: 'owner@example.com',
        role: 'owner' as const,
      },
    }));

    render(<IdentityPanel me={me} login={login} />);

    expect(await screen.findByRole('heading', { name: '登录 SOPscape' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'correct horse battery staple' },
    });
    fireEvent.click(screen.getByRole('button', { name: '安全登录' }));

    await waitFor(() => expect(login).toHaveBeenCalled());
    expect(await screen.findByText('Owner · owner')).toBeInTheDocument();
  });
});
