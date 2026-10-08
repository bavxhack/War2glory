import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseConfiguration, loadConfiguration } from '../apps/server/config.js';
import { WorldStorage } from '../apps/server/storage.js';
import { publicMap } from '../packages/game-core/world.js';
import { advanceSupply, supplySummary, livingUnitGroups, SUPPLY_RULES } from '../packages/game-core/supply.js';
import { newCity } from '../packages/game-core/index.js';
import { newMilitary } from '../packages/game-core/military.js';

const quiet = { warn() {} };
test('ENV: defaults, explicit zero, decimal hourly conversion and rejected formats', () => {
  assert.deepEqual(parseConfiguration().supply, SUPPLY_RULES);
  assert.equal(parseConfiguration({ UPKEEP_INFANTRY_PER_HOUR: '36' }).supply.upkeepPerSecond.infantry, 0.01);
  assert.equal(parseConfiguration({ UPKEEP_SCOUT_PER_HOUR: '0' }).supply.upkeepPerSecond.scout, 0);
  assert.equal(parseConfiguration({ UPKEEP_SCOUT_PER_HOUR: '18.5' }).supply.upkeepPerSecond.scout, 18.5 / 3600);
  for (const value of ['', '-1', 'NaN', 'Infinity', '1e3', '1,5', '1 food', ' 36 ', '0x10']) assert.throws(() => parseConfiguration({ UPKEEP_INFANTRY_PER_HOUR: value }), /UPKEEP_INFANTRY/);
  for (const [key, value] of [['WORLD_WIDTH', '1'], ['WORLD_WIDTH', '65'], ['WORLD_HEIGHT', '3.5'], ['WORLD_NPC_COUNT', '4096'], ['SUPPLY_GRACE_SECONDS', '0'], ['SUPPLY_LOSS_PERCENT', '101']]) assert.throws(() => parseConfiguration({ [key]: value }), new RegExp(key));
});

test('dotenv priorities and invalid/missing files', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'w2g-env-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, '.env');
  assert.equal((await loadConfiguration({ file })).port, 3000);
  await writeFile(file, 'PORT=3001\nWORLD_NAME=demo\nUPKEEP_INFANTRY_PER_HOUR="36"\n');
  const config = await loadConfiguration({ file, env: { PORT: '3002' }, cli: { port: '3003' } });
  assert.equal(config.port, 3003); assert.equal(config.world, 'demo'); assert.equal(config.supply.upkeepPerSecond.infantry, 0.01);
  await writeFile(file, 'UPKEEP_INFANTRY_PER_HOUR=\n'); await assert.rejects(loadConfiguration({ file }), /UPKEEP_INFANTRY/);
  await writeFile(file, 'malformed config\n'); await assert.rejects(loadConfiguration({ file }), /Zuweisung/);
  await writeFile(file, 'PORT="broken\n'); await assert.rejects(loadConfiguration({ file }), /ENV-Wert/);
});

test('free units remain visible, do not starve and worlds do not share rules', () => {
  const p = { city: newCity(0), military: newMilitary('p') }; p.city.buildingSlots[2].level = 0; p.city.resources.food = 0; p.military.units.infantry = 100;
  const free = parseConfiguration({ UPKEEP_INFANTRY_PER_HOUR: '0', UPKEEP_SCOUT_PER_HOUR: '0' }).supply;
  const next = advanceSupply(p, 3_600_000, 0, { rules: free });
  assert.equal(livingUnitGroups(next.military)[0].amount, 100); assert.equal(supplySummary(next).units, 100); assert.equal(next.supply.events.length, 0);
  assert.equal(supplySummary(p).upkeep, 10); assert.equal(next.supply.inShortage, false);
});

test('maps: small, rectangular, larger, impossible and saved dimensions', async t => {
  const root = await mkdtemp(join(tmpdir(), 'w2g-map-')); t.after(() => rm(root, { recursive: true, force: true }));
  for (const [width, height, count] of [[2, 3, 0], [9, 4, 3], [64, 64, 100]]) {
    const dir = join(root, `${width}`); const config = parseConfiguration({ WORLD_WIDTH: String(width), WORLD_HEIGHT: String(height), WORLD_NPC_COUNT: String(count) });
    const storage = await new WorldStorage(dir, 'map', () => 0, config, quiet).initialize();
    const map = publicMap(storage.world, null); assert.equal(map.terrain.length, Math.min(15, width) * Math.min(15, height));
    const original = structuredClone(storage.world.map);
    const reopened = await new WorldStorage(dir, 'map', () => 10, parseConfiguration(), quiet).initialize();
    assert.deepEqual(reopened.world.map, original);
    assert.equal(new Set(original.entities.map(e => `${e.x}:${e.y}`)).size, count);
  }
  const badDir = join(root, 'bad');
  await assert.rejects(new WorldStorage(badDir, 'bad', () => 0, parseConfiguration({ WORLD_WIDTH: '2', WORLD_HEIGHT: '2', WORLD_NPC_COUNT: '4' })).initialize(), /bebaubare/);
  await assert.rejects(readFile(join(badDir, 'world.json')), /ENOENT/);
});

test('restart preserves offline old rates, cycle rules, history and journal recovery', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'w2g-transition-')); t.after(() => rm(dir, { recursive: true, force: true }));
  let now = 0; let storage = await new WorldStorage(dir, 'rules', () => now).initialize();
  const { player } = await storage.register('RulesPlayer', 'long-test-password');
  player.city.resources.food = 1000; player.city.buildingSlots[2].level = 0; player.military.units.infantry = 10; await storage.savePlayer(player);
  now = 60_000; const config = parseConfiguration({ UPKEEP_INFANTRY_PER_HOUR: '36', SUPPLY_GRACE_SECONDS: '10' });
  storage = await new WorldStorage(dir, 'rules', () => now, config).initialize();
  let saved = await storage.loadPlayer(player.playerId); assert.equal(saved.city.resources.food, 940);
  now = 120_000; await storage.advanceWorld(now); saved = await storage.loadPlayer(player.playerId); assert.equal(saved.city.resources.food, 934);
  const history = structuredClone(storage.world.supplyRuleHistory);
  // Recover an older player image; saved world history still splits elapsed intervals correctly.
  await writeFile(join(dir, 'transaction.json'), JSON.stringify({ players: [player], world: null }));
  storage = await new WorldStorage(dir, 'rules', () => now, config).initialize(); saved = await storage.loadPlayer(player.playerId);
  assert.equal(saved.city.resources.food, 934); assert.deepEqual(storage.world.supplyRuleHistory, history);
  saved.city.resources.food = 0; await storage.savePlayer(saved); now += 5_000; await storage.advanceWorld(now);
  saved = await storage.loadPlayer(player.playerId); const cycle = structuredClone(saved.supply.cycleRules);
  now += 1_000;
  storage = await new WorldStorage(dir, 'rules', () => now, parseConfiguration({ UPKEEP_INFANTRY_PER_HOUR: '0' })).initialize();
  saved = await storage.loadPlayer(player.playerId); assert.deepEqual(saved.supply.cycleRules, cycle); assert.equal(saved.supply.shortageMs, 6000);
  assert.equal(saved.supply.inShortage, false); now += cycle.recoveryMs; await storage.advanceWorld(now); assert.equal((await storage.loadPlayer(player.playerId)).supply.shortageMs, 0);
});

test('native server loads dotenv, process precedence and CLI before world mutation', async t => {
  const { spawn } = await import('node:child_process');
  const { once } = await import('node:events');
  const { fileURLToPath } = await import('node:url');
  const dir = await mkdtemp(join(tmpdir(), 'w2g-native-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, '.env'), 'WORLD_WIDTH=9\nWORLD_HEIGHT=4\nWORLD_NPC_COUNT=3\nUPKEEP_INFANTRY_PER_HOUR=0\nUPKEEP_SCOUT_PER_HOUR=18\nWORLD_NAME=dotenv-world\nPORT=3110\n');
  const entry = fileURLToPath(new URL('../apps/server/index.js', import.meta.url));
  const { createServer } = await import('node:net');
  const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, [entry, '--world', 'native-test', '--port', String(port)], { cwd: dir, env: { ...process.env, UPKEEP_INFANTRY_PER_HOUR: '36' } });
  t.after(() => child.kill('SIGTERM'));
  let output = '';
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Native start timeout')), 5000);
    child.stdout.on('data', data => { output += data; if (output.includes(`http://localhost:${port}`)) { clearTimeout(timeout); resolve(); } });
    child.on('exit', code => { if (code) { clearTimeout(timeout); reject(new Error(`Native start failed: ${code}`)); } });
  });
  const world = JSON.parse(await readFile(join(dir, 'data/native-test/world.json'), 'utf8'));
  assert.deepEqual(world.map.config, { width: 9, height: 4, npcCount: 3, maxViewport: 15 });
  assert.deepEqual(world.supplyRuleHistory.at(-1).rules.upkeepPerSecond, { infantry: 0.01, scout: 0.005 });
  assert.match(output, /Nahrung\/Einheit\/Sekunde/);
  const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited;
});

test('two isolated saved worlds keep different effective rules through advancement', async t => {
  const root = await mkdtemp(join(tmpdir(), 'w2g-isolated-')); t.after(() => rm(root, { recursive: true, force: true }));
  let now = 0;
  const free = await new WorldStorage(join(root, 'free'), 'free', () => now, parseConfiguration({ UPKEEP_INFANTRY_PER_HOUR: '0' })).initialize();
  const paid = await new WorldStorage(join(root, 'paid'), 'paid', () => now, parseConfiguration({ UPKEEP_INFANTRY_PER_HOUR: '36' })).initialize();
  const registrations = await Promise.all([free.register('FreeWorld', 'long-test-password'), paid.register('PaidWorld', 'long-test-password')]);
  for (const [index, storage] of [free, paid].entries()) {
    const player = registrations[index].player; player.city.buildingSlots[2].level = 0; player.city.resources.food = 1000; player.military.units.infantry = 10;
    await storage.savePlayer(player);
  }
  now = 60000; await Promise.all([free.advanceWorld(now), paid.advanceWorld(now)]);
  assert.equal((await free.loadPlayer(registrations[0].player.playerId)).city.resources.food, 1000);
  assert.equal((await paid.loadPlayer(registrations[1].player.playerId)).city.resources.food, 994);
  assert.equal(free.supplyRules.upkeepPerSecond.infantry, 0); assert.equal(paid.supplyRules.upkeepPerSecond.infantry, 0.01);
});

test('shortening ENV grace/loss rules cannot accelerate an already running shortage cycle', () => {
  let p = { city: newCity(0), military: newMilitary('cycle') }; p.city.buildingSlots[2].level = 0; p.city.resources.food = 0; p.military.units.infantry = 100;
  p = advanceSupply(p, 600000, 0);
  const changed = parseConfiguration({ SUPPLY_GRACE_SECONDS: '10', SUPPLY_LOSS_INTERVAL_SECONDS: '1', SUPPLY_LOSS_PERCENT: '100' }).supply;
  p = advanceSupply(p, 601000, 0, { rules: changed }); assert.equal(p.supply.cycleRules.graceMs, 1800000);
  p = advanceSupply(p, 1800000, 0); assert.equal(p.military.units.infantry, 95); assert.equal(p.supply.events.length, 1);
  p.city.resources.food = 10000; p = advanceSupply(p, 1860000, 0); assert.equal(p.supply.shortageMs, 0);
  p.city.resources.food = 0; p = advanceSupply(p, 1870000, 0); assert.equal(p.military.units.infantry, 0); assert.equal(p.supply.events.at(-1).total, 95);
});
