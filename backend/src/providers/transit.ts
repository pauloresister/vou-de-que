import { decode } from '@here/flexpolyline';
import { config, hasHere } from '../config.js';
import { downsample, haversineM } from '../lib/geo.js';
import { getJson } from '../lib/http.js';
import { isPeak } from '../lib/time.js';
import type { Coord, DataSource, LatLng, TransitLeg, TransitMode } from '../types.js';

export interface TransitRoute {
  durationMin: number;
  walkMin: number;
  waitMin: number;
  inVehicleMin: number;
  transfers: number;
  legs: TransitLeg[];
  polyline: Coord[];
  source: DataSource;
  provider: string;
}

export interface Fares {
  bus: number;
  rail: number;
  integrated: number;
}

interface HereTransitSection {
  type: 'pedestrian' | 'transit' | string;
  departure: { time: string; place?: { name?: string } };
  arrival: { time: string; place?: { name?: string } };
  polyline?: string;
  travelSummary?: { duration: number; length?: number };
  transport?: { mode: string; name?: string; shortName?: string; headsign?: string; color?: string };
}
interface HereTransitResponse {
  routes?: Array<{ sections: HereTransitSection[] }>;
}

export function mapMode(hereMode: string): TransitMode {
  switch (hereMode) {
    case 'pedestrian':
      return 'walk';
    case 'bus':
    case 'privateBus':
    case 'busRapid':
      return 'bus';
    case 'subway':
    case 'monorail':
      return 'subway';
    case 'lightRail':
      return 'tram';
    case 'ferry':
      return 'ferry';
    case 'regionalTrain':
    case 'cityTrain':
    case 'intercityTrain':
    case 'interRegionalTrain':
    case 'highSpeedTrain':
      return 'train';
    default:
      return 'other';
  }
}

const minutes = (ms: number) => ms / 60_000;

export function parseHereRoute(sections: HereTransitSection[], now: number): TransitRoute {
  let walkMin = 0;
  let inVehicleMin = 0;
  const legs: TransitLeg[] = [];
  const points: Coord[] = [];

  for (const s of sections) {
    const dur =
      s.travelSummary?.duration != null
        ? s.travelSummary.duration / 60
        : minutes(Date.parse(s.arrival.time) - Date.parse(s.departure.time));
    const mode = s.type === 'pedestrian' ? 'walk' : mapMode(s.transport?.mode ?? 'other');
    if (mode === 'walk') walkMin += dur;
    else inVehicleMin += dur;
    if (dur >= 0.5 || mode !== 'walk') {
      legs.push({
        mode,
        line: s.transport?.shortName ?? s.transport?.name,
        headsign: s.transport?.headsign,
        color: s.transport?.color,
        durationMin: Math.max(1, Math.round(dur)),
        fromName: s.departure.place?.name,
        toName: s.arrival.place?.name,
        departure: s.departure.time,
      });
    }
    if (s.polyline) for (const p of decode(s.polyline).polyline) points.push([p[0], p[1]]);
  }

  const arrival = Date.parse(sections[sections.length - 1].arrival.time);
  const durationMin = Math.max(1, minutes(arrival - now));
  const vehicleLegs = legs.filter((l) => l.mode !== 'walk').length;
  return {
    durationMin,
    walkMin,
    inVehicleMin,
    waitMin: Math.max(0, durationMin - walkMin - inVehicleMin),
    transfers: Math.max(0, vehicleLegs - 1),
    legs,
    polyline: downsample(points),
    source: 'tempo_real',
    provider: 'HERE Public Transit',
  };
}

/**
 * HERE Public Transit v8: paradas próximas, linhas ativas, horários e (onde a operadora fornece) tempo real.
 * Pede alternativas e escolhe a que chega primeiro saindo agora.
 */
async function hereTransit(o: LatLng, d: LatLng): Promise<TransitRoute | null> {
  const url = new URL('https://transit.router.hereapi.com/v8/routes');
  url.searchParams.set('origin', `${o.lat},${o.lng}`);
  url.searchParams.set('destination', `${d.lat},${d.lng}`);
  url.searchParams.set('return', 'polyline,travelSummary');
  url.searchParams.set('alternatives', '3');
  url.searchParams.set('lang', 'pt-BR');
  url.searchParams.set('apiKey', config.hereApiKey);
  const data = await getJson<HereTransitResponse>(url.toString(), 'HERE Transit');
  const now = Date.now();
  const candidates = (data.routes ?? [])
    .filter((r) => r.sections?.some((s) => s.type === 'transit'))
    .map((r) => parseHereRoute(r.sections, now));
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => a.durationMin - b.durationMin)[0];
}

/**
 * Estimativa usada sem chave HERE ou quando a API falha.
 * Velocidades médias de ônibus urbano em SP ficam entre 14 e 20 km/h conforme o horário.
 */
export function estimateTransit(o: LatLng, d: LatLng, roadKm?: number, date = new Date()): TransitRoute {
  const km = roadKm ?? (haversineM(o, d) / 1000) * 1.3;
  const peak = isPeak(date);
  const speedKmh = peak ? 14 : 19;
  const walkMin = km > 12 ? 12 : 9;
  const waitMin = peak ? 7 : 11;
  const inVehicleMin = Math.max(4, (km * 1.08 * 60) / speedKmh);
  return {
    durationMin: walkMin + waitMin + inVehicleMin,
    walkMin,
    waitMin,
    inVehicleMin,
    transfers: km > 12 ? 1 : 0,
    legs: [
      { mode: 'walk', durationMin: Math.round(walkMin / 2) },
      { mode: 'bus', durationMin: Math.round(inVehicleMin) },
      { mode: 'walk', durationMin: Math.round(walkMin / 2) },
    ],
    polyline: [],
    source: 'estimado',
    provider: 'Estimativa por distância e horário',
  };
}

export async function routeTransit(o: LatLng, d: LatLng): Promise<TransitRoute | null> {
  if (!hasHere()) return null;
  try {
    return await hereTransit(o, d);
  } catch {
    return null;
  }
}

/**
 * Regra de tarifa no estilo Bilhete Único de SP:
 * só ônibus = 1 tarifa (até 4 ônibus em 3h); só trilhos = 1 tarifa; ônibus + trilhos = tarifa de integração.
 */
export function fareFor(legs: TransitLeg[], fares: Fares): { cost: number; rule: string } {
  const hasBus = legs.some((l) => l.mode === 'bus');
  const hasRail = legs.some((l) => l.mode === 'subway' || l.mode === 'train' || l.mode === 'tram');
  if (hasBus && hasRail) return { cost: fares.integrated, rule: 'Integração ônibus + trilhos' };
  if (hasRail) return { cost: fares.rail, rule: 'Tarifa de metrô/trem' };
  return { cost: fares.bus, rule: 'Tarifa de ônibus' };
}

/** Rótulo amigável do modo principal (o de maior tempo a bordo). */
export function modeLabel(legs: TransitLeg[]): string {
  const ride = legs.filter((l) => l.mode !== 'walk');
  const kinds = new Set(ride.map((l) => l.mode));
  if (kinds.size > 1) return 'transporte público';
  const labels: Record<string, string> = {
    bus: 'ônibus',
    subway: 'metrô',
    train: 'trem',
    tram: 'VLT',
    ferry: 'barca',
  };
  return labels[ride[0]?.mode ?? 'bus'] ?? 'transporte público';
}
