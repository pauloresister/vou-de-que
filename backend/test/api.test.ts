import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { buildApp } from '../src/app.js';

const { app } = await buildApp({ dbPath: ':memory:', logger: false });
after(() => app.close());

test('health responde', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ok, true);
});

test('preços de referência', async () => {
  const res = await app.inject({ method: 'GET', url: '/v1/reference/prices?uf=SP' });
  const body = res.json();
  assert.equal(body.fuel.etanol, 3.86);
  assert.equal(body.fares.bus, 5.3);
});

test('valida alerta incompleto com mensagem legível', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/alerts',
    payload: { kind: 'lotacao', lat: -23.5, lng: -46.6, deviceId: 'device-xyz1' },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, 'Informe o nível de lotação.');
});

test('cria e lista alerta', async () => {
  const created = await app.inject({
    method: 'POST',
    url: '/v1/alerts',
    payload: { kind: 'ocorrencia', incidentType: 'acidente', lat: -23.5, lng: -46.6, deviceId: 'device-xyz2' },
  });
  assert.equal(created.statusCode, 201);
  const list = await app.inject({ method: 'GET', url: '/v1/alerts?lat=-23.5&lng=-46.6&radiusKm=3' });
  assert.equal(list.json().alerts.length, 1);
});

test('rejeita origem igual ao destino', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/compare',
    payload: {
      origin: { lat: -23.5, lng: -46.6 },
      destination: { lat: -23.5, lng: -46.6 },
      vehicle: { consumptionKmL: 11, fuelPrice: 6.5 },
      fares: { bus: 5.3, rail: 5.4, integrated: 9.38 },
    },
  });
  assert.equal(res.statusCode, 400);
});
