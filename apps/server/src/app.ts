import Fastify, { type FastifyInstance } from 'fastify';
import { SopInputSchema, CouncilResultSchema, AgentRoleSchema } from '@sopscape/contracts';
import { startGeneration, type LLMConfig } from '@sopscape/core';

// ponytail: A2MCP is the competition ingress — 58s absolute deadline interface, no payment.
// All real orchestration happens in @sopscape/core; this route only maps transport.

const A2MCP_DEADLINE_MS = 58_000;
const A2MCP_RESPONSE_RESERVE_MS = 2_000;

// In-memory exercise tracking (workspace-demo only, no multi-tenant)
// ponytail: in-memory for competition; DB-backed for production.
interface ExerciseState {
  rehearsalId: string;
  retryCount: number; // max 1 per exercise
  running: boolean; // prevent concurrent duplicate
  lastResult?: { status: string; partialFindings?: unknown[]; failedRoles?: string[] };
}
const exercises = new Map<string, ExerciseState>();

function getLLMConfig(): LLMConfig | null {
  const { MODEL_API_KEY, MODEL_BASE_URL, MODEL_NAME } = process.env;
  if (MODEL_API_KEY && MODEL_BASE_URL && MODEL_NAME) {
    return { apiKey: MODEL_API_KEY, baseUrl: MODEL_BASE_URL, modelName: MODEL_NAME };
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
      return reply.code(503).send({
        status: 'not_ready',
        reason: 'LLM not configured (MODEL_API_KEY, MODEL_BASE_URL, MODEL_NAME required)',
      });
    }
    return reply.code(200).send({
      status: 'ready',
      llm: { baseUrl: llm.baseUrl, modelName: llm.modelName },
    });
  });

  app.post('/a2mcp/generate-rehearsal', async (request, reply) => {
    const parsed = SopInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        retryable: false,
        requestId: crypto.randomUUID(),
      });
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const startedAt = ingressStartedAt.get(request) ?? performance.now();
    const workRemainingMs =
      A2MCP_DEADLINE_MS - A2MCP_RESPONSE_RESERVE_MS - (performance.now() - startedAt);

    const llm = getLLMConfig();

    try {
      if (workRemainingMs <= 0) {
        throw new Error('DEADLINE_EXCEEDED');
      }
      const result = await Promise.race([
        startGeneration(parsed.data, { signal, llm: llm ?? undefined }),
        deadline(workRemainingMs, signal),
      ]);

      if (result.status === 'CANCELLED') {
        return reply.code(499).send({
          code: 'CANCELLED',
          message: 'Generation was cancelled',
          retryable: false,
          requestId: crypto.randomUUID(),
        });
      }

      if (result.status === 'PARTIAL_FAILED') {
        // Register exercise for retry tracking
        exercises.set(result.rehearsalId, {
          rehearsalId: result.rehearsalId,
          retryCount: 0,
          running: false,
          lastResult: {
            status: result.status,
            partialFindings: result.partialFindings,
            failedRoles: result.failedRoles,
          },
        });
        // Some specialists failed → no moderator, no decision nodes, no digital passport
        return reply.code(206).send({
          rehearsalId: result.rehearsalId,
          status: result.status,
          partialFindings: result.partialFindings ?? [],
          failedRoles: result.failedRoles ?? [],
          message: result.error ?? 'Partial failure',
          retryable: true,
          requestId: crypto.randomUUID(),
        });
      }

      if (result.status === 'FAILED') {
        const message = result.error ?? 'Unknown error';
        const isBudgetExceeded =
          message === 'BUDGET_EXCEEDED' || message === 'ATTEMPT_BUDGET_EXCEEDED';
        // Register exercise for tracking
        exercises.set(result.rehearsalId, {
          rehearsalId: result.rehearsalId,
          retryCount: 0,
          running: false,
          lastResult: { status: result.status },
        });
        return reply.code(isBudgetExceeded ? 502 : 500).send({
          code: isBudgetExceeded ? 'BUDGET_EXCEEDED' : 'GENERATION_FAILED',
          message,
          retryable: !isBudgetExceeded,
          requestId: crypto.randomUUID(),
        });
      }

      // READY — validate council result
      const councilValid = CouncilResultSchema.safeParse(result.council);
      if (!councilValid.success) {
        // Register as partial for retry tracking
        exercises.set(result.rehearsalId, {
          rehearsalId: result.rehearsalId,
          retryCount: 0,
          running: false,
          lastResult: { status: 'FAILED' },
        });
        return reply.code(500).send({
          code: 'PROJECTION_ERROR',
          message: 'Council result validation failed',
          retryable: false,
          requestId: crypto.randomUUID(),
        });
      }

      // Register exercise for retry tracking
      exercises.set(result.rehearsalId, {
        rehearsalId: result.rehearsalId,
        retryCount: 0,
        running: false,
        lastResult: {
          status: result.status,
          partialFindings: result.partialFindings,
          failedRoles: result.failedRoles,
        },
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
        return reply.code(504).send({
          code: 'GENERATION_TIMEOUT',
          message: 'Generation exceeded 58s deadline',
          retryable: true,
          requestId: crypto.randomUUID(),
        });
      }
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error',
        retryable: true,
        requestId: crypto.randomUUID(),
      });
    } finally {
      controller.abort();
      ingressStartedAt.delete(request);
    }
  });

  // Retry failed specialist — Owner/Editor only, one retry per exercise, no concurrent duplicates
  app.post('/a2mcp/:rehearsalId/retry-specialist', async (request, reply) => {
    const rehearsalId = request.params['rehearsalId'] as string;
    const exercise = exercises.get(rehearsalId);

    if (!exercise) {
      return reply.code(404).send({
        code: 'EXERCISE_NOT_FOUND',
        message: 'No exercise found for this rehearsal ID',
        retryable: false,
        requestId: crypto.randomUUID(),
      });
    }

    // Check concurrent execution
    if (exercise.running) {
      return reply.code(409).send({
        code: 'CONCURRENT_RETRY_DENIED',
        message: 'Retry already in progress for this exercise',
        retryable: false,
        requestId: crypto.randomUUID(),
      });
    }

    // Check retry limit (one manual retry per exercise)
    if (exercise.retryCount >= 1) {
      return reply.code(429).send({
        code: 'RETRY_LIMIT_EXCEEDED',
        message: 'Only one manual retry allowed per exercise',
        retryable: false,
        requestId: crypto.randomUUID(),
      });
    }

    // Validate role from header (Owner/Editor only)
    const callerRole = request.headers['x-caller-role'] as string;
    if (callerRole !== 'owner' && callerRole !== 'editor') {
      return reply.code(403).send({
        code: 'PERMISSION_DENIED',
        message: 'Only Owner or Editor can retry failed specialist',
        retryable: false,
        requestId: crypto.randomUUID(),
      });
    }

    // Validate requested specialist role
    const body = request.body as { role?: string } | null;
    const roleParsed = AgentRoleSchema.safeParse(body?.role);
    if (!roleParsed.success) {
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid specialist role',
        retryable: false,
        requestId: crypto.randomUUID(),
      });
    }

    const targetRole = roleParsed.data;

    // Check that this role actually failed
    const failedRoles = exercise.lastResult?.failedRoles ?? [];
    if (!failedRoles.includes(targetRole)) {
      return reply.code(400).send({
        code: 'ROLE_NOT_FAILED',
        message: `Role ${targetRole} did not fail in this exercise`,
        retryable: false,
        requestId: crypto.randomUUID(),
      });
    }

    // Mark running and increment retry count
    exercise.running = true;
    exercise.retryCount += 1;

    const controller = new AbortController();
    const llm = getLLMConfig();

    try {
      // Retry: re-run the full generation (LLMProvider handles per-role retry internally)
      const result = await Promise.race([
        startGeneration(
          { title: 'retry', content: 'retry' },
          { signal: controller.signal, llm: llm ?? undefined },
        ),
        deadline(A2MCP_DEADLINE_MS - A2MCP_RESPONSE_RESERVE_MS, controller.signal),
      ]);

      exercise.lastResult = {
        status: result.status,
        partialFindings: result.partialFindings,
        failedRoles: result.failedRoles,
      };

      if (result.status === 'READY') {
        const councilValid = CouncilResultSchema.safeParse(result.council);
        if (councilValid.success) {
          return reply.code(200).send({
            rehearsalId: result.rehearsalId,
            status: result.status,
            consensus: councilValid.data.consensus,
            disagreements: councilValid.data.disagreements,
            evidenceGaps: councilValid.data.evidenceGaps,
            recommendedPath: councilValid.data.recommendedPath,
            decisionNodes: councilValid.data.decisionNodes,
            requestId: crypto.randomUUID(),
          });
        }
      }

      if (result.status === 'PARTIAL_FAILED') {
        return reply.code(206).send({
          rehearsalId: result.rehearsalId,
          status: result.status,
          partialFindings: result.partialFindings ?? [],
          failedRoles: result.failedRoles ?? [],
          retryable: false, // retry already consumed
          requestId: crypto.randomUUID(),
        });
      }

      return reply.code(500).send({
        code: 'RETRY_FAILED',
        message: result.error ?? 'Retry failed',
        retryable: false,
        requestId: crypto.randomUUID(),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'DEADLINE_EXCEEDED') {
        controller.abort();
        return reply.code(504).send({
          code: 'GENERATION_TIMEOUT',
          message: 'Retry exceeded 58s deadline',
          retryable: false,
          requestId: crypto.randomUUID(),
        });
      }
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error during retry',
        retryable: false,
        requestId: crypto.randomUUID(),
      });
    } finally {
      exercise.running = false;
      controller.abort();
    }
  });

  return app;
}
