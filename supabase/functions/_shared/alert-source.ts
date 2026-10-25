import { config } from './config.ts';
import type { Alert, AlertSource, AlertWithKey } from './types.ts';

interface Row {
  id: string;
  kind: Alert['kind'];
  crowd_level: Alert['crowdLevel'] | null;
  incident_type: Alert['incidentType'] | null;
  line: string | null;
  line_key: string | null;
  lat: number;
  lng: number;
  note: string | null;
  created_at: string;
  expires_at: string;
  confirmations: number;
}

const COLUMNS = 'id,kind,crowd_level,incident_type,line,line_key,lat,lng,note,created_at,expires_at,confirmations';

export const rowToAlert = (r: Row): AlertWithKey => ({
  id: r.id,
  kind: r.kind,
  crowdLevel: r.crowd_level ?? undefined,
  incidentType: r.incident_type ?? undefined,
  line: r.line ?? undefined,
  lineKey: r.line_key ?? '',
  lat: r.lat,
  lng: r.lng,
  note: r.note ?? undefined,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  confirmations: r.confirmations,
});

/** Lê alertas ativos do banco do Supabase pela API REST (PostgREST), sem dependências extras. */
export function supabaseAlertSource(): AlertSource {
  const query = async (filters: string): Promise<AlertWithKey[]> => {
    if (!config.supabaseUrl || !config.supabaseKey) return [];
    const key = config.supabaseKey;
    const headers: Record<string, string> = { apikey: key, Accept: 'application/json' };
    // Chaves legadas são JWT; as novas (sb_...) vão só no cabeçalho apikey.
    if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
    const now = new Date().toISOString();
    const url = `${config.supabaseUrl}/rest/v1/alerts?select=${COLUMNS}&expires_at=gt.${encodeURIComponent(now)}&${filters}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      await res.body?.cancel();
      return [];
    }
    return ((await res.json()) as Row[]).map(rowToAlert);
  };

  return {
    withLines: () => query('line_key=not.is.null&order=created_at.desc&limit=500'),
    incidentsInBox: (b) =>
      query(
        `kind=eq.ocorrencia&incident_type=in.(transito_parado,acidente)` +
          `&lat=gte.${b.minLat}&lat=lte.${b.maxLat}&lng=gte.${b.minLng}&lng=lte.${b.maxLng}&limit=300`,
      ),
  };
}
