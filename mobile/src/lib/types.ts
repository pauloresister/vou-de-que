// Espelho dos tipos da API (backend/src/types.ts).
export type Coord = [number, number];
export type DataSource = 'tempo_real' | 'horario' | 'estimado';
export type TrafficLevel = 'livre' | 'moderado' | 'intenso';
export type CrowdLevel = 'vazio' | 'moderado' | 'lotado';
export type IncidentType = 'transito_parado' | 'acidente' | 'atraso_linha';
export type AlertKind = 'lotacao' | 'ocorrencia';
export type TransitMode = 'walk' | 'bus' | 'subway' | 'train' | 'tram' | 'ferry' | 'other';
export type Choice = 'car' | 'transit';

export interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

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
  crowding: { level: CrowdLevel; line: string; reports: number; lastReportAt: string } | null;
  lineAlerts: Alert[];
  source: DataSource;
  provider: string;
  polyline: Coord[];
}

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

export interface CompareResult {
  car: CarOption;
  transit: TransitOption;
  recommendation: Recommendation;
  generatedAt: string;
}

export interface ReferencePrices {
  uf: string;
  fuel: { gasolina: number; etanol: number; diesel: number };
  fuelReference: string;
  fuelUpdatedAt: string;
  fares: { bus: number; rail: number; integrated: number };
  faresReference: string;
}
