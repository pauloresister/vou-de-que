/** Formatação manual em pt-BR: resultado idêntico em qualquer motor JavaScript do celular. */
export function brl(value: number): string {
  const [int, dec] = Math.abs(value).toFixed(2).split('.');
  return `${value < 0 ? '-' : ''}R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

export function decimal(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',');
}

/** "1 h 05" ou "42 min". */
export function duration(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${String(rest).padStart(2, '0')}`;
}

export function distance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${decimal(meters / 1000)} km`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.round((now - Date.parse(iso)) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)} h`;
}

export function clock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Aceita "6,53" ou "6.53". */
export function parseDecimal(text: string): number | null {
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
