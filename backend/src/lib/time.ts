import { config } from '../config.js';

/** Hora local (0–23) e se é dia útil, no fuso da cidade configurada. */
export function localClock(date = new Date()): { hour: number; minute: number; weekday: boolean } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  const weekday = !['Sat', 'Sun'].includes(get('weekday'));
  return { hour, minute, weekday };
}

/** Faixas de pico típicas de grandes cidades brasileiras. */
export function isPeak(date = new Date()): boolean {
  const { hour, minute, weekday } = localClock(date);
  if (!weekday) return false;
  const t = hour + minute / 60;
  return (t >= 6.5 && t < 9.5) || (t >= 17 && t < 20);
}
