import type { Coord, LatLng } from '../types.js';

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Menor distância (m) entre um ponto e uma polilinha.
 * Projeta localmente em metros (equiretangular), precisão suficiente para raios urbanos.
 */
export function distanceToPolylineM(p: LatLng, line: Coord[]): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return haversineM(p, { lat: line[0][0], lng: line[0][1] });
  const kx = Math.cos(toRad(p.lat)) * 111_320;
  const ky = 110_540;
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i][1] - p.lng) * kx;
    const ay = (line[i][0] - p.lat) * ky;
    const bx = (line[i + 1][1] - p.lng) * kx;
    const by = (line[i + 1][0] - p.lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    best = Math.min(best, Math.hypot(cx, cy));
  }
  return best;
}

/** Reduz a quantidade de pontos mantendo início e fim, para trafegar pouco dado até o celular. */
export function downsample(points: Coord[], maxPoints = 300): Coord[] {
  if (points.length <= maxPoints) return points.map(roundCoord);
  const step = (points.length - 1) / (maxPoints - 1);
  const out: Coord[] = [];
  for (let i = 0; i < maxPoints; i++) out.push(roundCoord(points[Math.round(i * step)]));
  return out;
}

const roundCoord = ([lat, lng]: Coord): Coord => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5];

/** Caixa delimitadora aproximada para consultas por raio. */
export function boundingBox(center: LatLng, radiusKm: number) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.1, Math.cos(toRad(center.lat))));
  return { minLat: center.lat - dLat, maxLat: center.lat + dLat, minLng: center.lng - dLng, maxLng: center.lng + dLng };
}
