import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encode } from '@here/flexpolyline';
import { fareFor, modeLabel, parseHereRoute } from '../src/providers/transit.js';

const fares = { bus: 5.3, rail: 5.4, integrated: 9.38 };
const poly = encode({ polyline: [[-23.56, -46.65], [-23.57, -46.66]] });
const at = (base: number, min: number) => new Date(base + min * 60_000).toISOString();

test('interpreta resposta do HERE Transit: caminhada, espera e viagem', () => {
  const now = Date.parse('2026-10-26T11:00:00Z');
  const route = parseHereRoute(
    [
      { type: 'pedestrian', departure: { time: at(now, 0) }, arrival: { time: at(now, 6) }, travelSummary: { duration: 360 }, polyline: poly },
      {
        type: 'transit',
        departure: { time: at(now, 10), place: { name: 'Av. Paulista' } },
        arrival: { time: at(now, 35), place: { name: 'Ibirapuera' } },
        travelSummary: { duration: 1500 },
        transport: { mode: 'bus', name: '8700-10', headsign: 'Terminal' },
        polyline: poly,
      },
      { type: 'pedestrian', departure: { time: at(now, 35) }, arrival: { time: at(now, 39) }, travelSummary: { duration: 240 } },
    ],
    now,
  );
  assert.equal(Math.round(route.durationMin), 39);
  assert.equal(Math.round(route.walkMin), 10);
  assert.equal(Math.round(route.inVehicleMin), 25);
  assert.equal(Math.round(route.waitMin), 4);
  assert.equal(route.transfers, 0);
  assert.equal(route.legs[1].line, '8700-10');
  assert.equal(route.polyline.length, 4);
});

test('regras de tarifa e rótulos', () => {
  assert.equal(fareFor([{ mode: 'bus', durationMin: 10 }, { mode: 'bus', durationMin: 10 }], fares).cost, 5.3);
  assert.equal(fareFor([{ mode: 'subway', durationMin: 10 }], fares).cost, 5.4);
  assert.equal(fareFor([{ mode: 'bus', durationMin: 10 }, { mode: 'train', durationMin: 10 }], fares).cost, 9.38);
  assert.equal(modeLabel([{ mode: 'walk', durationMin: 3 }, { mode: 'subway', durationMin: 10 }]), 'metrô');
  assert.equal(modeLabel([{ mode: 'bus', durationMin: 3 }, { mode: 'subway', durationMin: 10 }]), 'transporte público');
});
