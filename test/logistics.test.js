import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { newCity, advanceCity, enqueueConstruction, resourceCapacities, demolitionPreview, demolishBuilding, commanderScore } from '../packages/game-core/index.js';
import { newMilitary, enqueueTraining, resolveMissionCombat, startRaidMission } from '../packages/game-core/military.js';
import { RESEARCH_RULES, TECHNOLOGIES, researchQuote, startResearch } from '../packages/game-core/research.js';
import { SUPPLY_RULES, advanceSupply, supplySummary } from '../packages/game-core/supply.js';
import { LOGISTICS_RULES, LOGISTICS_RAID_RULESET, missionQuote, startLogisticsMission, cargoCapacity, clampMissionCargo, truckCombatLosses } from '../packages/game-core/logistics.js';
import { WorldStorage } from '../apps/server/storage.js';
import { parseConfiguration, loadConfiguration } from '../apps/server/config.js';
import { forceSummary } from '../apps/client/force-summary.js';

const origin = { x: 0, y: 0 }, target = { id: 'npc-test', kind: 'npc', name: 'NPC', x: 3, y: 4 };
function fixture() {
  const p = { playerId: 'p', city: newCity(0), military: newMilitary('p'), supply: { rules: structuredClone(SUPPLY_RULES), activatedAt: 0, updatedAt: 0, shortageMs: 0, recoveryStartedAt: null, nextLossAt: null, events: [] } };
  p.city.resources = { wood: 2000, stone: 2000, food: 2000, oil: 100 };
  p.military.combatScore = 0;
  p.military.units = { infantry: 20, truck: 4, scout: 2 };
  p.military.generals[0].attributes = { leadership: 20, attack: 0, defense: 0 };
  return p;
}
function command(p, extra = {}) { return { id: 'mission-test', type: 'raid', targetId: target.id, generalId: p.military.generals[0].id, units: { infantry: 20, truck: 4 }, ...extra }; }
function start(p, c = command(p), rules = LOGISTICS_RULES) { return startLogisticsMission(p, { ...c, preview: missionQuote(p, c, origin, target, rules) }, 0, origin, target, rules); }
function university(city, level = 2) { Object.assign(city.buildingSlots[3], { building: 'university', buildingId: 'uni', level }); }
function research(city, technology, extra = {}) { return { id: 'research-test', technology, universityId: 'uni', expectedUniversityLevel: 2, rulesetVersion: RESEARCH_RULES.version, targetLevel: 1, ...extra }; }
async function storageFixture(t, config = parseConfiguration()) {
  const dir = await mkdtemp(join(tmpdir(), 'logistics-')); t.after(() => rm(dir, { recursive: true, force: true }));
  let now = 0;
  const storage = await new WorldStorage(dir, 'test', () => now, config, { warn() {} }).initialize();
  const registration = await storage.register('LogisticsTest', 'test-password-long');
  const player = registration.player;
  const playerId = player.playerId, portrait = player.military.generals[0].portraitId;
  Object.assign(player, fixture(), { playerId });
  player.military.generals[0].ownerId = playerId; player.military.generals[0].portraitId = portrait;
  const npc = storage.world.map.entities.find(e => e.kind === 'npc');
  const home = storage.world.map.entities.find(e => e.playerId === player.playerId);
  Object.assign(home, origin); Object.assign(npc, target, { id: npc.id });
  npc.garrison = { amount: 10, capacity: 10, progressMs: 0, updatedAt: 0, activatedAt: 0 };
  npc.resources.food = { amount: 1000, capacity: 1000, regenerationPerHour: 0, updatedAt: 0 };
  await storage.saveWorld(); await storage.savePlayer(player);
  return { dir, storage, player, npc, home, setNow: n => { now = n; } };
}

test('unlock dependencies, individual maxima, 182-second motorization and old research snapshots', () => {
  const p = fixture(); university(p.city);
  assert.throws(() => enqueueConstruction(p.city, { id: 'build-1', slotId: 'plot-5', building: 'refinery' }, 0), /Forschung/);
  assert.throws(() => researchQuote(p.city, research(p.city, 'motorization')), /Ölverarbeitung/);
  p.city.research.levels.oilProcessing = 1;
  assert.throws(() => researchQuote(p.city, research(p.city, 'motorization')), /Lagerlogistik/);
  p.city.research.levels.logistics = 1;
  p.military.researcherGeneralId = p.military.generals[0].id;
  const q = researchQuote(p.city, research(p.city, 'motorization'), { military: p.military });
  assert.equal(q.durationMs, 182000); assert.equal(q.factorAfter, 1); assert.deepEqual(q.cost, { wood: 500, stone: 500 });
  p.city.research.levels.motorization = 1;
  assert.throws(() => researchQuote(p.city, research(p.city, 'motorization', { targetLevel: 2 })), /stufe/);
  assert.equal(TECHNOLOGIES.forestry.maxLevel, 5); assert.equal(commanderScore(p.city).research, 30);
  for (const ruleset of ['research-1-provisional', 'research-2-leadership-provisional']) {
    const city = newCity(0); city.research.active = { technology: 'forestry', targetLevel: 1, ruleset, paidCost: { wood: 100, stone: 100 }, finishesAt: 1000, durationMs: 1000 };
    assert.equal(advanceCity(city, 1000).research.levels.forestry, 1);
  }
});

test('oil starts at zero, produces at completion, capacity 3025, demolition preserves overstock', () => {
  let city = newCity(0); assert.equal(city.resources.oil, 0); city.research.levels.oilProcessing = 1;
  city = enqueueConstruction(city, { id: 'refinery-1', slotId: 'plot-5', building: 'refinery' }, 0);
  assert.equal(advanceCity(city, 5000).resources.oil, 0); city = advanceCity(city, 15000); assert.equal(city.resources.oil, 10);
  city = enqueueConstruction(city, { id: 'refinery-2', slotId: 'plot-5', building: 'refinery' }, 15000);
  city = advanceCity(city, 30000); assert.equal(city.resources.oil, 30);
  Object.assign(city.buildingSlots[5], { building: 'warehouse', level: 1 }); city.research.levels.logistics = 2;
  assert.equal(resourceCapacities(city).oil, 3025);
  city.resources.oil = 4000;
  const { preview } = demolitionPreview(city, 'plot-5', 30000);
  assert.equal(preview.refund.wood, 12); assert.equal(preview.refund.stone, 9); assert.equal(preview.productionLoss.amount, 2);
  city = demolishBuilding(city, preview, 30000).city;
  assert.equal(advanceCity(city, 100000).resources.oil, 4000); assert.equal(city.research.levels.oilProcessing, 1);
  assert.throws(() => enqueueConstruction(city, { id: 'wrongarea', slotId: 'military-plot-1', building: 'refinery' }, 30000), /Baubereich/);
  assert.throws(() => enqueueConstruction(city, { id: 'wrongfactory', slotId: 'plot-5', building: 'vehicleFactory' }, 30000), /Baubereich/);
});

test('factory uses shared queues, exact prices, parallel groups and hunger pause without repayment', () => {
  const p = fixture(); p.city.research.levels.motorization = 1;
  Object.assign(p.city.militarySlots[0], { building: 'vehicleFactory', level: 2 });
  Object.assign(p.city.militarySlots[1], { building: 'barracks', level: 1 });
  Object.assign(p.city.militarySlots[2], { building: 'vehicleFactory', level: 1 });
  assert.throws(() => enqueueTraining(p.military, p.city, { unit: 'truck', amount: 1, barracksSlotId: 'military-plot-2' }, 0), /passenden/);
  assert.throws(() => enqueueTraining(p.military, p.city, { unit: 'infantry', amount: 1, trainingSlotId: 'military-plot-1' }, 0), /passenden/);
  for (let n = 0; n < 3; n++) Object.assign(p, enqueueTraining(p.military, p.city, { id: `truck-${n}`, unit: 'truck', amount: 2, trainingSlotId: 'military-plot-1' }, 0));
  assert.deepEqual(p.military.trainingQueue.map(j => j.finishesAt), [10000, 20000, 30000]);
  assert.equal(p.city.resources.wood, 1400); assert.equal(p.city.resources.oil, 100);
  assert.throws(() => enqueueTraining(p.military, p.city, { unit: 'truck', amount: 1, trainingSlotId: 'military-plot-1' }, 0), /voll/);
  Object.assign(p, enqueueTraining(p.military, p.city, { id: 'parallel', unit: 'truck', amount: 1, trainingSlotId: 'military-plot-3' }, 0));
  const done = advanceSupply(p, 10000, 0); assert.equal(done.military.units.truck, 7); assert.equal(done.military.trainingQueue.length, 2);
  p.city.resources.food = 0; p.city.buildingSlots[2].level = 0;
  const paused = advanceSupply(p, 10000, 0); assert.equal(paused.military.units.truck, 4); assert.equal(paused.military.trainingQueue[0].finishesAt, 20000);
  paused.city.resources.food = 1000;
  const resumed = advanceSupply(paused, 20000, 0); assert.equal(resumed.military.units.truck, 7); assert.equal(resumed.city.resources.wood, 1320); // 1300 after payment +20 production
  p.city.constructionQueue.push({ slotId: 'military-plot-3' });
  assert.throws(() => enqueueTraining(p.military, p.city, { unit: 'truck', amount: 1, trainingSlotId: 'military-plot-3' }, 0), /ausgebaut/);
});

test('fixed-point oil rounds total once, starts atomically, freezes price/cargo and rejects invalid troops', () => {
  const p = fixture(), c = command(p); const q = missionQuote(p, c, origin, target);
  assert.deepEqual(parseConfiguration().logistics.oilMilliPerField, LOGISTICS_RULES.oilMilliPerField);
  assert.equal(missionQuote(p, command(p, { units: { infantry: 20 } }), origin, target).totalOil, 20);
  assert.equal(missionQuote(p, command(p, { units: { infantry: 1 } }), origin, { ...target, x: 0, y: 0 }).totalOil, 1);
  assert.equal(missionQuote(p, { type: 'scout', generalId: c.generalId, scouts: 2 }, origin, target).totalOil, 4);
  assert.equal(q.totalOil, 60); assert.equal(q.capacity, 1200); assert.equal(q.upkeepPerHour, 7920);
  const sent = start(p); assert.equal(sent.city.resources.oil, 40); assert.equal(p.city.resources.oil, 100);
  assert.deepEqual(sent.military.units, { infantry: 0, truck: 0, scout: 2 }); assert.equal(sent.military.missions[0].paidOil, 60);
  p.city.resources.oil = 59; assert.throws(() => start(p), /Öl/); assert.equal(p.military.units.truck, 4);
  p.city.resources.oil = 100;
  const tiny = parseConfiguration({ OIL_INFANTRY_PER_FIELD: '0.001', OIL_TRUCK_PER_FIELD: '0.001' }).logistics;
  assert.equal(missionQuote(p, c, origin, target, tiny).totalOil, 1);
  const changed = parseConfiguration({ TRUCK_CARGO_CAPACITY: '300' }).logistics;
  assert.throws(() => startLogisticsMission(p, { ...c, preview: q }, 0, origin, target, changed), /vorschau/);
  for (const units of [{ infantry: 0, truck: 4 }, { infantry: -1 }, { infantry: 1.5 }, { infantry: 1, scout: 1 }, { infantry: 1, unknown: 0 }, { infantry: 9999, truck: 2 }, { infantry: NaN }, { infantry: Number.MAX_SAFE_INTEGER + 1 }]) assert.throws(() => missionQuote(p, command(p, { units }), origin, target));
  assert.throws(() => missionQuote(p, command(p, { generalId: 'foreign' }), origin, target), /eigener/);
  const scoutRules = parseConfiguration({ OIL_SCOUT_PER_FIELD: '1' }).logistics;
  const scoutCommand = { id: 'scout', type: 'scout', generalId: c.generalId, scouts: 2 };
  assert.equal(missionQuote(p, scoutCommand, origin, target, scoutRules).totalOil, 20);
  p.city.resources.oil = 19; assert.throws(() => start(p, scoutCommand, scoutRules), /Öl/);
});

test('truck combat has no strength, losses use infantry proportion including defeat and zero infantry', () => {
  const m = { ruleset: LOGISTICS_RAID_RULESET, combatBonuses: { attackPercent: 0, defensePercent: 0 } };
  const combat = resolveMissionCombat(m, 20, 10); assert.equal(combat.attackerLosses, 5); assert.equal(combat.defenderLosses, 10);
  assert.equal(truckCombatLosses(4, 5, 20), 1); assert.equal(cargoCapacity({ infantry: 15, truck: 3 }), 900);
  assert.equal(truckCombatLosses(4, 0, 20), 0); assert.equal(truckCombatLosses(4, 20, 20), 4); assert.equal(truckCombatLosses(4, 0, 0), 0);
  m.combatBonuses.defensePercent = 50; const defeat = resolveMissionCombat(m, 10, 20); assert.equal(defeat.victory, false); assert.equal(defeat.survivors, 5); assert.equal(truckCombatLosses(4, defeat.attackerLosses, 10), 2);
});

test('stationed upkeep excludes convoy; historical cargo clamp and zero food-rate types remain supported', () => {
  const p = start(fixture()); assert.equal(Math.round(supplySummary(p).upkeep * 3600), 360); // only the two stationed scouts
  const m = p.military.missions[0]; m.units = { infantry: 15, truck: 3 }; m.status = 'returning'; m.result = { loadedFood: 900 };
  m.units.truck--; clampMissionCargo(m); assert.equal(m.result.loadedFood, 700); assert.equal(m.foodLostInTransit, 200);
  m.units.infantry = 0; clampMissionCargo(m); assert.equal(m.result.loadedFood, 400);
  m.units.truck = 0; clampMissionCargo(m); assert.equal(m.result.loadedFood, 0); assert.equal(m.foodLostInTransit, 900);
  m.status = 'completed'; assert.equal(supplySummary(p).upkeep * 3600, 360);
  const free = fixture(); free.city.resources.food = 0; free.city.buildingSlots[2].level = 0;
  const rules = parseConfiguration({ UPKEEP_INFANTRY_PER_HOUR: '0', UPKEEP_SCOUT_PER_HOUR: '0', SUPPLY_GRACE_SECONDS: '1', SUPPLY_LOSS_INTERVAL_SECONDS: '1', SUPPLY_LOSS_PERCENT: '100' }).supply;
  const result = advanceSupply(free, 1000, 0, { rules }); assert.equal(result.military.units.truck, 0); assert.equal(result.military.units.infantry, 20); assert.equal(result.military.units.scout, 2);
  assert.equal(supplySummary(result).unitCounts.infantry, 20);
  assert.equal(forceSummary(p.military, ['truck']).truck.deployed, 0);
});

test('shared journal settles 877 food, +4 score, 20 XP and one return/report across restart', async t => {
  const f = await storageFixture(t); const c = command(f.player, { targetId: f.npc.id });
  const p = startLogisticsMission(f.player, { ...c, preview: missionQuote(f.player, c, f.home, f.npc, f.storage.config.logistics) }, 0, f.home, f.npc, f.storage.config.logistics);
  await f.storage.savePlayer(p); await f.storage.advanceWorld(25000);
  let current = await f.storage.loadPlayer(p.playerId), m = current.military.missions[0];
  assert.equal(m.result.loadedFood, 877); assert.deepEqual(m.units, { infantry: 15, truck: 3 }); assert.equal(m.result.combatScore, 4); assert.equal(m.result.generalExperience, 20);
  assert.equal(f.storage.world.map.entities.find(n => n.id === f.npc.id).resources.food.amount, 123);
  const restarted = await new WorldStorage(f.dir, 'test', () => 50000, parseConfiguration(), { warn() {} }).initialize();
  current = await restarted.loadPlayer(p.playerId); assert.deepEqual(current.military.units, { infantry: 15, truck: 3, scout: 2 });
  assert.equal(current.military.combatScore, 4); assert.equal(current.military.generals[0].experience, 20); assert.equal(current.military.reports.length, 1);
  assert.equal(current.military.reports[0].paidOil, 60); assert.equal(current.mailbox.readReportIds.length, 0);
  const before = structuredClone(current); await restarted.advanceWorld(50000); assert.deepEqual(await restarted.loadPlayer(p.playerId), before);
});

test('return loss 900 ->700 ->600 stores separate hunger and overflow without restoring NPC food', async t => {
  const f = await storageFixture(t), p = start(f.player); const m = p.military.missions[0]; m.targetId = f.npc.id;
  delete m.cargo; m.ruleset = LOGISTICS_RAID_RULESET; m.status = 'returning'; m.units = { infantry: 15, truck: 3 }; m.result = { survivors: 15, loadedFood: 900, capacity: 900, combatScore: 4, generalExperience: 20, combatLossesByUnit: { infantry: 5, truck: 1 } };
  m.units.truck = 2; m.hungerLossesByUnit.truck = 1; clampMissionCargo(m);
  p.city.resources.food = 1400; p.supply.rules = parseConfiguration({ UPKEEP_INFANTRY_PER_HOUR: '0', UPKEEP_TRUCK_PER_HOUR: '0', UPKEEP_SCOUT_PER_HOUR: '0' }).supply;
  p.city.buildingSlots[2].level = 0; f.storage.world.supplyRuleHistory = [{ effectiveAt: 0, rules: p.supply.rules }];
  await f.storage.saveWorld(); await f.storage.savePlayer(p); await f.storage.advanceWorld(50000);
  const report = (await f.storage.loadPlayer(p.playerId)).military.reports[0];
  assert.equal(report.originalLoadedFood, 900); assert.equal(report.foodLostInTransit, 200); assert.equal(report.storedFood, 600); assert.equal(report.overflowFood, 100);
  assert.deepEqual(report.returnedUnits, { infantry: 15, truck: 2 }); assert.equal(f.storage.world.map.entities.find(n => n.id === f.npc.id).resources.food.amount, 1000);
});

test('hunger eliminates infantry before arrival: attack cancelled, trucks return without rewards', async t => {
  const f = await storageFixture(t), p = start(f.player), m = p.military.missions[0]; m.targetId = f.npc.id;
  m.units.infantry = 0; m.hungerLossesByUnit.infantry = 20;
  await f.storage.savePlayer(p); await f.storage.advanceWorld(50000);
  const result = await f.storage.loadPlayer(p.playerId); assert.equal(result.military.reports[0].cancelled, true); assert.equal(result.military.reports[0].storedFood, 0);
  assert.equal(result.military.generals[0].experience, 0); assert.equal(result.military.combatScore, 0); assert.equal(result.military.units.truck, 4);
  assert.equal(f.storage.world.map.entities.find(n => n.id === f.npc.id).garrison.amount, 10);
});

test('migration 12 retains portraits, read status, resources, investments, queue and old mission versions', async t => {
  const f = await storageFixture(t); let p = await f.storage.loadPlayer(f.player.playerId);
  p.schemaVersion = 12; delete p.city.resources.oil; delete p.military.units.truck; delete p.city.research.levels.oilProcessing; delete p.city.research.levels.motorization;
  p.mailbox.messages = [{ id: 'message-preserved', readAt: 12 }]; p.mailbox.readReportIds = ['old-read'];
  p.city.research.active = { technology: 'forestry', targetLevel: 1, ruleset: 'research-2-leadership-provisional', durationMs: 60000, finishesAt: 60000, paidCost: { wood: 100, stone: 100 } };
  p.military.trainingQueue = [{ id: 'old-queue', barracksSlotId: 'military-plot-1', unit: 'scout', amount: 1, finishesAt: 60000 }];
  Object.assign(p.city.militarySlots[0], { building: 'barracks', level: 1 });
  p.military.missions = [1, 2, 3].map((v, i) => ({ id: `old-${v}`, type: 'raid', ruleset: ['npc-pve-1-provisional', 'npc-pve-2-skills-provisional', 'npc-pve-3-general-bases-provisional'][i], infantry: 1, status: 'outbound', arrivesAt: 60000, returnsAt: 120000 }));
  const portrait = p.military.generals[0].portraitId, messages = structuredClone(p.mailbox); await f.storage.savePlayer(p);
  p = await f.storage.loadPlayer(p.playerId); assert.equal(p.schemaVersion, 15); assert.equal(p.city.resources.oil, 0); assert.equal(p.military.units.truck, 0);
  assert.equal(p.city.research.levels.motorization, 0); assert.deepEqual(p.mailbox, messages); assert.equal(p.military.generals[0].portraitId, portrait);
  assert.equal(p.military.trainingQueue[0].trainingSlotId, 'military-plot-1'); assert.equal(p.city.research.active.finishesAt, 60000);
  assert.ok(p.military.missions.every(m => !m.units && !m.paidOil)); assert.deepEqual(await f.storage.loadPlayer(p.playerId), p);
  p.schemaVersion = 99; await f.storage.savePlayer(p); await assert.rejects(f.storage.loadPlayer(p.playerId), /99/);
});

test('config exact fixed milli rates, limits, native precedence, compose and isolated rules', async t => {
  for (const key of ['UPKEEP_TRUCK_PER_HOUR', 'OIL_TRUCK_PER_FIELD', 'TRUCK_CARGO_CAPACITY']) for (const value of ['', '-1', 'NaN', 'Infinity', '1e3', '9999999999999999999']) assert.throws(() => parseConfiguration({ [key]: value }), new RegExp(key));
  for (const value of ['0.0001', '1.1234', '100001']) assert.throws(() => parseConfiguration({ OIL_TRUCK_PER_FIELD: value }), /OIL_TRUCK/);
  assert.throws(() => parseConfiguration({ TRUCK_CARGO_CAPACITY: '0' }), /CAPACITY/);
  const zero = parseConfiguration({ UPKEEP_TRUCK_PER_HOUR: '0', OIL_TRUCK_PER_FIELD: '0.001' }); assert.equal(zero.supply.upkeepPerSecond.truck, 0); assert.equal(zero.logistics.oilMilliPerField.truck, 1);
  assert.equal(parseConfiguration({ OIL_TRUCK_PER_FIELD: '1.001' }).logistics.oilMilliPerField.truck, 1001); assert.equal(parseConfiguration().logistics.cargoPerUnit.truck, 200);
  const dir = await mkdtemp(join(tmpdir(), 'oil-env-')); t.after(() => rm(dir, { recursive: true, force: true })); const file = join(dir, '.env');
  await writeFile(file, 'OIL_TRUCK_PER_FIELD=2\nUPKEEP_TRUCK_PER_HOUR=90\nTRUCK_CARGO_CAPACITY=250\n');
  const native = await loadConfiguration({ file, env: { OIL_TRUCK_PER_FIELD: '3' } }); assert.equal(native.logistics.oilMilliPerField.truck, 3000); assert.equal(native.supply.upkeepPerSecond.truck, 0.025);
  const compose = await readFile(new URL('../compose.yaml', import.meta.url), 'utf8');
  for (const key of ['UPKEEP_TRUCK_PER_HOUR', 'OIL_INFANTRY_PER_FIELD', 'OIL_SCOUT_PER_FIELD', 'OIL_TRUCK_PER_FIELD', 'TRUCK_CARGO_CAPACITY']) assert.match(compose, new RegExp(`${key}: \\$\\{${key}-`));
});

test('offline one large step matches fine steps with research, refinery and mixed convoy', async t => {
  const f = await storageFixture(t); let p = start(f.player); p.military.missions[0].targetId = f.npc.id;
  university(p.city); p.city = startResearch(p.city, research(p.city, 'oilProcessing'), 0);
  Object.assign(p.city.buildingSlots[4], { building: 'refinery', buildingId: 'ref', level: 1 });
  p.city = enqueueConstruction(p.city, { id: 'ref-up', slotId: 'plot-5', building: 'refinery' }, 0);
  await f.storage.savePlayer(p);
  const copy = join(f.dir, 'copy'); await mkdir(join(copy, 'players'), { recursive: true });
  for (const file of ['accounts.json', 'world.json']) await writeFile(join(copy, file), await readFile(join(f.dir, file)));
  await writeFile(join(copy, 'players', `${p.playerId}.json`), await readFile(f.storage.playerFile(p.playerId)));
  const fine = await new WorldStorage(copy, 'test', () => 0, parseConfiguration(), { warn() {} }).initialize();
  await f.storage.advanceWorld(240000);
  for (let at = 1000; at <= 240000; at += 1000) await fine.advanceWorld(at);
  const large = await f.storage.loadPlayer(p.playerId), small = await fine.loadPlayer(p.playerId);
  const rounded = value => JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'number' ? Number(item.toFixed(9)) : item));
  assert.deepEqual(rounded(large.military), rounded(small.military)); assert.deepEqual(large.city.research, small.city.research); assert.equal(large.city.resources.oil, small.city.resources.oil);
  assert.ok(Math.abs(large.city.resources.food - small.city.resources.food) < 1e-8);
});

test('two players share scarce NPC food with deterministic ordered arrivals', async t => {
  const f = await storageFixture(t); const second = (await f.storage.register('LogisticsSecond', 'test-password-long')).player;
  second.military.units.infantry = 20; second.military.units.truck = 4; second.city.resources.oil = 100; second.city.resources.food = 2000;
  second.military.generals[0].attributes = { leadership: 20, attack: 0, defense: 0 };
  const home2 = f.storage.world.map.entities.find(e => e.playerId === second.playerId); Object.assign(home2, origin);
  f.npc.garrison.amount = 0; f.npc.garrison.capacity = 0; f.npc.resources.food.amount = 500;
  const rules = f.storage.config.logistics;
  for (const [n, p] of [f.player, second].entries()) {
    const c = command(p, { id: `shared-${n}`, targetId: f.npc.id });
    const sent = startLogisticsMission(p, { ...c, preview: missionQuote(p, c, origin, f.npc, rules) }, 0, origin, f.npc, rules);
    sent.military.missions[0].eventSequence = n + 1; await f.storage.savePlayer(sent);
  }
  await f.storage.saveWorld(); await f.storage.advanceWorld(50000);
  const reports = await Promise.all([f.player, second].map(async p => (await f.storage.loadPlayer(p.playerId)).military.reports[0]));
  assert.deepEqual(reports.map(r => r.originalLoadedFood), [500, 0]);
  assert.ok(reports.every(r => r.generalExperience === 0 && r.combatScore === 0));
  assert.equal(f.storage.world.map.entities.find(e => e.id === f.npc.id).resources.food.amount, 0);
});

test('journal recovery after NPC debit and failed player rename never duplicates cargo', async t => {
  const { rename } = await import('node:fs/promises'); const f = await storageFixture(t), p = start(f.player); p.military.missions[0].targetId = f.npc.id;
  await f.storage.savePlayer(p);
  const file = f.storage.playerFile(p.playerId), backup = `${file}.backup`;
  await rename(file, backup); await mkdir(file);
  // advanceWorld must first load a valid file; inject the failure at commit after it has loaded.
  await rm(file, { recursive: true }); await rename(backup, file);
  const oldFile = f.storage.playerFile.bind(f.storage); let reads = 0;
  f.storage.playerFile = id => {
    if (id === p.playerId && ++reads === 2) return join(f.dir, 'blocked-player');
    return oldFile(id);
  };
  await mkdir(join(f.dir, 'blocked-player'));
  await assert.rejects(f.storage.advanceWorld(25000), /directory|EISDIR/i);
  assert.equal(JSON.parse(await readFile(f.storage.worldFile, 'utf8')).map.entities.find(e => e.id === f.npc.id).resources.food.amount, 123);
  assert.ok(JSON.parse(await readFile(f.storage.journalFile, 'utf8')).players.length > 0);
  f.storage.playerFile = oldFile;
  await f.storage.advanceWorld(50000);
  const current = await f.storage.loadPlayer(p.playerId); assert.equal(current.military.reports.length, 1); assert.equal(current.military.reports[0].originalLoadedFood, 877); assert.equal(current.military.combatScore, 4);
  await assert.rejects(readFile(f.storage.journalFile), /ENOENT/);
});

test('active missions freeze oil/cargo across config restart; historical missing truck upkeep is zero', async t => {
  const f = await storageFixture(t), p = start(f.player); p.military.missions[0].targetId = f.npc.id;
  f.storage.world.supplyRuleHistory = [{ effectiveAt: 0, rules: { ...SUPPLY_RULES, version: 'supply-1-provisional', upkeepPerSecond: { infantry: 0, scout: 0 } } }];
  p.city.buildingSlots[2].level = 0; p.city.resources.food = 1000;
  await f.storage.saveWorld(); await f.storage.savePlayer(p);
  const changed = parseConfiguration({ OIL_TRUCK_PER_FIELD: '100', TRUCK_CARGO_CAPACITY: '1000', UPKEEP_INFANTRY_PER_HOUR: '0', UPKEEP_SCOUT_PER_HOUR: '0' });
  const restart = await new WorldStorage(f.dir, 'test', () => 10000, changed, { warn() {} }).initialize();
  let current = await restart.loadPlayer(p.playerId); assert.equal(current.city.resources.food, 1000); assert.equal(current.city.resources.oil, 40);
  assert.equal(current.military.missions[0].logistics.cargoPerUnit.truck, 200);
  await restart.advanceWorld(20000); current = await restart.loadPlayer(p.playerId); assert.equal(current.city.resources.food, 1000);
  await restart.advanceWorld(50000); current = await restart.loadPlayer(p.playerId); assert.equal(current.military.reports[0].originalLoadedFood, 877); assert.equal(current.military.reports[0].paidOil, 60);
  assert.equal(restart.world.supplyRuleHistory[0].rules.upkeepPerSecond.truck, undefined);
});

test('legacy mission versions 1–3 finish both phases unchanged through schema 12 migration', async t => {
  for (const ruleset of ['npc-pve-1-provisional', 'npc-pve-2-skills-provisional', 'npc-pve-3-general-bases-provisional']) for (const phase of ['outbound', 'returning']) {
    const f = await storageFixture(t); let p = f.player;
    p.military = startRaidMission(p.military, { id: 'legacy-raid', generalId: p.military.generals[0].id, infantry: 20 }, 0, f.home, f.npc, 1);
    const m = p.military.missions[0]; m.ruleset = ruleset;
    if (phase === 'returning') { m.status = 'returning'; m.result = { victory: true, attackerLosses: 5, defenderLosses: 10, survivors: 15, loadedFood: 300, capacity: 300, generalExperience: 20, combatScore: 5 }; }
    p.schemaVersion = 12; delete p.city.resources.oil; delete p.military.units.truck; await f.storage.savePlayer(p);
    await f.storage.advanceWorld(50000); p = await f.storage.loadPlayer(p.playerId);
    const r = p.military.reports[0]; assert.equal(r.ruleset, ruleset); assert.equal(r.originalLoadedFood, 300); assert.equal(r.combatScore, 5); assert.equal(r.paidOil, undefined);
    assert.equal(p.military.units.infantry, 15); assert.equal(p.military.units.truck, 0); assert.equal(p.city.resources.oil, 0);
  }
});

test('historical hunger wave removes one returning truck and exactly 200 cargo without infantry losses', () => {
  const p = start(fixture()); p.military.units.scout = 0;
  const m = p.military.missions[0]; m.units = { infantry: 15, truck: 3 }; m.status = 'returning'; m.result = { loadedFood: 900 };
  p.city.resources.food = 0; p.city.buildingSlots[2].level = 0;
  const rules = parseConfiguration({ UPKEEP_INFANTRY_PER_HOUR: '0', UPKEEP_SCOUT_PER_HOUR: '0', SUPPLY_GRACE_SECONDS: '1', SUPPLY_LOSS_INTERVAL_SECONDS: '1' }).supply;
  delete rules.upkeepScope;
  const next = advanceSupply(p, 1000, 0, { rules }); const mission = next.military.missions[0];
  assert.deepEqual(mission.units, { infantry: 15, truck: 2 }); assert.equal(mission.result.loadedFood, 700); assert.equal(mission.foodLostInTransit, 200); assert.deepEqual(mission.hungerLossesByUnit, { truck: 1 });
  assert.equal(supplySummary(next).unitCounts.truck, 2);
});
