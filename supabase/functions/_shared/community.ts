import { boundingBox, distanceToPolylineM } from './geo.ts';
import { lineKey, sameLine } from './format.ts';
import type { Alert, AlertSource, Coord, CrowdInfo, CrowdLevel, LatLng, TransitLeg } from './types.ts';

const CROWD_SCORE: Record<CrowdLevel, number> = { vazio: 0, moderado: 1, lotado: 2 };
const SCORE_TO_LEVEL: CrowdLevel[] = ['vazio', 'moderado', 'lotado'];

/** Raio para considerar que uma ocorrência está "no caminho" do carro. */
export const INCIDENT_RADIUS_M = 250;
export const INCIDENT_DELAY_MIN = { acidente: 8, transito_parado: 5 } as const;
export const LINE_DELAY_MIN = 5;
const MAX_CAR_DELAY_MIN = 20;
const MAX_LINE_DELAY_MIN = 15;

/** Agrega relatos de lotação; os mais recentes pesam mais (meia-vida de 7 min) e confirmações reforçam. */
export function aggregateCrowd(reports: Alert[], now = Date.now()): CrowdLevel | null {
  let weighted = 0;
  let total = 0;
  for (const r of reports) {
    if (!r.crowdLevel) continue;
    const ageMin = (now - Date.parse(r.createdAt)) / 60_000;
    const w = Math.pow(0.5, ageMin / 7) * (1 + 0.5 * r.confirmations);
    weighted += CROWD_SCORE[r.crowdLevel] * w;
    total += w;
  }
  if (total === 0) return null;
  return SCORE_TO_LEVEL[Math.round(weighted / total)];
}

/** Cruza as linhas da rota de coletivo com relatos de lotação e de atraso. */
export async function transitCommunity(source: AlertSource, legs: TransitLeg[], now = Date.now()) {
  const lines = legs
    .filter((l) => l.mode !== 'walk' && l.line)
    .map((l) => ({ name: l.line as string, key: lineKey(l.line) }));
  if (lines.length === 0) return { crowding: null as CrowdInfo | null, lineAlerts: [] as Alert[], delayMin: 0 };

  const active = await source.withLines();
  let crowding: CrowdInfo | null = null;
  const lineAlerts: Alert[] = [];
  for (const line of lines) {
    const matches = active.filter((a) => sameLine(a.lineKey, line.key));
    const crowdReports = matches.filter((a) => a.kind === 'lotacao');
    const level = aggregateCrowd(crowdReports, now);
    // Mostra a lotação da linha mais cheia do trajeto: é ela que define o conforto da viagem.
    if (level && (!crowding || CROWD_SCORE[level] > CROWD_SCORE[crowding.level])) {
      crowding = { level, line: line.name, reports: crowdReports.length, lastReportAt: crowdReports[0].createdAt };
    }
    lineAlerts.push(...matches.filter((a) => a.kind === 'ocorrencia' && a.incidentType === 'atraso_linha'));
  }
  return { crowding, lineAlerts, delayMin: Math.min(MAX_LINE_DELAY_MIN, lineAlerts.length * LINE_DELAY_MIN) };
}

/** Ocorrências de via perto da rota de carro. Com trânsito ao vivo, aplica metade do atraso. */
export async function carCommunity(source: AlertSource, polyline: Coord[], liveTraffic: boolean) {
  if (polyline.length === 0) return { incidents: [] as Alert[], delayMin: 0 };
  const lats = polyline.map((p) => p[0]);
  const lngs = polyline.map((p) => p[1]);
  const center: LatLng = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
  const spanKm = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs)) * 111;
  const candidates = await source.incidentsInBox(boundingBox(center, spanKm / 2 + 1));
  const incidents = candidates.filter((a) => distanceToPolylineM(a, polyline) <= INCIDENT_RADIUS_M);
  const raw = incidents.reduce(
    (sum, a) => sum + (a.incidentType === 'acidente' ? INCIDENT_DELAY_MIN.acidente : INCIDENT_DELAY_MIN.transito_parado),
    0,
  );
  return { incidents, delayMin: Math.min(MAX_CAR_DELAY_MIN, raw * (liveTraffic ? 0.5 : 1)) };
}
