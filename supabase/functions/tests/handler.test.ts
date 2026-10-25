import assert from 'node:assert/strict';
import { handle } from '../_shared/handler.ts';

const call = (path: string, init?: RequestInit) => handle(new Request(`http://localhost/functions/v1/api${path}`, init));

Deno.test('health responde', async () => {
  const res = await call('/health');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
});

Deno.test('preços de referência', async () => {
  const body = await (await call('/reference/prices?uf=SP')).json();
  assert.equal(body.fuel.etanol, 3.86);
  assert.equal(body.fares.bus, 5.3);
});

Deno.test('rejeita origem igual ao destino', async () => {
  const res = await call('/compare', {
    method: 'POST',
    body: JSON.stringify({
      origin: { lat: -23.5, lng: -46.6 },
      destination: { lat: -23.5, lng: -46.6 },
      vehicle: { consumptionKmL: 11, fuelPrice: 6.53 },
      fares: { bus: 5.3, rail: 5.4, integrated: 9.38 },
    }),
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /mesmo lugar/);
});

Deno.test('valida busca curta e rota desconhecida', async () => {
  assert.equal((await call('/places/search?q=a')).status, 400);
  assert.equal((await call('/nada')).status, 404);
  assert.equal((await call('/health', { method: 'OPTIONS' })).status, 200);
});
