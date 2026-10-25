import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import { config } from './config.js';
import { registerRoutes } from './routes/index.js';
import { AlertStore } from './services/alerts.js';
import { AlertHub } from './services/hub.js';

export async function buildApp(opts: { dbPath?: string; logger?: boolean } = {}) {
  const app = Fastify({
    logger: opts.logger === false ? false : { level: config.logLevel },
    trustProxy: true,
  });
  const store = new AlertStore(opts.dbPath ?? config.dbPath);
  const hub = new AlertHub();

  await app.register(cors, { origin: config.corsOrigin });
  await app.register(rateLimit, { global: true, max: 120, timeWindow: '1 minute' });
  await app.register(websocket);
  await registerRoutes(app, { store, hub });

  // Limpa alertas vencidos a cada minuto e avisa os aparelhos conectados.
  const sweeper = setInterval(() => {
    const ids = store.purgeExpired();
    if (ids.length) hub.broadcast({ type: 'alert.expired', ids });
  }, 60_000);
  sweeper.unref();

  app.addHook('onClose', async () => {
    clearInterval(sweeper);
    hub.close();
    store.close();
  });

  return { app, store, hub };
}
