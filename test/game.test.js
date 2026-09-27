import test from 'node:test';
import assert from 'node:assert/strict';
import { newCity, advanceCity, startUpgrade, CAPACITY } from '../packages/game-core/index.js';

test('Produktion und Übergänge verändern den Ausgangszustand nicht', () => {
  const city = newCity(0);
  assert.equal(advanceCity(city, 5000).resources.wood, 205);
  assert.equal(city.resources.wood, 200);
});
test('Offline-Produktion berücksichtigt den exakten Fertigstellungszeitpunkt', () => {
  const city = startUpgrade(newCity(0), 'sawmill', 0);
  // 200 Start - 80 Kosten + 10 Sekunden * 1 + 10 Sekunden * 2 = 150.
  const later = advanceCity(city, 20000);
  assert.equal(later.resources.wood, 150);
  assert.equal(later.buildings.sawmill, 2);
  assert.equal(later.construction, null);
});
test('Doppelbau, unbekannte Gebäude und fehlende Rohstoffe werden abgelehnt', () => {
  assert.throws(() => startUpgrade(startUpgrade(newCity(0), 'farm', 0), 'quarry', 0));
  assert.throws(() => startUpgrade(newCity(0), '__proto__', 0));
  const city = newCity(0);
  city.resources.wood = 0;
  assert.throws(() => startUpgrade(city, 'farm', 0));
});
test('Lagergrenze und rückwärts laufende Uhr', () => {
  assert.equal(advanceCity(newCity(0), 100000000).resources.wood, CAPACITY);
  assert.deepEqual(advanceCity(newCity(1000), 0), newCity(1000));
});
