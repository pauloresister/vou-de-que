import { config, hasTomTom } from './config.ts';
import { downsample } from './geo.ts';
import { getJson } from './http.ts';
import { isPeak, localClock } from './time.ts';
import type { Coord, DataSource, LatLng } from './types.ts';

export interface CarRoute {
  distanceKm: number;
  durationMin: number;
  freeFlowMin: number;
  polyline: Coord[];
  source: DataSource;
  provider: string;
}

export interface TomTomResponse {
  routes?: Array<{
    summary: {
      lengthInMeters: number;
      travelTimeInSeconds: number;
      trafficDelayInSeconds?: number;
      noTrafficTravelTimeInSeconds?: number;
    };
    legs: Array<{ points: Array<{ latitude: number; longitude: number }> }>;
  }>;
}

export function parseTomTom(data: TomTomResponse): CarRoute {
  const route = data.routes?.[0];
  if (!route) throw new Error('TomTom não encontrou rota de carro');
  const s = route.summary;
  const freeFlowSec = s.noTrafficTravelTimeInSeconds ?? s.travelTimeInSeconds - (s.trafficDelayInSeconds ?? 0);
  const points: Coord[] = route.legs.flatMap((leg) => leg.points.map((p) => [p.latitude, p.longitude] as Coord));
  return {
    distanceKm: s.lengthInMeters / 1000,
    durationMin: s.travelTimeInSeconds / 60,
    freeFlowMin: Math.max(1, freeFlowSec) / 60,
    polyline: downsample(points),
    source: 'tempo_real',
    provider: 'TomTom Traffic',
  };
}

/**
 * TomTom Routing API: rota de carro com trânsito ao vivo.
 * Plano Freemium: 2.500 requisições por dia, sem cartão de crédito. Acima disso a API apenas recusa
 * (não há cobrança possível sem cartão cadastrado) e o app passa para o modo estimado.
 */
async function tomtomCar(o: LatLng, d: LatLng): Promise<CarRoute> {
  const url = new URL(`https://api.tomtom.com/routing/1/calculateRoute/${o.lat},${o.lng}:${d.lat},${d.lng}/json`);
  url.searchParams.set('key', config.tomtomKey);
  url.searchParams.set('traffic', 'true');
  url.searchParams.set('travelMode', 'car');
  url.searchParams.set('routeType', 'fastest');
  url.searchParams.set('computeTravelTimeFor', 'all');
  url.searchParams.set('routeRepresentation', 'polyline');
  return parseTomTom(await getJson<TomTomResponse>(url.toString(), 'TomTom'));
}

/** Fator de congestionamento por horário, usado só no modo estimado. */
export function estimatedTrafficFactor(date = new Date()): number {
  const { hour, weekday } = localClock(date);
  if (isPeak(date)) return 1.65;
  if (!weekday) return hour >= 10 && hour < 20 ? 1.2 : 1.05;
  if (hour >= 10 && hour < 17) return 1.3;
  if (hour >= 20 && hour < 23) return 1.15;
  return 1.05;
}

interface OsrmResponse {
  code: string;
  routes: Array<{ distance: number; duration: number; geometry: { coordinates: [number, number][] } }>;
}

/** OSRM público (OpenStreetMap): distância e trajeto exatos, tempo sem trânsito ajustado pelo horário. */
async function osrmCar(o: LatLng, d: LatLng): Promise<CarRoute> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}` +
    '?overview=simplified&geometries=geojson';
  const data = await getJson<OsrmResponse>(url, 'OSRM');
  const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route) throw new Error('OSRM não encontrou rota de carro');
  const freeFlowMin = route.duration / 60;
  return {
    distanceKm: route.distance / 1000,
    durationMin: freeFlowMin * estimatedTrafficFactor(),
    freeFlowMin,
    polyline: downsample(route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as Coord)),
    source: 'estimado',
    provider: 'OpenStreetMap (OSRM), tempo estimado pelo horário',
  };
}

export async function routeCar(o: LatLng, d: LatLng): Promise<CarRoute> {
  if (hasTomTom()) {
    try {
      return await tomtomCar(o, d);
    } catch {
      // Cota do dia esgotada ou instabilidade: segue com a estimativa em vez de falhar.
    }
  }
  return osrmCar(o, d);
}
