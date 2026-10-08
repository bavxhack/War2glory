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
import { advanceMilitary, applySkillConversion, applySkillDistribution, barracksIsBusy, enqueueTraining, generalLevel, newMilitary, normalizeGeneral, previewSkillConversion, renameGeneral, resolveNpcCombat, skillSummary, startRaidMission, startScoutMission, validateGeneralName, validateMissionUnits } from '../packages/game-core/military.js';

test('lokale Militärfortschreibung rechnet Farmzüge nicht als Späherrückkehr ab', () => {
  const military = newMilitary('raid-clock');
  military.units.infantry = 20;
  const deployed = startRaidMission(military, { id: 'raid-clock', generalId: military.generals[0].id, infantry: 10 }, 0,
    { x: 0, y: 0 }, { id: 'npc', name: 'Ziel', kind: 'npc', x: 1, y: 0 }, 1);
  assert.deepEqual(advanceMilitary(deployed, 20_000), deployed);
  deployed.missions[0].status = 'returning';
  deployed.missions[0].result = { survivors: 7 };
  assert.deepEqual(advanceMilitary(deployed, 20_000), deployed);
  assert.equal(deployed.units.scout, 0);
});
import { advanceNpc, mapDistance, publicMap, randomFreeLocation, terrainAt } from '../packages/game-core/world.js';

const command = (id, slotId, building) => ({ id, slotId, building });

test('Vorläufiger NPC-Kampf ist deterministisch und validiert Truppenmengen', () => {
  assert.deepEqual(resolveNpcCombat(10, 5), { victory: true, attackerLosses: 3, defenderLosses: 5, survivors: 7 });
  assert.deepEqual(resolveNpcCombat(4, 5), { victory: false, attackerLosses: 4, defenderLosses: 2, survivors: 0 });
  assert.deepEqual(resolveNpcCombat(5, 5), { victory: false, attackerLosses: 5, defenderLosses: 2, survivors: 0 });
  assert.deepEqual(resolveNpcCombat(5, 0), { victory: true, attackerLosses: 0, defenderLosses: 0, survivors: 5 });
  for (const invalid of [0, -1, 1.5]) assert.throws(() => resolveNpcCombat(invalid, 5), /positive Ganzzahl/);
});

test('NPC-Regeneration erhält Bruchteile und spart bei voller Garnison nichts an', () => {
  const npc = { kind: 'npc', resources: { food: { amount: 100, capacity: 500, regenerationPerHour: 25, updatedAt: 0 } },
    garrison: { amount: 4, capacity: 5, progressMs: 0, updatedAt: 0 } };
  const partial = advanceNpc(npc, 150_000);
  assert.equal(partial.resources.food.amount, 100 + 25 * 150 / 3600);
  assert.deepEqual({ amount: partial.garrison.amount, progressMs: partial.garrison.progressMs }, { amount: 4, progressMs: 150_000 });
  const rebuilt = advanceNpc(partial, 300_000);
  assert.deepEqual({ amount: rebuilt.garrison.amount, progressMs: rebuilt.garrison.progressMs }, { amount: 5, progressMs: 0 });
  const fullLater = advanceNpc(rebuilt, 900_000);
  fullLater.garrison.amount = 4;
  assert.equal(advanceNpc(fullLater, 900_001).garrison.amount, 4);
  assert.equal(npc.resources.food.amount, 100);
});

test('Farmzug reserviert General und Infanterie ohne vorläufiges Führungslimit', () => {
  const origin = { x: 0, y: 0 }; const target = { id: 'npc-1', kind: 'npc', name: 'NPC', x: 1, y: 0 };
  const military = newMilitary('p1'); military.units.infantry = 21;
  const mission = startRaidMission(military, { id: 'raid-1', generalId: 'general-p1', infantry: 20 }, 100, origin, target, 7);
  assert.equal(mission.units.infantry, 1); assert.equal(mission.generals[0].status, 'raiding'); assert.equal(mission.missions[0].eventSequence, 7);
  const allInfantry = startRaidMission(military, { id: 'raid-2', generalId: 'general-p1', infantry: 21 }, 100, origin, target, 8);
  assert.equal(allInfantry.units.infantry, 0);
  assert.throws(() => startRaidMission(military, { id: 'raid-3', generalId: 'general-p1', infantry: 22 }, 100, origin, target, 9), /verfügbare Infanterie/);
});

test('Einsätze sind auf insgesamt 10.000 Einheiten begrenzt', () => {
  assert.equal(validateMissionUnits({ infantry: 6_000, truck: 4_000 }), 10_000);
  assert.throws(() => validateMissionUnits({ infantry: 6_001, truck: 4_000 }), /höchstens 10000/);
  const origin = { x: 0, y: 0 };
  const target = { id: 'npc-limit', kind: 'npc', name: 'NPC', x: 1, y: 0 };
  const raidMilitary = newMilitary('raid-limit');
  raidMilitary.units.infantry = 10_001;
  assert.equal(startRaidMission(raidMilitary, { id: 'raid-10000', generalId: 'general-raid-limit', infantry: 10_000 }, 0, origin, target, 1).missions[0].infantry, 10_000);
  assert.throws(() => startRaidMission(raidMilitary, { id: 'raid-10001', generalId: 'general-raid-limit', infantry: 10_001 }, 0, origin, target, 2), /höchstens 10000/);

  const scoutMilitary = newMilitary('scout-limit');
  scoutMilitary.units.scout = 10_001;
  assert.equal(startScoutMission(scoutMilitary, { id: 'scout-10000', generalId: 'general-scout-limit', scouts: 10_000 }, 0, origin, target).missions[0].scouts, 10_000);
  assert.throws(() => startScoutMission(scoutMilitary, { id: 'scout-10001', generalId: 'general-scout-limit', scouts: 10_001 }, 0, origin, target), /höchstens 10000/);
});

test('Produktion und Übergänge verändern den Ausgangszustand nicht', () => {
  const city = newCity(0);
  assert.equal(advanceCity(city, 5000).resources.wood, 205);
  assert.equal(city.resources.wood, 200);
});

test('Neubau und Ausbau reservieren feste Bauplätze und ziehen Kosten einmal ab', () => {
  const city = newCity(0);
  const building = enqueueConstruction(city, command('command-1', 'plot-4', 'farm'), 0);
  assert.deepEqual(building.resources, { wood: 160, stone: 170, food: 200, oil: 0 });
  assert.equal(building.buildingSlots[3].building, null);
  assert.equal(building.constructionQueue[0].type, 'build');
  assert.throws(() => enqueueConstruction(building, command('command-2', 'plot-4', 'sawmill'), 0), /bereits/);
  assert.deepEqual(city.resources, { wood: 200, stone: 200, food: 200, oil: 0 });
});

test('Mehrere Offline-Abschlüsse ändern Produktion zu den exakten Zeitpunkten', () => {
  let city = newCity(0);
  city = enqueueConstruction(city, command('command-1', 'plot-1', 'sawmill'), 0);
  city = enqueueConstruction(city, command('command-2', 'plot-2', 'quarry'), 0);
  city = enqueueConstruction(city, command('command-3', 'plot-4', 'farm'), 0);
  const later = advanceCity(city, 30000);
  assert.deepEqual(later.resources, { wood: 50, stone: 90, food: 235, oil: 0 });
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

  city.resources = { wood: 1000, stone: 1000, food: 200, oil: 0 };
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
  city.resources = { wood: 2000, stone: 2000, food: 2000, oil: 0 };
  city = enqueueConstruction(city, command('upgrade-sawmill', 'plot-1', 'sawmill'), 0);
  city = enqueueConstruction(city, command('warehouse-one', 'plot-4', 'warehouse'), 0);
  city.resources = { wood: 2200, stone: 2200, food: 2200, oil: 0 };
  assert.deepEqual(resourceCapacities(city), { wood: 2000, stone: 2000, food: 2000, oil: 2000 });
  city = advanceCity(city, 15_000);
  assert.deepEqual(resourceCapacities(city), { wood: 2750, stone: 2500, food: 2500, oil: 2500 });
  assert.equal(city.resources.wood, 2210, 'im vollen Lager pausierte Produktion wird nicht nachgeholt');
});

test('Abriss erstattet nur nachgewiesene Investitionen und erhält Überbestand', () => {
  let city = newCity(0);
  city.resources = { wood: 1000, stone: 1000, food: 2500, oil: 0 };
  city = advanceCity(enqueueConstruction(city, command('warehouse-build', 'plot-4', 'warehouse'), 0), 5000);
  const { preview } = demolitionPreview(city, 'plot-4', 5000);
  assert.deepEqual(preview.refund, { wood: 4, stone: 3, food: 0, oil: 0 });
  assert.deepEqual(preview.capacityAfter, { wood: 2000, stone: 2000, food: 2000, oil: 2000 });
  const demolished = demolishBuilding(city, preview, 5000).city;
  assert.equal(demolished.resources.food, 2500);
  assert.equal(demolished.buildingSlots[3].building, null);
  assert.throws(() => demolishBuilding(city, { ...preview, version: 'stale' }, 5000), /veraltet/);
  assert.equal(commanderScore(demolished).total, 30);
});

test('Unbekannte Altinvestitionen werden nicht aus aktuellen Preisen rekonstruiert', () => {
  const city = newCity(0); const slot = city.buildingSlots[0];
  slot.investment = { complete: false, paid: { wood: 80, stone: 0, food: 0, oil: 0 } };
  const { preview } = demolitionPreview(city, slot.id, 0);
  assert.equal(preview.investmentComplete, false);
  assert.deepEqual(preview.refund, { wood: 8, stone: 0, food: 0, oil: 0 });
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

test('Aufklärung darf alle stationierten Späher ohne vorläufiges Führungslimit entsenden', () => {
  const military = newMilitary('scout-owner');
  military.units.scout = 25;
  const mission = startScoutMission(military, { id: 'large-scout', generalId: 'general-scout-owner', scouts: 25 }, 0,
    { x: 0, y: 0 }, { id: 'npc-1', kind: 'npc', name: 'Ziel', x: 1, y: 0 });
  assert.equal(mission.units.scout, 0);
  assert.equal(mission.missions[0].scouts, 25);
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
  city.resources = { wood: 2000, stone: 2000, food: 2000, oil: 0 };
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
  city.resources = { wood: 2000, stone: 2000, food: 2000, oil: 0 };
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
