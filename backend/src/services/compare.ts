import { routeCar } from '../providers/car.js';
import { estimateTransit, fareFor, modeLabel, routeTransit, type Fares } from '../providers/transit.js';
import { round2 } from '../lib/format.js';
import type { CarOption, CompareResponse, LatLng, TransitOption } from '../types.js';
import type { AlertStore } from './alerts.js';
import { carCommunity, transitCommunity } from './community.js';
import { classifyTraffic, decide } from './decision.js';

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

/** Processa os dois cenários em paralelo e entrega o comparativo com a recomendação. */
export async function compareTrip(input: CompareInput, store: AlertStore): Promise<CompareResponse> {
  const { origin, destination, vehicle, fares } = input;
  const [carResult, transitResult] = await Promise.allSettled([
    routeCar(origin, destination),
    routeTransit(origin, destination),
  ]);

  // Cenário A: carro particular. Custo = (Distância / Consumo) × Preço do combustível (+ estacionamento opcional).
  let car: CarOption;
  if (carResult.status === 'fulfilled') {
    const r = carResult.value;
    const community = carCommunity(store, r.polyline, r.source === 'tempo_real');
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

  // Cenário B: transporte público. Tempo = caminhada + espera + viagem a bordo. Custo = tarifa.
  const rawTransit =
    (transitResult.status === 'fulfilled' ? transitResult.value : null) ??
    estimateTransit(origin, destination, car.available ? car.distanceKm : undefined);
  const community = transitCommunity(store, rawTransit.legs);
  const fare = fareFor(rawTransit.legs, fares);
  const transit: TransitOption = {
    available: true,
    durationMin: Math.round(rawTransit.durationMin + community.delayMin),
    walkMin: Math.round(rawTransit.walkMin),
    waitMin: Math.round(rawTransit.waitMin),
    inVehicleMin: Math.round(rawTransit.inVehicleMin),
    reportedDelayMin: Math.round(community.delayMin),
    transfers: rawTransit.transfers,
    cost: round2(fare.cost),
    fareRule: fare.rule,
    modeLabel: modeLabel(rawTransit.legs),
    legs: rawTransit.legs,
    crowding: community.crowding,
    lineAlerts: community.lineAlerts,
    source: rawTransit.source,
    provider: rawTransit.provider,
    polyline: rawTransit.polyline,
  };

  return {
    car,
    transit,
    recommendation: decide(car, transit, input.valueOfTimePerHour),
    generatedAt: new Date().toISOString(),
  };
}
