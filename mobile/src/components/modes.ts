import type { Ionicons } from '@expo/vector-icons';
import type { CrowdLevel, IncidentType, TrafficLevel, TransitMode } from '@/lib/types';

type IconName = keyof typeof Ionicons.glyphMap;

export const MODE_ICON: Record<TransitMode, IconName> = {
  walk: 'walk',
  bus: 'bus',
  subway: 'subway',
  train: 'train',
  tram: 'train',
  ferry: 'boat',
  other: 'navigate',
};

export const TRAFFIC_LABEL: Record<TrafficLevel, string> = {
  livre: 'Trânsito livre',
  moderado: 'Trânsito moderado',
  intenso: 'Trânsito intenso',
};

export const CROWD_LABEL: Record<CrowdLevel, string> = {
  vazio: 'Vazio',
  moderado: 'Moderado',
  lotado: 'Lotado',
};

export const INCIDENT_LABEL: Record<IncidentType, string> = {
  transito_parado: 'Trânsito parado',
  acidente: 'Acidente',
  atraso_linha: 'Atraso na linha',
};

export const INCIDENT_ICON: Record<IncidentType, IconName> = {
  transito_parado: 'car',
  acidente: 'warning',
  atraso_linha: 'time',
};

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
