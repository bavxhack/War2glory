import { legacyPlayer } from './support/player.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorldStorage } from '../apps/server/storage.js';
import { parseConfiguration } from '../apps/server/config.js';
import { missionQuote, startLogisticsMission } from '../packages/game-core/logistics.js';
import { operatingFuel, cargoAmount } from '../packages/game-core/cargo.js';
import { start, close, websocket, authenticate } from './support/socket.js';

const quiet = { warn() {} };
const config = () => parseConfiguration({ UPKEEP_INFANTRY_PER_HOUR: '0', UPKEEP_TRUCK_PER_HOUR: '0', UPKEEP_SCOUT_PER_HOUR: '0' });
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'cargo-storage-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const storage = await new WorldStorage(dir, 'test', () => 0, config(), quiet).initialize();
  const { player } = await storage.register('CargoOwner', 'long-test-password');
  player.city.resources = { wood: 1000, stone: 1000, food: 1000, oil: 1000 }; player.city.buildingSlots.forEach(slot => { slot.level = 0; });
  player.military.units = { infantry: 20, truck: 4, scout: 0 }; player.military.generals[0].attributes = { leadership: 20, attack: 0, defense: 0 };
  const home = storage.world.map.entities.find(e => e.playerId === player.playerId), npc = storage.world.map.entities.find(e => e.kind === 'npc');
  Object.assign(home, { x: 0, y: 0 }); Object.assign(npc, { x: 3, y: 4 });
  npc.garrison = { amount: 10, capacity: 10, updatedAt: 0, activatedAt: 0, progressMs: 0 };
  npc.resources.food = { amount: 1000, capacity: 1000, regenerationPerHour: 0, updatedAt: 0 };
  await storage.saveWorld(); await storage.savePlayer(player);
  const command = { id: 'cargo-raid', type: 'raid', targetId: npc.id, generalId: player.military.generals[0].id, units: { infantry: 20, truck: 4 }, cargo: { wood: 100, stone: 100, food: 50, oil: 50 } };
  const send = (p = player, c = command) => startLogisticsMission(p, { ...c, preview: missionQuote(p, c, home, npc, storage.config.logistics) }, 0, home, npc, storage.config.logistics);
  return { dir, storage, player, home, npc, command, send };
}

test('restart on outbound/arrival/return preserves own cargo, fractional reserve, 577 loot and no oil refund', async t => {
  const f = await fixture(t); const sent = f.send(); await f.storage.savePlayer(sent);
  let storage = await new WorldStorage(f.dir, 'test', () => 12500, config(), quiet).initialize();
  let p = await storage.loadPlayer(sent.playerId); assert.equal(p.city.resources.oil, 890); assert.equal(operatingFuel(p.military.missions[0], 12500).remaining, 45);
  storage = await new WorldStorage(f.dir, 'test', () => 25000, parseConfiguration({ OIL_TRUCK_PER_FIELD: '50', TRUCK_CARGO_CAPACITY: '1', UPKEEP_INFANTRY_PER_HOUR: '0', UPKEEP_TRUCK_PER_HOUR: '0' }), quiet).initialize();
  p = await storage.loadPlayer(sent.playerId); let m = p.military.missions[0];
  assert.equal(m.result.loadedFood, 577); assert.equal(m.result.goodsCapacity, 877); assert.equal(m.cargo.returnFuelMilli, '22500'); assert.equal(m.cargo.lostFuelMilli, '7500');
  assert.equal(storage.world.map.entities.find(n => n.id === f.npc.id).resources.food.amount, 423);
  storage = await new WorldStorage(f.dir, 'test', () => 37500, config(), quiet).initialize(); p = await storage.loadPlayer(sent.playerId); assert.equal(operatingFuel(p.military.missions[0], 37500).remaining, 11.25);
  storage = await new WorldStorage(f.dir, 'test', () => 50000, config(), quiet).initialize(); p = await storage.loadPlayer(sent.playerId);
  assert.deepEqual(p.city.resources, { wood: 1000, stone: 1000, food: 1577, oil: 940 });
  const report = p.military.reports[0]; assert.equal(report.operatingFuel.remaining, 0); assert.equal(report.operatingFuel.burned, 52.5); assert.equal(report.operatingFuel.lost, 7.5); assert.equal(report.combatScore, 4); assert.equal(report.generalExperience, 20);
  assert.deepEqual(report.cargo.delivery.storedOwn, f.command.cargo); assert.equal(report.cargo.delivery.storedLoot.food, 577);
  const before = structuredClone(p); await storage.advanceWorld(50000); assert.deepEqual(await storage.loadPlayer(p.playerId), before); assert.equal(p.mailbox.readReportIds.length, 0);
});

for (const phase of ['arrival', 'return']) test(`journal crash during ${phase} recovers once without duplicated own cargo or NPC loot`, async t => {
  const f = await fixture(t); const sent = f.send(); await f.storage.savePlayer(sent);
  if (phase === 'return') await f.storage.advanceWorld(25000);
  const original = f.storage.playerFile.bind(f.storage), blocked = join(f.dir, 'blocked'); await mkdir(blocked);
  let calls = 0; f.storage.playerFile = id => ++calls === 2 ? blocked : original(id);
  await assert.rejects(f.storage.advanceWorld(phase === 'arrival' ? 25000 : 50000), /directory|EISDIR/i);
  assert.ok(JSON.parse(await readFile(f.storage.journalFile, 'utf8')).players.length);
  const restart = await new WorldStorage(f.dir, 'test', () => 50000, config(), quiet).initialize();
  const p = await restart.loadPlayer(sent.playerId); assert.equal(p.military.reports.length, 1); assert.equal(p.city.resources.oil, 940); assert.equal(p.city.resources.food, 1577);
  assert.equal(restart.world.map.entities.find(n => n.id === f.npc.id).resources.food.amount, 423); await assert.rejects(readFile(f.storage.journalFile), /ENOENT/);
  await restart.advanceWorld(50000); assert.deepEqual(await restart.loadPlayer(p.playerId), p);
});

test('battle cargo loss and defeat/full losses preserve independent ledgers, old version4 migrates without cargo retrofit', async t => {
  for (const defenders of [10, 100]) {
    const f = await fixture(t); f.npc.garrison.amount = defenders; f.npc.garrison.capacity = defenders; await f.storage.saveWorld();
    const heavy = f.send(f.player, { ...f.command, cargo: { wood: 250, stone: 250, food: 250, oil: 250 } }); await f.storage.savePlayer(heavy); await f.storage.advanceWorld(50000);
    const r = (await f.storage.loadPlayer(heavy.playerId)).military.reports[0];
    assert.equal(r.loadedFood, 0); assert.equal(r.operatingFuel.remaining, 0);
    assert.equal(cargoAmount(r.cargo.retained), defenders === 10 ? 877 : 0); assert.equal(cargoAmount(r.cargo.lost), defenders === 10 ? 123 : 1000);
    assert.equal(r.operatingFuel.lost, defenders === 10 ? 7.5 : 30);
  }
  const f = await fixture(t), legacy = f.send(f.player, { ...f.command, cargo: {} }), m = legacy.military.missions[0];
  delete m.cargo; m.ruleset = 'npc-pve-4-logistics-provisional'; m.logistics.oilMilliPerField = { infantry: 0, truck: 0 }; m.paidOil = 0; legacyPlayer(legacy); legacy.schemaVersion = 14;
  legacy.mailbox.readReportIds = ['historical-read']; const profile = structuredClone(legacy.military.generals[0]); await f.storage.savePlayer(legacy);
  const migrated = await f.storage.loadPlayer(legacy.playerId); assert.equal(migrated.schemaVersion, 16); assert.deepEqual(migrated.military.missions[0], JSON.parse(JSON.stringify({ ...m, originCityId: migrated.cities[0].id }))); assert.deepEqual(migrated.military.generals[0], profile);
  await f.storage.advanceWorld(50000); const r = (await f.storage.loadPlayer(legacy.playerId)).military.reports[0]; assert.equal(r.loadedFood, 900); assert.equal(r.cargo, undefined); assert.equal(r.paidOil, 0);
});

test('offline event steps equal one large step including delayed own freight and fuel', async t => {
  const f = await fixture(t); const sent = f.send(f.player, { ...f.command, delayMinutes: 2 }); await f.storage.savePlayer(sent);
  const copyDir = `${f.dir}-split`; await cp(f.dir, copyDir, { recursive: true }); t.after(() => rm(copyDir, { recursive: true, force: true }));
  const split = await new WorldStorage(copyDir, 'test', () => 0, config(), quiet).initialize(); await f.storage.advanceWorld(170000);
  for (const at of [25000, 85000, 144999, 145000, 160000, 170000]) await split.advanceWorld(at);
  assert.deepEqual(await f.storage.loadPlayer(sent.playerId), await split.loadPlayer(sent.playerId)); assert.deepEqual(f.storage.world, split.world);
});

test('two players share actual remaining loot after their own load; no preview reservation', async t => {
  const f = await fixture(t), second = (await f.storage.register('CargoSecond', 'long-test-password')).player;
  second.city.resources = { wood: 1000, stone: 1000, food: 1000, oil: 1000 }; second.city.buildingSlots.forEach(s => { s.level = 0; }); second.military.units = { infantry: 20, truck: 4, scout: 0 }; second.military.generals[0].attributes = { leadership: 20, attack: 0, defense: 0 };
  const secondHome = f.storage.world.map.entities.find(e => e.playerId === second.playerId); Object.assign(secondHome, { x: 0, y: 0 });
  f.npc.garrison.amount = 0; f.npc.garrison.capacity = 0; await f.storage.saveWorld();
  const c2 = { ...f.command, id: 'second-cargo', generalId: second.military.generals[0].id };
  const q2 = missionQuote(second, c2, secondHome, f.npc, f.storage.config.logistics); assert.equal(f.npc.resources.food.amount, 1000);
  const p1 = f.send(), p2 = startLogisticsMission(second, { ...c2, preview: q2 }, 0, secondHome, f.npc, f.storage.config.logistics);
  p1.military.missions[0].eventSequence = 1; p2.military.missions[0].eventSequence = 2; await f.storage.savePlayer(p1); await f.storage.savePlayer(p2); await f.storage.advanceWorld(50000);
  const reports = await Promise.all([p1,p2].map(async p => (await f.storage.loadPlayer(p.playerId)).military.reports[0]));
  assert.deepEqual(reports.map(r => r.loadedFood), [870, 130]); assert.equal(f.storage.world.map.entities.find(n => n.id === f.npc.id).resources.food.amount, 0);
});

test('corrupt freight/schema rejected without reset; schema14 save failure retry preserves originals', async t => {
  const f = await fixture(t); const sent = f.send(); legacyPlayer(sent); sent.schemaVersion = 14; await f.storage.savePlayer(sent);
  const save = f.storage.savePlayer.bind(f.storage); f.storage.savePlayer = () => { throw new Error('migration-failure'); };
  await assert.rejects(f.storage.loadPlayer(sent.playerId), /migration-failure/); assert.deepEqual(JSON.parse(await readFile(f.storage.playerFile(sent.playerId), 'utf8')), JSON.parse(JSON.stringify(sent)));
  f.storage.savePlayer = save; const current = await f.storage.loadPlayer(sent.playerId); assert.equal(current.schemaVersion, 16);
  current.military.missions[0].cargo.lost.oil = 1; await save(current); await assert.rejects(f.storage.loadPlayer(current.playerId), /ladungsbilanz/);
  current.military.missions[0].cargo.lost.oil = 0; delete current.military.missions[0].cargo; await save(current); await assert.rejects(f.storage.loadPlayer(current.playerId), /frachtversion/);
});

test('WebSocket cargo preview binds every amount; two tabs and reconnect debit once, reports/private cargo stay private', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'cargo-ws-')); let now = 100000;
  const running = await start(dir, () => now, 'alpha', config()); const clients = [];
  t.after(async () => { clients.forEach(c => c.close()); await close(running.server); await rm(dir, { recursive: true, force: true }); });
  const a = await websocket(running.port), b = await websocket(running.port), other = await websocket(running.port); clients.push(a,b,other);
  const owner = await authenticate(a, 'register', 'CargoSocket'); await authenticate(b, 'login', 'CargoSocket'); await authenticate(other, 'register', 'CargoOther');
  const storage = running.server.storage, p = await storage.loadPlayer(owner.snapshot.player.id);
  p.city.resources = { wood: 1000, stone: 1000, food: 1000, oil: 1000 }; p.city.buildingSlots.forEach(s => { s.level = 0; }); p.military.units = { infantry: 20, truck: 4, scout: 0 }; p.military.generals[0].attributes = { leadership: 20, attack: 0, defense: 0 };
  const home = storage.world.map.entities.find(e => e.playerId === p.playerId), npc = storage.world.map.entities.find(e => e.kind === 'npc'); Object.assign(home, { x: 0, y: 0 }); Object.assign(npc, { x: 3, y: 4 }); npc.garrison.amount = 10; npc.resources.food.amount = 1000; npc.resources.food.capacity = 1000;
  await storage.savePlayer(p); await storage.saveWorld();
  const request = async (client, type, payload, expected = 'command.ok', id) => { const rid = client.send(type, payload, id); return (await client.next(expected, rid)).payload; };
  const payload = { targetId: npc.id, generalId: p.military.generals[0].id, units: { infantry: 20, truck: 4 }, cargo: { wood: 100, stone: 100, food: 50, oil: 50 } };
  const q = await request(a, 'raid.preview', payload, 'raid.preview'); assert.equal(q.projectedLootCapacity, 870);
  assert.match((await request(a, 'raid.start', { ...payload, cargo: { ...payload.cargo, oil: 51 }, preview: q }, 'command.error')).message, /vorschau/);
  const id = 'cargo-tabs-once'; const results = await Promise.all([a,b].map(client => request(client, 'raid.start', { ...payload, preview: q }, 'command.ok', id))); assert.equal(results.filter(r => r.duplicate).length, 1);
  let current = await storage.loadPlayer(p.playerId); assert.equal(current.city.resources.oil, 890); assert.equal(current.city.resources.wood, 900);
  const stranger = await request(other, 'city.sync', {}, 'city.snapshot'); assert.equal(stranger.military.missions.length, 0);
  const details = await request(other, 'map.details', { id: home.id }, 'map.details'); assert.equal(JSON.stringify(details).includes('cargo'), false);
  now += 50000; const returned = await request(a, 'city.sync', {}, 'city.snapshot'); assert.equal(returned.mailbox.unreadCount, 1); assert.equal(returned.military.reports[0].loadedFood, 577); assert.equal(returned.military.reports[0].operatingFuel.remaining, 0);
  await request(a, 'mail.read', { kind: 'report', id: returned.military.reports[0].id }); await request(b, 'raid.start', { ...payload, preview: q }, 'command.ok', id);
  const resumed = await websocket(running.port); clients.push(resumed); await authenticate(resumed, 'login', 'CargoSocket'); assert.equal((await request(resumed, 'raid.start', { ...payload, preview: q }, 'command.ok', id)).duplicate, true);
  current = await storage.loadPlayer(p.playerId); assert.equal(current.city.resources.oil, 940); assert.equal(current.military.reports.length, 1); assert.equal(current.mailbox.readReportIds.length, 1);
});

test('defeat with surviving troops returns own cargo, no loot and no extra oil debit', async t => {
  const f = await fixture(t); f.npc.garrison.amount = 100; f.npc.garrison.capacity = 100; f.player.military.generals[0].attributes.defense = 25; await f.storage.saveWorld();
  const sent = f.send(); await f.storage.savePlayer(sent); await f.storage.advanceWorld(50000);
  const p = await f.storage.loadPlayer(sent.playerId), report = p.military.reports[0];
  assert.equal(report.victory, false); assert.equal(report.loadedFood, 0); assert.deepEqual(report.returnedUnits, { infantry: 10, truck: 2 });
  assert.equal(report.cargo.returnFuelMilli, '15000'); assert.equal(report.operatingFuel.lost, 15); assert.equal(report.operatingFuel.burned, 45); assert.equal(report.operatingFuel.remaining, 0);
  assert.deepEqual(report.cargo.retained, f.command.cargo); assert.deepEqual(p.city.resources, { wood: 1000, stone: 1000, food: 1000, oil: 940 });
  assert.equal(f.storage.world.map.entities.find(n => n.id === f.npc.id).resources.food.amount, 1000);
});
