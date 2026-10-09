import { legacyPlayer } from './support/player.js';
import { resolveCargoArrival } from '../packages/game-core/cargo.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newCity } from '../packages/game-core/index.js';
import { newMilitary, startRaidMission } from '../packages/game-core/military.js';
import { LOGISTICS_RULES, missionQuote, startLogisticsMission, fuelPlan, missionTimes } from '../packages/game-core/logistics.js';
import { advanceSupply, advanceSupplyHistory, refreshSupplyAt, SUPPLY_RULES, supplySummary } from '../packages/game-core/supply.js';
import { parseConfiguration, loadConfiguration } from '../apps/server/config.js';
import { WorldStorage } from '../apps/server/storage.js';
import { start, close, websocket, authenticate } from './support/socket.js';

const origin = { x: 0, y: 0 }, target = { id: 'npc', kind: 'npc', name: 'NPC', x: 3, y: 4 };
const quiet = { warn() {} };
function fixture() {
  const p = { city: newCity(0), military: newMilitary('p') };
  p.city.resources = { wood: 2000, stone: 2000, food: 0, oil: 1000000 };
  p.city.buildingSlots[2].level = 0;
  p.military.units = { infantry: 20, truck: 4, scout: 0 };
  return refreshSupplyAt(p, 0);
}
const command = (p, extra = {}) => ({ id: 'convoy-id', type: 'raid', generalId: p.military.generals[0].id, units: { infantry: 20, truck: 4 }, ...extra });
const send = (p, c = command(p), at = 0, rules = LOGISTICS_RULES) => startLogisticsMission(p, { ...c, preview: missionQuote(p, c, origin, target, rules) }, at, origin, target, rules);
async function stored(t, config = parseConfiguration()) {
  const dir = await mkdtemp(join(tmpdir(), 'delayed-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const storage = await new WorldStorage(dir, 'test', () => 0, config, quiet).initialize();
  const { player } = await storage.register('DelayedPlayer', 'long-test-password');
  const p = fixture(); p.playerId = player.playerId; p.mailbox = player.mailbox; legacyPlayer(p); p.schemaVersion = 14;
  p.military.generals[0] = { ...p.military.generals[0], id: player.military.generals[0].id, ownerId: player.playerId, portraitId: player.military.generals[0].portraitId, attributes: { leadership: 20, attack: 0, defense: 0 } };
  const home = storage.world.map.entities.find(e => e.playerId === player.playerId), npc = storage.world.map.entities.find(e => e.kind === 'npc');
  Object.assign(home, origin); Object.assign(npc, target, { id: npc.id });
  npc.garrison = { amount: 10, capacity: 10, progressMs: 0, updatedAt: 0, activatedAt: 0 };
  npc.resources.food = { amount: 1000, capacity: 1000, regenerationPerHour: 0, updatedAt: 0 };
  await storage.saveWorld(); await storage.savePlayer(p);
  return { dir, storage, p, npc, home };
}

test('ratio examples: E=10/T=1min/H=10min => 100+10=110, D=10 =>120; linear unrounded increments', () => {
  assert.equal(fuelPlan(10000n, 60000, 9).outboundOil, 100);
  assert.equal(fuelPlan(10000n, 60000, 9).returnOil, 10);
  assert.equal(fuelPlan(10000n, 60000, 9).totalOil, 110);
  assert.equal(fuelPlan(10000n, 60000, 10).totalOil, 120);
  assert.equal(fuelPlan(10000n, 60000, 30).totalOil, 320);
  assert.deepEqual(missionTimes(0, 60000, 9), { arrivesAt: 600000, returnsAt: 660000 });
  assert.deepEqual(missionTimes(0, 60000, 30), { arrivesAt: 1860000, returnsAt: 1920000 });
  assert.deepEqual([0, 10, 20, 30].map(m => fuelPlan(30000n, 25000, m).totalOil), [60, 780, 1500, 2220]);
  assert.equal(fuelPlan(1n, 7000, 1).totalOil, 1); // ceil(0.001*(2+60/7)), no intermediate rounding
  assert.equal(fuelPlan(101n, 7000, 1).totalOil, 2);
  assert.throws(() => fuelPlan(BigInt(Number.MAX_SAFE_INTEGER) * 1000n, 1, 1), /Zahlenbereich/);
});

test('positive unit fuel, different equal-size groups, single total rounding and missing definitions', () => {
  const p = fixture();
  const infantry = missionQuote(p, command(p, { units: { infantry: 4 }, delayMinutes: 10 }), origin, target);
  const mixed = missionQuote(p, command(p, { units: { infantry: 1, truck: 3 }, delayMinutes: 10 }), origin, target);
  assert.equal(infantry.totalOil, 52); assert.equal(mixed.totalOil, 403);
  assert.equal(missionQuote(p, command(p, { units: { infantry: 10 } }), origin, target).totalOil, 10);
  p.military.units.scout = 2;
  assert.equal(missionQuote(p, { type: 'scout', generalId: command(p).generalId, scouts: 2 }, origin, target).totalOil, 4);
  for (const rate of [0, undefined]) assert.throws(() => missionQuote(p, command(p), origin, target, { ...LOGISTICS_RULES, oilMilliPerField: { ...LOGISTICS_RULES.oilMilliPerField, infantry: rate } }), /Positive/);
});

test('delay bounds, types, scout prohibition, time arithmetic, failed starts preserve all state', () => {
  const p = fixture(), before = structuredClone(p);
  for (const delayMinutes of [-1, 0.5, 1441, NaN, Infinity, '30', '', null]) {
    assert.throws(() => missionQuote(p, command(p, { delayMinutes }), origin, target), /Zusatz/);
  }
  assert.equal(missionQuote(p, command(p, { delayMinutes: 0 }), origin, target).delayMinutes, 0);
  assert.throws(() => missionQuote(p, command(p, { delayMinutes: 1440 }), origin, target), /Ladung zu schwer/);
  const largeCargo = { ...LOGISTICS_RULES, cargoPerUnit: { ...LOGISTICS_RULES.cargoPerUnit, truck: 1000000 } };
  assert.equal(missionQuote(p, command(p, { delayMinutes: 1440 }), origin, target, largeCargo).delayMinutes, 1440);
  assert.throws(() => missionQuote(p, { type: 'scout', generalId: command(p).generalId, scouts: 1, delayMinutes: 1 }, origin, target), /Aufklärung/);
  assert.throws(() => missionQuote(p, command(p), origin, target, LOGISTICS_RULES, Number.MAX_SAFE_INTEGER), /Einsatzzeit/);
  assert.throws(() => send(p, command(p, { delayMinutes: 1.5 })), /Zusatz/);
  const q = missionQuote(p, command(p), origin, target);
  assert.throws(() => startLogisticsMission(p, { ...command(p), delayMinutes: 1, preview: q }, 0, origin, target), /vorschau/);
  const noFuel = structuredClone(p); noFuel.city.resources.oil = 59;
  assert.throws(() => startLogisticsMission(noFuel, { ...command(p), preview: q }, 0, origin, target), /Öl/);
  assert.deepEqual(p, before); assert.equal(noFuel.military.units.truck, 4); assert.equal(noFuel.military.generals[0].status, 'idle');
});

test('later confirmation shifts times only; changed prices, troops, general or duration demand preview', () => {
  const p = fixture(), c = command(p, { delayMinutes: 10 }), q = missionQuote(p, c, origin, target);
  const sent = startLogisticsMission(p, { ...c, preview: q }, 1000, origin, target);
  const m = sent.military.missions[0]; assert.equal(m.arrivesAt, 626000); assert.equal(m.returnsAt, 651000); assert.equal(m.paidOil, 780);
  for (const rules of [parseConfiguration({ OIL_INFANTRY_PER_FIELD: '0.2' }).logistics, parseConfiguration({ MAX_ATTACK_DELAY_MINUTES: '100' }).logistics]) assert.throws(() => startLogisticsMission(p, { ...c, preview: q }, 1000, origin, target, rules), /vorschau/);
  const changed = structuredClone(p); changed.military.generals[0].version++;
  assert.throws(() => startLogisticsMission(changed, { ...c, preview: q }, 1000, origin, target), /vorschau/);
});

test('stationed upkeep changes at departure and return; empty home never damages traveling cargo', () => {
  const p = fixture(); assert.equal(Math.round(supplySummary(p).upkeep * 3600), 7920);
  const sent = send(p, command(p, { delayMinutes: 10 }));
  assert.equal(supplySummary(sent).upkeep, 0); assert.equal(supplySummary(sent).totalUnits, 24); assert.equal(supplySummary(sent).deployedUnits, 24);
  sent.military.missions[0].status = 'returning'; sent.military.missions[0].units = { infantry: 15, truck: 3 }; sent.military.missions[0].result = { loadedFood: 900 };
  const next = advanceSupply(sent, 86400000, 0);
  assert.deepEqual(next.military.missions[0].units, { infantry: 15, truck: 3 }); assert.equal(next.military.missions[0].result.loadedFood, 900); assert.equal(next.supply.events.length, 0);
  const partial = send(p, command(p, { units: { infantry: 12 } }));
  assert.equal(Math.round(supplySummary(partial).upkeep * 3600), 3600); // eight infantry + four trucks
  partial.military.units.infantry += 10;
  assert.equal(Math.round(supplySummary(partial).upkeep * 3600), 7200);
});

test('departure preserves shortage clock; stable recovery completes normally, short absence does not reset', () => {
  let p = advanceSupply(fixture(), 10000, 0);
  const c = command(p); p = startLogisticsMission(p, { ...c, preview: missionQuote(p, c, origin, target) }, 10000, origin, target);
  p = refreshSupplyAt(p, 10000); assert.equal(p.supply.shortageMs, 10000);
  const short = advanceSupply(p, 20000, 0); short.military.units.infantry = 10;
  const returned = refreshSupplyAt(short, 20000); assert.equal(returned.supply.shortageMs, 10000); assert.equal(returned.supply.recoveryStartedAt, null);
  assert.equal(advanceSupply(p, 70000, 0).supply.shortageMs, 0);
});

test('delayed arrival leaves NPC untouched at base time; actual arrival battles once, normal return stores overflow', async t => {
  const f = await stored(t), c = command(f.p, { targetId: f.npc.id, delayMinutes: 10 });
  const p = startLogisticsMission(f.p, { ...c, preview: missionQuote(f.p, c, f.home, f.npc) }, 0, f.home, f.npc);
  p.city.resources.food = 1400; p.supply.rules = parseConfiguration({ UPKEEP_INFANTRY_PER_HOUR: '0', UPKEEP_TRUCK_PER_HOUR: '0' }).supply;
  f.storage.world.supplyRuleHistory = [{ effectiveAt: 0, rules: p.supply.rules }];
  await f.storage.savePlayer(p); await f.storage.saveWorld();
  await f.storage.advanceWorld(25000); assert.equal(f.storage.world.map.entities.find(e => e.id === f.npc.id).resources.food.amount, 1000);
  await f.storage.advanceWorld(624999); assert.equal((await f.storage.loadPlayer(p.playerId)).military.missions[0].status, 'outbound');
  await f.storage.advanceWorld(625000); let current = await f.storage.loadPlayer(p.playerId);
  assert.equal(current.military.missions[0].result.loadedFood, 877); assert.equal(current.military.units.truck, 0);
  await f.storage.advanceWorld(650000); current = await f.storage.loadPlayer(p.playerId);
  const r = current.military.reports[0]; assert.equal(r.storedFood, 600); assert.equal(r.overflowFood, 277); assert.equal(r.delayMinutes, 10); assert.equal(r.paidOil, 780);
  assert.equal(r.foodLostInTransit, 0); assert.equal(r.combatScore, 4); assert.equal(current.military.generals[0].experience, 20);
});

test('historical scope transition preserves prior hunger/cargo, cycle rules and frozen mission; offline equals split', () => {
  const p = send(fixture()); const m = p.military.missions[0]; delete m.cargo; m.ruleset = 'npc-pve-4-logistics-provisional'; m.status = 'returning'; m.result = { loadedFood: 1200 }; m.returnsAt = 100000;
  const old = { ...SUPPLY_RULES, version: 'historical', graceMs: 1000, lossIntervalMs: 1000, recoveryMs: 1000, lossRate: 0.1 }; delete old.upkeepScope;
  const history = [{ effectiveAt: 0, rules: old }, { effectiveAt: 2000, rules: { ...SUPPLY_RULES, graceMs: 100, lossIntervalMs: 100, recoveryMs: 100 } }];
  const large = advanceSupplyHistory(p, 5000, 0, history);
  const split = advanceSupplyHistory(advanceSupplyHistory(p, 2000, 0, history), 5000, 0, history);
  assert.deepEqual(large, split); assert.deepEqual(large.military.missions[0].units, { infantry: 15, truck: 3 });
  assert.equal(large.military.missions[0].result.loadedFood, 900); assert.equal(large.military.missions[0].foodLostInTransit, 300);
  assert.equal(large.military.missions[0].paidOil, 60); assert.equal(large.military.missions[0].returnsAt, 100000);
  assert.deepEqual(history[0].rules, old); assert.equal(history[0].rules.upkeepScope, undefined);
});

test('scope switches loss groups immediately but active cycle keeps old grace/percentage', () => {
  const p = send(fixture()); p.military.units.infantry = 10;
  const old = { ...SUPPLY_RULES, graceMs: 2000, lossIntervalMs: 2000, lossRate: 0.5 }; delete old.upkeepScope;
  const history = [{ effectiveAt: 0, rules: old }, { effectiveAt: 1000, rules: { ...SUPPLY_RULES, graceMs: 100, lossIntervalMs: 100, lossRate: 1 } }];
  const next = advanceSupplyHistory(p, 2000, 0, history);
  assert.equal(next.military.units.infantry, 5); assert.equal(next.military.missions[0].units.infantry, 20); assert.equal(next.military.missions[0].units.truck, 4);
  assert.equal(next.supply.cycleRules.graceMs, 2000); assert.deepEqual(next.supply.events[0].losses, { infantry: 5 });
});

test('worldwide activation and restart migrate schema 13 without altering paid snapshots or reactivating', async t => {
  const f = await stored(t); let p = send(f.p); const m = p.military.missions[0]; m.targetId = f.npc.id; m.arrivesAt = 60000; m.returnsAt = 65000;
  legacyPlayer(p); p.schemaVersion = 13; delete m.cargo; m.ruleset = 'npc-pve-4-logistics-provisional'; delete m.delayMinutes; m.paidOil = 0; m.logistics.oilMilliPerField = { infantry: 0, truck: 0 }; m.hungerLosses = 2;
  const old = { ...SUPPLY_RULES, version: 'old', graceMs: 10000 }; delete old.upkeepScope;
  f.storage.world.supplyRuleHistory = [{ effectiveAt: 0, rules: old }]; await f.storage.saveWorld(); await f.storage.savePlayer(p);
  const restarted = await new WorldStorage(f.dir, 'test', () => 5000, parseConfiguration(), quiet).initialize();
  p = await restarted.loadPlayer(p.playerId); assert.equal(p.schemaVersion, 16); assert.equal(p.city.resources.food, 0); assert.equal(p.military.missions[0].delayMinutes, 0);
  assert.equal(p.military.missions[0].paidOil, 0); assert.equal(p.military.missions[0].arrivesAt, 60000); assert.equal(p.supply.shortageMs, 5000);
  assert.equal(restarted.world.supplyRuleHistory.at(-1).effectiveAt, 5000); assert.equal(restarted.world.supplyRuleHistory.at(-1).rules.upkeepScope, 'stationed');
  const history = structuredClone(restarted.world.supplyRuleHistory);
  const again = await new WorldStorage(f.dir, 'test', () => 6000, parseConfiguration(), quiet).initialize(); assert.deepEqual(again.world.supplyRuleHistory, history);
  p = await again.loadPlayer(p.playerId); assert.equal(p.military.missions[0].hungerLosses, 2); assert.equal(p.military.missions[0].units.infantry, 20);
});

for (const loadedFood of [0, 100]) test(`return at exact city hunger threshold: ${loadedFood ? 'loot prevents loss' : 'returned troops join stationed loss'}`, async t => {
  const f = await stored(t), p = send(f.p), m = p.military.missions[0]; m.targetId = f.npc.id;
  m.status = 'returning'; m.arrivesAt = 500; m.returnsAt = 1000; m.units = { infantry: 10, truck: 0 }; m.result = { survivors: 10, loadedFood, capacity: 200, generalExperience: 0, combatScore: 0 }; resolveCargoArrival(m, 200);
  p.military.units.infantry = 10;
  const rules = { ...SUPPLY_RULES, graceMs: 1000, lossIntervalMs: 1000, lossRate: 0.1 };
  f.storage.world.supplyRuleHistory = [{ effectiveAt: 0, rules }]; await f.storage.saveWorld(); await f.storage.savePlayer(p);
  await f.storage.advanceWorld(1000); const next = await f.storage.loadPlayer(p.playerId);
  assert.equal(next.military.units.infantry, loadedFood ? 20 : 18); assert.equal(next.military.reports[0].returnedUnits.infantry, 10);
  assert.equal(next.military.reports[0].hungerLosses, 0); assert.equal(next.military.reports[0].foodLostInTransit, 0);
  assert.equal(next.supply.events.length, loadedFood ? 0 : 1);
  if (!loadedFood) assert.deepEqual(next.supply.events[0].losses, { infantry: 2 });
});

test('ENV rejects old minute key, zero oil and malformed limits; permits zero food and zero delay limit', async t => {
  for (const key of ['OIL_INFANTRY_PER_FIELD', 'OIL_SCOUT_PER_FIELD', 'OIL_TRUCK_PER_FIELD']) for (const value of ['0', '', '0.0001', '1.1234', 'NaN', 'Infinity', '-1', '100001']) assert.throws(() => parseConfiguration({ [key]: value }), new RegExp(key));
  for (const value of ['-1', '1.1', '', 'NaN', '10081']) assert.throws(() => parseConfiguration({ MAX_ATTACK_DELAY_MINUTES: value }), /MAX_ATTACK/);
  assert.throws(() => parseConfiguration({ OIL_DELAY_PER_UNIT_PER_MINUTE: '0.1' }), /entfernt/);
  const config = parseConfiguration({ MAX_ATTACK_DELAY_MINUTES: '0', UPKEEP_TRUCK_PER_HOUR: '0' }); assert.equal(config.supply.upkeepPerSecond.truck, 0);
  assert.throws(() => missionQuote(fixture(), command(fixture(), { delayMinutes: 1 }), origin, target, config.logistics), /Zusatz/);
  const dir = await mkdtemp(join(tmpdir(), 'ratio-env-')); t.after(() => rm(dir, { recursive: true, force: true })); const file = join(dir, '.env');
  await writeFile(file, 'MAX_ATTACK_DELAY_MINUTES=100\nOIL_SCOUT_PER_FIELD=0.3\n');
  const native = await loadConfiguration({ file, env: { MAX_ATTACK_DELAY_MINUTES: '10' } }); assert.equal(native.logistics.maxAttackDelayMinutes, 10); assert.equal(native.logistics.oilMilliPerField.scout, 300);
});

test('delayed WebSocket start binds delay, pays once through lost save/retry/restart, frozen limit and arrival', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'delay-ws-')); let now = 100000;
  let running = await start(dir, () => now); const clients = [];
  t.after(async () => { clients.forEach(c => c.close()); await close(running.server); await rm(dir, { recursive: true, force: true }); });
  const a = await websocket(running.port), b = await websocket(running.port); clients.push(a, b);
  const owner = await authenticate(a, 'register', 'DelayedSocket'); await authenticate(b, 'login', 'DelayedSocket');
  const request = async (client, type, payload, expected = 'command.ok', id) => { const rid = client.send(type, payload, id); return (await client.next(expected, rid)).payload; };
  let storage = running.server.storage, p = await storage.loadPlayer(owner.snapshot.player.id);
  p.city.resources.oil = 5000; p.city.resources.food = 0; p.city.buildingSlots[2].level = 0; p.military.units.infantry = 10;
  const home = storage.world.map.entities.find(e => e.playerId === p.playerId), npc = storage.world.map.entities.find(e => e.kind === 'npc'); Object.assign(home, origin); Object.assign(npc, { x: 3, y: 4 });
  await storage.saveWorld(); await storage.savePlayer(p);
  const payload = { targetId: npc.id, generalId: p.military.generals[0].id, units: { infantry: 10 }, delayMinutes: 10 };
  const q = await request(a, 'raid.preview', payload, 'raid.preview'); assert.equal(q.totalOil, 130); assert.equal(q.upkeepBeforePerHour, 3600); assert.equal(q.upkeepAfterPerHour, 0);
  assert.match((await request(a, 'raid.start', { ...payload, delayMinutes: 9, preview: q }, 'command.error')).message, /vorschau/);
  now += 1000;
  const sequence = storage.world.nextEventSequence;
  await mkdir(storage.journalFile);
  assert.match((await request(a, 'raid.start', { ...payload, preview: q }, 'command.error', 'delayed-failed-request')).message, /directory|EISDIR/i);
  await rm(storage.journalFile, { recursive: true });
  assert.equal((await storage.loadPlayer(p.playerId)).city.resources.oil, 5000);
  assert.equal(storage.world.nextEventSequence, sequence);
  const id = 'delayed-once-request';
  const results = await Promise.all([request(a, 'raid.start', { ...payload, preview: q }, 'command.ok', id), request(b, 'raid.start', { ...payload, preview: q }, 'command.ok', id)]);
  assert.equal(results.filter(r => r.duplicate).length, 1);
  p = await storage.loadPlayer(p.playerId); const frozen = structuredClone(p.military.missions[0]); assert.equal(p.city.resources.oil, 4870); assert.equal(frozen.arrivesAt, 726000); assert.equal(frozen.returnsAt, 751000);
  clients.forEach(c => c.close()); await close(running.server);
  running = await start(dir, () => now, 'alpha', parseConfiguration({ MAX_ATTACK_DELAY_MINUTES: '0', OIL_INFANTRY_PER_FIELD: '0.2' })); storage = running.server.storage;
  const resumed = await websocket(running.port); clients.push(resumed); await authenticate(resumed, 'login', 'DelayedSocket');
  assert.equal((await request(resumed, 'raid.start', { ...payload, preview: q }, 'command.ok', id)).duplicate, true);
  now = frozen.arrivesAt - 1; await request(resumed, 'city.sync', {}, 'city.snapshot'); p = await storage.loadPlayer(p.playerId);
  assert.equal(p.military.missions[0].status, 'outbound'); assert.equal(p.military.missions[0].units.infantry, 10); assert.equal(p.city.resources.oil, 4870);
  now = frozen.returnsAt; await request(resumed, 'city.sync', {}, 'city.snapshot'); p = await storage.loadPlayer(p.playerId); assert.equal(p.military.reports.length, 1); assert.equal(p.military.reports[0].paidOil, 130); assert.equal(p.military.reports[0].delayMinutes, 10);
});

test('different actual arrival times share scarce NPC loot; delayed offline step matches small steps', async t => {
  const f = await stored(t), p = f.p;
  p.military.generals.push({ ...structuredClone(p.military.generals[0]), id: 'second-general' });
  p.military.units.infantry = 40; p.military.units.truck = 8;
  let next = startLogisticsMission(p, { ...command(p, { id: 'late-mission', targetId: f.npc.id, delayMinutes: 2 }), preview: missionQuote(p, command(p, { targetId: f.npc.id, delayMinutes: 2 }), f.home, f.npc) }, 0, f.home, f.npc);
  const c = command(next, { id: 'early-mission', targetId: f.npc.id, generalId: 'second-general', delayMinutes: 1 });
  next = startLogisticsMission(next, { ...c, preview: missionQuote(next, c, f.home, f.npc) }, 0, f.home, f.npc);
  next.military.missions[0].eventSequence = 1; next.military.missions[1].eventSequence = 2;
  await f.storage.savePlayer(next);
  const copyDir = `${f.dir}-small`; const { cp } = await import('node:fs/promises'); await cp(f.dir, copyDir, { recursive: true }); t.after(() => rm(copyDir, { recursive: true, force: true }));
  const small = await new WorldStorage(copyDir, 'test', () => 0, parseConfiguration(), quiet).initialize();
  await f.storage.advanceWorld(170000);
  for (const at of [25000, 84999, 85000, 110000, 144999, 145000, 170000]) await small.advanceWorld(at);
  const large = await f.storage.loadPlayer(p.playerId), split = await small.loadPlayer(p.playerId);
  assert.deepEqual(large, split);
  assert.equal(large.military.reports.find(r => r.missionId === 'early-mission').originalLoadedFood, 877);
  assert.equal(large.military.reports.find(r => r.missionId === 'late-mission').originalLoadedFood, 123);
  assert.equal(large.military.reports.length, 2);
});

test('schema 13 migration write failure leaves original intact and retries once without changing dates', async t => {
  const f = await stored(t), p = send(f.p); legacyPlayer(p); p.schemaVersion = 13; delete p.military.missions[0].delayMinutes;
  await f.storage.savePlayer(p);
  const save = f.storage.savePlayer.bind(f.storage); f.storage.savePlayer = () => { throw new Error('migration-save-failure'); };
  await assert.rejects(f.storage.loadPlayer(p.playerId), /migration-save-failure/);
  const { readFile } = await import('node:fs/promises'); assert.deepEqual(JSON.parse(await readFile(f.storage.playerFile(p.playerId), 'utf8')), p);
  f.storage.savePlayer = save; const migrated = await f.storage.loadPlayer(p.playerId); assert.equal(migrated.schemaVersion, 16); assert.equal(migrated.military.missions[0].delayMinutes, 0);
  assert.equal(migrated.military.missions[0].arrivesAt, p.military.missions[0].arrivesAt); assert.deepEqual(await f.storage.loadPlayer(p.playerId), migrated);
});

test('activation journal completes after world write/player rename failure; transition never repeats', async t => {
  const f = await stored(t); const p = send(f.p); p.military.missions[0].arrivesAt = 60000; p.military.missions[0].returnsAt = 65000;
  const old = { ...SUPPLY_RULES, version: 'legacy', graceMs: 10000 }; delete old.upkeepScope;
  f.storage.world.supplyRuleHistory = [{ effectiveAt: 0, rules: old }]; await f.storage.savePlayer(p); await f.storage.saveWorld();
  let throughBoundary = advanceSupplyHistory(p, 5000, 0, f.storage.world.supplyRuleHistory);
  f.storage.world.supplyRuleHistory.push({ effectiveAt: 5000, rules: structuredClone(SUPPLY_RULES) });
  throughBoundary.supply.rules = structuredClone(SUPPLY_RULES); throughBoundary = refreshSupplyAt(throughBoundary, 5000);
  const original = f.storage.playerFile.bind(f.storage); const blocked = join(f.dir, 'blocked'); await mkdir(blocked); f.storage.playerFile = () => blocked;
  await assert.rejects(f.storage.commitPlayers([throughBoundary], true), /directory|EISDIR/i); f.storage.playerFile = original;
  const again = await new WorldStorage(f.dir, 'test', () => 6000, parseConfiguration(), quiet).initialize();
  const current = await again.loadPlayer(p.playerId); assert.equal(current.supply.shortageMs, 5000); assert.equal(current.military.missions[0].units.infantry, 20);
  assert.equal(again.world.supplyRuleHistory.length, 2); assert.equal(again.world.supplyRuleHistory.at(-1).effectiveAt, 5000);
  const { readFile } = await import('node:fs/promises'); await assert.rejects(readFile(again.journalFile), /ENOENT/);
});
