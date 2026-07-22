import Fastify, { type FastifyInstance } from 'fastify';

// ponytail: liveness only proves the process is alive.
// readiness returns 503 until real dependencies (DB, migration, admission)
// are wired up — this prevents misleading "healthy" signals.
export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get('/health/live', async () => ({ status: 'ok' }));

  app.get('/health/ready', async (_request, reply) => {
    return reply.code(503).send({
      status: 'not_ready',
      reason: 'database and admission not configured',
    });
  });

  return app;
}
