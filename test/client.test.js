import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestId } from '../apps/client/request-id.js';
import { dragToPan } from '../apps/client/map-navigation.js';

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
