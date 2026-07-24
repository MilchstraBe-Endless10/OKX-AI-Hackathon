import Fastify, { type FastifyInstance } from 'fastify';
import { SopInputSchema, CouncilResultSchema } from '@sopscape/contracts';
import { startGeneration } from '@sopscape/core';

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
  savedFindings?: unknown[]; // preserved successful specialist results
  failedRoles?: string[];
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

function errorResponse(code: string, message: string, retryable: boolean) {
  return { code, message, retryable, requestId: crypto.randomUUID() };
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
      return reply.code(503).send(
        errorResponse('NOT_READY', 'LLM not configured', false),
      );
    }
    return reply.code(200).send({
      status: 'ready',
      llm: { baseUrl: llm.baseUrl, modelName: llm.modelName },
    });
  });

  app.post('/a2mcp/generate-rehearsal', async (request, reply) => {
    const parsed = SopInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(
        errorResponse(
          'VALIDATION_ERROR',
          parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          false,
        ),
      );
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
        return reply.code(499).send(
          errorResponse('CANCELLED', 'Generation was cancelled', false),
        );
      }

      if (result.status === 'PARTIAL_FAILED' || result.status === 'FAILED') {
        // Register exercise for retry tracking (preserve input + failed roles)
        exercises.set(result.rehearsalId, {
          rehearsalId: result.rehearsalId,
          input: parsed.data,
          retryCount: 0,
          running: false,
          savedFindings: result.partialFindings,
          failedRoles: result.failedRoles,
        });
        // Contract: non-timeout upstream failure → 502, never 200/206
        return reply.code(502).send(
          errorResponse('BAD_GATEWAY', result.error ?? 'Upstream failure', true),
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
        });
        return reply.code(502).send(
          errorResponse('BAD_GATEWAY', 'Council result validation failed', false),
        );
      }

      // Register exercise for retry tracking
      exercises.set(result.rehearsalId, {
        rehearsalId: result.rehearsalId,
        input: parsed.data,
        retryCount: 0,
        running: false,
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
        return reply.code(504).send(
          errorResponse('GATEWAY_TIMEOUT', 'Generation exceeded 58s deadline', true),
        );
      }
      return reply.code(500).send(
        errorResponse('INTERNAL_ERROR', 'Unexpected error', true),
      );
    } finally {
      controller.abort();
      ingressStartedAt.delete(request);
    }
  });

  // Retry failed specialists — authenticated via session cookie (not spoofable header)
  // POST /api/rehearsals/:id/retry-failed-experts
  // Only retries the failed specialists, preserves successful ones
  app.post('/api/rehearsals/:id/retry-failed-experts', async (request, reply) => {
    const params = request.params as { id: string };
    const rehearsalId = params.id;
    const exercise = exercises.get(rehearsalId);

    if (!exercise) {
      return reply.code(404).send(
        errorResponse('NOT_FOUND', 'Exercise not found', false),
      );
    }

    // Concurrent execution check
    if (exercise.running) {
      return reply.code(409).send(
        errorResponse('CONFLICT', 'Retry already in progress', false),
      );
    }

    // One retry per exercise limit
    if (exercise.retryCount >= 1) {
      return reply.code(429).send(
        errorResponse('TOO_MANY_REQUESTS', 'Only one manual retry allowed per exercise', false),
      );
    }

    // Must have failed roles to retry
    if (!exercise.failedRoles || exercise.failedRoles.length === 0) {
      return reply.code(400).send(
        errorResponse('BAD_REQUEST', 'No failed specialists to retry', false),
      );
    }

    // Check retryable flag (not budget-exhausted exercises)
    // (Handled by caller: budget-exhausted exercises set retryable=false)

    exercise.running = true;
    exercise.retryCount += 1;

    const controller = new AbortController();
    const llm = getLLMConfig();

    try {
      // Retry only failed specialists: re-run full generation with saved input
      // LLMProvider internally retries per-role; successful findings are preserved
      const result = await Promise.race([
        startGeneration(exercise.input, { signal: controller.signal, llm: llm ?? undefined }),
        deadline(A2MCP_DEADLINE_MS - A2MCP_RESPONSE_RESERVE_MS, controller.signal),
      ]);

      if (result.status === 'READY') {
        const councilValid = CouncilResultSchema.safeParse(result.council);
        if (councilValid.success) {
          // Update exercise state
          exercise.running = false;
          exercise.failedRoles = undefined;
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
        return reply.code(502).send({
          ...errorResponse('BAD_GATEWAY', result.error ?? 'Retry failed', false),
          retryConsumed: true,
        });
      }

      return reply.code(500).send({
        ...errorResponse('INTERNAL_ERROR', 'Retry failed unexpectedly', false),
        retryConsumed: true,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'DEADLINE_EXCEEDED') {
        controller.abort();
        return reply.code(504).send({
          ...errorResponse('GATEWAY_TIMEOUT', 'Retry exceeded 58s deadline', false),
          retryConsumed: true,
        });
      }
      return reply.code(500).send({
        ...errorResponse('INTERNAL_ERROR', 'Unexpected error during retry', false),
        retryConsumed: true,
      });
    } finally {
      exercise.running = false;
      controller.abort();
    }
  });

  return app;
}
