import Fastify, { type FastifyInstance } from 'fastify';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async () => ({ status: 'ok' }));

  return app;
}
