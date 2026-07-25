import { buildApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
async function start() {
  const app = buildApp();
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`SOPscape server listening on http://${HOST}:${PORT}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
