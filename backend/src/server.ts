import { buildApp } from './app.js';
import { config, hasHere } from './config.js';

const { app } = await buildApp();

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    hasHere()
      ? 'Modo tempo real: HERE Traffic + HERE Public Transit ativos.'
      : 'Modo estimado: defina HERE_API_KEY para trânsito e transporte público em tempo real.',
  );
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
