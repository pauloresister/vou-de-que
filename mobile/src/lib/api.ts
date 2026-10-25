import { useSettings } from '@/store/settings';
import { ApiError, friendlyError, NOT_CONFIGURED } from './errors';
import { functionHeaders, isConfigured, SUPABASE_URL, supabase } from './supabase';
import type { Alert, AlertKind, CompareResult, CrowdLevel, IncidentType, Place, ReferencePrices } from './types';

export { ApiError } from './errors';

const FUNCTION_BASE = `${SUPABASE_URL}/functions/v1/api`;

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  if (!isConfigured) throw new ApiError(NOT_CONFIGURED);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? 25_000);
  const outer = init?.signal;
  outer?.addEventListener('abort', () => controller.abort());
  try {
    const res = await fetch(`${FUNCTION_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...functionHeaders(), ...(init?.headers ?? {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(friendlyError(body?.error ?? body?.message ?? `Erro ${res.status} no servidor.`));
    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === 'AbortError') {
      if (outer?.aborted) throw err;
      throw new ApiError('O servidor demorou para responder. Verifique sua conexão e tente de novo.');
    }
    throw new ApiError(friendlyError((err as Error).message));
  } finally {
    clearTimeout(timer);
  }
}

/** Linha da tabela "alerts" do banco (snake_case). */
export interface AlertRow {
  id: string;
  kind: AlertKind;
  crowd_level: CrowdLevel | null;
  incident_type: IncidentType | null;
  line: string | null;
  lat: number;
  lng: number;
  note: string | null;
  created_at: string;
  expires_at: string;
  confirmations: number;
}

export const rowToAlert = (r: AlertRow): Alert => ({
  id: r.id,
  kind: r.kind,
  crowdLevel: r.crowd_level ?? undefined,
  incidentType: r.incident_type ?? undefined,
  line: r.line ?? undefined,
  lat: r.lat,
  lng: r.lng,
  note: r.note ?? undefined,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  confirmations: r.confirmations,
});

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await supabase().rpc(fn, args);
    if (error) throw new ApiError(friendlyError(error.message));
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(friendlyError((err as Error).message));
  }
}

export const api = {
  searchPlaces(q: string, near?: { lat: number; lng: number }, signal?: AbortSignal) {
    let query = `q=${encodeURIComponent(q)}`;
    if (near) query += `&lat=${near.lat}&lng=${near.lng}`;
    return request<{ places: Place[] }>(`/places/search?${query}`, { signal, timeoutMs: 10_000 });
  },

  reverse(lat: number, lng: number) {
    return request<{ place: Place | null }>(`/places/reverse?lat=${lat}&lng=${lng}`, { timeoutMs: 10_000 });
  },

  compare(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) {
    const s = useSettings.getState();
    return request<CompareResult>('/compare', {
      method: 'POST',
      body: JSON.stringify({
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        vehicle: { consumptionKmL: s.consumptionKmL, fuelPrice: s.fuelPrices[s.fuelType], parkingCost: s.parkingCost },
        fares: s.fares,
        valueOfTimePerHour: s.valueOfTimePerHour,
      }),
    });
  },

  referencePrices(uf: string) {
    return request<ReferencePrices>(`/reference/prices?uf=${encodeURIComponent(uf)}`);
  },

  async alertsNear(lat: number, lng: number, radiusKm = 10) {
    const rows = await rpc<AlertRow[]>('alerts_near', { p_lat: lat, p_lng: lng, p_radius_km: radiusKm });
    return { alerts: (rows ?? []).map(rowToAlert) };
  },

  async createAlert(input: {
    kind: AlertKind;
    crowdLevel?: CrowdLevel;
    incidentType?: IncidentType;
    line?: string;
    note?: string;
    lat: number;
    lng: number;
  }) {
    const row = await rpc<AlertRow>('create_alert', {
      p_kind: input.kind,
      p_lat: input.lat,
      p_lng: input.lng,
      p_device_id: useSettings.getState().deviceId,
      p_crowd_level: input.crowdLevel ?? null,
      p_incident_type: input.incidentType ?? null,
      p_line: input.line ?? null,
      p_note: input.note ?? null,
    });
    return { alert: rowToAlert(row) };
  },

  async confirmAlert(id: string) {
    const row = await rpc<AlertRow>('confirm_alert', { p_alert_id: id, p_device_id: useSettings.getState().deviceId });
    return { alert: rowToAlert(row) };
  },
};
