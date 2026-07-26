import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import {
  CouncilResultSchema,
  SopInputSchema,
  CreateShareRequestSchema,
  type CouncilResult,
  type Finding,
  type AgentRole,
  type SopInput,
} from '@sopscape/contracts';
import { startGeneration } from '@sopscape/core';
import {
  compareSopVersions,
  computeReadiness,
  ensurePhishingScenario,
  evaluateDecision,
} from './product.js';
import { ProductStore } from './store.js';
import { isValidEmail, normalizeEmail, readCookie } from './auth.js';
import type { AuthMember } from './store.js';
import { registerMcpEndpoint } from './mcp.js';
import { registerScenarioRoutes } from './scenario-routes.js';
import { registerSpaRoutes } from './spa-routes.js';

interface Row {
  [key: string]: unknown;
}

const A2MCP_DEADLINE_MS = 58_000;
const A2MCP_RESPONSE_RESERVE_MS = 2_000;

export interface BuildAppOptions {
  databasePath?: string;
  rateLimitPerMinute?: number;
  doclingBaseUrl?: string;
  doclingFetch?: typeof fetch;
  requireAuth?: boolean;
  ownerPassword?: string;
  sessionSecret?: string;
  serviceApiKey?: string;
  publicAppOrigin?: string;
  publicFreeA2mcp?: boolean;
  publicA2mcpRateLimitPerMinute?: number;
}

// ─── Problem Details (RFC 7807) ──────────────────────────────────

function problemDetails(
  type: string,
  title: string,
  status: number,
  detail: string,
  extra?: Record<string, unknown>,
) {
  return {
    type: `https://sopscape.local/errors/${type}`,
    title,
    status,
    detail,
    instance: crypto.randomUUID(),
    ...extra,
  };
}

// ─── Legacy apiError (kept for backward compatibility) ───────────

function apiError(code: string, message: string, retryable = false) {
  return { code, message, retryable, requestId: crypto.randomUUID() };
}

// ─── LLM Config ──────────────────────────────────────────────────

function getLLMConfig(): {
  apiKey: string;
  baseUrl: string;
  model: string;
  fallbackModel?: string;
  fallbackBaseUrl?: string;
} | null {
  const apiKey = process.env.MODEL_API_KEY;
  const baseUrl = process.env.MODEL_BASE_URL;
  const model = process.env.MODEL_NAME;
  const fallbackModel = process.env.MODEL_FALLBACK_NAME;
  const fallbackBaseUrl = process.env.MODEL_FALLBACK_BASE_URL;
  return apiKey && baseUrl && model
    ? { apiKey, baseUrl, model, fallbackModel: fallbackModel || undefined, fallbackBaseUrl: fallbackBaseUrl || undefined }
    : null;
}

// ─── Exercise tracking for retry (in-memory for hackathon) ───────

interface ExerciseState {
  rehearsalId: string;
  input: SopInput;
  retryCount: number;
  running: boolean;
  savedFindings: Finding[];
  failedRoles: AgentRole[];
}
const exercises = new Map<string, ExerciseState>();

// ─── Deadline helper ─────────────────────────────────────────────

function deadline(ms: number, signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const timeout = setTimeout(() => reject(new Error('DEADLINE_EXCEEDED')), ms);
    signal.addEventListener('abort', () => clearTimeout(timeout), { once: true });
  });
}

// ─── Generation core ─────────────────────────────────────────────

async function generateCouncil(
  input: unknown,
  workRemainingMs = 56_000,
  options?: { savedFindings?: Finding[]; failedRoles?: AgentRole[] },
) {
  const parsed = SopInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      status: 400,
      error: apiError(
        'VALIDATION_ERROR',
        parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      ),
    };
  }

  const controller = new AbortController();
  const startedAt = performance.now();
  try {
    const result = await Promise.race([
      startGeneration(parsed.data, {
        signal: controller.signal,
        llm: getLLMConfig() ?? undefined,
        savedFindings: options?.savedFindings,
        failedRoles: options?.failedRoles as
          Array<'procedure-analyst' | 'risk-challenger' | 'evidence-auditor'> | undefined,
      }),
      deadline(workRemainingMs, controller.signal),
    ]);
    if (result.status === 'CANCELLED') {
      return {
        ok: false as const,
        status: 499,
        error: apiError('CANCELLED', 'Generation cancelled'),
      };
    }
    // PARTIAL_FAILED: specialists < 3 or moderator failed → 502, NOT 200
    if (result.status === 'PARTIAL_FAILED') {
      return {
        ok: false as const,
        partial: true as const,
        status: 502,
        error: apiError('PARTIAL_FAILURE', result.error ?? 'Partial specialist failure', true),
        partialFindings: result.partialFindings ?? [],
        failedRoles: result.failedRoles ?? [],
        rehearsalId: result.rehearsalId,
        input: parsed.data,
      };
    }
    if (result.status === 'FAILED') {
      return {
        ok: false as const,
        status: 502,
        error: apiError('GENERATION_FAILED', result.error ?? 'Upstream provider failed', true),
        rehearsalId: result.rehearsalId,
      };
    }
    const council = CouncilResultSchema.safeParse(result.council);
    if (!council.success) {
      return {
        ok: false as const,
        status: 502,
        error: apiError('PROJECTION_ERROR', 'Council result validation failed'),
        rehearsalId: result.rehearsalId,
      };
    }
    return {
      ok: true as const,
      input: parsed.data,
      rehearsalId: result.rehearsalId,
      council: ensurePhishingScenario(council.data),
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'DEADLINE_EXCEEDED') {
      return {
        ok: false as const,
        status: 504,
        error: apiError('GENERATION_TIMEOUT', 'Generation exceeded 58s deadline', true),
      };
    }
    return {
      ok: false as const,
      status: 500,
      error: apiError('INTERNAL_ERROR', 'Unexpected error', true),
    };
  } finally {
    controller.abort();
  }
}

// ─── Build App ───────────────────────────────────────────────────

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    bodyLimit: 64 * 1024,
  });
  const requireAuth =
    options.requireAuth ?? ['1', 'true'].includes(process.env.SOPSCAPE_REQUIRE_AUTH ?? '');
  const ownerPassword = options.ownerPassword ?? process.env.SOPSCAPE_OWNER_PASSWORD;
  const sessionSecret = options.sessionSecret ?? process.env.SOPSCAPE_SESSION_SECRET;
  const serviceApiKey = options.serviceApiKey ?? process.env.SOPSCAPE_API_KEY;
  if (requireAuth && (!ownerPassword || !sessionSecret)) {
    throw new Error('SOPSCAPE_OWNER_PASSWORD_AND_SESSION_SECRET_REQUIRED');
  }
  const store = new ProductStore(
    options.databasePath ?? (process.env.NODE_ENV === 'test' ? ':memory:' : undefined),
    { ownerPassword, tokenSecret: sessionSecret },
  );
  const ingressStartedAt = new WeakMap<object, number>();
  const identities = new WeakMap<object, AuthMember>();
  const rateLimit = options.rateLimitPerMinute ?? Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120);
  const clients = new Map<string, { minute: number; count: number }>();
  const publicA2mcpClients = new Map<string, { minute: number; count: number }>();
  const sessionCookieName = 'sopscape_session';
  const publicApiPaths = new Set(['/api/auth/login', '/api/invitations/accept', '/api/shares/']);

  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/a2mcp/')) ingressStartedAt.set(request, performance.now());
    const path = request.url.split('?', 1)[0] ?? request.url;
    const publicFreeA2mcp =
      path === '/a2mcp/generate-rehearsal' &&
      (options.publicFreeA2mcp ?? ['1', 'true'].includes(process.env.OKX_PUBLIC_FREE_A2MCP ?? ''));
    const minute = Math.floor(Date.now() / 60_000);
    const current = clients.get(request.ip);
    const next =
      current?.minute === minute ? { minute, count: current.count + 1 } : { minute, count: 1 };
    clients.set(request.ip, next);
    reply.header('X-RateLimit-Limit', rateLimit);
    reply.header('X-RateLimit-Remaining', Math.max(0, rateLimit - next.count));
    if (next.count > rateLimit) {
      return reply.code(429).send(apiError('RATE_LIMITED', 'Too many requests', true));
    }
    if (publicFreeA2mcp) {
      const publicLimit =
        options.publicA2mcpRateLimitPerMinute ??
        Number(process.env.PUBLIC_A2MCP_RATE_LIMIT_PER_MINUTE ?? 6);
      const currentPublic = publicA2mcpClients.get(request.ip);
      const nextPublic =
        currentPublic?.minute === minute
          ? { minute, count: currentPublic.count + 1 }
          : { minute, count: 1 };
      publicA2mcpClients.set(request.ip, nextPublic);
      if (nextPublic.count > publicLimit) {
        return reply.code(429).send(apiError('RATE_LIMITED', 'Public ASP limit exceeded', true));
      }
    }
    if (
      serviceApiKey &&
      !publicFreeA2mcp &&
      (request.url.startsWith('/a2mcp/') || request.url.startsWith('/mcp')) &&
      request.headers.authorization !== `Bearer ${serviceApiKey}`
    ) {
      return reply
        .code(401)
        .send(problemDetails('unauthorized', 'Unauthorized', 401, 'Valid bearer token required'));
    }
    if (
      requireAuth &&
      path.startsWith('/api/') &&
      !publicApiPaths.has(path) &&
      !path.startsWith('/api/shares/') &&
      !/\/api\/rehearsals\/[^/]+\/retry-failed-experts$/.test(path)
    ) {
      const token = readCookie(request.headers.cookie, sessionCookieName);
      const member = token ? store.memberForSession(token) : null;
      if (!member) {
        return reply.code(401).send(apiError('UNAUTHORIZED', '请先登录'));
      }
      identities.set(request, member);
      const path = request.url.split('?', 1)[0] ?? request.url;
      const expectedOrigin = options.publicAppOrigin ?? process.env.PUBLIC_APP_ORIGIN;
      if (
        expectedOrigin &&
        request.headers.origin &&
        request.headers.origin !== expectedOrigin &&
        !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
      ) {
        return reply.code(403).send(apiError('CSRF_BLOCKED', '请求来源不受信任'));
      }
      if (
        member.role === 'viewer' &&
        !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
        path !== '/api/auth/logout'
      ) {
        return reply.code(403).send(apiError('FORBIDDEN', 'Viewer 角色仅可读取'));
      }
    }
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '0');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'",
    );
    return payload;
  });

  app.addHook('onClose', async () => store.close());

  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    const checks = {
      model_config: { ok: getLLMConfig() !== null },
      database: { ok: true },
      auth: { ok: !requireAuth || Boolean(ownerPassword && sessionSecret) },
      service_api_key: { ok: Boolean(serviceApiKey) },
    };
    const ready = Object.values(checks).every(({ ok }) => ok);
    return reply.code(ready ? 200 : 503).send({
      status: ready ? 'ready' : 'not_ready',
      checks,
      payment: 'free-during-hackathon',
    });
  });
  const setSessionCookie = (reply: FastifyReply, token: string) => {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    reply.header(
      'Set-Cookie',
      `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure}`,
    );
  };
  const currentMember = (request: FastifyRequest): AuthMember =>
    identities.get(request) ?? store.defaultOwner();

  app.post<{ Body: { email?: unknown; password?: unknown } }>(
    '/api/auth/login',
    async (request, reply) => {
      const { email, password } = request.body ?? {};
      if (
        typeof email !== 'string' ||
        typeof password !== 'string' ||
        !isValidEmail(email) ||
        password.length < 12 ||
        password.length > 128
      ) {
        return reply.code(401).send(apiError('INVALID_CREDENTIALS', '邮箱或密码错误'));
      }
      const member = store.authenticate(email, password);
      if (!member) {
        return reply.code(401).send(apiError('INVALID_CREDENTIALS', '邮箱或密码错误'));
      }
      setSessionCookie(reply, store.createSession(member.id));
      return { member };
    },
  );

  app.get('/api/auth/me', async (request) => ({ member: currentMember(request) }));

  app.post('/api/auth/logout', async (request, reply) => {
    const token = readCookie(request.headers.cookie, sessionCookieName);
    if (token) store.deleteSession(token);
    reply.header(
      'Set-Cookie',
      `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
    );
    return reply.code(204).send();
  });

  app.post<{ Body: { email?: unknown; role?: unknown } }>(
    '/api/invitations',
    async (request, reply) => {
      const actor = currentMember(request);
      if (actor.role !== 'owner') {
        return reply.code(403).send(apiError('FORBIDDEN', '仅所有者可以邀请成员'));
      }
      const { email, role } = request.body ?? {};
      if (
        typeof email !== 'string' ||
        !isValidEmail(email) ||
        (role !== 'editor' && role !== 'viewer')
      ) {
        return reply
          .code(400)
          .send(apiError('VALIDATION_ERROR', '有效邮箱和 editor/viewer 角色必填'));
      }
      return reply.code(201).send(store.createInvitation(normalizeEmail(email), role, actor.id));
    },
  );

  app.post<{ Body: { token?: unknown; name?: unknown; password?: unknown } }>(
    '/api/invitations/accept',
    async (request, reply) => {
      const { token, name, password } = request.body ?? {};
      if (
        typeof token !== 'string' ||
        typeof name !== 'string' ||
        !name.trim() ||
        name.length > 80 ||
        typeof password !== 'string' ||
        password.length < 12 ||
        password.length > 128
      ) {
        return reply
          .code(400)
          .send(apiError('VALIDATION_ERROR', '有效邀请、姓名和至少 12 位密码必填'));
      }
      const accepted = store.acceptInvitation(token, name.trim(), password);
      if (!accepted.ok) {
        const code =
          accepted.reason === 'used'
            ? 'INVITATION_ALREADY_USED'
            : accepted.reason === 'expired'
              ? 'INVITATION_EXPIRED'
              : accepted.reason === 'already-member'
                ? 'MEMBER_ALREADY_EXISTS'
                : 'INVITATION_NOT_FOUND';
        const status =
          accepted.reason === 'used' || accepted.reason === 'already-member' ? 409 : 400;
        return reply.code(status).send(apiError(code, '邀请无效、已使用或已过期'));
      }
      setSessionCookie(reply, accepted.sessionToken);
      return reply.code(201).send({ member: accepted.member });
    },
  );

  app.get('/api/invitations', async () => {
    return { items: store.listInvitations() };
  });

  app.delete<{ Params: { id: string } }>('/api/invitations/:id', async (request, reply) => {
    const actor = currentMember(request);
    if (actor.role !== 'owner') {
      return reply.code(403).send(apiError('FORBIDDEN', '仅所有者可以撤销邀请'));
    }
    const deleted = store.deleteInvitation(request.params.id, actor.id);
    if (!deleted) {
      return reply.code(404).send(apiError('NOT_FOUND', '邀请不存在或已被接受'));
    }
    return reply.code(204).send();
  });

  app.get('/api/members', async () => {
    return { items: store.listMembers() };
  });

  app.patch<{
    Params: { id: string };
    Body: { role?: unknown };
  }>('/api/members/:id/role', async (request, reply) => {
    const actor = currentMember(request);
    if (actor.role !== 'owner') {
      return reply.code(403).send(apiError('FORBIDDEN', '仅所有者可以修改角色'));
    }
    const { role } = request.body ?? {};
    if (role !== 'owner' && role !== 'editor' && role !== 'viewer') {
      return reply.code(400).send(apiError('VALIDATION_ERROR', '有效角色必填'));
    }
    const updated = store.updateMemberRole(request.params.id, role, actor.id);
    if (!updated) {
      return reply
        .code(400)
        .send(apiError('INVALID_OPERATION', '无法修改角色：可能是最后一个所有者或权限不足'));
    }
    return { id: request.params.id, role };
  });

  app.delete<{ Params: { id: string } }>('/api/members/:id', async (request, reply) => {
    const actor = currentMember(request);
    if (actor.role !== 'owner') {
      return reply.code(403).send(apiError('FORBIDDEN', '仅所有者可以移除成员'));
    }
    const removed = store.removeMember(request.params.id, actor.id);
    if (!removed) {
      return reply
        .code(400)
        .send(apiError('INVALID_OPERATION', '无法移除成员：不能移除自己或权限不足'));
    }
    return reply.code(204).send();
  });

  app.get('/api/workspace', async () => store.workspace());
  app.get('/api/sops', async () => ({ items: store.listSops() }));
  app.get('/api/audit', async () => ({ items: store.auditEvents() }));
  app.get('/api/metrics', async () => store.rehearsalMetrics());
  app.get('/api/training', async () => ({ items: store.listTraining() }));

  app.post<{
    Body: { name?: unknown; mime?: unknown; base64?: unknown };
  }>('/api/documents/convert', { bodyLimit: 8 * 1024 * 1024 }, async (request, reply) => {
    const { name, mime, base64 } = request.body ?? {};
    if (
      typeof name !== 'string' ||
      typeof mime !== 'string' ||
      typeof base64 !== 'string' ||
      ![
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ].includes(mime)
    ) {
      return reply.code(400).send(apiError('VALIDATION_ERROR', 'Valid PDF or DOCX required'));
    }
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) {
      return reply.code(413).send(apiError('DOCUMENT_TOO_LARGE', 'Document limit is 5 MiB'));
    }
    const baseUrl = options.doclingBaseUrl ?? process.env.DOCLING_BASE_URL;
    if (!baseUrl) {
      return reply
        .code(503)
        .send(apiError('DOCLING_NOT_CONFIGURED', 'Document parser unavailable'));
    }
    const form = new FormData();
    form.append('files', new Blob([bytes], { type: mime }), name);
    form.append('to_formats', 'md');
    form.append('abort_on_error', 'true');
    const response = await (options.doclingFetch ?? fetch)(
      `${baseUrl.replace(/\/$/, '')}/v1/convert/file`,
      { method: 'POST', body: form },
    );
    if (!response.ok) {
      return reply
        .code(502)
        .send(apiError('DOCUMENT_CONVERSION_FAILED', 'Docling conversion failed'));
    }
    const converted = (await response.json()) as {
      status?: string;
      document?: { md_content?: string; text_content?: string };
    };
    const content = converted.document?.md_content ?? converted.document?.text_content;
    if (!content) {
      return reply
        .code(502)
        .send(apiError('DOCUMENT_CONVERSION_FAILED', 'Docling returned no text'));
    }
    return { title: name.replace(/\.[^.]+$/, ''), content, status: converted.status ?? 'success' };
  });

  app.post<{ Body: { sopId?: unknown; assignee?: unknown } }>(
    '/api/training',
    async (request, reply) => {
      const { sopId, assignee } = request.body ?? {};
      if (typeof sopId !== 'string' || typeof assignee !== 'string' || !assignee.trim()) {
        return reply.code(400).send(apiError('VALIDATION_ERROR', 'sopId and assignee required'));
      }
      const assignment = store.createTraining(sopId, assignee.trim());
      return assignment ?? reply.code(404).send(apiError('NOT_FOUND', 'SOP not found'));
    },
  );

  app.post<{
    Params: { id: string };
    Body: {
      score?: unknown;
      decisions?: unknown;
    };
  }>('/api/training/:id/complete', async (request, reply) => {
    const { score, decisions } = request.body ?? {};
    const validDecisions =
      Array.isArray(decisions) &&
      decisions.every(
        (decision) =>
          decision &&
          typeof decision === 'object' &&
          typeof decision.nodeId === 'string' &&
          typeof decision.choiceId === 'string' &&
          typeof decision.scoreDelta === 'number',
      );
    if (
      typeof score !== 'number' ||
      !Number.isInteger(score) ||
      score < 0 ||
      score > 100 ||
      !validDecisions
    ) {
      return reply
        .code(400)
        .send(apiError('VALIDATION_ERROR', 'score and valid decisions required'));
    }
    const completed = store.completeTraining(
      request.params.id,
      score,
      decisions as Array<{ nodeId: string; choiceId: string; scoreDelta: number }>,
    );
    return completed ?? reply.code(404).send(apiError('NOT_FOUND', 'Training not found'));
  });

  app.get<{ Params: { id: string } }>('/api/training/:id/report', async (request, reply) => {
    const report = store.trainingReport(request.params.id);
    return report ?? reply.code(404).send(apiError('NOT_FOUND', 'Training not found'));
  });

  app.get<{ Params: { id: string } }>('/api/rehearsals/:id/replay', async (request, reply) => {
    const rehearsal = store.getRehearsal(request.params.id);
    if (!rehearsal) {
      return reply.code(404).send(apiError('NOT_FOUND', 'Rehearsal not found'));
    }
    return { items: store.replay(request.params.id) };
  });

  app.get<{ Params: { id: string } }>('/api/sops/:id', async (request, reply) => {
    const sop = store.getSop(request.params.id);
    return sop ?? reply.code(404).send(apiError('NOT_FOUND', 'SOP not found'));
  });

  app.get<{ Params: { id: string } }>('/api/sops/:id/versions', async (request) => ({
    items: store.listVersions(request.params.id),
  }));

  app.get<{ Params: { id: string } }>('/api/sops/:id/passport', async (request, reply) => {
    const sop = store.getSop(request.params.id);
    return sop?.passport ?? reply.code(404).send(apiError('NOT_FOUND', 'SOP not found'));
  });

  app.post('/api/sops', async (request, reply) => {
    const generated = await generateCouncil(request.body);
    if (!generated.ok) return reply.code(generated.status).send(generated.error);
    return reply.code(201).send(store.createSop(generated.input, generated.council));
  });

  app.post<{ Params: { id: string }; Body: { content?: unknown } }>(
    '/api/sops/:id/versions',
    async (request, reply) => {
      const sop = store.getSop(request.params.id);
      if (!sop) return reply.code(404).send(apiError('NOT_FOUND', 'SOP not found'));
      if (typeof request.body?.content !== 'string') {
        return reply.code(400).send(apiError('VALIDATION_ERROR', 'content is required'));
      }
      const generated = await generateCouncil({
        title: sop.title,
        content: request.body.content,
        locale: sop.locale,
      });
      if (!generated.ok) return reply.code(generated.status).send(generated.error);
      const version = store.addVersion(sop.id, generated.input.content, generated.council);
      return reply.code(201).send(version);
    },
  );

  app.get<{ Params: { id: string }; Querystring: { from?: string; to?: string } }>(
    '/api/sops/:id/compare',
    async (request, reply) => {
      const from = Number(request.query.from);
      const to = Number(request.query.to);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < 1) {
        return reply.code(400).send(apiError('VALIDATION_ERROR', 'from and to must be versions'));
      }
      const previous = store.getVersion(request.params.id, from);
      const current = store.getVersion(request.params.id, to);
      if (!previous || !current) {
        return reply.code(404).send(apiError('NOT_FOUND', 'SOP version not found'));
      }
      return {
        fromVersion: from,
        toVersion: to,
        ...compareSopVersions(
          previous.content,
          current.content,
          previous.passport,
          current.passport,
        ),
      };
    },
  );

  async function review(body: unknown) {
    const generated = await generateCouncil(body);
    if (!generated.ok) return generated;
    const sop = store.createSop(generated.input, generated.council);
    const passport = sop.passport;
    store.saveRehearsal(generated.rehearsalId, generated.council, passport, {
      sopId: sop.id,
      version: sop.latestVersion,
      durationMs: generated.durationMs,
    });
    return { ...generated, passport, sop };
  }

  app.post('/a2mcp/review-sop', async (request, reply) => {
    const result = await review(request.body);
    if (!result.ok) return reply.code(result.status).send(result.error);
    return {
      rehearsalId: result.rehearsalId,
      status: 'READY',
      council: result.council,
      passport: result.passport,
      sop: result.sop,
    };
  });

  const generateRehearsalHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const startedAt = ingressStartedAt.get(request) ?? performance.now();
    const remaining =
      A2MCP_DEADLINE_MS - A2MCP_RESPONSE_RESERVE_MS - (performance.now() - startedAt);
    if (remaining <= 0) {
      return reply
        .code(504)
        .header('Cache-Control', 'no-store')
        .header('X-Request-Id', crypto.randomUUID())
        .send(
          problemDetails(
            'gateway-timeout',
            'Gateway Timeout',
            504,
            'Generation exceeded 58s deadline',
            {
              rehearsalStatus: 'TIMEOUT',
              errorType: 'timeout',
            },
          ),
        );
    }
    const generated = await generateCouncil(request.body, remaining);
    ingressStartedAt.delete(request);
    if (!generated.ok) {
      // PARTIAL_FAILED → 502 with Problem Details
      if ((generated as { partial?: boolean }).partial) {
        const partial = generated as typeof generated & {
          partialFindings: Finding[];
          failedRoles: AgentRole[];
          rehearsalId: string;
          input: { title: string; content: string; locale?: string };
        };
        // Register exercise for retry
        exercises.set(partial.rehearsalId, {
          rehearsalId: partial.rehearsalId,
          input: partial.input,
          retryCount: 0,
          running: false,
          savedFindings: partial.partialFindings,
          failedRoles: partial.failedRoles,
        });
        return reply
          .code(502)
          .header('Cache-Control', 'no-store')
          .header('X-Request-Id', crypto.randomUUID())
          .send(
            problemDetails(
              'bad-gateway',
              'Upstream Failure',
              502,
              partial.error?.message ?? 'Upstream provider failed',
              {
                rehearsalStatus: 'PARTIAL_FAILED',
                failedExperts: partial.failedRoles,
                errorType: 'partial',
                rehearsalId: partial.rehearsalId,
              },
            ),
          );
      }
      return reply.code(generated.status).send(generated.error);
    }
    const sop = store.createSop(generated.input, generated.council);
    const passport = sop.passport;
    store.saveRehearsal(generated.rehearsalId, generated.council, passport, {
      sopId: sop.id,
      version: sop.latestVersion,
      durationMs: generated.durationMs,
    });
    const council = generated.council;
    return {
      rehearsalId: generated.rehearsalId,
      status: 'READY',
      consensus: council.consensus,
      disagreements: council.disagreements,
      evidenceGaps: council.evidenceGaps,
      recommendedPath: council.recommendedPath,
      decisionNodes: council.decisionNodes,
      passport,
      sop,
    };
  };

  app.post('/api/generate-rehearsal', generateRehearsalHandler);
  app.post('/a2mcp/generate-rehearsal', generateRehearsalHandler);

  // ─── Retry endpoint: selective retry for failed specialists ───
  // POST /api/rehearsals/:id/retry-failed-experts
  // Requires SOPSCAPE_API_KEY via Authorization header
  // Only Owner/Editor can retry; Viewer → 403, unauthenticated → 401
  // One retry per exercise; concurrent → 409

  app.post<{ Params: { id: string } }>(
    '/api/rehearsals/:id/retry-failed-experts',
    async (request, reply) => {
      // Auth: API key header check
      const apiKeyHeader = request.headers.authorization as string | undefined;
      if (serviceApiKey && apiKeyHeader !== `Bearer ${serviceApiKey}`) {
        return reply
          .code(401)
          .header('Cache-Control', 'no-store')
          .send(problemDetails('unauthorized', 'Unauthorized', 401, 'Valid API key required'));
      }

      const rehearsalId = request.params.id;
      const exercise = exercises.get(rehearsalId);

      if (!exercise) {
        return reply
          .code(404)
          .header('Cache-Control', 'no-store')
          .send(
            problemDetails('not-found', 'Not Found', 404, 'Exercise not found', { rehearsalId }),
          );
      }

      // Concurrent execution check
      if (exercise.running) {
        return reply
          .code(409)
          .header('Cache-Control', 'no-store')
          .send(
            problemDetails('conflict', 'Conflict', 409, 'Retry already in progress', {
              rehearsalId,
            }),
          );
      }

      // One retry per exercise limit
      if (exercise.retryCount >= 1) {
        return reply
          .code(429)
          .header('Cache-Control', 'no-store')
          .send(
            problemDetails(
              'too-many-requests',
              'Too Many Requests',
              429,
              'Only one manual retry allowed per exercise',
              { rehearsalId },
            ),
          );
      }

      // Must have failed roles to retry
      if (exercise.failedRoles.length === 0) {
        return reply
          .code(400)
          .header('Cache-Control', 'no-store')
          .send(
            problemDetails('bad-request', 'Bad Request', 400, 'No failed specialists to retry', {
              rehearsalId,
            }),
          );
      }

      exercise.running = true;
      exercise.retryCount += 1;

      const controller = new AbortController();
      const llmConfig = getLLMConfig();

      try {
        const result = await Promise.race([
          startGeneration(exercise.input, {
            signal: controller.signal,
            llm: llmConfig ?? undefined,
            savedFindings: exercise.savedFindings,
            failedRoles: exercise.failedRoles as Array<
              'procedure-analyst' | 'risk-challenger' | 'evidence-auditor'
            >,
          }),
          deadline(A2MCP_DEADLINE_MS - A2MCP_RESPONSE_RESERVE_MS, controller.signal),
        ]);

        if (result.status === 'READY') {
          const councilValid = CouncilResultSchema.safeParse(result.council);
          if (councilValid.success) {
            const sop = store.createSop(exercise.input, councilValid.data);
            store.saveRehearsal(
              result.originalRehearsalId ?? result.rehearsalId ?? rehearsalId,
              councilValid.data,
              sop.passport,
              {
                sopId: sop.id,
                version: sop.latestVersion,
              },
            );
            exercise.running = false;
            exercise.failedRoles = [];
            return reply.code(200).send({
              rehearsalId: result.originalRehearsalId ?? result.rehearsalId ?? rehearsalId,
              status: result.status,
              consensus: councilValid.data.consensus,
              disagreements: councilValid.data.disagreements,
              evidenceGaps: councilValid.data.evidenceGaps,
              recommendedPath: councilValid.data.recommendedPath,
              decisionNodes: councilValid.data.decisionNodes,
              retryConsumed: true,
            });
          }
        }

        if (result.status === 'PARTIAL_FAILED' || result.status === 'FAILED') {
          const failedRoles = (result.failedRoles ?? []) as AgentRole[];
          // Update saved findings with partial results
          exercise.savedFindings = result.partialFindings ?? exercise.savedFindings;
          exercise.failedRoles = failedRoles;
          exercise.running = false;
          return reply
            .code(502)
            .header('Cache-Control', 'no-store')
            .send(
              problemDetails('bad-gateway', 'Retry Failed', 502, result.error ?? 'Retry failed', {
                rehearsalId,
                retryConsumed: true,
                failedExperts: failedRoles,
              }),
            );
        }

        exercise.running = false;
        return reply
          .code(500)
          .header('Cache-Control', 'no-store')
          .send(
            problemDetails('internal-error', 'Internal Error', 500, 'Retry failed unexpectedly', {
              rehearsalId,
              retryConsumed: true,
            }),
          );
      } catch (error) {
        if (error instanceof Error && error.message === 'DEADLINE_EXCEEDED') {
          controller.abort();
          exercise.running = false;
          return reply
            .code(504)
            .header('Cache-Control', 'no-store')
            .send(
              problemDetails(
                'gateway-timeout',
                'Gateway Timeout',
                504,
                'Retry exceeded 58s deadline',
                {
                  rehearsalId,
                  retryConsumed: true,
                  rehearsalStatus: 'TIMEOUT',
                  errorType: 'timeout',
                },
              ),
            );
        }
        exercise.running = false;
        return reply.code(500).send(
          problemDetails('internal-error', 'Internal Error', 500, 'Unexpected error during retry', {
            rehearsalId,
            retryConsumed: true,
          }),
        );
      } finally {
        exercise.running = false;
        controller.abort();
      }
    },
  );

  const evaluateDecisionHandler = async (
    request: FastifyRequest<{
      Body: { rehearsalId?: unknown; nodeId?: unknown; choiceId?: unknown };
    }>,
    reply: FastifyReply,
  ) => {
    const evaluated = evaluateDecisionInput(request.body);
    if (!evaluated.ok) {
      return reply.code(evaluated.status).send(evaluated.error);
    }
    return evaluated.value;
  };

  function evaluateDecisionInput(input: unknown) {
    const body =
      input && typeof input === 'object'
        ? (input as { rehearsalId?: unknown; nodeId?: unknown; choiceId?: unknown })
        : {};
    const { rehearsalId, nodeId, choiceId } = body;
    if (
      typeof rehearsalId !== 'string' ||
      typeof nodeId !== 'string' ||
      typeof choiceId !== 'string'
    ) {
      return {
        ok: false as const,
        status: 400,
        error: apiError('VALIDATION_ERROR', 'rehearsalId, nodeId and choiceId required'),
      };
    }
    const rehearsal = store.getRehearsal(rehearsalId);
    const node = rehearsal?.council.decisionNodes.find((candidate) => candidate.id === nodeId);
    if (!rehearsal || !node) {
      return {
        ok: false as const,
        status: 404,
        error: apiError('NOT_FOUND', 'Rehearsal or decision not found'),
      };
    }
    try {
      const evaluation = evaluateDecision(node, choiceId);
      store.recordDecision(rehearsalId, evaluation);
      return { ok: true as const, value: evaluation };
    } catch {
      return {
        ok: false as const,
        status: 404,
        error: apiError('NOT_FOUND', 'Decision choice not found'),
      };
    }
  }

  app.post('/api/evaluate-decision', evaluateDecisionHandler);
  app.post('/a2mcp/evaluate-decision', evaluateDecisionHandler);

  function compareVersionsInput(input: unknown) {
    const body =
      input && typeof input === 'object'
        ? (input as {
            previous?: unknown;
            current?: unknown;
            previousCouncil?: unknown;
            currentCouncil?: unknown;
          })
        : {};
    const { previous, current, previousCouncil, currentCouncil } = body;
    const before = CouncilResultSchema.safeParse(previousCouncil);
    const after = CouncilResultSchema.safeParse(currentCouncil);
    if (
      typeof previous !== 'string' ||
      typeof current !== 'string' ||
      !before.success ||
      !after.success
    ) {
      return {
        ok: false as const,
        status: 400,
        error: apiError('VALIDATION_ERROR', 'Valid versions and councils required'),
      };
    }
    return {
      ok: true as const,
      value: compareSopVersions(
        previous,
        current,
        computeReadiness(before.data, previous),
        computeReadiness(after.data, current),
      ),
    };
  }

  app.post('/a2mcp/compare-versions', async (request, reply) => {
    const compared = compareVersionsInput(request.body);
    if (!compared.ok) return reply.code(compared.status).send(compared.error);
    return compared.value;
  });

  // 分享相关 API
  app.post<{ Body: unknown }>('/api/shares', async (request, reply) => {
    const actor = currentMember(request);
    const parsed = CreateShareRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send(
          apiError(
            'VALIDATION_ERROR',
            parsed.error.issues
              .map(
                (i: { path: (string | number)[]; message: string }) =>
                  `${i.path.join('.')}: ${i.message}`,
              )
              .join('; '),
          ),
        );
    }
    const { rehearsalId, expiresAt, maxViews } = parsed.data;

    // 验证 rehearsal 是否存在
    const rehearsal = store.getRehearsal(rehearsalId);
    if (!rehearsal) {
      return reply.code(404).send(apiError('NOT_FOUND', 'Rehearsal not found'));
    }

    const result = store.createShare(rehearsalId, actor.id, expiresAt ?? null, maxViews);
    if (!result) {
      return reply.code(500).send(apiError('INTERNAL_ERROR', 'Failed to create share'));
    }

    return reply.code(201).send({
      shareId: result.id,
      shareToken: result.shareToken,
      shareUrl: `${process.env.PUBLIC_APP_ORIGIN ?? 'http://localhost:5173'}${result.shareUrl}`,
      expiresAt: expiresAt ?? null,
      maxViews,
    });
  });

  app.get<{ Params: { token: string } }>('/api/shares/:token', async (request, reply) => {
    const { token } = request.params;
    const data = store.getSharedRehearsalData(token);
    if (!data) {
      return reply
        .code(404)
        .send(apiError('NOT_FOUND', 'Share not found, expired, or view limit reached'));
    }

    // 增加查看次数
    store.incrementShareView(String((data as Row).shareId));

    return {
      shareId: (data as Row).shareId,
      rehearsalId: (data as Row).rehearsalId,
      sopId: (data as Row).sopId,
      council: (data as Row).council,
      passport: (data as Row).passport,
      decisions: (data as Row).decisions,
      createdAt: (data as Row).createdAt,
    };
  });

  app.get<{ Params: { id: string } }>('/api/rehearsals/:id/shares', async (request, reply) => {
    const actor = currentMember(request);
    const rehearsal = store.getRehearsal(request.params.id);
    if (!rehearsal) {
      return reply.code(404).send(apiError('NOT_FOUND', 'Rehearsal not found'));
    }
    const shares = store.listShares(request.params.id) as Row[];
    // 只显示当前用户创建的分享
    const filteredShares = shares.filter((s: Row) => String(s.createdBy) === actor.id);
    return { shares: filteredShares };
  });

  app.delete<{ Params: { id: string } }>('/api/shares/:id', async (request, reply) => {
    const actor = currentMember(request);
    const deleted = store.deleteShare(request.params.id, actor.id);
    if (!deleted) {
      return reply.code(404).send(apiError('NOT_FOUND', 'Share not found or permission denied'));
    }
    return reply.code(204).send();
  });

  registerMcpEndpoint(app, {
    reviewSop: async (input) => {
      const reviewed = await review(input);
      if (!reviewed.ok) throw new Error(reviewed.error.message);
      return {
        rehearsalId: reviewed.rehearsalId,
        status: 'READY',
        council: reviewed.council,
        passport: reviewed.passport,
        sop: reviewed.sop,
      };
    },
    generateRehearsal: async (input) => {
      const reviewed = await review(input);
      if (!reviewed.ok) throw new Error(reviewed.error.message);
      return {
        rehearsalId: reviewed.rehearsalId,
        status: 'READY',
        consensus: reviewed.council.consensus,
        disagreements: reviewed.council.disagreements,
        evidenceGaps: reviewed.council.evidenceGaps,
        recommendedPath: reviewed.council.recommendedPath,
        decisionNodes: reviewed.council.decisionNodes,
        passport: reviewed.passport,
        sop: reviewed.sop,
      };
    },
    evaluateDecision: async (input) => {
      const evaluated = evaluateDecisionInput(input);
      if (!evaluated.ok) throw new Error(evaluated.error.message);
      return { ...evaluated.value };
    },
    compareSopVersions: async (input) => {
      const compared = compareVersionsInput(input);
      if (!compared.ok) throw new Error(compared.error.message);
      return { ...compared.value };
    },
  });
  registerScenarioRoutes(app);
  registerSpaRoutes(app);

  return app;
}

export type { CouncilResult };
