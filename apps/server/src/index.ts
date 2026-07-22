import { buildApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);

const app = buildApp();

app
  .listen({ port: PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`SOPscape server listening on :${PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
