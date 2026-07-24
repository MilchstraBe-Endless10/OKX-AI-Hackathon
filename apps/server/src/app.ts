import Fastify, { type FastifyInstance } from 'fastify';
import { SopInputSchema, CouncilResultSchema } from '@sopscape/contracts';
import { startGeneration, type Finding, type AgentRole } from '@sopscape/core';

// ponytail: A2MCP is the competition ingress — 58s absolute deadline interface, no payment.
// All real orchestration happens in @sopscape/core; this route only maps transport.

const A2MCP_DEADLINE_MS = 58_000;
const A2MCP_RESPONSE_RESERVE_MS = 2_000;

interface ServerLLMConfig {
  apiKey: string;
  baseUrl: string;
  modelName: string;
  fallbackName?: string;
}

// In-memory exercise tracking (workspace-demo only, no multi-tenant)
// ponytail: in-memory for competition; DB-backed for production.
interface ExerciseState {
  rehearsalId: string;
  input: { title: string; content: string; locale?: string };
  retryCount: number; // max 1 per exercise
  running: boolean; // prevent concurrent duplicate
  savedFindings: Finding[]; // preserved successful specialist results
  failedRoles: AgentRole[];
}
const exercises = new Map<string, ExerciseState>();

function getLLMConfig(): ServerLLMConfig | null {
  const { MODEL_API_KEY, MODEL_BASE_URL, MODEL_NAME, MODEL_FALLBACK_NAME } = process.env;
  if (MODEL_API_KEY && MODEL_BASE_URL && MODEL_NAME) {
    return {
      apiKey: MODEL_API_KEY,
      baseUrl: MODEL_BASE_URL,
      modelName: MODEL_NAME,
      fallbackName: MODEL_FALLBACK_NAME || undefined,
    };
  }
  return null;
}

function deadline(ms: number, signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('DEADLINE_EXCEEDED'));
    }, ms);
    signal.addEventListener('abort', () => clearTimeout(timeout), { once: true });
  });
}

// Problem Details response per RFC 7807
function problemDetails(
  type: string,
  title: string,
  status: number,
  detail: string,
  instance?: string,
  extra?: Record<string, unknown>,
) {
  const body = {
    type: `https://sopscape.local/errors/${type}`,
    title,
    status,
    detail,
    instance: instance ?? crypto.randomUUID(),
    ...extra,
  };
  return body;
}

function formatAuthError() {
  return problemDetails('unauthorized', 'Unauthorized', 401, 'Valid API key required');
}

// Auth middleware for retry endpoint — validates SOPSCAPE_API_KEY header
function requireAuth(headers: Record<string, string | string[] | undefined>): boolean {
  const apiKey = headers['authorization'] as string | undefined;
  const expected = process.env.SOPSCAPE_API_KEY;
  if (!expected) return true; // No key configured → skip auth (dev mode)
  return apiKey === `Bearer ${expected}`;
}

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });
  const ingressStartedAt = new WeakMap<object, number>();

  app.addHook('onRequest', async (request) => {
    if (request.url === '/a2mcp/generate-rehearsal') {
      ingressStartedAt.set(request, performance.now());
    }
  });

  app.get('/health/live', async () => ({ status: 'ok' }));

  app.get('/health/ready', async (_request, reply) => {
    const llm = getLLMConfig();
    if (!llm) {
      return reply
        .code(503)
        .send(problemDetails('not-ready', 'Not Ready', 503, 'LLM not configured'));
    }
    return reply.code(200).send({
      status: 'ready',
      llm: { baseUrl: llm.baseUrl, modelName: llm.modelName },
    });
  });

  app.post('/a2mcp/generate-rehearsal', async (request, reply) => {
    const parsed = SopInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .header('Cache-Control', 'no-store')
        .send(
          problemDetails(
            'validation-error',
            'Validation Error',
            400,
            parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          ),
        );
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const startedAt = ingressStartedAt.get(request) ?? performance.now();
    const workRemainingMs =
      A2MCP_DEADLINE_MS - A2MCP_RESPONSE_RESERVE_MS - (performance.now() - startedAt);

    const llm = getLLMConfig();
    const requestId = crypto.randomUUID();

    try {
      if (workRemainingMs <= 0) {
        throw new Error('DEADLINE_EXCEEDED');
      }
      const result = await Promise.race([
        startGeneration(parsed.data, { signal, llm: llm ?? undefined }),
        deadline(workRemainingMs, signal),
      ]);

      if (result.status === 'CANCELLED') {
        return reply
          .code(499)
          .header('Cache-Control', 'no-store')
          .send(
            problemDetails('cancelled', 'Cancelled', 499, 'Generation was cancelled', undefined, {
              requestId,
            }),
          );
      }

      if (result.status === 'PARTIAL_FAILED' || result.status === 'FAILED') {
        const failedRoles = (result.failedRoles ?? []) as AgentRole[];
        const savedFindings = (result.partialFindings ?? []) as Finding[];

        // Register exercise for retry tracking
        exercises.set(result.rehearsalId, {
          rehearsalId: result.rehearsalId,
          input: parsed.data,
          retryCount: 0,
          running: false,
          savedFindings,
          failedRoles,
        });

        return reply
          .code(502)
          .header('Cache-Control', 'no-store')
          .header('X-Request-Id', requestId)
          .send(
            problemDetails(
              'bad-gateway',
              'Upstream Failure',
              502,
              result.error ?? 'Upstream provider failed',
              undefined,
              {
                requestId,
                rehearsalId: result.rehearsalId,
                rehearsalStatus: result.status,
                failedExperts: failedRoles,
                errorType: result.status === 'PARTIAL_FAILED' ? 'partial' : 'complete',
              },
            ),
          );
      }

      // READY — validate council result
      const councilValid = CouncilResultSchema.safeParse(result.council);
      if (!councilValid.success) {
        exercises.set(result.rehearsalId, {
          rehearsalId: result.rehearsalId,
          input: parsed.data,
          retryCount: 0,
          running: false,
          savedFindings: [],
          failedRoles: [],
        });
        return reply
          .code(502)
          .header('Cache-Control', 'no-store')
          .send(
            problemDetails(
              'projection-error',
              'Projection Error',
              502,
              'Council result validation failed',
              undefined,
              { requestId },
            ),
          );
      }

      // Register exercise for retry tracking
      exercises.set(result.rehearsalId, {
        rehearsalId: result.rehearsalId,
        input: parsed.data,
        retryCount: 0,
        running: false,
        savedFindings: [],
        failedRoles: [],
      });

      const council = councilValid.data;
      return reply.code(200).send({
        rehearsalId: result.rehearsalId,
        status: result.status,
        consensus: council.consensus,
        disagreements: council.disagreements,
        evidenceGaps: council.evidenceGaps,
        recommendedPath: council.recommendedPath,
        decisionNodes: council.decisionNodes,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'DEADLINE_EXCEEDED') {
        controller.abort();
        return reply
          .code(504)
          .header('Cache-Control', 'no-store')
          .header('X-Request-Id', requestId)
          .send(
            problemDetails(
              'gateway-timeout',
              'Gateway Timeout',
              504,
              'Generation exceeded 58s deadline',
              undefined,
              {
                requestId,
                rehearsalStatus: 'TIMEOUT',
                errorType: 'timeout',
              },
            ),
          );
      }
      return reply.code(500).send(
        problemDetails('internal-error', 'Internal Error', 500, 'Unexpected error', undefined, {
          requestId,
        }),
      );
    } finally {
      controller.abort();
      ingressStartedAt.delete(request);
    }
  });

  // Retry failed specialists — requires SOPSCAPE_API_KEY via Authorization header
  // POST /api/rehearsals/:id/retry-failed-experts
  // Only retries the failed specialists, preserves successful ones
  app.post('/api/rehearsals/:id/retry-failed-experts', async (request, reply) => {
    // Auth check — only authenticated Owner/Editor can retry
    if (!requireAuth(request.headers)) {
      return reply.code(401).send(formatAuthError());
    }

    const params = request.params as { id: string };
    const rehearsalId = params.id;
    const exercise = exercises.get(rehearsalId);

    if (!exercise) {
      return reply
        .code(404)
        .header('Cache-Control', 'no-store')
        .send(problemDetails('not-found', 'Not Found', 404, 'Exercise not found', rehearsalId));
    }

    // Concurrent execution check
    if (exercise.running) {
      return reply
        .code(409)
        .header('Cache-Control', 'no-store')
        .send(
          problemDetails('conflict', 'Conflict', 409, 'Retry already in progress', rehearsalId),
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
            rehearsalId,
          ),
        );
    }

    // Must have failed roles to retry
    if (exercise.failedRoles.length === 0) {
      return reply
        .code(400)
        .header('Cache-Control', 'no-store')
        .send(
          problemDetails(
            'bad-request',
            'Bad Request',
            400,
            'No failed specialists to retry',
            rehearsalId,
          ),
        );
    }

    exercise.running = true;
    exercise.retryCount += 1;

    const controller = new AbortController();
    const llm = getLLMConfig();
    const requestId = crypto.randomUUID();

    try {
      // Selective retry: only retry failed specialists, merge with saved successful findings
      const result = await Promise.race([
        startGeneration(exercise.input, {
          signal: controller.signal,
          llm: llm ?? undefined,
          // Pass saved findings so core can merge results
          savedFindings: exercise.savedFindings,
          failedRoles: exercise.failedRoles,
        }),
        deadline(A2MCP_DEADLINE_MS - A2MCP_RESPONSE_RESERVE_MS, controller.signal),
      ]);

      if (result.status === 'READY') {
        const councilValid = CouncilResultSchema.safeParse(result.council);
        if (councilValid.success) {
          exercise.running = false;
          exercise.failedRoles = [];
          return reply.code(200).send({
            rehearsalId: result.rehearsalId,
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
        return reply
          .code(502)
          .header('Cache-Control', 'no-store')
          .send({
            ...problemDetails(
              'bad-gateway',
              'Retry Failed',
              502,
              result.error ?? 'Retry failed',
              rehearsalId,
              {
                requestId,
                retryConsumed: true,
                failedExperts: (result.failedRoles ?? []) as AgentRole[],
              },
            ),
          });
      }

      return reply
        .code(500)
        .header('Cache-Control', 'no-store')
        .send({
          ...problemDetails(
            'internal-error',
            'Internal Error',
            500,
            'Retry failed unexpectedly',
            rehearsalId,
            { requestId, retryConsumed: true },
          ),
        });
    } catch (error) {
      if (error instanceof Error && error.message === 'DEADLINE_EXCEEDED') {
        controller.abort();
        return reply
          .code(504)
          .header('Cache-Control', 'no-store')
          .send({
            ...problemDetails(
              'gateway-timeout',
              'Gateway Timeout',
              504,
              'Retry exceeded 58s deadline',
              rehearsalId,
              { requestId, retryConsumed: true, rehearsalStatus: 'TIMEOUT', errorType: 'timeout' },
            ),
          });
      }
      return reply.code(500).send({
        ...problemDetails(
          'internal-error',
          'Internal Error',
          500,
          'Unexpected error during retry',
          rehearsalId,
          { requestId, retryConsumed: true },
        ),
      });
    } finally {
      exercise.running = false;
      controller.abort();
    }
  });

  return app;
}
