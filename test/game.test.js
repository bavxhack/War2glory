import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceCity,
  CAPACITY,
  cityOffers,
  enqueueConstruction,
  MAX_QUEUE_LENGTH,
  newCity,
} from '../packages/game-core/index.js';

const command = (id, slotId, building) => ({ id, slotId, building });

test('Produktion und Übergänge verändern den Ausgangszustand nicht', () => {
  const city = newCity(0);
  assert.equal(advanceCity(city, 5000).resources.wood, 205);
  assert.equal(city.resources.wood, 200);
});

test('Neubau und Ausbau reservieren feste Bauplätze und ziehen Kosten einmal ab', () => {
  const city = newCity(0);
  const building = enqueueConstruction(city, command('command-1', 'plot-4', 'farm'), 0);
  assert.deepEqual(building.resources, { wood: 160, stone: 170, food: 200 });
  assert.equal(building.buildingSlots[3].building, null);
  assert.equal(building.constructionQueue[0].type, 'build');
  assert.throws(() => enqueueConstruction(building, command('command-2', 'plot-4', 'sawmill'), 0), /bereits/);
  assert.deepEqual(city.resources, { wood: 200, stone: 200, food: 200 });
});

test('Mehrere Offline-Abschlüsse ändern Produktion zu den exakten Zeitpunkten', () => {
  let city = newCity(0);
  city = enqueueConstruction(city, command('command-1', 'plot-1', 'sawmill'), 0);
  city = enqueueConstruction(city, command('command-2', 'plot-2', 'quarry'), 0);
  city = enqueueConstruction(city, command('command-3', 'plot-4', 'farm'), 0);
  const later = advanceCity(city, 30000);
  assert.deepEqual(later.resources, { wood: 50, stone: 90, food: 235 });
  assert.deepEqual(later.buildingSlots.slice(0, 4).map(slot => slot.level), [2, 2, 1, 1]);
  assert.equal(later.constructionQueue.length, 0);
});

test('Volle Warteschlange, belegte Plätze, unbekannte Gebäude und Rohstoffmangel werden abgelehnt', () => {
  let city = newCity(0);
  assert.throws(() => enqueueConstruction(city, command('command-1', 'plot-1', 'farm'), 0), /belegt/);
  assert.throws(() => enqueueConstruction(city, command('command-1', 'plot-4', '__proto__'), 0), /Unbekannt/);
  const poorCity = newCity(0);
  poorCity.resources.wood = 0;
  assert.throws(() => enqueueConstruction(poorCity, command('command-1', 'plot-4', 'farm'), 0), /Rohstoffe/);

  city.resources = { wood: 1000, stone: 1000, food: 200 };
  for (let index = 0; index < MAX_QUEUE_LENGTH; index += 1) {
    city = enqueueConstruction(city, command(`command-${index}`, `plot-${index + 1}`, Object.keys(cityOffers(city).build)[index]), 0);
  }
  assert.throws(() => enqueueConstruction(city, command('command-full', 'plot-4', 'farm'), 0), /voll/);
});

test('Lagergrenze und rückwärts laufende Uhr', () => {
  assert.equal(advanceCity(newCity(0), 100000000).resources.wood, CAPACITY);
  assert.deepEqual(advanceCity(newCity(1000), 0), newCity(1000));
});
