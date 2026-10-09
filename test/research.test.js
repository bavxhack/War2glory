import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { advanceCity, capacityBreakdown, commanderScore, demolitionPreview, demolishBuilding, enqueueConstruction, newCity, productionRates, resourceCapacities } from '../packages/game-core/index.js';
import { newResearch, RESEARCH_RULES, researchOffers, researchQuote, startResearch } from '../packages/game-core/research.js';
import { advanceSupply, assignMayor, supplySummary } from '../packages/game-core/supply.js';
import { newMilitary } from '../packages/game-core/military.js';
import { WorldStorage } from '../apps/server/storage.js';

function cityAt() {
  const city = newCity(0); city.resources = { wood: 2000, stone: 2000, food: 1000, oil: 0 };
  Object.assign(city.buildingSlots[3], { building: 'university', buildingId: 'university-1', level: 2, investment: { complete: true, paid: { wood: 120, stone: 90, food: 0, oil: 0 } } });
  return city;
}
const command = (technology = 'forestry', targetLevel = 1) => ({ id: 'research-test', technology, targetLevel, universityId: 'university-1', expectedUniversityLevel: 2, rulesetVersion: RESEARCH_RULES.version });

test('university builds only on civil plots, no income/capacity and uses normal investment/score', () => {
  const city = newCity(0);
  assert.throws(() => enqueueConstruction(city, { id: 'bad', slotId: 'military-plot-1', building: 'university' }, 0), /Baubereich/);
  const queued = enqueueConstruction(city, { id: 'uni', slotId: 'plot-4', building: 'university' }, 0);
  assert.equal(queued.resources.wood, 160); assert.equal(queued.resources.stone, 170);
  const built = advanceCity(queued, 5000); assert.equal(built.buildingSlots[3].level, 1);
  assert.deepEqual(productionRates(built), { wood: 1, stone: 1, food: 1, oil: 0 });
  assert.deepEqual(resourceCapacities(built), { wood: 2000, stone: 2000, food: 2000, oil: 2000 });
  assert.equal(commanderScore(built).buildings, 40);
  assert.deepEqual(built.buildingSlots[3].investment.paid, { wood: 40, stone: 30, food: 0, oil: 0 });
});

test('research quotes exact costs/duration, rejects foreign/stale/manipulated requirements atomically', () => {
  const city = cityAt(); city.research.levels.forestry = 1;
  const quote = researchQuote(city, command('forestry', 2)); assert.deepEqual(quote.cost, { wood: 200, stone: 200 }); assert.equal(quote.durationMs, 110000);
  const previous = structuredClone(city);
  for (const overrides of [{ technology: 'pvp' }, { universityId: 'foreign' }, { rulesetVersion: 'fake' }, { targetLevel: 3 }, { expectedUniversityLevel: 1 }, { expectedUniversityLevel: null }]) assert.throws(() => startResearch(city, { ...command('forestry', 2), ...overrides }, 0));
  assert.deepEqual(city, previous);
  const begun = startResearch(city, { ...command('forestry', 2), cost: { wood: 0 }, durationMs: 1 }, 0);
  assert.equal(begun.resources.wood, 1800); assert.equal(begun.research.active.durationMs, 110000); assert.equal(begun.research.active.universityLevel, 2);
  assert.throws(() => startResearch(begun, command('agriculture'), 0), /bereits/);
  const low = cityAt(); low.buildingSlots[3].level = 1; low.research.levels.forestry = 1;
  assert.throws(() => researchQuote(low, { ...command('forestry', 2), expectedUniversityLevel: 1 }), /Stufe 2/);
  low.resources.wood = 0; assert.throws(() => researchQuote(low, { ...command('masonry'), expectedUniversityLevel: 1 }), /Rohstoffe/);
  const offers = researchOffers(low); assert.equal(offers[0].nextCost.wood, 200); assert.ok(offers[0].universities[0].reason);
});

test('only completed research changes production, exact offline boundary and idempotent points', () => {
  const city = cityAt(); city.buildingSlots[3].level = 1; city.resources.wood = 1000;
  const started = startResearch(city, { ...command(), expectedUniversityLevel: 1 }, 0);
  assert.equal(commanderScore(started).research, 0);
  const before = advanceCity(started, 59999); assert.equal(before.research.levels.forestry, 0);
  const done = advanceCity(started, 120000); assert.equal(done.resources.wood, 900 + 60 + 63);
  assert.equal(done.research.active, null); assert.equal(done.research.levels.forestry, 1); assert.equal(commanderScore(done).research, 10);
  const split = advanceCity(advanceCity(started, 30000), 120000); assert.deepEqual(split, done);
  assert.deepEqual(advanceCity(done, 120000), done);
});

test('mayor multiplies researched food once, logistics creates room without supplies', () => {
  const city = cityAt(); city.buildingSlots[2].level = 2; city.research.levels.agriculture = 2;
  const p = { city, military: assignMayor(newMilitary('p'), 'general-p') }; p.military.units.infantry = 30;
  const summary = supplySummary(p); assert.equal(summary.baseProduction, 2); assert.ok(Math.abs(summary.production - 2.64) < 1e-12); assert.ok(Math.abs(summary.net + 0.36) < 1e-12);
  assert.ok(Math.abs(advanceSupply(p, 60000, 0).city.resources.food - 978.4) < 1e-9);
  city.buildingSlots[2].level = 3; city.research.levels.logistics = 2;
  assert.equal(resourceCapacities(city).food, 2750); assert.equal(city.resources.food, 1000);
  assert.equal(capacityBreakdown(city).food.researchFactor, 1.1);
});

test('running research locks demolition; upgrades do not change duration; knowledge survives rebuild', () => {
  let city = startResearch(cityAt(), command(), 0);
  assert.throws(() => demolitionPreview(city, 'plot-4', 0), /Forschung/);
  const duration = city.research.active.durationMs;
  city = enqueueConstruction(city, { id: 'upgrade', slotId: 'plot-4', building: 'university' }, 0);
  city = advanceCity(city, 20000); assert.equal(city.buildingSlots[3].level, 3); assert.equal(city.research.active.durationMs, duration);
  city = advanceCity(city, duration);
  const { preview } = demolitionPreview(city, 'plot-4', duration);
  city = demolishBuilding(city, preview, duration).city;
  assert.equal(city.research.levels.forestry, 1); assert.equal(productionRates(city).wood, 1.05);
  city = advanceCity(enqueueConstruction(city, { id: 'rebuild', slotId: 'plot-4', building: 'university' }, duration), duration + 5000);
  assert.equal(city.research.levels.forestry, 1); assert.equal(productionRates(city).wood, 1.05);
});

test('research continues in hunger and timely agriculture prevents same-time hunger loss', () => {
  let city = cityAt(); city.buildingSlots[3].level = 1; city.buildingSlots[2].level = 2;
  city = startResearch(city, { ...command('agriculture'), expectedUniversityLevel: 1 }, 0);
  city.research.active.finishesAt = 1800000; city.research.active.durationMs = 1800000;
  city.resources.food = 0;
  const p = { city, military: newMilitary('p') }; p.military.units.infantry = 21;
  const done = advanceSupply(p, 1800000, 0);
  assert.equal(done.city.research.levels.agriculture, 1); assert.equal(done.supply.events.length, 0); assert.equal(done.supply.inShortage, false);
  assert.equal(done.military.units.infantry, 21); assert.equal(done.supply.shortageMs, 1800000);
  const recovered = advanceSupply(done, 1860000, 0); assert.equal(recovered.supply.shortageMs, 0);
});

test('two universities still one research, max level enforced and all four effects', () => {
  let city = cityAt(); Object.assign(city.buildingSlots[4], { building: 'university', buildingId: 'uni-2', level: 5 });
  city = startResearch(city, command(), 0);
  assert.throws(() => startResearch(city, { ...command('masonry'), universityId: 'uni-2', expectedUniversityLevel: 5 }, 0), /bereits/);
  city.research.active = null; Object.assign(city.research.levels, { forestry: 5, masonry: 2, agriculture: 3, logistics: 4 });
  assert.throws(() => researchQuote(city, command('forestry', 6)), /Forschungsstufe/);
  assert.deepEqual(productionRates(city), { wood: 1.25, stone: 1.1, food: 1.15, oil: 0 });
  assert.equal(commanderScore(city).research, 140); assert.equal(resourceCapacities(city).wood, 2400);
});

test('schema migration preserves existing data and research/return ordering survives journal/restart', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'w2g-research-')); t.after(() => rm(directory, { recursive: true, force: true }));
  let now = 0; let storage = await new WorldStorage(directory, 'test', () => now).initialize();
  let { player } = await storage.register('ResearchState', 'long-test-password');
  player.schemaVersion = 8; delete player.city.research; await storage.savePlayer(player);
  player = await storage.loadPlayer(player.playerId); assert.equal(player.schemaVersion, 14); assert.deepEqual(player.city.research, newResearch());
  player.city = cityAt(); player.city.buildingSlots[3].level = 1;
  player.city = startResearch(player.city, { ...command('logistics'), expectedUniversityLevel: 1 }, 0);
  player.city.resources.food = 2000;
  player.military.generals[0].status = 'raiding';
  player.military.missions.push({ id: 'return', type: 'raid', status: 'returning', targetId: 'npc-1', generalId: player.military.generals[0].id, generalName: 'General', startedAt: 0, arrivesAt: 1000, returnsAt: 60000, eventSequence: 1, infantry: 1, result: { survivors: 1, loadedFood: 100, generalExperience: 0, combatScore: 0 } });
  await storage.savePlayer(player); now = 60000; storage = await new WorldStorage(directory, 'test', () => now).initialize();
  const done = await storage.loadPlayer(player.playerId); assert.equal(done.city.research.levels.logistics, 1); assert.equal(done.city.resources.food, 2100); assert.equal(done.military.reports[0].storedFood, 100);
  await writeFile(storage.journalFile, JSON.stringify({ world: storage.world, players: [done] }));
  storage = await new WorldStorage(directory, 'test', () => now).initialize(); const recovered = await storage.loadPlayer(player.playerId); assert.deepEqual(recovered.city, done.city); assert.equal(recovered.military.reports.length, 1);
});

test('journal write failure/recovery in the same process preserves single completion', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'w2g-research-failure-')); t.after(() => rm(directory, { recursive: true, force: true }));
  let now = 0; const storage = await new WorldStorage(directory, 'test', () => now).initialize();
  let { player } = await storage.register('ResearchFailure', 'long-test-password');
  player.city = cityAt(); player.city.buildingSlots[3].level = 1;
  player.city = startResearch(player.city, { ...command(), expectedUniversityLevel: 1 }, 0); await storage.savePlayer(player);
  // A directory at the private test player's path makes atomic rename fail after the journal write.
  const file = storage.playerFile(player.playerId); const original = await readFile(file);
  await rm(file); await mkdir(file);
  // advanceWorld needs to load first, so inject the isolated snapshot as the reader result.
  const load = storage.loadPlayer.bind(storage); storage.loadPlayer = async () => structuredClone(player);
  now = 60000; await assert.rejects(storage.advanceWorld(now));
  assert.equal(JSON.parse(await readFile(storage.journalFile, 'utf8')).players[0].city.research.levels.forestry, 1);
  await rm(file, { recursive: true }); await writeFile(file, original); storage.loadPlayer = load;
  await storage.advanceWorld(now); const done = await load(player.playerId);
  assert.equal(done.city.research.levels.forestry, 1); assert.equal(commanderScore(done.city).research, 10); assert.equal(done.city.research.active, null);
  await storage.advanceWorld(now); assert.deepEqual((await load(player.playerId)).city, done.city);
});
