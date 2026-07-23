import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';

const WEB_DIST_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
const API_PREFIXES = ['/api/', '/a2mcp/', '/mcp', '/health/'];

function isApiRoute(url: string): boolean {
  return API_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export function registerSpaRoutes(app: FastifyInstance): void {
  if (process.env.NODE_ENV === 'production' && existsSync(join(WEB_DIST_PATH, 'index.html'))) {
    app.register(fastifyStatic, {
      root: WEB_DIST_PATH,
      wildcard: false,
      maxAge: '30d',
      immutable: true,
    });
    app.setNotFoundHandler(async (request, reply) => {
      if (isApiRoute(request.url)) {
        return reply.code(404).send({ code: 'NOT_FOUND', message: 'Route not found' });
      }
      return reply.sendFile('index.html', { maxAge: 0, immutable: false });
    });
    return;
  }

  app.setNotFoundHandler(async (request, reply) => {
    if (isApiRoute(request.url)) {
      return reply.code(404).send({ code: 'NOT_FOUND', message: 'Route not found' });
    }
    return reply.code(404).send({
      code: 'DEV_MODE',
      message: 'Run web dev server separately in development mode',
    });
  });
}
