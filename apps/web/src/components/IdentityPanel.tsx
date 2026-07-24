import { useEffect, useState } from 'react';
import { productApi, type Member } from '../lib/product-api';

interface IdentityPanelProps {
  me?: typeof productApi.me;
  login?: typeof productApi.login;
  acceptInvitation?: typeof productApi.acceptInvitation;
  logout?: typeof productApi.logout;
  onMember?: (member: Member | null) => void;
}

export default function IdentityPanel({
  me = productApi.me,
  login = productApi.login,
  acceptInvitation = productApi.acceptInvitation,
  logout = productApi.logout,
  onMember,
}: IdentityPanelProps) {
  const [member, setMember] = useState<Member | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('builder@sopscape.local');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const invitationToken = new URLSearchParams(window.location.search).get('invite');

  useEffect(() => {
    let cancelled = false;
    me()
      .then(({ member: authenticated }) => {
        if (cancelled) return;
        setMember(authenticated);
        onMember?.(authenticated);
      })
      .catch(() => {
        if (!cancelled) onMember?.(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [me, onMember]);

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const session = await login(email, password);
      setMember(session.member);
      onMember?.(session.member);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败');
    }
  }

  async function submitInvitation(event: React.FormEvent) {
    event.preventDefault();
    if (!invitationToken) return;
    setError(null);
    try {
      const session = await acceptInvitation(invitationToken, name, password);
      setMember(session.member);
      onMember?.(session.member);
      history.replaceState(null, '', window.location.pathname);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '邀请接受失败');
    }
  }

  async function signOut() {
    await logout();
    setMember(null);
    onMember?.(null);
  }

  if (checking) return <span className="identity-chip">身份校验中</span>;
  if (member) {
    return (
      <div className="identity-session">
        <span>
          {member.name} · {member.role}
        </span>
        <button onClick={() => void signOut()}>退出</button>
      </div>
    );
  }

  return (
    <div
      className="identity-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="identity-title"
    >
      <form className="identity-card" onSubmit={invitationToken ? submitInvitation : submitLogin}>
        <span>FORMAL IDENTITY · RBAC</span>
        <h2 id="identity-title">{invitationToken ? '接受团队邀请' : '登录 SOPscape'}</h2>
        <p>
          {invitationToken
            ? '设置成员姓名和密码。邀请令牌只能使用一次。'
            : '使用工作区账号进入 SOP、训练、审计和 MCP 控制台。'}
        </p>
        {invitationToken ? (
          <label>
            <span>姓名</span>
            <input
              aria-label="姓名"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
        ) : (
          <label>
            <span>邮箱</span>
            <input
              aria-label="邮箱"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
        )}
        <label>
          <span>密码</span>
          <input
            aria-label="密码"
            type="password"
            value={password}
            minLength={12}
            maxLength={128}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && <div className="product-alert">{error}</div>}
        <button type="submit">{invitationToken ? '加入工作区' : '安全登录'}</button>
      </form>
    </div>
  );
}
