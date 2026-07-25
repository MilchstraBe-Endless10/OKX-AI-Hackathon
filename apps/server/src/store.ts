import { DatabaseSync } from 'node:sqlite';
import type {
  CouncilResult,
  DecisionEvaluation,
  SopInput,
  SopPassport,
  SopRecord,
  SopVersion,
} from '@sopscape/contracts';
import { computeReadiness } from './product.js';
import {
  createOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from './auth.js';

interface Row {
  [key: string]: unknown;
}

const now = () => new Date().toISOString();

export type MemberRole = 'owner' | 'editor' | 'viewer';

export interface AuthMember {
  id: string;
  workspaceId: string;
  name: string;
  role: MemberRole;
  email: string;
}

interface StoreAuthOptions {
  ownerPassword?: string;
  tokenSecret?: string;
}

export class ProductStore {
  readonly workspaceId = 'workspace-demo';
  private readonly db: DatabaseSync;

  private readonly tokenSecret: string;

  constructor(
    path = process.env.SOPSCAPE_DATABASE_PATH ?? 'sopscape.sqlite',
    auth: StoreAuthOptions = {},
  ) {
    this.db = new DatabaseSync(path);
    this.tokenSecret = auth.tokenSecret ?? 'development-only-token-secret';
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL,
        role TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sops (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, title TEXT NOT NULL,
        locale TEXT NOT NULL, owner TEXT NOT NULL, status TEXT NOT NULL,
        latest_version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sop_versions (
        id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, version INTEGER NOT NULL,
        content TEXT NOT NULL, council_json TEXT NOT NULL, passport_json TEXT NOT NULL,
        created_at TEXT NOT NULL, UNIQUE(sop_id, version)
      );
      CREATE TABLE IF NOT EXISTS rehearsals (
        id TEXT PRIMARY KEY, sop_id TEXT, version INTEGER NOT NULL,
        council_json TEXT NOT NULL, passport_json TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0, model TEXT NOT NULL,
        tokens INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY, rehearsal_id TEXT NOT NULL, node_id TEXT NOT NULL,
        choice_id TEXT NOT NULL, score_delta INTEGER NOT NULL, risk_level TEXT NOT NULL,
        consequence TEXT NOT NULL, coaching TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, actor TEXT NOT NULL,
        action TEXT NOT NULL, target_id TEXT NOT NULL, detail_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS training_assignments (
        id TEXT PRIMARY KEY, sop_id TEXT NOT NULL, assignee TEXT NOT NULL,
        status TEXT NOT NULL, due_at TEXT NOT NULL, score INTEGER,
        report_json TEXT, completed_at TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL,
        expires_at TEXT NOT NULL, created_at TEXT NOT NULL,
        FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS invitations (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, email TEXT NOT NULL,
        role TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, invited_by TEXT NOT NULL,
        expires_at TEXT NOT NULL, accepted_at TEXT, created_at TEXT NOT NULL,
        FOREIGN KEY(invited_by) REFERENCES members(id)
      );
      CREATE TABLE IF NOT EXISTS shares (
        id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, rehearsal_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL,
        expires_at TEXT, view_count INTEGER NOT NULL DEFAULT 0, max_views INTEGER NOT NULL DEFAULT -1,
        created_at TEXT NOT NULL,
        FOREIGN KEY(rehearsal_id) REFERENCES rehearsals(id) ON DELETE CASCADE,
        FOREIGN KEY(created_by) REFERENCES members(id)
      );
    `);
    const memberColumns = new Set(
      (this.db.prepare('PRAGMA table_info(members)').all() as Row[]).map((row) => String(row.name)),
    );
    if (!memberColumns.has('password_salt'))
      this.db.exec('ALTER TABLE members ADD COLUMN password_salt TEXT');
    if (!memberColumns.has('password_hash'))
      this.db.exec('ALTER TABLE members ADD COLUMN password_hash TEXT');
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS members_email_unique ON members(email)');
    const trainingColumns = new Set(
      (this.db.prepare('PRAGMA table_info(training_assignments)').all() as Row[]).map((row) =>
        String(row.name),
      ),
    );
    // ponytail: three additive columns are enough for the hackathon schema; use migrations once schema history matters.
    if (!trainingColumns.has('score'))
      this.db.exec('ALTER TABLE training_assignments ADD COLUMN score INTEGER');
    if (!trainingColumns.has('report_json'))
      this.db.exec('ALTER TABLE training_assignments ADD COLUMN report_json TEXT');
    if (!trainingColumns.has('completed_at'))
      this.db.exec('ALTER TABLE training_assignments ADD COLUMN completed_at TEXT');
    this.seed(auth.ownerPassword);
  }

  close(): void {
    this.db.close();
  }

  workspace(): { id: string; name: string; members: Row[] } {
    const workspace = this.db
      .prepare('SELECT id, name, created_at AS createdAt FROM workspaces WHERE id = ?')
      .get(this.workspaceId) as Row;
    const members = this.db
      .prepare(
        'SELECT id, name, role, email, created_at AS createdAt FROM members WHERE workspace_id = ? ORDER BY created_at',
      )
      .all(this.workspaceId) as Row[];
    return { id: String(workspace.id), name: String(workspace.name), members };
  }

  defaultOwner(): AuthMember {
    const member = this.db
      .prepare(
        `SELECT id, workspace_id AS workspaceId, name, role, email
        FROM members WHERE workspace_id = ? AND role = 'owner' ORDER BY created_at LIMIT 1`,
      )
      .get(this.workspaceId) as Row;
    return this.toMember(member);
  }

  authenticate(email: string, password: string): AuthMember | null {
    const row = this.db
      .prepare(
        `SELECT id, workspace_id AS workspaceId, name, role, email,
        password_salt AS passwordSalt, password_hash AS passwordHash
        FROM members WHERE email = ?`,
      )
      .get(normalizeEmail(email)) as Row | undefined;
    if (!row || typeof row.passwordSalt !== 'string' || typeof row.passwordHash !== 'string') {
      const fallback = hashPassword('invalid-credential', 'sopscape-invalid-user');
      verifyPassword(password, fallback.salt, fallback.hash);
      return null;
    }
    if (!verifyPassword(password, row.passwordSalt, row.passwordHash)) {
      return null;
    }
    return this.toMember(row);
  }

  createSession(memberId: string, ttlMs = 8 * 60 * 60 * 1000): string {
    const token = createOpaqueToken();
    const createdAt = now();
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    this.db
      .prepare(
        'INSERT INTO sessions (token_hash, member_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
      )
      .run(hashOpaqueToken(token, this.tokenSecret), memberId, expiresAt, createdAt);
    return token;
  }

  memberForSession(token: string): AuthMember | null {
    const row = this.db
      .prepare(
        `SELECT members.id, members.workspace_id AS workspaceId, members.name,
        members.role, members.email FROM sessions
        JOIN members ON members.id = sessions.member_id
        WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
      )
      .get(hashOpaqueToken(token, this.tokenSecret), now()) as Row | undefined;
    return row ? this.toMember(row) : null;
  }

  deleteSession(token: string): void {
    this.db
      .prepare('DELETE FROM sessions WHERE token_hash = ?')
      .run(hashOpaqueToken(token, this.tokenSecret));
  }

  createInvitation(
    email: string,
    role: Exclude<MemberRole, 'owner'>,
    invitedBy: string,
  ): { id: string; email: string; role: string; token: string; expiresAt: string } {
    const id = crypto.randomUUID();
    const token = createOpaqueToken();
    const normalizedEmail = normalizeEmail(email);
    const createdAt = now();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    this.db
      .prepare(
        `INSERT INTO invitations
        (id, workspace_id, email, role, token_hash, invited_by, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        this.workspaceId,
        normalizedEmail,
        role,
        hashOpaqueToken(token, this.tokenSecret),
        invitedBy,
        expiresAt,
        createdAt,
      );
    this.audit('invitation.created', id, { email: normalizedEmail, role }, invitedBy);
    return { id, email: normalizedEmail, role, token, expiresAt };
  }

  acceptInvitation(
    token: string,
    name: string,
    password: string,
  ):
    | { ok: true; member: AuthMember; sessionToken: string }
    | { ok: false; reason: 'not-found' | 'used' | 'expired' | 'already-member' } {
    const tokenHash = hashOpaqueToken(token, this.tokenSecret);
    const invitation = this.db
      .prepare('SELECT * FROM invitations WHERE token_hash = ?')
      .get(tokenHash) as Row | undefined;
    if (!invitation) return { ok: false, reason: 'not-found' };
    if (invitation.accepted_at) return { ok: false, reason: 'used' };
    if (String(invitation.expires_at) <= now()) return { ok: false, reason: 'expired' };
    const existing = this.db
      .prepare('SELECT id FROM members WHERE email = ?')
      .get(String(invitation.email));
    if (existing) return { ok: false, reason: 'already-member' };

    const memberId = crypto.randomUUID();
    const credential = hashPassword(password);
    const acceptedAt = now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const claimed = this.db
        .prepare(
          `UPDATE invitations SET accepted_at = ?
          WHERE token_hash = ? AND accepted_at IS NULL AND expires_at > ?`,
        )
        .run(acceptedAt, tokenHash, acceptedAt);
      if (Number(claimed.changes) !== 1) {
        this.db.exec('ROLLBACK');
        return { ok: false, reason: 'used' };
      }
      this.db
        .prepare(
          `INSERT INTO members
          (id, workspace_id, name, role, email, password_salt, password_hash, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          memberId,
          this.workspaceId,
          name,
          String(invitation.role),
          String(invitation.email),
          credential.salt,
          credential.hash,
          acceptedAt,
        );
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    const member: AuthMember = {
      id: memberId,
      workspaceId: this.workspaceId,
      name,
      role: invitation.role as MemberRole,
      email: String(invitation.email),
    };
    this.audit('invitation.accepted', String(invitation.id), { memberId }, memberId);
    return { ok: true, member, sessionToken: this.createSession(memberId) };
  }

  listInvitations(): Row[] {
    return this.db
      .prepare(
        `SELECT id, email, role,
        CASE
          WHEN accepted_at IS NOT NULL THEN 'accepted'
          WHEN expires_at <= ? THEN 'expired'
          ELSE 'pending'
        END AS status,
        expires_at AS expiresAt, accepted_at AS acceptedAt, created_at AS createdAt
        FROM invitations WHERE workspace_id = ? ORDER BY created_at DESC`,
      )
      .all(now(), this.workspaceId) as Row[];
  }

  deleteInvitation(invitationId: string, memberId: string): boolean {
    const invitation = this.db
      .prepare('SELECT * FROM invitations WHERE id = ?')
      .get(invitationId) as Row | undefined;
    if (!invitation) return false;
    if (String(invitation.invited_by) !== memberId) return false;
    if (invitation.accepted_at) return false; // 已接受的邀请不能删除

    this.db.prepare('DELETE FROM invitations WHERE id = ?').run(invitationId);
    this.audit('invitation.deleted', invitationId, {}, memberId);
    return true;
  }

  listMembers(): Row[] {
    return this.db
      .prepare(
        `SELECT id, workspace_id AS workspaceId, name, role, email, created_at AS createdAt
        FROM members WHERE workspace_id = ? ORDER BY created_at`,
      )
      .all(this.workspaceId) as Row[];
  }

  updateMemberRole(memberId: string, newRole: MemberRole, actorId: string): boolean {
    const actor = this.db.prepare('SELECT role FROM members WHERE id = ?').get(actorId) as
      Row | undefined;
    if (!actor || actor.role !== 'owner') return false;

    const target = this.db.prepare('SELECT role FROM members WHERE id = ?').get(memberId) as
      Row | undefined;
    if (!target) return false;

    // 检查是否是最后一个 owner
    if (target.role === 'owner' && newRole !== 'owner') {
      const ownerCount = this.db
        .prepare("SELECT COUNT(*) AS count FROM members WHERE workspace_id = ? AND role = 'owner'")
        .get(this.workspaceId) as Row;
      if (Number(ownerCount.count) <= 1) return false;
    }

    this.db.prepare('UPDATE members SET role = ? WHERE id = ?').run(newRole, memberId);
    this.audit('member.role_updated', memberId, { newRole }, actorId);
    return true;
  }

  removeMember(memberId: string, actorId: string): boolean {
    const actor = this.db.prepare('SELECT role FROM members WHERE id = ?').get(actorId) as
      Row | undefined;
    if (!actor || actor.role !== 'owner') return false;

    if (memberId === actorId) return false; // 不能删除自己

    const target = this.db.prepare('SELECT role FROM members WHERE id = ?').get(memberId) as
      Row | undefined;
    if (!target) return false;

    // 检查是否是最后一个 owner
    if (target.role === 'owner') {
      const ownerCount = this.db
        .prepare("SELECT COUNT(*) AS count FROM members WHERE workspace_id = ? AND role = 'owner'")
        .get(this.workspaceId) as Row;
      if (Number(ownerCount.count) <= 1) return false;
    }

    this.db.prepare('DELETE FROM members WHERE id = ?').run(memberId);
    this.audit('member.removed', memberId, {}, actorId);
    return true;
  }

  createSop(input: SopInput, council: CouncilResult, owner = 'Demo Builder'): SopRecord {
    const id = crypto.randomUUID();
    const createdAt = now();
    const passport = this.makePassport(id, 1, council, input.content);
    this.db
      .prepare(
        `INSERT INTO sops
        (id, workspace_id, title, locale, owner, status, latest_version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(
        id,
        this.workspaceId,
        input.title,
        input.locale ?? 'zh-CN',
        owner,
        passport.verdict,
        createdAt,
        createdAt,
      );
    this.insertVersion(id, 1, input.content, council, passport, createdAt);
    this.audit('sop.created', id, { title: input.title, verdict: passport.verdict });
    return {
      id,
      workspaceId: this.workspaceId,
      title: input.title,
      locale: input.locale ?? 'zh-CN',
      owner,
      status: passport.verdict,
      latestVersion: 1,
      createdAt,
      updatedAt: createdAt,
      passport,
    };
  }

  addVersion(sopId: string, content: string, council: CouncilResult): SopVersion | null {
    const sop = this.db.prepare('SELECT latest_version FROM sops WHERE id = ?').get(sopId) as
      Row | undefined;
    if (!sop) return null;
    const version = Number(sop.latest_version) + 1;
    const createdAt = now();
    const passport = this.makePassport(sopId, version, council, content);
    const result = this.insertVersion(sopId, version, content, council, passport, createdAt);
    this.db
      .prepare('UPDATE sops SET status = ?, latest_version = ?, updated_at = ? WHERE id = ?')
      .run(passport.verdict, version, createdAt, sopId);
    this.audit('sop.version.created', sopId, { version, verdict: passport.verdict });
    return result;
  }

  listSops(): SopRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM sops WHERE workspace_id = ? ORDER BY updated_at DESC')
      .all(this.workspaceId) as Row[];
    return rows.map((row) => this.toSop(row));
  }

  getSop(sopId: string): SopRecord | null {
    const row = this.db.prepare('SELECT * FROM sops WHERE id = ?').get(sopId) as Row | undefined;
    return row ? this.toSop(row) : null;
  }

  getVersion(sopId: string, version: number): SopVersion | null {
    const row = this.db
      .prepare('SELECT * FROM sop_versions WHERE sop_id = ? AND version = ?')
      .get(sopId, version) as Row | undefined;
    return row ? this.toVersion(row) : null;
  }

  listVersions(sopId: string): SopVersion[] {
    return (
      this.db
        .prepare('SELECT * FROM sop_versions WHERE sop_id = ? ORDER BY version DESC')
        .all(sopId) as Row[]
    ).map((row) => this.toVersion(row));
  }

  saveRehearsal(
    rehearsalId: string,
    council: CouncilResult,
    passport: SopPassport,
    options: { sopId?: string; version?: number; model?: string; durationMs?: number } = {},
  ): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO rehearsals
        (id, sop_id, version, council_json, passport_json, score, model, tokens, duration_ms, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?, ?)`,
      )
      .run(
        rehearsalId,
        options.sopId ?? null,
        options.version ?? passport.version,
        JSON.stringify(council),
        JSON.stringify(passport),
        options.model ?? process.env.MODEL_NAME ?? 'deterministic-demo',
        options.durationMs ?? 0,
        now(),
      );
    this.audit('rehearsal.completed', rehearsalId, { verdict: passport.verdict });
  }

  getRehearsal(rehearsalId: string): { council: CouncilResult; passport: SopPassport } | null {
    const row = this.db.prepare('SELECT * FROM rehearsals WHERE id = ?').get(rehearsalId) as
      Row | undefined;
    if (!row) return null;
    return {
      council: JSON.parse(String(row.council_json)) as CouncilResult,
      passport: JSON.parse(String(row.passport_json)) as SopPassport,
    };
  }

  recordDecision(rehearsalId: string, evaluation: DecisionEvaluation): void {
    this.db
      .prepare(
        `INSERT INTO decisions
        (id, rehearsal_id, node_id, choice_id, score_delta, risk_level, consequence, coaching, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        crypto.randomUUID(),
        rehearsalId,
        evaluation.nodeId,
        evaluation.choiceId,
        evaluation.scoreDelta,
        evaluation.riskLevel,
        evaluation.consequence,
        evaluation.coaching,
        now(),
      );
    this.db
      .prepare('UPDATE rehearsals SET score = score + ? WHERE id = ?')
      .run(evaluation.scoreDelta, rehearsalId);
    this.audit('decision.recorded', rehearsalId, evaluation);
  }

  auditEvents(limit = 100): Row[] {
    return this.db
      .prepare(
        `SELECT id, actor, action, target_id AS targetId, detail_json AS detail,
        created_at AS createdAt FROM audit_events WHERE workspace_id = ?
        ORDER BY created_at DESC LIMIT ?`,
      )
      .all(this.workspaceId, limit) as Row[];
  }

  createTraining(sopId: string, assignee: string): Row | null {
    if (!this.getSop(sopId)) return null;
    const id = crypto.randomUUID();
    const createdAt = now();
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    this.db
      .prepare(
        `INSERT INTO training_assignments
        (id, sop_id, assignee, status, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, sopId, assignee, 'assigned', dueAt, createdAt);
    this.audit('training.assigned', sopId, { assignmentId: id, assignee, dueAt });
    return { id, sopId, assignee, status: 'assigned', dueAt, createdAt };
  }

  listTraining(): Row[] {
    return (
      this.db
        .prepare(
          `SELECT id, sop_id AS sopId, assignee, status, score, report_json AS report,
          due_at AS dueAt, completed_at AS completedAt, created_at AS createdAt
          FROM training_assignments ORDER BY created_at DESC`,
        )
        .all() as Row[]
    ).map((row) => ({
      ...row,
      report: row.report ? JSON.parse(String(row.report)) : null,
    }));
  }

  completeTraining(
    assignmentId: string,
    score: number,
    decisions: Array<{ nodeId: string; choiceId: string; scoreDelta: number }>,
  ): Row | null {
    const assignment = this.db
      .prepare('SELECT * FROM training_assignments WHERE id = ?')
      .get(assignmentId) as Row | undefined;
    if (!assignment) return null;
    const completedAt = now();
    const unsafe = decisions.filter((decision) => decision.scoreDelta < 0);
    const report = {
      grade: score >= 70 && unsafe.length === 0 ? 'passed' : 'needs-review',
      score,
      completedNodes: decisions.length,
      unsafeChoices: unsafe.map((decision) => decision.choiceId),
      summary:
        score >= 70 && unsafe.length === 0
          ? '已完成核验、避开恶意链接并上报证据。'
          : '仍存在高风险选择，需要重新完成对应训练节点。',
    };
    this.db
      .prepare(
        `UPDATE training_assignments SET status = 'completed', score = ?,
        report_json = ?, completed_at = ? WHERE id = ?`,
      )
      .run(score, JSON.stringify(report), completedAt, assignmentId);
    this.audit('training.completed', String(assignment.sop_id), {
      assignmentId,
      score,
      grade: report.grade,
    });
    return {
      id: assignmentId,
      sopId: assignment.sop_id,
      assignee: assignment.assignee,
      status: 'completed',
      score,
      completedAt,
      report,
    };
  }

  trainingReport(assignmentId: string): Row | null {
    const row = this.db
      .prepare(
        `SELECT id, sop_id AS sopId, assignee, status, score, report_json AS report,
        due_at AS dueAt, completed_at AS completedAt, created_at AS createdAt
        FROM training_assignments WHERE id = ?`,
      )
      .get(assignmentId) as Row | undefined;
    if (!row) return null;
    return {
      ...row,
      report: row.report ? JSON.parse(String(row.report)) : null,
    };
  }

  rehearsalMetrics(): Row {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS runs, COALESCE(SUM(tokens), 0) AS tokens,
        COALESCE(SUM(duration_ms), 0) AS durationMs,
        COALESCE(AVG(duration_ms), 0) AS averageDurationMs,
        COALESCE(MAX(model), 'deterministic-demo') AS model FROM rehearsals`,
      )
      .get() as Row;
    return {
      runs: Number(row.runs),
      tokens: Number(row.tokens),
      durationMs: Number(row.durationMs),
      averageDurationMs: Math.round(Number(row.averageDurationMs)),
      model: String(row.model),
      estimatedCostUsd: Number(row.tokens) * 0.000002,
    };
  }

  replay(rehearsalId: string): Row[] {
    return this.db
      .prepare(
        `SELECT node_id AS nodeId, choice_id AS choiceId, score_delta AS scoreDelta,
        risk_level AS riskLevel, consequence, coaching, created_at AS createdAt
        FROM decisions WHERE rehearsal_id = ? ORDER BY created_at`,
      )
      .all(rehearsalId) as Row[];
  }

  createShare(
    rehearsalId: string,
    createdBy: string,
    expiresAt: string | null = null,
    maxViews = -1,
  ): { id: string; shareToken: string; shareUrl: string } | null {
    const rehearsal = this.db.prepare('SELECT id FROM rehearsals WHERE id = ?').get(rehearsalId) as
      Row | undefined;
    if (!rehearsal) return null;

    const id = crypto.randomUUID();
    const shareToken = createOpaqueToken();
    const createdAt = now();
    const tokenHash = hashOpaqueToken(shareToken, this.tokenSecret);

    this.db
      .prepare(
        `INSERT INTO shares
        (id, workspace_id, rehearsal_id, token_hash, created_by, expires_at, view_count, max_views, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(id, this.workspaceId, rehearsalId, tokenHash, createdBy, expiresAt, maxViews, createdAt);

    const shareUrl = `/r/${shareToken}`;
    this.audit('share.created', id, { rehearsalId, expiresAt, maxViews }, createdBy);
    return { id, shareToken, shareUrl };
  }

  getShareByToken(token: string): Row | null {
    const tokenHash = hashOpaqueToken(token, this.tokenSecret);
    const share = this.db
      .prepare(
        `SELECT shares.*, rehearsals.council_json, rehearsals.passport_json, rehearsals.sop_id,
        rehearsals.created_at AS rehearsal_created_at FROM shares
        JOIN rehearsals ON rehearsals.id = shares.rehearsal_id
        WHERE shares.token_hash = ? AND (shares.expires_at IS NULL OR shares.expires_at > ?)
        AND (shares.max_views = -1 OR shares.view_count < shares.max_views)`,
      )
      .get(tokenHash, now()) as Row | undefined;
    return share ?? null;
  }

  incrementShareView(shareId: string): void {
    this.db.prepare('UPDATE shares SET view_count = view_count + 1 WHERE id = ?').run(shareId);
  }

  listShares(rehearsalId: string): Row[] {
    return (
      this.db
        .prepare(
          `SELECT id, rehearsal_id AS rehearsalId, created_by AS createdBy,
          expires_at AS expiresAt, view_count AS viewCount, max_views AS maxViews,
          created_at AS createdAt FROM shares WHERE rehearsal_id = ? ORDER BY created_at DESC`,
        )
        .all(rehearsalId) as Row[]
    ).map((row) => ({
      ...row,
      // 部分隐藏 token（前8位）
      token: '••••••••',
    }));
  }

  deleteShare(shareId: string, memberId: string): boolean {
    const share = this.db.prepare('SELECT * FROM shares WHERE id = ?').get(shareId) as
      Row | undefined;
    if (!share) return false;
    if (String(share.created_by) !== memberId) return false;

    this.db.prepare('DELETE FROM shares WHERE id = ?').run(shareId);
    this.audit('share.deleted', shareId, { rehearsalId: share.rehearsal_id }, memberId);
    return true;
  }

  getSharedRehearsalData(token: string): Row | null {
    const tokenHash = hashOpaqueToken(token, this.tokenSecret);
    const share = this.db
      .prepare(
        `SELECT shares.id AS share_id, shares.rehearsal_id, shares.created_at,
        rehearsals.council_json, rehearsals.passport_json, rehearsals.sop_id
        FROM shares
        JOIN rehearsals ON rehearsals.id = shares.rehearsal_id
        WHERE shares.token_hash = ? AND (shares.expires_at IS NULL OR shares.expires_at > ?)
        AND (shares.max_views = -1 OR shares.view_count < shares.max_views)`,
      )
      .get(tokenHash, now()) as Row | undefined;
    if (!share) return null;

    const decisions = this.db
      .prepare(
        `SELECT node_id AS nodeId, choice_id AS choiceId, score_delta AS scoreDelta,
        risk_level AS riskLevel, consequence, coaching, decisions.created_at AS createdAt
        FROM decisions WHERE rehearsal_id = ? ORDER BY decisions.created_at`,
      )
      .all(String(share.rehearsal_id)) as Row[];

    return {
      shareId: String(share.share_id),
      rehearsalId: String(share.rehearsal_id),
      sopId: share.sop_id ? String(share.sop_id) : null,
      council: JSON.parse(String(share.council_json)),
      passport: JSON.parse(String(share.passport_json)),
      decisions,
      createdAt: String(share.created_at),
    };
  }

  private seed(ownerPassword?: string): void {
    const createdAt = now();
    this.db
      .prepare('INSERT OR IGNORE INTO workspaces (id, name, created_at) VALUES (?, ?, ?)')
      .run(this.workspaceId, 'SOPscape Hackathon Workspace', createdAt);
    this.db
      .prepare(
        `INSERT OR IGNORE INTO members
        (id, workspace_id, name, role, email, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        'member-demo',
        this.workspaceId,
        'Demo Builder',
        'owner',
        'builder@sopscape.local',
        createdAt,
      );
    if (ownerPassword) {
      const credential = hashPassword(ownerPassword);
      this.db
        .prepare(
          `UPDATE members SET password_salt = ?, password_hash = ?
          WHERE id = 'member-demo'`,
        )
        .run(credential.salt, credential.hash);
    }
  }

  private makePassport(
    sopId: string,
    version: number,
    council: CouncilResult,
    content: string,
  ): SopPassport {
    const assessment = computeReadiness(council, content);
    return {
      id: crypto.randomUUID(),
      sopId,
      version,
      ...assessment,
      generatedAt: now(),
    };
  }

  private insertVersion(
    sopId: string,
    version: number,
    content: string,
    council: CouncilResult,
    passport: SopPassport,
    createdAt: string,
  ): SopVersion {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO sop_versions
        (id, sop_id, version, content, council_json, passport_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        sopId,
        version,
        content,
        JSON.stringify(council),
        JSON.stringify(passport),
        createdAt,
      );
    return { id, sopId, version, content, council, passport, createdAt };
  }

  private toVersion(row: Row): SopVersion {
    return {
      id: String(row.id),
      sopId: String(row.sop_id),
      version: Number(row.version),
      content: String(row.content),
      council: JSON.parse(String(row.council_json)) as CouncilResult,
      passport: JSON.parse(String(row.passport_json)) as SopPassport,
      createdAt: String(row.created_at),
    };
  }

  private toSop(row: Row): SopRecord {
    const version = this.getVersion(String(row.id), Number(row.latest_version));
    if (!version) throw new Error('SOP_VERSION_NOT_FOUND');
    return {
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      title: String(row.title),
      locale: String(row.locale),
      owner: String(row.owner),
      status: row.status as SopRecord['status'],
      latestVersion: Number(row.latest_version),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      passport: version.passport,
    };
  }

  private toMember(row: Row): AuthMember {
    return {
      id: String(row.id),
      workspaceId: String(row.workspaceId),
      name: String(row.name),
      role: row.role as MemberRole,
      email: String(row.email),
    };
  }

  private audit(action: string, targetId: string, detail: unknown, actor = 'Demo Builder'): void {
    this.db
      .prepare(
        `INSERT INTO audit_events
        (id, workspace_id, actor, action, target_id, detail_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        crypto.randomUUID(),
        this.workspaceId,
        actor,
        action,
        targetId,
        JSON.stringify(detail),
        now(),
      );
  }
}
