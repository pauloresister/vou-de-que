import { boundingBox, distanceToPolylineM } from '../lib/geo.js';
import { lineKey, sameLine } from '../lib/format.js';
import type { Alert, Coord, CrowdInfo, CrowdLevel, LatLng, TransitLeg } from '../types.js';
import type { AlertStore } from './alerts.js';

const CROWD_SCORE: Record<CrowdLevel, number> = { vazio: 0, moderado: 1, lotado: 2 };
const SCORE_TO_LEVEL: CrowdLevel[] = ['vazio', 'moderado', 'lotado'];

/** Raio para considerar que uma ocorrência está "no caminho" do carro. */
export const INCIDENT_RADIUS_M = 250;
/** Atraso estimado por ocorrência reportada, em minutos. */
export const INCIDENT_DELAY_MIN = { acidente: 8, transito_parado: 5 } as const;
export const LINE_DELAY_MIN = 5;
const MAX_CAR_DELAY_MIN = 20;
const MAX_LINE_DELAY_MIN = 15;

/**
 * Agrega relatos de lotação com peso maior para os mais recentes (meia-vida de 7 min).
 * Ex.: um "lotado" de agora pesa mais que dois "vazio" de 25 min atrás.
 */
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

/** Cruza as linhas da rota com relatos de lotação e de atraso. */
export function transitCommunity(store: AlertStore, legs: TransitLeg[], now = Date.now()) {
  const lines = legs
    .filter((l) => l.mode !== 'walk' && l.line)
    .map((l) => ({ name: l.line as string, key: lineKey(l.line) }));
  if (lines.length === 0) return { crowding: null as CrowdInfo | null, lineAlerts: [] as Alert[], delayMin: 0 };

  const active = store.listWithLines(now);
  let crowding: CrowdInfo | null = null;
  const lineAlerts: Alert[] = [];

  for (const line of lines) {
    const matches = active.filter((a) => sameLine(a.lineKey, line.key));
    const crowdReports = matches.filter((a) => a.kind === 'lotacao');
    const level = aggregateCrowd(crowdReports, now);
    // Mostra a lotação da linha mais cheia do trajeto: é a que define o conforto da viagem.
    if (level && (!crowding || CROWD_SCORE[level] > CROWD_SCORE[crowding.level])) {
      crowding = {
        level,
        line: line.name,
        reports: crowdReports.length,
        lastReportAt: crowdReports[0].createdAt,
      };
    }
    lineAlerts.push(...matches.filter((a) => a.kind === 'ocorrencia' && a.incidentType === 'atraso_linha'));
  }
  const delayMin = Math.min(MAX_LINE_DELAY_MIN, lineAlerts.length * LINE_DELAY_MIN);
  return { crowding, lineAlerts, delayMin };
}

/**
 * Ocorrências de via perto da rota de carro.
 * Com trânsito em tempo real, metade do atraso é aplicada (o provedor já capta parte do efeito).
 */
export function carCommunity(store: AlertStore, polyline: Coord[], liveTraffic: boolean, now = Date.now()) {
  if (polyline.length === 0) return { incidents: [] as Alert[], delayMin: 0 };
  const lats = polyline.map((p) => p[0]);
  const lngs = polyline.map((p) => p[1]);
  const center: LatLng = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
  const spanKm = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs)) * 111;
  const box = boundingBox(center, spanKm / 2 + 1);
  const incidents = store
    .listIncidentsInBox(box, now)
    .filter((a) => distanceToPolylineM(a, polyline) <= INCIDENT_RADIUS_M);
  const raw = incidents.reduce(
    (sum, a) => sum + (a.incidentType === 'acidente' ? INCIDENT_DELAY_MIN.acidente : INCIDENT_DELAY_MIN.transito_parado),
    0,
  );
  const delayMin = Math.min(MAX_CAR_DELAY_MIN, raw * (liveTraffic ? 0.5 : 1));
  return { incidents, delayMin };
}
