import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceCity,
  CAPACITY,
  cityOffers,
  enqueueConstruction,
  MAX_QUEUE_LENGTH,
  newCity,
  commanderScore,
  demolishBuilding,
  demolitionPreview,
  resourceCapacities,
} from '../packages/game-core/index.js';
import { advanceMilitary, applySkillConversion, applySkillDistribution, barracksIsBusy, enqueueTraining, generalLevel, newMilitary, normalizeGeneral, previewSkillConversion, renameGeneral, skillSummary, startScoutMission, validateGeneralName } from '../packages/game-core/military.js';
import { mapDistance, publicMap, randomFreeLocation, terrainAt } from '../packages/game-core/world.js';

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

test('Produktionsgebäude und Lagerhäuser erhöhen ressourcenspezifische Kapazitäten erst nach Abschluss', () => {
  let city = newCity(0);
  city.resources = { wood: 2000, stone: 2000, food: 2000 };
  city = enqueueConstruction(city, command('upgrade-sawmill', 'plot-1', 'sawmill'), 0);
  city = enqueueConstruction(city, command('warehouse-one', 'plot-4', 'warehouse'), 0);
  city.resources = { wood: 2200, stone: 2200, food: 2200 };
  assert.deepEqual(resourceCapacities(city), { wood: 2000, stone: 2000, food: 2000 });
  city = advanceCity(city, 15_000);
  assert.deepEqual(resourceCapacities(city), { wood: 2750, stone: 2500, food: 2500 });
  assert.equal(city.resources.wood, 2210, 'im vollen Lager pausierte Produktion wird nicht nachgeholt');
});

test('Abriss erstattet nur nachgewiesene Investitionen und erhält Überbestand', () => {
  let city = newCity(0);
  city.resources = { wood: 1000, stone: 1000, food: 2500 };
  city = advanceCity(enqueueConstruction(city, command('warehouse-build', 'plot-4', 'warehouse'), 0), 5000);
  const { preview } = demolitionPreview(city, 'plot-4', 5000);
  assert.deepEqual(preview.refund, { wood: 4, stone: 3, food: 0 });
  assert.deepEqual(preview.capacityAfter, { wood: 2000, stone: 2000, food: 2000 });
  const demolished = demolishBuilding(city, preview, 5000).city;
  assert.equal(demolished.resources.food, 2500);
  assert.equal(demolished.buildingSlots[3].building, null);
  assert.throws(() => demolishBuilding(city, { ...preview, version: 'stale' }, 5000), /veraltet/);
  assert.equal(commanderScore(demolished).total, 30);
});

test('Unbekannte Altinvestitionen werden nicht aus aktuellen Preisen rekonstruiert', () => {
  const city = newCity(0); const slot = city.buildingSlots[0];
  slot.investment = { complete: false, paid: { wood: 80, stone: 0, food: 0 } };
  const { preview } = demolitionPreview(city, slot.id, 0);
  assert.equal(preview.investmentComplete, false);
  assert.deepEqual(preview.refund, { wood: 8, stone: 0, food: 0 });
});

test('Kartendistanz verwendet dokumentierte euklidische Luftlinie', () => {
  assert.equal(mapDistance({ x: 2, y: 3 }, { x: 2, y: 3 }), 0);
  assert.equal(mapDistance({ x: 2, y: 3 }, { x: 5, y: 3 }), 3);
  assert.equal(mapDistance({ x: 2, y: 3 }, { x: 2, y: 7 }), 4);
  assert.equal(mapDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test('Öffentliche Kartenausschnitte geben keine internen NPC-Bestände preis', () => {
  const world = { map: { seed: 12, revision: 3, config: { width: 4, height: 4, maxViewport: 4 }, entities: [
    { id: 'own', kind: 'player', playerId: 'p1', name: 'Eigen', commanderName: 'Alpha', x: 0, y: 0 },
    { id: 'npc-1', kind: 'npc', name: 'NPC', difficulty: 2, x: 3, y: 3, resources: { food: { amount: 500, regenerationPerHour: 25 } }, garrison: ['secret'] },
  ] } };
  const view = publicMap(world, 'p1', { x: 0, y: 0, width: 4, height: 4 });
  assert.ok(Math.abs(view.entities.find(entity => entity.id === 'npc-1').distance - Math.sqrt(18)) < 1e-12);
  assert.equal(JSON.stringify(view).includes('500'), false);
  assert.equal(JSON.stringify(view).includes('secret'), false);
  assert.equal(view.terrain[0].type, terrainAt(0, 0, 12));
  assert.throws(() => publicMap(world, 'p1', { x: 0, y: 0, width: 5, height: 1 }), /zu groß/);
});

test('Zufällige Stadtpositionen wählen nur freie, bebaubare Felder', () => {
  const map = { seed: 7, config: { width: 4, height: 3 }, entities: [
    { id: 'occupied-1', x: 0, y: 0 },
    { id: 'occupied-2', x: 1, y: 0 },
  ] };
  const firstChoice = randomFreeLocation(map, () => 0);
  const lastChoice = randomFreeLocation(map, count => count - 1);
  assert.notDeepEqual(firstChoice, lastChoice);
  for (const location of [firstChoice, lastChoice]) {
    assert.equal(map.entities.some(entity => entity.x === location.x && entity.y === location.y), false);
    assert.notEqual(terrainAt(location.x, location.y, map.seed), 'water');
  }
});

test('Militärplätze sind getrennt und fertige Gebäude ergeben abgeleitete Punkte', () => {
  let city = newCity(0);
  assert.equal(commanderScore(city).total, 30);
  assert.throws(() => enqueueConstruction(city, command('bad-area', 'plot-4', 'barracks'), 0), /Baubereich/);
  city = enqueueConstruction(city, command('barracks-1', 'military-plot-1', 'barracks'), 0);
  assert.equal(commanderScore(city).total, 30, 'wartende Aufträge zählen nicht');
  city = advanceCity(city, 5000);
  assert.equal(commanderScore(city).total, 40);
});

test('Ausbildung, General und Aufklärung werden zeitlich und einmalig fortgeschrieben', () => {
  const city = newCity(0); city.militarySlots[0] = { ...city.militarySlots[0], building: 'barracks', level: 1 };
  let military = newMilitary('p1');
  const training = enqueueTraining(military, city, { id: 'train-1', barracksSlotId: 'military-plot-1', unit: 'scout', amount: 2 }, 0);
  assert.equal(training.military.units.scout, 0); assert.equal(training.city.resources.wood, 180);
  military = advanceMilitary(training.military, 4000);
  assert.equal(military.units.scout, 2);
  military = startScoutMission(military, { id: 'mission-1', generalId: 'general-p1', scouts: 2 }, 4000, { x: 0, y: 0 }, { id: 'npc-1', kind: 'npc', name: 'Ziel', x: 1, y: 0 });
  assert.equal(military.units.scout, 0); assert.equal(military.generals[0].status, 'scouting');
  assert.throws(() => startScoutMission(military, { id: 'mission-2', generalId: 'general-p1', scouts: 1 }, 4000, { x: 0, y: 0 }, { id: 'npc-2', kind: 'npc', name: 'Zweites Ziel', x: 2, y: 0 }), /freier General/);
  const npc = new Map([['npc-1', { resources: { food: { amount: 321, capacity: 500 } } }]]);
  military = advanceMilitary(military, 9000, npc);
  assert.equal(military.reports.length, 0); assert.equal(military.missions[0].status, 'returning');
  military = advanceMilitary(military, 14000, npc);
  assert.equal(military.units.scout, 2); assert.equal(military.reports[0].intelligence.food.amount, 321); assert.equal(military.generals[0].experience, 10);
  assert.equal(advanceMilitary(military, 20000, npc).generals[0].experience, 10);
  assert.equal(generalLevel(100), 2); assert.equal(generalLevel(300), 3);
});

test('Generäle behalten stabile Identitäten, getrennten Fortschritt und Unicode-Namen', () => {
  const military = newMilitary('owner');
  military.generals.push(normalizeGeneral({ id: 'general-two', ownerId: 'owner', name: 'General', experience: 100, level: 2, leadership: 40, status: 'idle' }));
  const renamed = renameGeneral(military, { generalId: 'general-two', name: '  李 Ægir 🚀  ', expectedVersion: 1 });
  assert.equal(renamed.generals[1].name, '李 Ægir 🚀');
  assert.equal(renamed.generals[0].name, 'General');
  assert.equal(renamed.generals[1].version, 2);
  assert.throws(() => renameGeneral(renamed, { generalId: 'general-two', name: 'Veraltet', expectedVersion: 1 }), /inzwischen geändert/);
  assert.throws(() => validateGeneralName('x\nname'), /Steuerzeichen/);
  assert.throws(() => validateGeneralName('😀'.repeat(41)), /1–40/);
});

test('Skillgrundlage berechnet steigende Kosten und verteilt nur freie Punkte', () => {
  const rules = { costForPoint: earned => 10 * (earned + 1) };
  const general = normalizeGeneral({ id: 'skill-general', name: 'Ada', experience: 65, level: 1, leadership: 20, status: 'idle' });
  assert.deepEqual(previewSkillConversion(general, 3, rules), { points: 3, cost: 60, remainingExperience: 5, totalPoints: 3 });
  const converted = applySkillConversion(general, 2, rules);
  assert.equal(converted.experience, 65, 'Gesamterfahrung und damit Levelgrundlage bleibt erhalten');
  assert.deepEqual(skillSummary(converted), { experienceSpent: 30, totalPoints: 2, allocations: { leadership: 0, attack: 0, defense: 0 }, availableExperience: 35, freePoints: 2 });
  const distributed = applySkillDistribution(converted, { attack: 1, defense: 1 });
  assert.equal(skillSummary(distributed).freePoints, 0);
  assert.throws(() => applySkillDistribution(distributed, { attack: 1 }), /Nicht genügend/);
  assert.throws(() => previewSkillConversion(general, 4, rules), /Nicht genügend/);
  assert.throws(() => previewSkillConversion(general, 1, { costForPoint: () => 0 }), /positive/);
});

test('Eine große Ausbildungsgruppe blockiert die Kaserne bis zum gemeinsamen Abschluss', () => {
  const city = newCity(0);
  city.militarySlots[0] = { ...city.militarySlots[0], building: 'barracks', level: 1 };
  city.resources = { wood: 2000, stone: 2000, food: 2000 };
  const result = enqueueTraining(newMilitary('batch-player'), city, { id: 'train-100', barracksSlotId: 'military-plot-1', unit: 'scout', amount: 100 }, 0);

  assert.equal(result.military.trainingQueue[0].finishesAt, 200_000);
  assert.equal(barracksIsBusy(result.military, 'military-plot-1'), true);
  assert.equal(result.city.resources.wood, 1000);
  assert.equal(advanceMilitary(result.military, 199_999).units.scout, 0);
  const completed = advanceMilitary(result.military, 200_000);
  assert.equal(completed.units.scout, 100);
  assert.equal(completed.trainingQueue.length, 0);
  assert.equal(barracksIsBusy(completed, 'military-plot-1'), false);
});

test('Jede Kaserne besitzt drei eigene Slots und bildet parallel aus', () => {
  let city = newCity(0);
  city.militarySlots[0] = { ...city.militarySlots[0], building: 'barracks', level: 1 };
  city.militarySlots[1] = { ...city.militarySlots[1], building: 'barracks', level: 1 };
  city.resources = { wood: 2000, stone: 2000, food: 2000 };
  let military = newMilitary('parallel-player');

  for (let index = 0; index < 3; index += 1) {
    ({ city, military } = enqueueTraining(military, city, { id: `first-${index}`, barracksSlotId: 'military-plot-1', unit: 'scout', amount: 1 }, 0));
  }
  assert.throws(() => enqueueTraining(military, city, { id: 'first-full', barracksSlotId: 'military-plot-1', unit: 'scout', amount: 1 }, 0), /dieser Kaserne ist voll/);
  const second = enqueueTraining(military, city, { id: 'second-1', barracksSlotId: 'military-plot-2', unit: 'infantry', amount: 1 }, 0);
  assert.equal(second.military.trainingQueue.find(job => job.id === 'second-1').finishesAt, 3000);
  assert.equal(second.military.trainingQueue.find(job => job.id === 'first-2').finishesAt, 6000);
  assert.equal(advanceMilitary(second.military, 3000).units.infantry, 1);
});
