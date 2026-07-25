import type {
  CouncilResult,
  DecisionEvaluation,
  SopPassport,
  SopRecord,
  SopVersion,
  VersionComparison,
} from '@sopscape/contracts';

async function json<T>(responsePromise: Promise<Response>): Promise<T> {
  const response = await responsePromise;
  const body = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    throw new Error(
      body && typeof body === 'object' && 'message' in body
        ? (body.message ?? `Request failed (${response.status})`)
        : `Request failed (${response.status})`,
    );
  }
  return body as T;
}

export interface Workspace {
  id: string;
  name: string;
  members: Array<{ id: string; name: string; role: string; email: string }>;
}

export type MemberRole = 'owner' | 'editor' | 'viewer';

export interface Member {
  id: string;
  workspaceId: string;
  name: string;
  role: MemberRole;
  email: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Exclude<MemberRole, 'owner'>;
  token: string;
  expiresAt: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  targetId: string;
  detail: string;
  createdAt: string;
}

export interface RehearsalMetrics {
  runs: number;
  tokens: number;
  durationMs: number;
  averageDurationMs: number;
  model: string;
  estimatedCostUsd: number;
}

export interface TrainingAssignment {
  id: string;
  sopId: string;
  assignee: string;
  status: 'assigned' | 'completed';
  score: number | null;
  dueAt: string;
  completedAt: string | null;
  report: { grade: 'passed' | 'needs-review'; summary: string } | null;
}

export interface ShareRecord {
  id: string;
  rehearsalId: string;
  token: string;
  expiresAt: string | null;
  viewCount: number;
  maxViews: number;
  createdAt: string;
  createdBy: string;
}

export interface InvitationRecord {
  id: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface MemberRecord {
  id: string;
  workspaceId: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  email: string;
  createdAt: string;
}

export interface CreateShareRequest {
  rehearsalId: string;
  expiresAt: string | null;
  maxViews: number;
}

export interface CreateShareResponse {
  shareId: string;
  shareToken: string;
  shareUrl: string;
  expiresAt: string | null;
  maxViews: number;
}

export interface SharedRehearsal {
  shareId: string;
  rehearsalId: string;
  sopId: string | null;
  council: CouncilResult;
  passport: SopPassport;
  decisions: Array<{
    nodeId: string;
    choiceId: string;
    scoreDelta: number;
    riskLevel: string;
    consequence: string;
    coaching: string;
    createdAt: string;
  }>;
  createdAt: string;
}

export const productApi = {
  me: (request: typeof fetch = fetch) =>
    json<{ member: Member }>(request('/api/auth/me', { credentials: 'same-origin' })),
  login: (email: string, password: string, request: typeof fetch = fetch) =>
    json<{ member: Member }>(
      request('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }),
    ),
  logout: (request: typeof fetch = fetch) =>
    request('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).then((response) => {
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
    }),
  invite: (email: string, role: Exclude<MemberRole, 'owner'>, request: typeof fetch = fetch) =>
    json<Invitation>(
      request('/api/invitations', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      }),
    ),
  acceptInvitation: (
    token: string,
    name: string,
    password: string,
    request: typeof fetch = fetch,
  ) =>
    json<{ member: Member }>(
      request('/api/invitations/accept', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, password }),
      }),
    ),
  convertDocument: (file: File, request: typeof fetch = fetch) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.onload = () => {
        const base64 = String(reader.result).split(',')[1] ?? '';
        json<{ content: string }>(
          request('/api/documents/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: file.name, mime: file.type, base64 }),
          }),
        ).then(({ content }) => resolve(content), reject);
      };
      reader.readAsDataURL(file);
    }),
  workspace: (request: typeof fetch = fetch) => json<Workspace>(request('/api/workspace')),
  listSops: (request: typeof fetch = fetch) => json<{ items: SopRecord[] }>(request('/api/sops')),
  versions: (sopId: string, request: typeof fetch = fetch) =>
    json<{ items: SopVersion[] }>(request(`/api/sops/${sopId}/versions`)),
  passport: (sopId: string, request: typeof fetch = fetch) =>
    json<SopPassport>(request(`/api/sops/${sopId}/passport`)),
  audit: (request: typeof fetch = fetch) => json<{ items: AuditEvent[] }>(request('/api/audit')),
  metrics: (request: typeof fetch = fetch) => json<RehearsalMetrics>(request('/api/metrics')),
  training: (request: typeof fetch = fetch) =>
    json<{ items: TrainingAssignment[] }>(request('/api/training')),
  assignTraining: (sopId: string, assignee: string, request: typeof fetch = fetch) =>
    json<{ id: string; status: string; dueAt: string }>(
      request('/api/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sopId, assignee }),
      }),
    ),
  completeTraining: (
    assignmentId: string,
    score: number,
    decisions: Array<{ nodeId: string; choiceId: string; scoreDelta: number }>,
    request: typeof fetch = fetch,
  ) =>
    json<{
      id: string;
      status: 'completed';
      report: { grade: 'passed' | 'needs-review'; summary: string };
    }>(
      request(`/api/training/${assignmentId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, decisions }),
      }),
    ),
  addVersion: (sopId: string, content: string, request: typeof fetch = fetch) =>
    json<SopVersion>(
      request(`/api/sops/${sopId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }),
    ),
  compare: (sopId: string, from: number, to: number, request: typeof fetch = fetch) =>
    json<VersionComparison>(request(`/api/sops/${sopId}/compare?from=${from}&to=${to}`)),
  evaluate: (
    rehearsalId: string,
    nodeId: string,
    choiceId: string,
    request: typeof fetch = fetch,
  ) =>
    json<DecisionEvaluation>(
      request('/api/evaluate-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rehearsalId, nodeId, choiceId }),
      }),
    ),
  createShare: (
    rehearsalId: string,
    expiresAt: string | null = null,
    maxViews = -1,
    request: typeof fetch = fetch,
  ) =>
    json<CreateShareResponse>(
      request('/api/shares', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rehearsalId, expiresAt, maxViews }),
      }),
    ),
  getSharedRehearsal: (token: string, request: typeof fetch = fetch) =>
    json<SharedRehearsal>(request(`/api/shares/${token}`, { credentials: 'same-origin' })),
  listShares: (rehearsalId: string, request: typeof fetch = fetch) =>
    json<{ shares: ShareRecord[] }>(
      request(`/api/rehearsals/${rehearsalId}/shares`, { credentials: 'same-origin' }),
    ),
  deleteShare: (shareId: string, request: typeof fetch = fetch) =>
    request(`/api/shares/${shareId}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    }).then((response) => {
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
    }),
  listInvitations: (request: typeof fetch = fetch) =>
    json<{ items: InvitationRecord[] }>(
      request('/api/invitations', { credentials: 'same-origin' }),
    ),
  deleteInvitation: (invitationId: string, request: typeof fetch = fetch) =>
    request(`/api/invitations/${invitationId}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    }).then((response) => {
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
    }),
  listMembers: (request: typeof fetch = fetch) =>
    json<{ items: MemberRecord[] }>(request('/api/members', { credentials: 'same-origin' })),
  updateMemberRole: (
    memberId: string,
    role: 'owner' | 'editor' | 'viewer',
    request: typeof fetch = fetch,
  ) =>
    json<{ id: string; role: string }>(
      request(`/api/members/${memberId}/role`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      }),
    ),
  removeMember: (memberId: string, request: typeof fetch = fetch) =>
    request(`/api/members/${memberId}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    }).then((response) => {
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
    }),
};
