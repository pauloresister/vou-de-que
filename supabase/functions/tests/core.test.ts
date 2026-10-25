import assert from 'node:assert/strict';
import { parseTomTom } from '../_shared/car.ts';
import { aggregateCrowd, carCommunity, transitCommunity } from '../_shared/community.ts';
import { classifyTraffic, decide } from '../_shared/decision.ts';
import { brl, lineKey, sameLine } from '../_shared/format.ts';
import { decodePolyline, distanceToPolylineM } from '../_shared/geo.ts';
import { bestItinerary, fareFor, modeLabel, type MotisLeg } from '../_shared/transit.ts';
import type { Alert, AlertSource, AlertWithKey, CarOption, Coord, TransitOption } from '../_shared/types.ts';

const car = (o: Partial<CarOption> = {}): CarOption => ({
  available: true, distanceKm: 18, durationMin: 40, freeFlowMin: 25, reportedDelayMin: 0, trafficLevel: 'intenso',
  fuelLiters: 1.8, fuelCost: 11.75, parkingCost: 15, cost: 26.75, source: 'tempo_real', provider: 'teste',
  polyline: [], incidents: [], ...o,
});
const transit = (o: Partial<TransitOption> = {}): TransitOption => ({
  available: true, durationMin: 55, walkMin: 8, waitMin: 5, inVehicleMin: 42, reportedDelayMin: 0, transfers: 0,
  cost: 5.3, fareRule: 'Tarifa de ônibus', modeLabel: 'ônibus', legs: [],
  crowding: { level: 'moderado', line: '8700-10', reports: 3, lastReportAt: new Date().toISOString() },
  lineAlerts: [], source: 'horario', provider: 'teste', polyline: [], ...o,
});

Deno.test('frase de apoio no formato da especificação', () => {
  const r = decide(car(), transit(), 25);
  assert.equal(r.fastest, 'car');
  assert.equal(r.cheapest, 'transit');
  assert.match(r.summary, /^Ir de ônibus leva 15 min a mais, mas economiza R\$ 21,45 e a linha está com lotação moderada\./);
});

Deno.test('quando o carro vence, a lotação vira frase separada', () => {
  const r = decide(car({ durationMin: 22, cost: 2.85, trafficLevel: 'moderado' }), transit({ durationMin: 28 }), 25);
  assert.equal(r.summary, 'De carro você chega 6 min antes e ainda gasta R$ 2,45 a menos. No coletivo, a linha está com lotação moderada.');
});

Deno.test('valor do tempo muda a recomendação', () => {
  assert.equal(decide(car(), transit(), 200).best, 'car');
  assert.equal(decide(car(), transit(), 0).best, 'transit');
});

Deno.test('rota de carro indisponível recomenda o coletivo', () => {
  assert.equal(decide(car({ available: false }), transit(), 25).best, 'transit');
});

Deno.test('trânsito, Reais e linhas', () => {
  assert.equal(classifyTraffic(20, 19), 'livre');
  assert.equal(classifyTraffic(26, 20), 'moderado');
  assert.equal(classifyTraffic(40, 20), 'intenso');
  assert.equal(brl(1234.5), 'R$ 1.234,50');
  assert.equal(lineKey('Linha 8700-10'), '870010');
  assert.ok(sameLine(lineKey('8700-10'), lineKey('8700 10')));
  assert.ok(!sameLine(lineKey('4'), lineKey('8740')));
});

Deno.test('decodifica polilinha Google (precisão 5 e 6)', () => {
  const p5 = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5);
  assert.deepEqual(p5.map(([a, b]) => [Math.round(a * 1000) / 1000, Math.round(b * 1000) / 1000]), [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
  assert.equal(decodePolyline('').length, 0);
});

Deno.test('interpreta resposta do TomTom', () => {
  const r = parseTomTom({
    routes: [{
      summary: { lengthInMeters: 12_400, travelTimeInSeconds: 2400, trafficDelayInSeconds: 600, noTrafficTravelTimeInSeconds: 1500 },
      legs: [{ points: [{ latitude: -23.56, longitude: -46.65 }, { latitude: -23.58, longitude: -46.66 }] }],
    }],
  });
  assert.equal(r.distanceKm, 12.4);
  assert.equal(r.durationMin, 40);
  assert.equal(r.freeFlowMin, 25);
  assert.equal(r.polyline.length, 2);
  assert.equal(r.source, 'tempo_real');
});

Deno.test('interpreta itinerário do Transitous: caminhada, espera, viagem', () => {
  const now = Date.parse('2026-10-26T11:00:00Z');
  const at = (m: number) => new Date(now + m * 60_000).toISOString();
  const walk = (a: number, b: number): MotisLeg => ({ mode: 'WALK', startTime: at(a), endTime: at(b), duration: (b - a) * 60, from: { name: 'A' }, to: { name: 'Ponto' } });
  const plan = {
    itineraries: [
      { duration: 0, startTime: at(0), endTime: at(60), transfers: 0, legs: [walk(0, 60)] },
      {
        duration: 0, startTime: at(0), endTime: at(39), transfers: 0,
        legs: [
          walk(0, 6),
          { mode: 'BUS', startTime: at(10), endTime: at(35), duration: 1500, routeShortName: '8700-10', headsign: 'Terminal', routeColor: '0A9466', from: { name: 'Av. Paulista' }, to: { name: 'Ibirapuera' }, legGeometry: { points: '_p~iF~ps|U_ulLnnqC', precision: 5 } },
          walk(35, 39),
        ],
      },
    ],
  };
  const r = bestItinerary(plan, now)!;
  assert.equal(Math.round(r.durationMin), 39);
  assert.equal(Math.round(r.walkMin), 10);
  assert.equal(Math.round(r.inVehicleMin), 25);
  assert.equal(Math.round(r.waitMin), 4);
  assert.equal(r.legs[1].line, '8700-10');
  assert.equal(r.legs[1].color, '#0A9466');
  assert.equal(r.source, 'horario');
  assert.equal(bestItinerary({ itineraries: [] }, now), null);
});

Deno.test('tarifas e rótulos', () => {
  const fares = { bus: 5.3, rail: 5.4, integrated: 9.38 };
  assert.equal(fareFor([{ mode: 'bus', durationMin: 1 }], fares).cost, 5.3);
  assert.equal(fareFor([{ mode: 'subway', durationMin: 1 }], fares).cost, 5.4);
  assert.equal(fareFor([{ mode: 'bus', durationMin: 1 }, { mode: 'train', durationMin: 1 }], fares).cost, 9.38);
  assert.equal(modeLabel([{ mode: 'walk', durationMin: 3 }, { mode: 'subway', durationMin: 10 }]), 'metrô');
});

// Fonte de alertas em memória, no lugar do banco.
const memory = (list: AlertWithKey[]): AlertSource => ({
  withLines: () => Promise.resolve(list.filter((a) => a.lineKey)),
  incidentsInBox: (b) => Promise.resolve(list.filter((a) => a.kind === 'ocorrencia' && a.incidentType !== 'atraso_linha' && a.lat >= b.minLat && a.lat <= b.maxLat && a.lng >= b.minLng && a.lng <= b.maxLng)),
});
const alert = (o: Partial<AlertWithKey>): AlertWithKey => ({
  id: crypto.randomUUID(), kind: 'lotacao', lat: -23.56, lng: -46.65, createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 1_800_000).toISOString(), confirmations: 0, lineKey: '', ...o,
});
const paulista: Coord[] = [[-23.5614, -46.6559], [-23.5646, -46.6527], [-23.5673, -46.6488]];

Deno.test('distância até a rota', () => {
  assert.ok(distanceToPolylineM({ lat: -23.5646, lng: -46.6527 }, paulista) < 1);
  assert.ok(distanceToPolylineM({ lat: -23.58, lng: -46.68 }, paulista) > 2000);
});

Deno.test('cruza lotação e atrasos com as linhas da rota', async () => {
  const src = memory([
    alert({ crowdLevel: 'lotado', line: 'Linha 8700-10', lineKey: '870010' }),
    alert({ crowdLevel: 'moderado', line: '8700-10', lineKey: '870010' }),
    alert({ kind: 'ocorrencia', incidentType: 'atraso_linha', line: '8700-10', lineKey: '870010' }),
  ]);
  const r = await transitCommunity(src, [{ mode: 'bus', line: '8700-10', durationMin: 20 }]);
  assert.equal(r.crowding?.reports, 2);
  assert.equal(r.lineAlerts.length, 1);
  assert.equal(r.delayMin, 5);
});

Deno.test('ocorrências perto da rota de carro somam atraso', async () => {
  const src = memory([
    alert({ kind: 'ocorrencia', incidentType: 'acidente', lat: -23.5647, lng: -46.6526 }),
    alert({ kind: 'ocorrencia', incidentType: 'acidente', lat: -23.6, lng: -46.7 }),
  ]);
  const est = await carCommunity(src, paulista, false);
  assert.equal(est.incidents.length, 1);
  assert.equal(est.delayMin, 8);
  assert.equal((await carCommunity(src, paulista, true)).delayMin, 4);
});

Deno.test('relatos recentes pesam mais', () => {
  const now = Date.now();
  const base = { id: 'x', kind: 'lotacao' as const, lat: 0, lng: 0, expiresAt: '', confirmations: 0 };
  const old = new Date(now - 25 * 60_000).toISOString();
  const level = aggregateCrowd([
    { ...base, crowdLevel: 'vazio', createdAt: old },
    { ...base, crowdLevel: 'vazio', createdAt: old },
    { ...base, crowdLevel: 'lotado', createdAt: new Date(now).toISOString() } as Alert,
  ], now);
  assert.equal(level, 'lotado');
});
