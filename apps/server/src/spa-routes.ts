// @sopscape/server — SPA static file serving for production
// ponytail: serves built frontend in production, returns index.html for SPA routes.
// Uses Fastify's built-in capabilities; no external dependencies.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIST_PATH = join(__dirname, '../../web/dist');
const INDEX_HTML_PATH = join(WEB_DIST_PATH, 'index.html');

// Security headers for SPA
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.okx.ai;",
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// API route prefixes that should not fall through to SPA
const API_PREFIXES = ['/api/', '/a2mcp/', '/mcp', '/health/'];

function isApiRoute(url: string): boolean {
  return API_PREFIXES.some(prefix => url.startsWith(prefix));
}

export function registerSpaRoutes(app: FastifyInstance): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const webDistExists = existsSync(WEB_DIST_PATH);

  if (isProduction && webDistExists) {
    // Serve static files from web/dist using Fastify's built-in capabilities
    // For full static file serving, use @fastify/static plugin
    // This is a minimal implementation for SPA fallback

    // SPA fallback: return index.html for unknown routes
    app.setNotFoundHandler(async (request, reply) => {
      // Don't fallback for API routes
      if (isApiRoute(request.url)) {
        return reply.code(404).send({ code: 'NOT_FOUND', message: 'Route not found' });
      }

      // Return index.html for SPA routes
      if (existsSync(INDEX_HTML_PATH)) {
        const indexHtml = readFileSync(INDEX_HTML_PATH, 'utf-8');
        return reply
          .type('text/html')
          .headers(SECURITY_HEADERS)
          .send(indexHtml);
      }

      return reply.code(500).send({ code: 'SERVER_ERROR', message: 'Frontend build not found' });
    });

    // Add security headers to all responses
    app.addHook('onSend', async (request, reply, payload) => {
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        if (!reply.hasHeader(key)) {
          reply.header(key, value);
        }
      }
      return payload;
    });
  } else {
    // Development mode: just set security headers
    app.addHook('onSend', async (request, reply, payload) => {
      if (reply.getHeader('Content-Type')?.toString().includes('text/html')) {
        for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
          if (!reply.hasHeader(key)) {
            reply.header(key, value);
          }
        }
      }
      return payload;
    });

    // Development fallback for SPA routes
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
}
