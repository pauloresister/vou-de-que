import { decode } from '@here/flexpolyline';
import { config, hasHere } from '../config.js';
import { downsample } from '../lib/geo.js';
import { getJson } from '../lib/http.js';
import { isPeak, localClock } from '../lib/time.js';
import type { Coord, DataSource, LatLng } from '../types.js';

export interface CarRoute {
  distanceKm: number;
  durationMin: number;
  freeFlowMin: number;
  polyline: Coord[];
  source: DataSource;
  provider: string;
}

interface HereCarResponse {
  routes: Array<{
    sections: Array<{
      polyline: string;
      summary: { duration: number; length: number; baseDuration?: number };
    }>;
  }>;
}

/** HERE Routing v8: rota de carro com trânsito em tempo real (padrão quando não se informa departureTime). */
async function hereCar(o: LatLng, d: LatLng): Promise<CarRoute> {
  const url = new URL('https://router.hereapi.com/v8/routes');
  url.searchParams.set('transportMode', 'car');
  url.searchParams.set('origin', `${o.lat},${o.lng}`);
  url.searchParams.set('destination', `${d.lat},${d.lng}`);
  url.searchParams.set('return', 'summary,polyline');
  url.searchParams.set('apiKey', config.hereApiKey);
  const data = await getJson<HereCarResponse>(url.toString(), 'HERE Routing');
  const route = data.routes?.[0];
  if (!route) throw new Error('HERE não encontrou rota de carro');

  let seconds = 0;
  let base = 0;
  let meters = 0;
  const points: Coord[] = [];
  for (const s of route.sections) {
    seconds += s.summary.duration;
    base += s.summary.baseDuration ?? s.summary.duration;
    meters += s.summary.length;
    for (const p of decode(s.polyline).polyline) points.push([p[0], p[1]]);
  }
  return {
    distanceKm: meters / 1000,
    durationMin: seconds / 60,
    freeFlowMin: base / 60,
    polyline: downsample(points),
    source: 'tempo_real',
    provider: 'HERE Traffic',
  };
}

interface OsrmResponse {
  code: string;
  routes: Array<{ distance: number; duration: number; geometry: { coordinates: [number, number][] } }>;
}

/**
 * Fator de congestionamento usado apenas no modo estimado (sem chave HERE).
 * Baseado em padrões de horário de pico; o app sinaliza claramente que é uma estimativa.
 */
export function estimatedTrafficFactor(date = new Date()): number {
  const { hour, weekday } = localClock(date);
  if (isPeak(date)) return 1.65;
  if (!weekday) return hour >= 10 && hour < 20 ? 1.2 : 1.05;
  if (hour >= 10 && hour < 17) return 1.3;
  if (hour >= 20 && hour < 23) return 1.15;
  return 1.05;
}

/** OSRM (servidor público do Project OSRM sobre OpenStreetMap): geometria e tempo sem trânsito. */
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
    provider: 'OpenStreetMap (OSRM)',
  };
}

export async function routeCar(o: LatLng, d: LatLng): Promise<CarRoute> {
  if (hasHere()) {
    try {
      return await hereCar(o, d);
    } catch {
      // Cota esgotada ou instabilidade: segue com a rota estimada em vez de falhar.
    }
  }
  return osrmCar(o, d);
}
