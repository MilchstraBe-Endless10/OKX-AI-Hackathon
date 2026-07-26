import { useEffect, useMemo, useState } from 'react';
import type { SopRecord, SopVersion, VersionComparison } from '@sopscape/contracts';
import {
  productApi,
  type AuditEvent,
  type Invitation,
  type MemberRole,
  type RehearsalMetrics,
  type TrainingAssignment,
  type Workspace,
} from '../lib/product-api';
import { getProductCopy, type ProductCopy } from '../lib/product-copy';
import type { LocaleCode } from '../lib/preferences';

export type ProductView = 'history' | 'evidence' | 'protocol' | 'security';

interface ProductWorkspaceProps {
  view: ProductView;
  refreshToken: number;
  onOpenTeam?: () => void;
  locale?: LocaleCode;
}

export default function ProductWorkspace({
  view,
  refreshToken,
  onOpenTeam,
  locale = 'zh-CN',
}: ProductWorkspaceProps) {
  const copy = getProductCopy(locale);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [sops, setSops] = useState<SopRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versions, setVersions] = useState<SopVersion[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [draft, setDraft] = useState('');
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  const [trainingAssigned, setTrainingAssigned] = useState(false);
  const [metrics, setMetrics] = useState<RehearsalMetrics | null>(null);
  const [training, setTraining] = useState<TrainingAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<MemberRole, 'owner'>>('editor');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const selected = sops.find((sop) => sop.id === selectedId) ?? sops[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([
      productApi.workspace(),
      productApi.listSops(),
      productApi.audit(),
      productApi.metrics(),
      productApi.training(),
    ])
      .then(([workspaceData, sopData, auditData, metricsData, trainingData]) => {
        if (cancelled) return;
        setWorkspace(workspaceData);
        setSops(sopData.items);
        setAudit(auditData.items);
        setMetrics(metricsData);
        setTraining(trainingData.items);
        setSelectedId((current) => current ?? sopData.items[0]?.id ?? null);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : '工作台加载失败'),
      );
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  useEffect(() => {
    if (!selected?.id) return;
    productApi
      .versions(selected.id)
      .then(({ items }) => {
        setVersions(items);
        setDraft(items[0]?.content ?? '');
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : '版本加载失败'),
      );
  }, [selected?.id, selected?.latestVersion]);

  const totalEvidence = selected?.passport.evidenceRefs.length ?? 0;
  const coverage = Math.round((selected?.passport.evidenceCoverage ?? 0) * 100);
  const stats = useMemo(
    () => ({
      ready: sops.filter((sop) => sop.status === 'READY').length,
      warn: sops.filter((sop) => sop.status === 'WARN').length,
      blocked: sops.filter((sop) => sop.status === 'BLOCK').length,
    }),
    [sops],
  );

  async function createVersion() {
    if (!selected || !draft.trim()) return;
    setError(null);
    try {
      await productApi.addVersion(selected.id, draft);
      const { items } = await productApi.listSops();
      setSops(items);
      const versionData = await productApi.versions(selected.id);
      setVersions(versionData.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '新版本创建失败');
    }
  }

  async function compareLatest() {
    if (!selected || versions.length < 2) return;
    const [latest, previous] = versions;
    if (!latest || !previous) return;
    try {
      setComparison(await productApi.compare(selected.id, previous.version, latest.version));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '版本比较失败');
    }
  }

  async function assignTraining() {
    if (!selected) return;
    try {
      await productApi.assignTraining(selected.id, workspace?.members[0]?.email ?? 'team');
      setTrainingAssigned(true);
      setTraining((await productApi.training()).items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '训练分配失败');
    }
  }

  async function createInvitation() {
    if (!inviteEmail.trim()) return;
    setError(null);
    try {
      const created = await productApi.invite(inviteEmail.trim(), inviteRole);
      setInvitation(created);
      setInviteEmail('');
      const workspaceData = await productApi.workspace();
      setWorkspace(workspaceData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '成员邀请失败');
    }
  }

  return (
    <section className="product-workspace" aria-label={copy.historyTitle}>
      <header className="product-hero">
        <div>
          <span>OPERATIONAL SOP INTELLIGENCE</span>
          <h1>{viewTitle(view, copy)}</h1>
          <p>
            {workspace?.name ?? 'SOPscape Workspace'} · {copy.workspaceTagline}
          </p>
        </div>
        <div className="product-actions">
          <button onClick={() => window.print()}>{copy.exportReport}</button>
          <button onClick={() => void assignTraining()} disabled={!selected}>
            {trainingAssigned ? copy.assignedTraining : copy.assignTraining}
          </button>
        </div>
      </header>

      {error && <div className="product-alert">{error}</div>}

      <div className="product-kpis">
        <Metric label={copy.sopCount} value={String(sops.length)} />
        <Metric label={copy.publishable} value={String(stats.ready)} tone="safe" />
        <Metric label={copy.needsReview} value={String(stats.warn)} tone="warn" />
        <Metric label={copy.blocked} value={String(stats.blocked)} tone="danger" />
      </div>

      <div className="product-grid">
        <aside className="product-card product-list">
          <div className="product-card-head">
            <strong>{copy.sopVersions}</strong>
            <span>{sops.length} RECORDS</span>
          </div>
          {sops.length === 0 ? (
            <p className="product-empty">{copy.noSop}</p>
          ) : (
            sops.map((sop) => (
              <button
                key={sop.id}
                className={selected?.id === sop.id ? 'is-selected' : ''}
                onClick={() => setSelectedId(sop.id)}
              >
                <span className={`verdict verdict-${sop.status.toLowerCase()}`}>{sop.status}</span>
                <strong>{sop.title}</strong>
                <small>
                  v{sop.latestVersion} · {sop.passport.score}/100 · {sop.owner}
                </small>
              </button>
            ))
          )}
        </aside>

        <main className="product-card product-detail">
          {view === 'history' && (
            <HistoryView
              copy={copy}
              selected={selected}
              versions={versions}
              draft={draft}
              onDraft={setDraft}
              onCreate={createVersion}
              onCompare={compareLatest}
              comparison={comparison}
            />
          )}
          {view === 'evidence' && (
            <EvidenceView
              copy={copy}
              selected={selected}
              total={totalEvidence}
              coverage={coverage}
            />
          )}
          {view === 'protocol' && (
            <ProtocolView
              copy={copy}
              selected={selected}
              versions={versions}
              trainingAssigned={trainingAssigned}
              metrics={metrics}
              training={training}
            />
          )}
          {view === 'security' && (
            <SecurityView
              copy={copy}
              workspace={workspace}
              audit={audit}
              selected={selected}
              inviteEmail={inviteEmail}
              inviteRole={inviteRole}
              invitation={invitation}
              onInviteEmail={setInviteEmail}
              onInviteRole={setInviteRole}
              onInvite={createInvitation}
              onOpenTeam={onOpenTeam}
            />
          )}
        </main>
      </div>
    </section>
  );
}

function HistoryView({
  copy,
  selected,
  versions,
  draft,
  onDraft,
  onCreate,
  onCompare,
  comparison,
}: {
  copy: ProductCopy;
  selected: SopRecord | null;
  versions: SopVersion[];
  draft: string;
  onDraft: (value: string) => void;
  onCreate: () => void;
  onCompare: () => void;
  comparison: VersionComparison | null;
}) {
  if (!selected) return <p className="product-empty">{copy.noHistory}</p>;
  return (
    <>
      <SectionTitle title={copy.historyTitle} subtitle={copy.historySubtitle} />
      <div className="passport-banner">
        <span className={`verdict verdict-${selected.status.toLowerCase()}`}>
          {selected.status}
        </span>
        <div>
          <strong>{selected.title}</strong>
          <p>
            {copy.sopVersions} · {selected.passport.id.slice(0, 8)} · v{selected.latestVersion}
          </p>
        </div>
        <b>{selected.passport.score}</b>
      </div>
      <label className="version-editor">
        <span>{copy.createVersion}</span>
        <textarea value={draft} onChange={(event) => onDraft(event.target.value)} rows={7} />
      </label>
      <div className="inline-actions">
        <button onClick={onCreate}>{copy.saveReview}</button>
        <button onClick={onCompare} disabled={versions.length < 2}>
          {copy.compareVersions}
        </button>
        <button onClick={() => navigator.clipboard?.writeText(location.href)}>
          {copy.copyShare}
        </button>
      </div>
      {comparison && (
        <div className={`comparison ${comparison.regressed ? 'is-regressed' : ''}`}>
          <strong>{comparison.regressed ? '风险回归已发现' : '版本风险未回归'}</strong>
          <p>{comparison.summary}</p>
        </div>
      )}
      <div className="timeline">
        {versions.map((version) => (
          <article key={version.id}>
            <b>v{version.version}</b>
            <span>{version.passport.verdict}</span>
            <p>{new Date(version.createdAt).toLocaleString()}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function EvidenceView({
  copy,
  selected,
  total,
  coverage,
}: {
  copy: ProductCopy;
  selected: SopRecord | null;
  total: number;
  coverage: number;
}) {
  if (!selected) return <p className="product-empty">{copy.noItems}</p>;
  return (
    <>
      <SectionTitle title={copy.evidenceTitle} subtitle={copy.evidenceSubtitle} />
      <div className="readiness-gauge">
        <b>{selected.passport.score}</b>
        <span>READINESS · {selected.passport.verdict}</span>
        <i style={{ width: `${selected.passport.score}%` }} />
      </div>
      <div className="evidence-summary">
        <Metric label={copy.evidenceSubtitleShort} value={`${coverage}%`} />
        <Metric label={copy.evidenceTitle} value={String(total)} />
        <Metric
          label={copy.blocked}
          value={String(selected.passport.blockers.length)}
          tone="danger"
        />
        <Metric
          label={copy.needsReview}
          value={String(selected.passport.warnings.length)}
          tone="warn"
        />
      </div>
      <EvidenceList
        title={copy.evidenceTitle}
        items={selected.passport.evidenceRefs}
        empty={copy.noItems}
      />
      <EvidenceList title={copy.blocked} items={selected.passport.blockers} empty={copy.noItems} />
      <EvidenceList
        title={copy.needsReview}
        items={selected.passport.warnings}
        empty={copy.noItems}
      />
    </>
  );
}

function ProtocolView({
  copy,
  selected,
  versions,
  trainingAssigned,
  metrics,
  training,
}: {
  copy: ProductCopy;
  selected: SopRecord | null;
  versions: SopVersion[];
  trainingAssigned: boolean;
  metrics: RehearsalMetrics | null;
  training: TrainingAssignment[];
}) {
  const council = versions[0]?.council;
  return (
    <>
      <SectionTitle title={copy.protocolTitle} subtitle={copy.protocolSubtitle} />
      <div className="tool-grid">
        {['review_sop', 'generate_rehearsal', 'evaluate_decision', 'compare_sop_versions'].map(
          (tool) => (
            <article key={tool}>
              <span>FREE · A2MCP</span>
              <strong>{tool}</strong>
              <p>{copy.protocolToolStatus}</p>
            </article>
          ),
        )}
      </div>
      <div className="evidence-summary">
        <Metric label="模型" value={metrics?.model ?? 'demo'} />
        <Metric label="运行次数" value={String(metrics?.runs ?? 0)} />
        <Metric label="平均耗时" value={`${metrics?.averageDurationMs ?? 0} ms`} />
        <Metric label="估算成本" value={`$${(metrics?.estimatedCostUsd ?? 0).toFixed(4)}`} />
      </div>
      <div className="scenario-card">
        <span>PHISHING EMAIL · BRANCHING TEMPLATE</span>
        <h2>{selected?.title ?? copy.phishingScenario}</h2>
        <p>
          {council?.decisionNodes[0]?.prompt ??
            '收到一封要求紧急重置密码的邮件，你会点击链接，还是独立核验并上报？'}
        </p>
        <ul>
          {(council?.decisionNodes[0]?.options ?? []).map((option) => (
            <li key={option.id}>
              <b>{option.label}</b> — {option.consequence}
            </li>
          ))}
        </ul>
        <small>{trainingAssigned ? copy.trainingAssigned : copy.trainingWaiting}</small>
      </div>
      <div className="timeline">
        {training.slice(0, 6).map((assignment) => (
          <article key={assignment.id}>
            <b>{assignment.status === 'completed' ? `${assignment.score ?? 0}分` : '待完成'}</b>
            <span>
              {assignment.assignee} · {assignment.report?.grade ?? assignment.status}
            </span>
            <p>{assignment.report?.summary ?? new Date(assignment.dueAt).toLocaleString()}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function SecurityView({
  copy,
  workspace,
  audit,
  selected,
  inviteEmail,
  inviteRole,
  invitation,
  onInviteEmail,
  onInviteRole,
  onInvite,
  onOpenTeam,
}: {
  copy: ProductCopy;
  workspace: Workspace | null;
  audit: AuditEvent[];
  selected: SopRecord | null;
  inviteEmail: string;
  inviteRole: Exclude<MemberRole, 'owner'>;
  invitation: Invitation | null;
  onInviteEmail: (value: string) => void;
  onInviteRole: (value: Exclude<MemberRole, 'owner'>) => void;
  onInvite: () => void;
  onOpenTeam?: () => void;
}) {
  const invitationUrl = invitation
    ? `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(invitation.token)}`
    : null;
  return (
    <>
      <SectionTitle title={copy.securityTitle} subtitle={copy.securitySubtitle} />
      <div className="security-checks">
        {[
          ['Bearer 鉴权', 'SOPSCAPE_API_KEY 可配置'],
          ['速率限制', '默认 120 次/分钟/IP'],
          ['输入边界', '64 KiB body + 60 KiB SOP'],
          ['安全响应头', 'CSP / nosniff / deny frame'],
          ['截止时间', '58 秒绝对 Deadline'],
          ['支付策略', '比赛期间免费，赛后接 x402 SDK'],
        ].map(([name, detail]) => (
          <article key={name}>
            <b>✓</b>
            <div>
              <strong>{name}</strong>
              <span>{detail}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="member-strip">
        {(workspace?.members ?? []).map((member) => (
          <span key={member.id}>
            {member.name} · {member.role}
          </span>
        ))}
        <span>当前护照：{selected?.passport.id.slice(0, 8) ?? '未生成'}</span>
      </div>
      {onOpenTeam && (
        <button className="team-manage-btn" onClick={onOpenTeam}>
          {copy.teamManagement}
        </button>
      )}
      <section className="invite-console">
        <div>
          <strong>{copy.inviteCollaborator}</strong>
          <p>所有者可签发 48 小时有效的一次性邀请；服务端只保存令牌摘要。</p>
        </div>
        <input
          aria-label="邀请邮箱"
          type="email"
          value={inviteEmail}
          placeholder="teammate@example.com"
          onChange={(event) => onInviteEmail(event.target.value)}
        />
        <select
          aria-label="邀请角色"
          value={inviteRole}
          onChange={(event) => onInviteRole(event.target.value as Exclude<MemberRole, 'owner'>)}
        >
          <option value="editor">Editor · 可编辑与训练</option>
          <option value="viewer">Viewer · 只读查看</option>
        </select>
        <button onClick={() => void onInvite()}>{copy.generateInvite}</button>
        {invitationUrl && (
          <div className="invitation-result">
            <code>{invitationUrl}</code>
            <button onClick={() => navigator.clipboard?.writeText(invitationUrl)}>
              {copy.copyInvite}
            </button>
          </div>
        )}
      </section>
      <div className="audit-log">
        {audit.slice(0, 12).map((event) => (
          <article key={event.id}>
            <time>{new Date(event.createdAt).toLocaleTimeString()}</time>
            <b>{event.action}</b>
            <span>{event.actor}</span>
          </article>
        ))}
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'safe' | 'warn' | 'danger';
}) {
  return (
    <article className={`product-metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <span>LIVE DATA</span>
    </div>
  );
}

function EvidenceList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="evidence-list">
      <h3>{title}</h3>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}

function viewTitle(view: ProductView, copy: ProductCopy): string {
  return {
    history: copy.historyTitle,
    evidence: copy.evidenceTitle,
    protocol: copy.protocolTitle,
    security: copy.securityTitle,
  }[view];
}
