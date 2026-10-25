import { brl, round2 } from '../lib/format.js';
import type { CarOption, Choice, CrowdLevel, Recommendation, TrafficLevel, TransitOption } from '../types.js';

/**
 * Motor de decisão.
 *
 * Compara as opções pelo "custo generalizado" (conceito clássico de economia dos transportes):
 *   custo total = dinheiro gasto + tempo × valor do tempo do usuário
 * com pesos de desconforto:
 *   - caminhar e esperar pesam 1,5× (pessoas percebem esses minutos como mais longos);
 *   - coletivo lotado pesa 1,45× no tempo a bordo; moderado 1,15×;
 *   - trânsito intenso pesa 1,1× no tempo ao volante.
 */
export const WEIGHTS = {
  walk: 1.5,
  wait: 1.5,
  crowd: { vazio: 1, moderado: 1.15, lotado: 1.45 } satisfies Record<CrowdLevel, number>,
  traffic: { livre: 1, moderado: 1.03, intenso: 1.1 } satisfies Record<TrafficLevel, number>,
  /** Diferença relativa abaixo da qual as opções são consideradas equivalentes. */
  closeCall: 0.05,
};

export function classifyTraffic(durationMin: number, freeFlowMin: number): TrafficLevel {
  if (freeFlowMin <= 0) return 'livre';
  const ratio = durationMin / freeFlowMin;
  if (ratio < 1.2) return 'livre';
  if (ratio < 1.5) return 'moderado';
  return 'intenso';
}

export function carScore(car: CarOption, valuePerHour: number): number {
  return car.cost + (valuePerHour / 60) * car.durationMin * WEIGHTS.traffic[car.trafficLevel];
}

export function transitScore(t: TransitOption, valuePerHour: number): number {
  const crowd = t.crowding ? WEIGHTS.crowd[t.crowding.level] : 1;
  const perceivedMin =
    t.inVehicleMin * crowd + t.walkMin * WEIGHTS.walk + t.waitMin * WEIGHTS.wait + t.reportedDelayMin;
  return t.cost + (valuePerHour / 60) * perceivedMin;
}

const CROWD_PHRASE: Record<CrowdLevel, string> = {
  vazio: 'a linha está vazia',
  moderado: 'a linha está com lotação moderada',
  lotado: 'a linha está lotada',
};

function mainClause(dTime: number, dMoney: number, label: string): string {
  // dTime > 0: coletivo mais lento. dMoney > 0: coletivo mais barato.
  const t = Math.abs(dTime);
  const m = brl(Math.abs(dMoney));
  const sameTime = t < 1;
  const sameMoney = Math.abs(dMoney) < 0.01;
  if (sameTime && sameMoney) return 'As duas opções empatam em tempo e custo';
  if (sameTime) return `As duas opções levam o mesmo tempo, e ${dMoney > 0 ? `ir de ${label}` : 'ir de carro'} sai ${m} mais barato`;
  if (sameMoney) return `${dTime > 0 ? 'De carro' : `De ${label}`} você chega ${t} min antes pelo mesmo custo`;
  if (dTime > 0 && dMoney > 0) return `Ir de ${label} leva ${t} min a mais, mas economiza ${m}`;
  if (dTime < 0 && dMoney > 0) return `Ir de ${label} é ${t} min mais rápido e ainda economiza ${m}`;
  if (dTime > 0 && dMoney < 0) return `De carro você chega ${t} min antes e ainda gasta ${m} a menos`;
  return `Ir de ${label} poupa ${t} min, mas custa ${m} a mais`;
}

export function decide(car: CarOption, transit: TransitOption, valuePerHour: number): Recommendation {
  const label = transit.modeLabel;

  if (!car.available && !transit.available) {
    return {
      best: null,
      fastest: null,
      cheapest: null,
      timeSavedMin: 0,
      moneySaved: 0,
      closeCall: false,
      headline: 'Sem rotas no momento',
      summary: 'Não encontramos rota de carro nem de transporte público para este trajeto. Tente outro destino.',
      scores: { car: null, transit: null },
    };
  }
  if (!car.available || !transit.available) {
    const only: Choice = car.available ? 'car' : 'transit';
    const reason = car.available ? transit.unavailableReason : car.unavailableReason;
    return {
      best: only,
      fastest: only,
      cheapest: only,
      timeSavedMin: 0,
      moneySaved: 0,
      closeCall: false,
      headline: only === 'car' ? 'Vá de carro' : `Vá de ${label}`,
      summary: `Única opção disponível agora. ${reason ?? ''}`.trim(),
      scores: {
        car: car.available ? round2(carScore(car, valuePerHour)) : null,
        transit: transit.available ? round2(transitScore(transit, valuePerHour)) : null,
      },
    };
  }

  const carMin = Math.round(car.durationMin);
  const transitMin = Math.round(transit.durationMin);
  const dTime = transitMin - carMin;
  const dMoney = round2(car.cost - transit.cost);

  const fastest: Choice | null = Math.abs(dTime) < 1 ? null : dTime > 0 ? 'car' : 'transit';
  const cheapest: Choice | null = Math.abs(dMoney) < 0.01 ? null : dMoney > 0 ? 'transit' : 'car';

  const sCar = carScore(car, valuePerHour);
  const sTransit = transitScore(transit, valuePerHour);
  const best: Choice = sTransit <= sCar ? 'transit' : 'car';
  const closeCall = Math.abs(sCar - sTransit) / Math.max(sCar, sTransit) < WEIGHTS.closeCall;

  const main = mainClause(dTime, dMoney, label);
  let summary: string;
  if (!transit.crowding) summary = `${main}.`;
  else if (main.startsWith(`Ir de ${label}`)) summary = `${main} e ${CROWD_PHRASE[transit.crowding.level]}.`;
  // Quando a frase principal fala do carro, a lotação vira uma frase própria para não soar como parte da vantagem.
  else summary = `${main}. No coletivo, ${CROWD_PHRASE[transit.crowding.level]}.`;
  const extras: string[] = [];
  if (car.trafficLevel === 'intenso') extras.push('O trânsito está intenso no caminho de carro.');
  if (car.incidents.length > 0) {
    extras.push(
      car.incidents.length === 1
        ? 'Há 1 ocorrência reportada na rota de carro.'
        : `Há ${car.incidents.length} ocorrências reportadas na rota de carro.`,
    );
  }
  if (transit.lineAlerts.length > 0) extras.push('Usuários relatam atraso na linha.');
  if (extras.length) summary += ` ${extras.join(' ')}`;

  const headline = closeCall
    ? 'Qualquer uma vale a pena agora'
    : best === 'car'
      ? 'Vá de carro'
      : `Vá de ${label}`;

  return {
    best,
    fastest,
    cheapest,
    timeSavedMin: Math.abs(dTime),
    moneySaved: Math.abs(dMoney),
    closeCall,
    headline,
    summary,
    scores: { car: round2(sCar), transit: round2(sTransit) },
  };
}
