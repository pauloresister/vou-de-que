/**
 * Roteador HTTP da Edge Function "api". Separado do ponto de entrada para poder ser testado.
 *
 * Rotas (prefixo https://<projeto>.supabase.co/functions/v1/api):
 *   GET  /health
 *   GET  /places/search?q=&lat=&lng=
 *   GET  /places/reverse?lat=&lng=
 *   GET  /reference/prices?uf=SP
 *   POST /compare
 *
 * Os alertas colaborativos não passam por aqui: o app grava e lê direto no banco
 * (funções SQL com validação) e recebe novidades pelo Realtime do Supabase.
 */
import { supabaseAlertSource } from './alert-source.ts';
import { compareTrip } from './compare.ts';
import { hasTomTom } from './config.ts';
import { reverseGeocode, searchPlaces } from './geocoding.ts';
import { haversineM } from './geo.ts';
import { UpstreamError } from './http.ts';
import { referencePrices } from './pricing.ts';
import { compareSchema, firstIssue, pointQuerySchema, searchSchema } from './schemas.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

const fail = (message: string, status: number) => json({ error: message }, status);

/** Limite simples por IP (melhor esforço, por instância), para proteger a cota gratuita do TomTom. */
const hits = new Map<string, { count: number; reset: number }>();
function rateLimited(ip: string, max = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + windowMs });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  entry.count++;
  return entry.count > max;
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*?\/api(?=\/|$)/, '') || '/';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  if (rateLimited(ip)) return fail('Muitas requisições. Aguarde um instante.', 429);

  try {
    if (req.method === 'GET' && path === '/health') {
      return json({ ok: true, carTraffic: hasTomTom() ? 'tempo_real' : 'estimado', time: new Date().toISOString() });
    }

    if (req.method === 'GET' && path === '/places/search') {
      const parsed = searchSchema.safeParse(Object.fromEntries(url.searchParams));
      if (!parsed.success) return fail(firstIssue(parsed.error), 400);
      const { q, lat, lng } = parsed.data;
      return json({ places: await searchPlaces(q, lat != null && lng != null ? { lat, lng } : undefined) });
    }

    if (req.method === 'GET' && path === '/places/reverse') {
      const parsed = pointQuerySchema.safeParse(Object.fromEntries(url.searchParams));
      if (!parsed.success) return fail('Coordenadas inválidas.', 400);
      return json({ place: await reverseGeocode(parsed.data) });
    }

    if (req.method === 'GET' && path === '/reference/prices') {
      return json(referencePrices(url.searchParams.get('uf')?.slice(0, 2) ?? undefined));
    }

    if (req.method === 'POST' && path === '/compare') {
      const body = await req.json().catch(() => null);
      const parsed = compareSchema.safeParse(body);
      if (!parsed.success) return fail(firstIssue(parsed.error), 400);
      if (haversineM(parsed.data.origin, parsed.data.destination) < 100) {
        return fail('Origem e destino estão no mesmo lugar. Escolha um destino diferente.', 400);
      }
      return json(await compareTrip(parsed.data, supabaseAlertSource()));
    }

    return fail('Rota não encontrada.', 404);
  } catch (err) {
    if (err instanceof UpstreamError) {
      return fail(`Serviço de mapas indisponível no momento (${err.service}). Tente de novo.`, 502);
    }
    console.error(err);
    return fail('Erro inesperado no servidor.', 500);
  }
}

