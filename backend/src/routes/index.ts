import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hasHere } from '../config.js';
import { haversineM } from '../lib/geo.js';
import { UpstreamError } from '../lib/http.js';
import { reverseGeocode, searchPlaces } from '../providers/geocoding.js';
import { referencePrices } from '../providers/pricing.js';
import { AlertError, type AlertStore } from '../services/alerts.js';
import { compareTrip } from '../services/compare.js';
import type { AlertHub } from '../services/hub.js';
import { compareSchema, firstIssue, nearQuerySchema, newAlertSchema, pointSchema, searchQuerySchema } from './schemas.js';

export async function registerRoutes(app: FastifyInstance, deps: { store: AlertStore; hub: AlertHub }) {
  const { store, hub } = deps;

  app.get('/health', async () => ({
    ok: true,
    mode: hasHere() ? 'tempo_real' : 'estimado',
    liveClients: hub.size,
    time: new Date().toISOString(),
  }));

  app.get('/v1/places/search', async (req, reply) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: firstIssue(parsed.error) });
    const { q, lat, lng } = parsed.data;
    const near = lat != null && lng != null ? { lat, lng } : undefined;
    return { places: await searchPlaces(q, near) };
  });

  app.get('/v1/places/reverse', async (req, reply) => {
    const parsed = pointSchema.safeParse({
      lat: Number((req.query as Record<string, string>).lat),
      lng: Number((req.query as Record<string, string>).lng),
    });
    if (!parsed.success) return reply.code(400).send({ error: 'Coordenadas inválidas.' });
    return { place: await reverseGeocode(parsed.data) };
  });

  app.get('/v1/reference/prices', async (req) => {
    const { uf } = z.object({ uf: z.string().max(2).optional() }).parse(req.query);
    return referencePrices(uf);
  });

  app.post('/v1/compare', async (req, reply) => {
    const parsed = compareSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: firstIssue(parsed.error) });
    if (haversineM(parsed.data.origin, parsed.data.destination) < 100) {
      return reply.code(400).send({ error: 'Origem e destino estão no mesmo lugar. Escolha um destino diferente.' });
    }
    return compareTrip(parsed.data, store);
  });

  app.get('/v1/alerts', async (req, reply) => {
    const parsed = nearQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: firstIssue(parsed.error) });
    const { lat, lng, radiusKm } = parsed.data;
    return { alerts: store.listNear({ lat, lng }, radiusKm) };
  });

  app.post('/v1/alerts', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = newAlertSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: firstIssue(parsed.error) });
    const alert = store.create(parsed.data);
    hub.broadcast({ type: 'alert.created', alert });
    return reply.code(201).send({ alert });
  });

  app.post('/v1/alerts/:id/confirm', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({ deviceId: z.string().min(8).max(64) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Aparelho não identificado.' });
    const alert = store.confirm(id, body.data.deviceId);
    hub.broadcast({ type: 'alert.updated', alert });
    return { alert };
  });

  app.get('/v1/alerts/stream', { websocket: true }, (socket) => {
    hub.add(socket);
    socket.send(JSON.stringify({ type: 'hello', at: new Date().toISOString() }));
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AlertError) return reply.code(err.statusCode).send({ error: err.message });
    if (err instanceof UpstreamError) {
      return reply.code(502).send({ error: `Serviço de mapas indisponível no momento (${err.service}). Tente de novo.` });
    }
    if (err instanceof z.ZodError) return reply.code(400).send({ error: firstIssue(err) });
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) return reply.code(429).send({ error: 'Muitas requisições. Aguarde um instante.' });
    app.log.error(err);
    return reply.code(500).send({ error: 'Erro inesperado no servidor.' });
  });
}
