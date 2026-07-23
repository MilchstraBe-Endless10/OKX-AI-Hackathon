import { readFileSync } from 'node:fs';
import { buildApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const USE_HTTPS = process.env.USE_HTTPS === 'true';

const app = buildApp();

async function start() {
  if (USE_HTTPS) {
    const certPath = process.env.SSL_CERT_PATH;
    const keyPath = process.env.SSL_KEY_PATH;
    if (!certPath || !keyPath) {
      app.log.error('SSL_CERT_PATH and SSL_KEY_PATH required when USE_HTTPS=true');
      process.exit(1);
    }

    const https = await import('node:https');
    const fastify = await import('fastify');

    const server = https.createServer(
      {
        cert: readFileSync(certPath),
        key: readFileSync(keyPath),
      },
      app.server,
    );

    await app.ready();

    server.listen(PORT, HOST, () => {
      app.log.info(`SOPscape server listening on https://${HOST}:${PORT}`);
    });
  } else {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`SOPscape server listening on http://${HOST}:${PORT}`);
  }
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
