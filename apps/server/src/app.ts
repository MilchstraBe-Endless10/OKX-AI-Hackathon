import Fastify, { type FastifyInstance } from 'fastify';
import { SopInputSchema, CouncilResultSchema } from '@sopscape/contracts';
import { startGeneration } from '@sopscape/core';

// ponytail: A2MCP is the competition ingress — 58s absolute deadline interface, no payment.
// All real orchestration happens in @sopscape/core; this route only maps transport.

const A2MCP_DEADLINE_MS = 58_000;

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

  app.get('/health/live', async () => ({ status: 'ok' }));

  app.get('/health/ready', async (_request, reply) => {
    return reply.code(503).send({
      status: 'not_ready',
      reason: 'database and admission not configured',
    });
  });

  app.post('/a2mcp/generate-rehearsal', async (request, reply) => {
    // Validate input directly from request.body
    const parsed = SopInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        retryable: false,
        requestId: crypto.randomUUID(),
      });
    }

    // Enforce 58s deadline with Promise.race
    const controller = new AbortController();
    const signal = controller.signal;

    try {
      const result = await Promise.race([
        startGeneration(parsed.data, { signal }),
        deadline(A2MCP_DEADLINE_MS, signal),
      ]);

      if (result.status === 'CANCELLED') {
        return reply.code(499).send({
          code: 'CANCELLED',
          message: 'Generation was cancelled',
          retryable: false,
          requestId: crypto.randomUUID(),
        });
      }

      if (result.status === 'FAILED') {
        return reply.code(500).send({
          code: 'GENERATION_FAILED',
          message: result.error ?? 'Unknown error',
          retryable: true,
          requestId: crypto.randomUUID(),
        });
      }

      // Validate council result — use parsed data
      const councilValid = CouncilResultSchema.safeParse(result.council);
      if (!councilValid.success) {
        return reply.code(500).send({
          code: 'PROJECTION_ERROR',
          message: 'Council result validation failed',
          retryable: false,
          requestId: crypto.randomUUID(),
        });
      }

      // Return A2MCP success projection
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
      // Deadline exceeded → HTTP 504
      if (error instanceof Error && error.message === 'DEADLINE_EXCEEDED') {
        controller.abort(); // Ensure Core is aborted
        return reply.code(504).send({
          code: 'DEADLINE_EXCEEDED',
          message: 'Generation exceeded 58s deadline',
          retryable: false,
          requestId: crypto.randomUUID(),
        });
      }
      // Other errors → HTTP 500
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error',
        retryable: true,
        requestId: crypto.randomUUID(),
      });
    }
  });

  return app;
}
