export interface LatLng {
  lat: number;
  lng: number;
}

/** Coordenadas compactas [lat, lng] enviadas ao app para desenhar rotas. */
export type Coord = [number, number];

export type DataSource = 'tempo_real' | 'horario' | 'estimado';
export type TrafficLevel = 'livre' | 'moderado' | 'intenso';
export type CrowdLevel = 'vazio' | 'moderado' | 'lotado';
export type IncidentType = 'transito_parado' | 'acidente' | 'atraso_linha';
export type AlertKind = 'lotacao' | 'ocorrencia';
export type TransitMode = 'walk' | 'bus' | 'subway' | 'train' | 'tram' | 'ferry' | 'other';

export interface Alert {
  id: string;
  kind: AlertKind;
  crowdLevel?: CrowdLevel;
  incidentType?: IncidentType;
  line?: string;
  lat: number;
  lng: number;
  note?: string;
  createdAt: string;
  expiresAt: string;
  confirmations: number;
}

export interface AlertWithKey extends Alert {
  lineKey: string;
}

/** De onde vêm os alertas: Supabase em produção, memória nos testes. */
export interface AlertSource {
  withLines(): Promise<AlertWithKey[]>;
  incidentsInBox(box: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<Alert[]>;
}

export interface CarOption {
  available: boolean;
  unavailableReason?: string;
  distanceKm: number;
  durationMin: number;
  freeFlowMin: number;
  reportedDelayMin: number;
  trafficLevel: TrafficLevel;
  fuelLiters: number;
  fuelCost: number;
  parkingCost: number;
  cost: number;
  source: DataSource;
  provider: string;
  polyline: Coord[];
  incidents: Alert[];
}

export interface TransitLeg {
  mode: TransitMode;
  line?: string;
  headsign?: string;
  color?: string;
  durationMin: number;
  fromName?: string;
  toName?: string;
  departure?: string;
  realTime?: boolean;
}

export interface CrowdInfo {
  level: CrowdLevel;
  line: string;
  reports: number;
  lastReportAt: string;
}

export interface TransitOption {
  available: boolean;
  unavailableReason?: string;
  durationMin: number;
  walkMin: number;
  waitMin: number;
  inVehicleMin: number;
  reportedDelayMin: number;
  transfers: number;
  cost: number;
  fareRule: string;
  modeLabel: string;
  legs: TransitLeg[];
  crowding: CrowdInfo | null;
  lineAlerts: Alert[];
  source: DataSource;
  provider: string;
  polyline: Coord[];
}

export type Choice = 'car' | 'transit';

export interface Recommendation {
  best: Choice | null;
  fastest: Choice | null;
  cheapest: Choice | null;
  timeSavedMin: number;
  moneySaved: number;
  closeCall: boolean;
  headline: string;
  summary: string;
  scores: { car: number | null; transit: number | null };
}

export interface CompareResponse {
  car: CarOption;
  transit: TransitOption;
  recommendation: Recommendation;
  generatedAt: string;
}
