import { config } from './config.ts';
import { decodePolyline, downsample, haversineM } from './geo.ts';
import { getJson, UpstreamError } from './http.ts';
import { isPeak } from './time.ts';
import type { Coord, DataSource, LatLng, TransitLeg, TransitMode } from './types.ts';

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

/** Recorte da resposta do MOTIS (motor do Transitous), conforme a especificação OpenAPI oficial. */
export interface MotisLeg {
  mode: string;
  startTime: string;
  endTime: string;
  duration: number;
  realTime?: boolean;
  headsign?: string;
  routeShortName?: string;
  displayName?: string;
  routeColor?: string;
  from: { name: string; departure?: string };
  to: { name: string; arrival?: string };
  legGeometry?: { points: string; precision: number };
}
export interface MotisPlan {
  itineraries?: Array<{ duration: number; startTime: string; endTime: string; transfers: number; legs: MotisLeg[] }>;
}

export function mapMotisMode(mode: string): TransitMode {
  switch (mode) {
    case 'WALK':
      return 'walk';
    case 'BUS':
    case 'COACH':
      return 'bus';
    case 'SUBWAY':
    case 'METRO':
      return 'subway';
    case 'TRAM':
    case 'CABLE_CAR':
      return 'tram';
    case 'FERRY':
      return 'ferry';
    case 'RAIL':
    case 'SUBURBAN':
    case 'REGIONAL_RAIL':
    case 'REGIONAL_FAST_RAIL':
    case 'HIGHSPEED_RAIL':
    case 'LONG_DISTANCE':
    case 'NIGHT_RAIL':
      return 'train';
    default:
      return 'other';
  }
}

const minutesBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60_000;

/** Converte um itinerário do MOTIS em caminhada + espera + viagem a bordo, contando a partir de agora. */
export function parseMotisItinerary(legsIn: MotisLeg[], now: number): TransitRoute {
  let walkMin = 0;
  let inVehicleMin = 0;
  let anyRealTime = false;
  const legs: TransitLeg[] = [];
  const points: Coord[] = [];

  for (const l of legsIn) {
    const mode = mapMotisMode(l.mode);
    const dur = l.duration > 0 ? l.duration / 60 : Math.max(0, minutesBetween(l.startTime, l.endTime));
    if (mode === 'walk') walkMin += dur;
    else inVehicleMin += dur;
    if (l.realTime) anyRealTime = true;
    if (dur >= 0.5 || mode !== 'walk') {
      legs.push({
        mode,
        line: mode === 'walk' ? undefined : l.routeShortName || l.displayName || undefined,
        headsign: l.headsign || undefined,
        color: l.routeColor ? `#${l.routeColor.replace(/^#/, '')}` : undefined,
        durationMin: Math.max(1, Math.round(dur)),
        fromName: l.from?.name,
        toName: l.to?.name,
        departure: l.startTime,
        realTime: l.realTime,
      });
    }
    if (l.legGeometry?.points) points.push(...decodePolyline(l.legGeometry.points, l.legGeometry.precision ?? 6));
  }

  const arrival = Date.parse(legsIn[legsIn.length - 1].endTime);
  const durationMin = Math.max(1, (arrival - now) / 60_000);
  const rides = legs.filter((l) => l.mode !== 'walk').length;
  return {
    durationMin,
    walkMin,
    inVehicleMin,
    waitMin: Math.max(0, durationMin - walkMin - inVehicleMin),
    transfers: Math.max(0, rides - 1),
    legs,
    polyline: downsample(points),
    source: anyRealTime ? 'tempo_real' : 'horario',
    provider: anyRealTime ? 'Transitous (horários em tempo real)' : 'Transitous (horários oficiais GTFS)',
  };
}

/** Escolhe o itinerário que chega primeiro saindo agora; ignora os que são só caminhada. */
export function bestItinerary(plan: MotisPlan, now: number): TransitRoute | null {
  const options = (plan.itineraries ?? [])
    .filter((it) => it.legs?.some((l) => mapMotisMode(l.mode) !== 'walk'))
    .map((it) => parseMotisItinerary(it.legs, now));
  if (options.length === 0) return null;
  return options.sort((a, b) => a.durationMin - b.durationMin)[0];
}

/**
 * Transitous: roteamento de transporte público comunitário, gratuito e sem chave, sobre dados GTFS abertos
 * (inclui a SPTrans). Política: uso não comercial, User-Agent com contato e atribuição visível no app.
 */
async function transitousPlan(o: LatLng, d: LatLng): Promise<MotisPlan> {
  const params = new URLSearchParams({
    fromPlace: `${o.lat},${o.lng}`,
    toPlace: `${d.lat},${d.lng}`,
    time: new Date().toISOString(),
    numItineraries: '4',
    language: 'pt',
  });
  try {
    return await getJson<MotisPlan>(`${config.transitousBase}/api/v6/plan?${params}`, 'Transitous', 12_000);
  } catch (err) {
    // Instâncias com MOTIS mais antigo só têm a versão v5 do endpoint.
    if (err instanceof UpstreamError && err.status === 404) {
      return getJson<MotisPlan>(`${config.transitousBase}/api/v5/plan?${params}`, 'Transitous', 12_000);
    }
    throw err;
  }
}

export async function routeTransit(o: LatLng, d: LatLng): Promise<TransitRoute | null> {
  try {
    return bestItinerary(await transitousPlan(o, d), Date.now());
  } catch {
    return null;
  }
}

/**
 * Estimativa quando não há itinerário publicado (cidade sem dados abertos ou serviço fora do ar).
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

/** Bilhete Único de SP: só ônibus = 1 tarifa; só trilhos = 1 tarifa; ônibus + trilhos = integração. */
export function fareFor(legs: TransitLeg[], fares: Fares): { cost: number; rule: string } {
  const hasBus = legs.some((l) => l.mode === 'bus');
  const hasRail = legs.some((l) => l.mode === 'subway' || l.mode === 'train' || l.mode === 'tram');
  if (hasBus && hasRail) return { cost: fares.integrated, rule: 'Integração ônibus + trilhos' };
  if (hasRail) return { cost: fares.rail, rule: 'Tarifa de metrô/trem' };
  return { cost: fares.bus, rule: 'Tarifa de ônibus' };
}

/** Rótulo amigável do modo usado ("ônibus", "metrô"...). */
export function modeLabel(legs: TransitLeg[]): string {
  const ride = legs.filter((l) => l.mode !== 'walk');
  const kinds = new Set(ride.map((l) => l.mode));
  if (kinds.size > 1) return 'transporte público';
  const labels: Record<string, string> = { bus: 'ônibus', subway: 'metrô', train: 'trem', tram: 'VLT', ferry: 'barca' };
  return labels[ride[0]?.mode ?? 'bus'] ?? 'transporte público';
}
