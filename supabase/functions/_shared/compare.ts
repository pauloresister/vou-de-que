import { routeCar } from './car.ts';
import { carCommunity, transitCommunity } from './community.ts';
import { classifyTraffic, decide } from './decision.ts';
import { round2 } from './format.ts';
import { estimateTransit, type Fares, fareFor, modeLabel, routeTransit } from './transit.ts';
import type { AlertSource, CarOption, CompareResponse, LatLng, TransitOption } from './types.ts';

export interface CompareInput {
  origin: LatLng;
  destination: LatLng;
  vehicle: { consumptionKmL: number; fuelPrice: number; parkingCost: number };
  fares: Fares;
  valueOfTimePerHour: number;
}

const emptyCar = (reason: string): CarOption => ({
  available: false,
  unavailableReason: reason,
  distanceKm: 0,
  durationMin: 0,
  freeFlowMin: 0,
  reportedDelayMin: 0,
  trafficLevel: 'livre',
  fuelLiters: 0,
  fuelCost: 0,
  parkingCost: 0,
  cost: 0,
  source: 'estimado',
  provider: '',
  polyline: [],
  incidents: [],
});

/** Alertas indisponíveis nunca derrubam a comparação: seguem como "sem relatos". */
const safeSource = (s: AlertSource): AlertSource => ({
  withLines: () => s.withLines().catch(() => []),
  incidentsInBox: (box) => s.incidentsInBox(box).catch(() => []),
});

/** Processa os dois cenários em paralelo e entrega o comparativo com a recomendação. */
export async function compareTrip(input: CompareInput, alerts: AlertSource): Promise<CompareResponse> {
  const source = safeSource(alerts);
  const { origin, destination, vehicle, fares } = input;
  const [carResult, transitResult] = await Promise.allSettled([
    routeCar(origin, destination),
    routeTransit(origin, destination),
  ]);

  // Cenário A: carro. Custo = (Distância ÷ Consumo) × Preço do combustível (+ estacionamento opcional).
  let car: CarOption;
  if (carResult.status === 'fulfilled') {
    const r = carResult.value;
    const community = await carCommunity(source, r.polyline, r.source === 'tempo_real');
    const durationMin = r.durationMin + community.delayMin;
    const fuelLiters = r.distanceKm / vehicle.consumptionKmL;
    const fuelCost = fuelLiters * vehicle.fuelPrice;
    car = {
      available: true,
      distanceKm: round2(r.distanceKm),
      durationMin: Math.round(durationMin),
      freeFlowMin: Math.round(r.freeFlowMin),
      reportedDelayMin: Math.round(community.delayMin),
      trafficLevel: classifyTraffic(durationMin, r.freeFlowMin),
      fuelLiters: round2(fuelLiters),
      fuelCost: round2(fuelCost),
      parkingCost: round2(vehicle.parkingCost),
      cost: round2(fuelCost + vehicle.parkingCost),
      source: r.source,
      provider: r.provider,
      polyline: r.polyline,
      incidents: community.incidents,
    };
  } else {
    car = emptyCar('Não foi possível calcular a rota de carro agora.');
  }

  // Cenário B: coletivo. Tempo = caminhada + espera + viagem a bordo. Custo = tarifa.
  const raw =
    (transitResult.status === 'fulfilled' ? transitResult.value : null) ??
    estimateTransit(origin, destination, car.available ? car.distanceKm : undefined);
  const community = await transitCommunity(source, raw.legs);
  const fare = fareFor(raw.legs, fares);
  const transit: TransitOption = {
    available: true,
    durationMin: Math.round(raw.durationMin + community.delayMin),
    walkMin: Math.round(raw.walkMin),
    waitMin: Math.round(raw.waitMin),
    inVehicleMin: Math.round(raw.inVehicleMin),
    reportedDelayMin: Math.round(community.delayMin),
    transfers: raw.transfers,
    cost: round2(fare.cost),
    fareRule: fare.rule,
    modeLabel: modeLabel(raw.legs),
    legs: raw.legs,
    crowding: community.crowding,
    lineAlerts: community.lineAlerts,
    source: raw.source,
    provider: raw.provider,
    polyline: raw.polyline,
  };

  return { car, transit, recommendation: decide(car, transit, input.valueOfTimePerHour), generatedAt: new Date().toISOString() };
}
