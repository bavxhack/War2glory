import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestId } from '../apps/client/request-id.js';
import { dragToPan, finishMapPointer, mapSelectionCoordinate } from '../apps/client/map-navigation.js';
import { forceSummary } from '../apps/client/force-summary.js';

test('Truppenbestand trennt Stationierung, lebende Einsatztruppen und Ausbildung', () => {
  const military = {
    units: { scout: 4, infantry: 12 },
    trainingQueue: [{ unit: 'infantry', amount: 30 }, { unit: 'scout', amount: 2 }],
    missions: [
      { status: 'outbound', type: 'raid', infantry: 20 },
      { status: 'returning', type: 'raid', infantry: 10, result: { survivors: 7 } },
      { status: 'returning', type: 'raid', infantry: 5, result: { survivors: 0 } },
      { status: 'completed', type: 'raid', infantry: 50, result: { survivors: 48 } },
      { status: 'outbound', scouts: 3 },
      { status: 'returning', type: 'scout', scouts: 2 },
    ],
  };
  assert.deepEqual(forceSummary(military, ['scout', 'infantry']), {
    scout: { stationed: 4, deployed: 5, training: 2, total: 9 },
    infantry: { stationed: 12, deployed: 27, training: 30, total: 39 },
  });
  military.units.infantry += 7;
  military.missions[1].status = 'completed';
  assert.equal(forceSummary(military, ['infantry']).infantry.total, 39);
});

test('leere Truppenbestände zeigen Null', () => {
  assert.deepEqual(forceSummary({ units: {}, missions: [], trainingQueue: [] }, ['scout']), {
    scout: { stationed: 0, deployed: 0, training: 0, total: 0 },
  });
});

test('Anfrage-IDs funktionieren ohne crypto.randomUUID', () => {
  const generated = createRequestId({
    getRandomValues(bytes) {
      bytes.forEach((_, index) => { bytes[index] = index; });
      return bytes;
    },
  });

  assert.equal(generated, '000102030405060708090a0b0c0d0e0f');
  assert.match(generated, /^[a-zA-Z0-9_-]{8,100}$/);
});

test('Anfrage-IDs besitzen einen kompatiblen Fallback ohne Web Crypto', () => {
  const first = createRequestId(null);
  const second = createRequestId(null);

  assert.match(first, /^[a-zA-Z0-9_-]{8,100}$/);
  assert.match(second, /^[a-zA-Z0-9_-]{8,100}$/);
  assert.notEqual(first, second);
});

test('Zeigerbewegungen werden in Kartenfelder zum Verschieben umgerechnet', () => {
  assert.deepEqual(dragToPan({ x: 200, y: 150 }, { x: 100, y: 200 }, 50), { x: 2, y: -1 });
  assert.deepEqual(dragToPan({ x: 100, y: 100 }, { x: 90, y: 91 }, 50), { x: 0, y: 0 });
  assert.throws(() => dragToPan({ x: 0, y: 0 }, { x: 1, y: 1 }, 0), /positive Feldgröße/);
});

test('ein Klick auf ein Kartenfeld wird nicht als Ziehen unterdrückt', () => {
  assert.deepEqual(finishMapPointer({ x: 100, y: 100 }, { x: 100, y: 100 }, 50), {
    offset: { x: 0, y: 0 },
    suppressClick: false,
  });
  assert.deepEqual(finishMapPointer({ x: 100, y: 100 }, { x: 25, y: 100 }, 50), {
    offset: { x: 2, y: 0 },
    suppressClick: true,
  });
});

test('Pointer-Capture behält das ursprünglich angeklickte Kartenfeld', () => {
  assert.equal(mapSelectionCoordinate({ clickedCoordinate: null, pressedCoordinate: '4:7', suppressClick: false }), '4:7');
  assert.equal(mapSelectionCoordinate({ clickedCoordinate: '4:7', pressedCoordinate: '4:7', suppressClick: false }), '4:7');
  assert.equal(mapSelectionCoordinate({ clickedCoordinate: null, pressedCoordinate: '4:7', suppressClick: true }), null);
});
