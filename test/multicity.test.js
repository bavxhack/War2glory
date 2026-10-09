import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorldStorage } from '../apps/server/storage.js';
import { parseConfiguration } from '../apps/server/config.js';
import { canonicalJSON, exposeCity, cityView, commitCity, foundedCity, playerScore } from '../packages/game-core/multicity.js';
import { ensureField, fieldMissionQuote, startFieldMission, foundingQuote, foundCity, expireClaims, validateCityName } from '../packages/game-core/settlement.js';
import { terrainAt, publicMap, randomFreeLocation } from '../packages/game-core/world.js';
import { enqueueConstruction } from '../packages/game-core/index.js';
import { researchQuote, startResearch } from '../packages/game-core/research.js';
import { assignMayor } from '../packages/game-core/supply.js';
import { start, close, websocket, authenticate } from './support/socket.js';

async function fixture(t, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'multicity-')); t.after(() => rm(dir, { recursive: true, force: true }));
  let now = 0;
  const config = parseConfiguration({ UPKEEP_INFANTRY_PER_HOUR: '0', UPKEEP_SCOUT_PER_HOUR: '0', UPKEEP_TRUCK_PER_HOUR: '0', ...overrides });
  const storage = await new WorldStorage(dir, 'test', () => now, config, { warn() {} }).initialize();
  let { player } = await storage.register('CityOwner', 'test-password-long');
  player.city.resources = { wood: 2000, stone: 2000, food: 2000, oil: 2000 }; player.military.units = { infantry: 100, scout: 10, truck: 10 };
  player.military.generals[0].attributes = { leadership: 20, attack: 0, defense: 0 };
  await storage.savePlayer(player);
  const home = storage.world.map.entities.find(e => e.playerId === player.playerId);
  const fields = [];
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (terrainAt(x, y, storage.world.map.seed) !== 'water' && !storage.world.map.entities.some(e => e.x === x && e.y === y)) fields.push({ x, y });
  fields.sort((a,b) => Math.hypot(a.x-home.x,a.y-home.y)-Math.hypot(b.x-home.x,b.y-home.y));
  const field = ensureField(storage.world, fields[0].x, fields[0].y, config.settlement, () => 0);
  await storage.saveWorld();
  async function send(type, p = player, target = field, extra = {}) {
    const origin = storage.world.map.entities.find(e => e.id === p.cityId);
    const command = { id: `${type}-${storage.world.nextEventSequence++}`, type, generalId: p.military.generals[0].id, scouts: 1, units: { infantry: 20, truck: 1 }, ...extra };
    const preview = fieldMissionQuote(p, storage.world, command, origin, target, config.logistics, now);
    const sent = startFieldMission(p, storage.world, { ...command, preview }, now, origin, target, config.logistics, config.settlement);
    await storage.commitPlayers([sent], true); player = sent; return sent.military.missions.at(-1);
  }
  async function advance(at) { now = at; await storage.advanceWorld(now); player = await storage.loadPlayer(player.playerId); return player; }
  return { dir, storage, config, home, fields, field, send, advance, get player() { return player; }, get now() { return now; } };
}
async function scout(f) { const mission = await f.send('field-scout', f.player); await f.advance(mission.returnsAt); return f.player.military.reports.at(-1); }
async function conquer(f, extra = {}) { const report = await scout(f); const mission = await f.send('conquest', f.player, f.field, { reportId: report.id, ...extra }); await f.advance(mission.arrivesAt); return mission; }

test('schema 15 migration keeps one canonical city, cargo, mayor, global research and portraits; second load is idempotent', async t => {
  const f = await fixture(t), original = f.player;
  // Generate the actual old shape without canonical aliases.
  const legacy = structuredClone(original); legacy.schemaVersion = 15;
  delete legacy.cities; delete legacy.cityId; delete legacy.research; delete legacy.city.id;
  legacy.military = assignMayor(legacy.military, legacy.military.generals[0].id);
  legacy.city.research.active = { cityId: undefined, universityId: 'old-university', finishesAt: 100000, researcher: { generalId: null } };
  await f.storage.savePlayer(legacy);
  const migrated = await f.storage.loadPlayer(legacy.playerId), again = await f.storage.loadPlayer(legacy.playerId);
  assert.equal(migrated.schemaVersion, 16); assert.equal(migrated.cities.length, 1); assert.equal(migrated.cities[0].id, f.home.id);
  assert.equal(migrated.cities[0].military.mayorGeneralId, legacy.military.mayorGeneralId);
  assert.equal(migrated.research.active.cityId, f.home.id); assert.deepEqual(migrated.city.resources, legacy.city.resources);
  assert.deepEqual(migrated.military.generals, legacy.military.generals); assert.deepEqual(migrated, again);
  const disk = JSON.parse(await readFile(f.storage.playerFile(legacy.playerId), 'utf8'));
  assert.equal(disk.city, undefined); assert.equal(disk.military.units, undefined); assert.equal(disk.cities[0].research, undefined);
});

test('field defense varies, is persisted/shared, and is absent from public map', async t => {
  const f = await fixture(t);
  const other = ensureField(f.storage.world, f.fields[1].x, f.fields[1].y, f.config.settlement, n => n - 1);
  assert.equal(f.field.defenders, 5); assert.equal(other.defenders, 30);
  assert.equal(ensureField(f.storage.world, f.field.x, f.field.y, f.config.settlement, () => 20).defenders, 5);
  await f.storage.saveWorld();
  const restart = await new WorldStorage(f.dir, 'test', () => 0, f.config, { warn() {} }).initialize();
  assert.deepEqual(restart.world.fields, f.storage.world.fields);
  const map = publicMap(restart.world, f.player.playerId, { x: f.field.x, y: f.field.y, width: 1, height: 1 }, f.home.id);
  assert.ok(!JSON.stringify(map).includes('defenders')); assert.equal(map.entities.length, 0);
});

test('scout report is released at return, no XP; current own report required, forgery and revision changes rejected', async t => {
  const f = await fixture(t); const mission = await f.send('field-scout');
  await f.advance(mission.arrivesAt); assert.equal(f.player.military.reports.length, 0);
  await f.advance(mission.returnsAt); const report = f.player.military.reports[0];
  assert.equal(report.intelligence.defenders, 5); assert.equal(f.player.military.generals[0].experience, 0);
  await assert.rejects(f.send('conquest', f.player, f.field, { reportId: 'forged' }), /Aufklärung/);
  f.field.revision++;
  await assert.rejects(f.send('conquest', f.player, f.field, { reportId: report.id }), /Aufklärung/);
});

test('conquest keeps fuel/cargo ledgers without loot; founding before return pays origin and army returns there after restart', async t => {
  const f = await fixture(t); const mission = await conquer(f, { cargo: { wood: 10, oil: 3 } });
  const p = canonicalJSON(f.player), claim = f.field.claim;
  assert.ok(claim); assert.equal(p.military.missions.at(-1).result.loadedFood, 0);
  const preview = foundingQuote(p, f.storage.world, claim.id, f.now, f.config.settlement);
  const before = p.cities[0].resources.wood;
  const result = foundCity(p, f.storage.world, { claimId: claim.id, name: '  Hafenstadt  ', preview }, f.now, f.config.settlement, () => 'new');
  assert.equal(p.cities.length, 2); assert.equal(p.cities[0].resources.wood, before - 500); assert.equal(p.cities[1].name, 'Hafenstadt');
  assert.deepEqual(p.cities[1].resources, { wood: 0, stone: 0, food: 0, oil: 0 }); assert.equal(p.cities[1].military.units.infantry, 0);
  exposeCity(p, result.cityId); await f.storage.commitPlayers([p], true);
  const restart = await new WorldStorage(f.dir, 'test', () => mission.returnsAt, f.config, { warn() {} }).initialize();
  const done = await restart.loadPlayer(p.playerId);
  assert.equal(done.cities[0].military.units.infantry, 97); assert.equal(done.cities[1].military.units.infantry, 0);
  assert.equal(done.military.reports.at(-1).operatingFuel.remaining, 0); assert.equal(done.military.reports.at(-1).loadedFood, 0);
  assert.ok(done.cities[1].resources.wood > 0); assert.equal(done.military.generals.length, 1);
});

test('insufficient fee, tampered quote, foreign claim and invalid names make no partial payment; expiry wins at exact boundary', async t => {
  const f = await fixture(t); await conquer(f);
  const p = canonicalJSON(f.player), claim = f.field.claim, preview = foundingQuote(p, f.storage.world, claim.id, f.now, f.config.settlement);
  p.cities[0].resources.wood = 499; const before = structuredClone(p);
  assert.throws(() => foundCity(p, f.storage.world, { claimId: claim.id, name: 'Name', preview }, f.now, f.config.settlement, () => 'bad'), /Rohstoffe/);
  assert.deepEqual(p, before); assert.ok(f.field.claim);
  assert.throws(() => foundingQuote({ ...p, playerId: 'foreign' }, f.storage.world, claim.id, f.now, f.config.settlement), /fremder/);
  assert.throws(() => foundCity(p, f.storage.world, { claimId: claim.id, name: 'Name', preview: { ...preview, cityCount: 0 } }, f.now, f.config.settlement, () => 'bad'), /veraltet/);
  for (const name of ['', 'a\n', 'x'.repeat(41), '\u200b']) assert.throws(() => validateCityName(name));
  assert.equal(validateCityName('🙂'.repeat(40)), '🙂'.repeat(40));
  assert.throws(() => foundingQuote(p, f.storage.world, claim.id, claim.expiresAt, f.config.settlement), /abgelaufen/);
  assert.equal(expireClaims(f.storage.world, claim.expiresAt - 1), false); assert.equal(expireClaims(f.storage.world, claim.expiresAt), true);
  assert.equal(f.field.defenders, f.field.originalDefenders); assert.equal(f.field.claim, null);
});

test('two simultaneous conquest arrivals choose mission ID; losing rival keeps army, cargo and has no XP/score', async t => {
  const f = await fixture(t); const report = await scout(f);
  const second = (await f.storage.register('OtherOwner', 'test-password-long')).player;
  second.city.resources.oil = 2000; second.military.units = { infantry: 20, scout: 0, truck: 1 };
  second.military.generals[0].attributes = { leadership: 20, attack: 0, defense: 0 };
  second.military.reports.push({ ...report });
  const home = f.storage.world.map.entities.find(e => e.id === second.cityId); Object.assign(home, { x: f.home.x, y: f.home.y });
  const commands = [];
  for (const [id,p] of [['b-second',f.player],['a-first',second]]) {
    const origin = f.storage.world.map.entities.find(e => e.id === p.cityId);
    const c = { id, type: 'conquest', generalId: p.military.generals[0].id, units: { infantry: 20, truck: 1 }, reportId: report.id, cargo: { wood: 0 } };
    const preview = fieldMissionQuote(p, f.storage.world, c, origin, f.field, f.config.logistics, f.now);
    const sent = startFieldMission(p, f.storage.world, { ...c, preview }, f.now, origin, f.field, f.config.logistics, f.config.settlement); commands.push(sent); await f.storage.savePlayer(sent);
  }
  await f.storage.saveWorld(); const at = commands[0].military.missions.at(-1).returnsAt; await f.advance(at);
  assert.equal(f.field.claim.playerId, second.playerId);
  const loser = await f.storage.loadPlayer(f.player.playerId), won = await f.storage.loadPlayer(second.playerId);
  assert.equal(loser.military.reports.at(-1).cancelled, true); assert.equal(loser.military.reports.at(-1).generalExperience, 0);
  assert.equal(loser.military.reports.at(-1).returnedUnits.infantry, 20); assert.equal(won.military.reports.at(-1).defenderLosses, 5);
  const available = []; randomFreeLocation(f.storage.world.map, count => { for (let i=0;i<count;i++) available.push(randomFreeLocation(f.storage.world.map, () => i)); return 0; });
  assert.ok(available.every(p => p.x !== f.field.x || p.y !== f.field.y));
});

test('all cities accrue production and global research exactly at completion, with independent queues, armies and local mayor', async t => {
  const f = await fixture(t); let p = canonicalJSON(f.player);
  const second = foundedCity('city-two', 'Zweite', 0); p.cities.push(second); exposeCity(p, p.cities[0].id);
  Object.assign(p.city.buildingSlots[3], { building: 'university', buildingId: 'university-one', level: 1 });
  const quote = researchQuote(p.city, { technology: 'forestry', targetLevel: 1, universityId: 'university-one', rulesetVersion: p.research.ruleset });
  p.city = startResearch(p.city, { ...quote, id: 'research', expectedUniversityLevel: 1 }, 0);
  await f.storage.savePlayer(p); await f.advance(120000);
  const done = await f.storage.loadPlayer(p.playerId);
  assert.equal(done.research.levels.forestry, 1); assert.equal(done.research.active, null);
  assert.equal(done.cities[1].resources.wood, 60 + 60 * 1.05); assert.equal(done.cities[1].resources.stone, 120);
  assert.equal(done.cities[1].military.units.infantry, 0); assert.equal(playerScore(done).research, 10); assert.equal(playerScore(done).buildings, 70);
  assert.throws(() => cityView(done, 'foreign'), /cityId/);
  const view = cityView(done, 'city-two'); view.city = enqueueConstruction(view.city, { id: 'build', slotId: 'plot-4', building: 'farm' }, 120000); commitCity(done, view); exposeCity(done, done.cities[0].id);
  assert.equal(done.cities[0].constructionQueue.length, 0); assert.equal(done.cities[1].constructionQueue.length, 1);
});

for (const phase of ['victory', 'founding']) test(`journal crash at ${phase} recovers world/player once`, async t => {
  const f = await fixture(t); const report = await scout(f); const mission = await f.send('conquest', f.player, f.field, { reportId: report.id });
  if (phase === 'founding') await f.advance(mission.arrivesAt);
  const original = f.storage.playerFile.bind(f.storage), blocked = join(f.dir, 'blocked'); await mkdir(blocked); let calls = 0;
  f.storage.playerFile = id => ++calls === (phase === 'victory' ? 2 : 1) ? blocked : original(id);
  if (phase === 'victory') await assert.rejects(f.storage.advanceWorld(mission.arrivesAt), /directory|EISDIR/i);
  else {
    const p = canonicalJSON(f.player), claim = f.field.claim, preview = foundingQuote(p, f.storage.world, claim.id, f.now, f.config.settlement);
    foundCity(p, f.storage.world, { claimId: claim.id, preview, name: 'Crashstadt' }, f.now, f.config.settlement, () => 'crash');
    await assert.rejects(f.storage.commitPlayers([p], true), /directory|EISDIR/i);
  }
  const restart = await new WorldStorage(f.dir, 'test', () => mission.returnsAt, f.config, { warn() {} }).initialize();
  const done = await restart.loadPlayer(f.player.playerId); assert.equal(done.cities.length, phase === 'victory' ? 1 : 2); assert.equal(done.military.reports.filter(r => r.type === 'conquest').length, 1);
  const before = canonicalJSON(done); await restart.advanceWorld(mission.returnsAt); assert.deepEqual(canonicalJSON(await restart.loadPlayer(done.playerId)), before);
});

test('ENV validates defense bounds, fees and TTL; fixed limit cannot be raised', () => {
  for (const env of [{ FIELD_DEFENDER_MIN: '31' }, { CITY_FOUND_FOOD: '0' }, { CITY_CLAIM_TTL_HOURS: '-1' }, { FIELD_DEFENDER_MAX: '5.5' }]) assert.throws(() => parseConfiguration(env));
  assert.equal(parseConfiguration({ CITY_MAX_COUNT: '100' }).settlement.maxCities, undefined);
});

test('real five-city sequence reserves exactly one slot, rejects a sixth, has increasing fees and never creates generals', async t => {
  const f = await fixture(t); let p = f.player;
  for (let n = 2; n <= 5; n++) {
    p = await f.storage.loadPlayer(p.playerId); p.city.resources = { wood: 5000, stone: 5000, food: 5000, oil: 2000 }; p.military.units.infantry = 100; await f.storage.savePlayer(p);
    const coords = f.fields[n - 1], field = ensureField(f.storage.world, coords.x, coords.y, f.config.settlement, () => 0);
    const scoutMission = await f.send('field-scout', p, field); await f.advance(scoutMission.returnsAt);
    const reportId = f.player.military.reports.at(-1).id;
    const mission = await f.send('conquest', f.player, field, { reportId });
    await assert.rejects(f.send('conquest', f.player, field, { reportId }), /Bereits/);
    await f.advance(mission.arrivesAt); p = canonicalJSON(f.player);
    const claim = field.claim, preview = foundingQuote(p, f.storage.world, claim.id, f.now, f.config.settlement);
    assert.equal(preview.cost.wood, 500 * (n - 1));
    foundCity(p, f.storage.world, { claimId: claim.id, name: `Stadt ${n}`, preview }, f.now, f.config.settlement, () => `city-${n}`);
    assert.equal(p.cities.length, n); assert.equal(p.military.generals.length, 1);
    await f.storage.commitPlayers([p], true); await f.advance(mission.returnsAt);
  }
  const field = ensureField(f.storage.world, f.fields[6].x, f.fields[6].y, f.config.settlement, () => 0);
  await assert.rejects(f.send('conquest', f.player, field, { reportId: 'anything' }), /fünf/);
});

test('defeat persists surviving defenders and invalidates scout revision; total army loss grants no claim or loot', async t => {
  const f = await fixture(t); const report = await scout(f), original = f.field.defenders;
  const m = await f.send('conquest', f.player, f.field, { reportId: report.id, units: { infantry: 2, truck: 1 }, cargo: { wood: 5 } });
  await f.advance(m.returnsAt);
  const result = f.player.military.reports.at(-1);
  assert.equal(result.victory, false); assert.equal(result.loadedFood, 0); assert.equal(f.field.claim, null);
  assert.ok(f.field.defenders < original); assert.equal(result.returnedUnits.infantry, 0); assert.equal(result.operatingFuel.remaining, 0); assert.equal(result.cargo.retained.wood, 0);
  await assert.rejects(f.send('conquest', f.player, f.field, { reportId: report.id }), /Aufklärung/);
});

test('local hunger/mayor and shared general exclusivity do not cross city boundaries', async t => {
  const f = await fixture(t, { UPKEEP_INFANTRY_PER_HOUR: '360' });
  const p = canonicalJSON(f.player), second = foundedCity('other-city', 'Andere', 0); p.cities.push(second);
  p.cities[0].resources.food = 0; p.cities[0].buildingSlots[2].level = 0;
  const mayor = p.military.generals[0]; second.military.mayorGeneralId = mayor.id; mayor.status = 'mayor';
  await f.storage.savePlayer(p); await f.advance(1800000);
  const done = f.player;
  assert.ok(done.cities[0].military.units.infantry < 100); assert.equal(done.cities[1].military.units.infantry, 0);
  assert.equal(done.cities[1].resources.food, 2000); assert.equal(done.cities[0].supply.events.length, 1); assert.equal(done.cities[1].supply.events.length, 0);
  assert.throws(() => assignMayor(cityView(done, done.cities[0].id).military, mayor.id), /freier/);
});

test('WebSocket city ownership, independent tabs, global report use and founding request deduplication', async t => {
  const f = await fixture(t); await conquer(f); const running = await start(f.dir, () => f.now, 'test', f.config); t.after(() => close(running.server));
  const a = await websocket(running.port), b = await websocket(running.port); t.after(() => { a.close(); b.close(); });
  const auth = await authenticate(a, 'login', 'CityOwner', 'test-password-long'); await authenticate(b, 'login', 'CityOwner', 'test-password-long');
  const command = async (socket, type, payload, expected = 'command.ok', id) => { const requestId = socket.send(type, payload, id); return (await socket.next(expected, requestId)).payload; };
  for (const cityId of [null, 'foreign-city']) {
    assert.match((await command(a, 'raid.preview', { cityId }, 'command.error')).message, /cityId/);
    assert.match((await command(a, 'construction.enqueue', { cityId, building: 'farm', slotId: 'plot-4' }, 'command.error')).message, /cityId/);
  }
  const claim = auth.snapshot.claims[0];
  const preview = await command(a, 'city.found.preview', { claimId: claim.id }, 'city.found.preview');
  const payload = { claimId: claim.id, preview, name: 'Webstadt' };
  const response = await command(a, 'city.found', payload, 'command.ok', 'founding-duplicate');
  assert.equal((await command(b, 'city.found', payload, 'command.ok', 'founding-duplicate')).duplicate, true);
  const secondId = response.cityId;
  const selected = await command(b, 'city.sync', { cityId: secondId }, 'city.snapshot');
  assert.equal(selected.cityId, secondId); assert.equal(selected.military.units.infantry, 0);
  const original = await command(a, 'city.sync', { cityId: auth.snapshot.cityId }, 'city.snapshot');
  assert.equal(original.cityId, auth.snapshot.cityId); assert.equal(original.cities.length, 2);
  assert.equal((await running.server.storage.loadPlayer(f.player.playerId)).cities.length, 2);
  const player = await running.server.storage.loadPlayer(f.player.playerId), view = cityView(player, secondId); view.city.resources.wood = 100; view.city.resources.stone = 100; commitCity(player, view); exposeCity(player, auth.snapshot.cityId); await running.server.storage.savePlayer(player);
  await command(b, 'construction.enqueue', { cityId: secondId, slotId: 'plot-4', building: 'farm' });
  const after = await running.server.storage.loadPlayer(f.player.playerId);
  assert.equal(after.cities[0].constructionQueue.length, 0); assert.equal(after.cities[1].constructionQueue.length, 1);
});

test('global agriculture completion prevents an exactly simultaneous hunger wave in a different city', async t => {
  const f = await fixture(t, { UPKEEP_INFANTRY_PER_HOUR: '37.44', SUPPLY_GRACE_SECONDS: '60' });
  const p = canonicalJSON(f.player), second = foundedCity('research-city', 'Forschungsstadt', 0); p.cities.push(second);
  p.cities[0].military.units = { infantry: 100, scout: 0, truck: 0 }; p.cities[0].resources.food = 0;
  second.resources = { wood: 200, stone: 200, food: 200, oil: 0 }; Object.assign(second.buildingSlots[3], { building: 'university', buildingId: 'agri-uni', level: 1 });
  exposeCity(p, second.id);
  const quote = researchQuote(p.city, { technology: 'agriculture', targetLevel: 1, universityId: 'agri-uni', rulesetVersion: p.research.ruleset });
  p.city = startResearch(p.city, { ...quote, id: 'agri', expectedUniversityLevel: 1 }, 0);
  await f.storage.savePlayer(p); await f.advance(60000);
  assert.equal(f.player.research.levels.agriculture, 1); assert.equal(f.player.cities[0].military.units.infantry, 100); assert.equal(f.player.cities[0].supply.events.length, 0);
});

for (const phase of ['victory', 'founding']) for (const boundary of ['journal', 'world']) test(`${phase}: failure at ${boundary} write recovers exactly once`, async t => {
  const f = await fixture(t), report = await scout(f), mission = await f.send('conquest', f.player, f.field, { reportId: report.id });
  if (phase === 'founding') await f.advance(mission.arrivesAt);
  const file = boundary === 'journal' ? f.storage.journalFile : f.storage.worldFile;
  const original = boundary === 'world' ? await readFile(file) : null;
  if (original) await rm(file); await mkdir(file);
  if (phase === 'victory') await assert.rejects(f.storage.advanceWorld(mission.arrivesAt));
  else {
    const p = canonicalJSON(f.player), claim = f.field.claim, preview = foundingQuote(p, f.storage.world, claim.id, f.now, f.config.settlement);
    foundCity(p, f.storage.world, { claimId: claim.id, preview, name: 'Recovered' }, f.now, f.config.settlement, () => 'recovered');
    await assert.rejects(f.storage.commitPlayers([p], true));
  }
  await rm(file, { recursive: true }); if (original) { const { writeFile } = await import('node:fs/promises'); await writeFile(file, original); }
  const restart = await new WorldStorage(f.dir, 'test', () => mission.returnsAt, f.config, { warn() {} }).initialize();
  const done = await restart.loadPlayer(f.player.playerId);
  assert.equal(done.cities.length, phase === 'founding' && boundary === 'world' ? 2 : 1);
  assert.equal(done.military.reports.filter(r => r.type === 'conquest').length, 1);
  if (phase === 'founding' && boundary === 'journal') assert.ok(Object.values(restart.world.fields).some(f => f.claim));
  const before = canonicalJSON(done); await restart.advanceWorld(mission.returnsAt); assert.deepEqual(canonicalJSON(await restart.loadPlayer(done.playerId)), before);
});
