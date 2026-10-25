import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyTraffic, decide } from '../src/services/decision.js';
import { brl, lineKey, sameLine } from '../src/lib/format.js';
import type { CarOption, TransitOption } from '../src/types.js';

const car = (o: Partial<CarOption> = {}): CarOption => ({
  available: true,
  distanceKm: 18,
  durationMin: 40,
  freeFlowMin: 25,
  reportedDelayMin: 0,
  trafficLevel: 'intenso',
  fuelLiters: 1.8,
  fuelCost: 11.75,
  parkingCost: 15,
  cost: 26.75,
  source: 'tempo_real',
  provider: 'teste',
  polyline: [],
  incidents: [],
  ...o,
});

const transit = (o: Partial<TransitOption> = {}): TransitOption => ({
  available: true,
  durationMin: 55,
  walkMin: 8,
  waitMin: 5,
  inVehicleMin: 42,
  reportedDelayMin: 0,
  transfers: 0,
  cost: 5.3,
  fareRule: 'Tarifa de ônibus',
  modeLabel: 'ônibus',
  legs: [],
  crowding: { level: 'moderado', line: '8700-10', reports: 3, lastReportAt: new Date().toISOString() },
  lineAlerts: [],
  source: 'tempo_real',
  provider: 'teste',
  polyline: [],
  ...o,
});

test('frase de apoio segue o formato da especificação', () => {
  const r = decide(car(), transit(), 25);
  assert.equal(r.fastest, 'car');
  assert.equal(r.cheapest, 'transit');
  assert.equal(r.timeSavedMin, 15);
  assert.equal(r.moneySaved, 21.45);
  assert.match(r.summary, /^Ir de ônibus leva 15 min a mais, mas economiza R\$ 21,45 e a linha está com lotação moderada\./);
});

test('valor do tempo alto favorece o carro', () => {
  const r = decide(car(), transit(), 200);
  assert.equal(r.best, 'car');
  assert.equal(r.headline, 'Vá de carro');
});

test('valor do tempo zero favorece o mais barato', () => {
  assert.equal(decide(car(), transit(), 0).best, 'transit');
});

test('lotação pesa contra o coletivo', () => {
  const vazio = decide(car(), transit({ crowding: { level: 'vazio', line: 'x', reports: 1, lastReportAt: '' } }), 40);
  const lotado = decide(car(), transit({ crowding: { level: 'lotado', line: 'x', reports: 1, lastReportAt: '' } }), 40);
  assert.ok((lotado.scores.transit ?? 0) > (vazio.scores.transit ?? 0));
});

test('coletivo mais rápido e mais barato', () => {
  const r = decide(car({ durationMin: 70 }), transit({ crowding: null }), 25);
  assert.equal(r.fastest, 'transit');
  assert.match(r.summary, /^Ir de ônibus é 15 min mais rápido e ainda economiza/);
});

test('rota de carro indisponível recomenda o coletivo', () => {
  const r = decide(car({ available: false, unavailableReason: 'Sem rota.' }), transit(), 25);
  assert.equal(r.best, 'transit');
});

test('classificação de trânsito', () => {
  assert.equal(classifyTraffic(20, 19), 'livre');
  assert.equal(classifyTraffic(26, 20), 'moderado');
  assert.equal(classifyTraffic(40, 20), 'intenso');
});

test('formatação de Reais e linhas', () => {
  assert.equal(brl(1234.5), 'R$ 1.234,50');
  assert.equal(brl(22), 'R$ 22,00');
  assert.equal(lineKey('Linha 8700-10'), '870010');
  assert.ok(sameLine(lineKey('8700-10'), lineKey('8700 10')));
  assert.ok(!sameLine(lineKey('4'), lineKey('8740')));
});

test('quando o carro vence, a lotação vira frase separada', () => {
  const r = decide(car({ durationMin: 22, cost: 2.85, trafficLevel: 'moderado' }), transit({ durationMin: 28 }), 25);
  assert.equal(r.summary, 'De carro você chega 6 min antes e ainda gasta R$ 2,45 a menos. No coletivo, a linha está com lotação moderada.');
});
