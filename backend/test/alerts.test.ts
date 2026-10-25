import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AlertStore } from '../src/services/alerts.js';
import { aggregateCrowd, carCommunity, transitCommunity } from '../src/services/community.js';
import { distanceToPolylineM } from '../src/lib/geo.js';
import type { Coord } from '../src/types.js';

const paulista: Coord[] = [
  [-23.5614, -46.6559],
  [-23.5646, -46.6527],
  [-23.5673, -46.6488],
];

test('distância até a polilinha', () => {
  assert.ok(distanceToPolylineM({ lat: -23.5646, lng: -46.6527 }, paulista) < 1);
  assert.ok(distanceToPolylineM({ lat: -23.58, lng: -46.68 }, paulista) > 2000);
});

test('cria, lista por raio, confirma e expira alertas', () => {
  const store = new AlertStore(':memory:');
  const now = Date.now();
  const a = store.create({ kind: 'lotacao', crowdLevel: 'lotado', line: '8700-10', lat: -23.56, lng: -46.65, deviceId: 'device-aaaa' }, now);
  assert.equal(store.listNear({ lat: -23.56, lng: -46.65 }, 2, now).length, 1);
  assert.equal(store.listNear({ lat: -22.9, lng: -43.2 }, 2, now).length, 0);
  assert.throws(() => store.create({ kind: 'lotacao', crowdLevel: 'vazio', line: '8700 10', lat: -23.56, lng: -46.65, deviceId: 'device-aaaa' }, now), /parecido/);
  const confirmed = store.confirm(a.id, 'device-bbbb', now);
  assert.equal(confirmed.confirmations, 1);
  assert.throws(() => store.confirm(a.id, 'device-bbbb', now), /já confirmou/);
  assert.deepEqual(store.purgeExpired(now + 3 * 3_600_000), [a.id]);
  store.close();
});

test('cruza lotação e atrasos com as linhas da rota', () => {
  const store = new AlertStore(':memory:');
  const now = Date.now();
  store.create({ kind: 'lotacao', crowdLevel: 'lotado', line: 'Linha 8700-10', lat: -23.56, lng: -46.65, deviceId: 'device-1111' }, now);
  store.create({ kind: 'lotacao', crowdLevel: 'moderado', line: '8700-10', lat: -23.56, lng: -46.65, deviceId: 'device-2222' }, now);
  store.create({ kind: 'ocorrencia', incidentType: 'atraso_linha', line: '8700-10', lat: -23.56, lng: -46.65, deviceId: 'device-3333' }, now);
  const r = transitCommunity(store, [{ mode: 'bus', line: '8700-10', durationMin: 20 }], now);
  assert.equal(r.crowding?.reports, 2);
  assert.ok(r.crowding?.level === 'lotado' || r.crowding?.level === 'moderado');
  assert.equal(r.lineAlerts.length, 1);
  assert.equal(r.delayMin, 5);
  store.close();
});

test('ocorrências perto da rota de carro somam atraso', () => {
  const store = new AlertStore(':memory:');
  store.create({ kind: 'ocorrencia', incidentType: 'acidente', lat: -23.5647, lng: -46.6526, deviceId: 'device-4444' });
  store.create({ kind: 'ocorrencia', incidentType: 'acidente', lat: -23.6, lng: -46.7, deviceId: 'device-5555' });
  const est = carCommunity(store, paulista, false);
  assert.equal(est.incidents.length, 1);
  assert.equal(est.delayMin, 8);
  assert.equal(carCommunity(store, paulista, true).delayMin, 4);
  store.close();
});

test('relatos recentes pesam mais', () => {
  const now = Date.now();
  const old = new Date(now - 25 * 60_000).toISOString();
  const fresh = new Date(now).toISOString();
  const base = { id: 'x', kind: 'lotacao' as const, lat: 0, lng: 0, expiresAt: '', confirmations: 0 };
  const level = aggregateCrowd(
    [
      { ...base, crowdLevel: 'vazio', createdAt: old },
      { ...base, crowdLevel: 'vazio', createdAt: old },
      { ...base, crowdLevel: 'lotado', createdAt: fresh },
    ],
    now,
  );
  assert.equal(level, 'lotado');
});
