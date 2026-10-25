import { getJson, TtlCache } from '../lib/http.js';
import type { LatLng } from '../types.js';

/**
 * Busca de endereços via Photon (komoot), geocodificador gratuito sobre dados do OpenStreetMap.
 * Sem chave, com autocompletar e viés de proximidade.
 */
export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface PhotonResponse {
  features: Array<{
    geometry: { coordinates: [number, number] };
    properties: {
      osm_id?: number;
      osm_type?: string;
      name?: string;
      street?: string;
      housenumber?: string;
      district?: string;
      locality?: string;
      city?: string;
      state?: string;
      countrycode?: string;
    };
  }>;
}

const PHOTON = 'https://photon.komoot.io';
const cache = new TtlCache<Place[]>(5 * 60_000);

function toPlace(f: PhotonResponse['features'][number]): Place {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const streetLine = [p.street, p.housenumber].filter(Boolean).join(', ');
  const name = p.name ?? (streetLine || p.city || 'Local sem nome');
  const address = [p.name ? streetLine : undefined, p.district ?? p.locality, p.city, p.state]
    .filter((s): s is string => Boolean(s) && s !== name)
    .join(', ');
  return { id: `${p.osm_type ?? 'X'}${p.osm_id ?? `${lat},${lng}`}`, name, address, lat, lng };
}

function rankBrazilFirst(features: PhotonResponse['features']) {
  return [...features].sort(
    (a, b) => Number(b.properties.countrycode === 'BR') - Number(a.properties.countrycode === 'BR'),
  );
}

export async function searchPlaces(query: string, near?: LatLng): Promise<Place[]> {
  const q = query.trim();
  const key = `${q.toLowerCase()}|${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ''}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const url = new URL('/api/', PHOTON);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '8');
  if (near) {
    url.searchParams.set('lat', String(near.lat));
    url.searchParams.set('lon', String(near.lng));
  }
  const data = await getJson<PhotonResponse>(url.toString(), 'Photon', 6000);
  const seen = new Set<string>();
  const places = rankBrazilFirst(data.features)
    .map(toPlace)
    .filter((p) => {
      const k = `${p.name}|${p.address}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  cache.set(key, places);
  return places;
}

export async function reverseGeocode(point: LatLng): Promise<Place | null> {
  const url = new URL('/reverse', PHOTON);
  url.searchParams.set('lat', String(point.lat));
  url.searchParams.set('lon', String(point.lng));
  const data = await getJson<PhotonResponse>(url.toString(), 'Photon', 6000);
  const first = data.features[0];
  return first ? { ...toPlace(first), lat: point.lat, lng: point.lng } : null;
}
