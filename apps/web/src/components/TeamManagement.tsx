import { useEffect, useState } from 'react';
import {
  productApi,
  type InvitationRecord,
  type MemberRecord,
  type MemberRole,
} from '../lib/product-api';

interface TeamManagementProps {
  currentMemberId: string;
  currentMemberRole: MemberRole;
  onClose: () => void;
}

export default function TeamManagement({
  currentMemberId,
  currentMemberRole,
  onClose,
}: TeamManagementProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'invitations'>('members');
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersResult, invitationsResult] = await Promise.all([
        productApi.listMembers(),
        productApi.listInvitations(),
      ]);
      setMembers(membersResult.items);
      setInvitations(invitationsResult.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  async function handleRevokeInvitation(id: string) {
    try {
      await productApi.deleteInvitation(id);
      setInvitations(invitations.filter((inv) => inv.id !== id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '撤销失败');
    }
  }

  async function handleUpdateRole(memberId: string, newRole: MemberRole) {
    try {
      await productApi.updateMemberRole(memberId, newRole);
      setMembers(members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '修改失败');
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      await productApi.removeMember(memberId);
      setMembers(members.filter((m) => m.id !== memberId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '移除失败');
    }
  }

  const roleLabels: Record<MemberRole, string> = {
    owner: '所有者',
    editor: '编辑者',
    viewer: '查看者',
  };

  const statusLabels: Record<InvitationRecord['status'], string> = {
    pending: '待接受',
    accepted: '已接受',
    expired: '已过期',
  };

  const statusColors: Record<InvitationRecord['status'], string> = {
    pending: 'var(--cyan)',
    accepted: 'var(--green)',
    expired: 'var(--muted)',
  };

  const isOwner = currentMemberRole === 'owner';

  return (
    <div className="team-overlay" role="dialog" aria-modal="true">
      <div className="team-card">
        <span>TEAM · 团队管理</span>
        <h2>成员与邀请</h2>
        <p>管理团队成员和邀请链接。</p>

        {error && <div className="product-alert">{error}</div>}

        <div className="team-tabs">
          <button
            className={activeTab === 'members' ? 'active' : ''}
            onClick={() => setActiveTab('members')}
          >
            成员 ({members.length})
          </button>
          <button
            className={activeTab === 'invitations' ? 'active' : ''}
            onClick={() => setActiveTab('invitations')}
          >
            邀请 ({invitations.filter((i) => i.status === 'pending').length})
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>
            加载中...
          </div>
        ) : activeTab === 'members' ? (
          <div className="team-list">
            {members.map((member) => (
              <div key={member.id} className="team-item">
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.email}</span>
                </div>
                <div className="team-actions">
                  <select
                    value={member.role}
                    disabled={!isOwner || member.id === currentMemberId}
                    onChange={(e) => handleUpdateRole(member.id, e.target.value as MemberRole)}
                  >
                    <option value="owner">所有者</option>
                    <option value="editor">编辑者</option>
                    <option value="viewer">查看者</option>
                  </select>
                  {isOwner && member.id !== currentMemberId && (
                    <button className="team-delete" onClick={() => handleRemoveMember(member.id)}>
                      移除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="team-list">
            {invitations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)' }}>
                暂无邀请
              </div>
            ) : (
              invitations.map((invitation) => (
                <div key={invitation.id} className="team-item">
                  <div>
                    <strong>{invitation.email}</strong>
                    <span>
                      <span style={{ color: statusColors[invitation.status] }}>
                        {statusLabels[invitation.status]}
                      </span>
                      {' · '}
                      {roleLabels[invitation.role]}
                    </span>
                  </div>
                  {invitation.status === 'pending' && isOwner && (
                    <button
                      className="team-delete"
                      onClick={() => handleRevokeInvitation(invitation.id)}
                    >
                      撤销
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <button onClick={onClose} className="team-close">
          关闭
        </button>
      </div>
    </div>
  );
}
