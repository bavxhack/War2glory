import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorldStorage } from '../apps/server/storage.js';
import { parseConfiguration } from '../apps/server/config.js';
import {
  TASKS,
  newTasks,
  completeTasks,
  observeTaskRecords,
  claimTask,
} from '../packages/game-core/tasks.js';
import {
  canonicalJSON,
  exposeCity,
  cityView,
  foundedCity,
  playerScore,
} from '../packages/game-core/multicity.js';
import { resourceCapacities } from '../packages/game-core/index.js';
import { supplySummary } from '../packages/game-core/supply.js';
import { cityOverview } from '../packages/game-core/city-overview.js';
import {
  cityTransportQuote,
  startCityTransport,
} from '../packages/game-core/city-logistics.js';
import { start, close, websocket, authenticate } from './support/socket.js';
async function request(c, type, payload = {}, expected = 'command.ok', id) {
  const rid = c.send(type, payload, id);
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      c.off('event', listener);
      reject(new Error(`Timeout ${type}`));
    }, 3000);
    const listener = (e) => {
      if (e.requestId !== rid) return;
      if (e.type === expected || e.type === 'command.error') {
        clearTimeout(timer);
        c.off('event', listener);
        if (e.type !== expected)
          reject(new Error(`${type}: ${e.payload.message}`));
        else resolve(e.payload);
      }
    };
    c.on('event', listener);
  });
}
async function fixture(t, env = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'tasks-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let now = 100000;
  const config = parseConfiguration(env);
  const storage = await new WorldStorage(
    dir,
    'tasks',
    () => now,
    config,
  ).initialize();
  const { player } = await storage.register('TaskOwner', 'test-password-long');
  return {
    dir,
    storage,
    config,
    id: player.playerId,
    get now() {
      return now;
    },
    async advance(at) {
      now = at;
      await storage.exclusive(() => storage.advanceWorld(now));
      return storage.loadPlayer(player.playerId);
    },
  };
}
function qualify(p) {
  for (const task of TASKS) p.tasks.evidence[task.id] = true;
  completeTasks(p.tasks, p.city.updatedAt);
}

test('fresh commander completes nine intro goals through ordinary WebSocket actions, no reward needed to unlock', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'intro-play-'));
  let now = 100000;
  const running = await start(dir, () => now),
    c = await websocket(running.port);
  t.after(async () => {
    c.close();
    await close(running.server);
    await rm(dir, { recursive: true, force: true });
  });
  const auth = await authenticate(c, 'register', 'NewCommander'),
    storage = running.server.storage,
    id = auth.snapshot.player.id;
  let p = await storage.loadPlayer(id);
  const gid = p.military.generals[0].id;
  const sync = async () => {
    await request(c, 'city.sync', {}, 'city.snapshot');
    p = await storage.loadPlayer(id);
  };
  const wait = async (ms) => {
    now += ms;
    await sync();
  };
  const build = async (slotId, building) => {
    await wait(200000);
    await request(c, 'construction.enqueue', { slotId, building });
    p = await storage.loadPlayer(id);
    now = p.city.constructionQueue.at(-1).finishesAt;
    await sync();
  };
  await build('plot-3', 'farm');
  assert.ok(p.tasks.completed['intro.farm']);
  await request(c, 'general.mayor', {
    generalId: gid,
    expectedRoleVersion: p.military.roleVersion,
  });
  await sync();
  assert.ok(p.tasks.completed['intro.mayor']);
  await request(c, 'general.mayor', {
    generalId: null,
    expectedRoleVersion: p.military.roleVersion,
  });
  await build('plot-4', 'warehouse');
  await build('plot-5', 'university');
  await wait(400000);
  const research = async (technology) => {
    await wait(400000);
    const slot = p.city.buildingSlots.find((s) => s.building === 'university');
    const cmd = {
      universityId: slot.buildingId,
      technology,
      targetLevel: 1,
      expectedUniversityLevel: slot.level,
      rulesetVersion: 'research-4-engineering-provisional',
    };
    const q = await request(c, 'research.preview', cmd, 'research.preview');
    await request(c, 'research.start', {
      ...cmd,
      researcher: q.researcher,
      effectRules: q.effectRules,
    });
    p = await storage.loadPlayer(id);
    now = p.research.active.finishesAt;
    await sync();
  };
  await research('forestry');
  await research('oilProcessing');
  await build('plot-6', 'refinery');
  await build('military-plot-1', 'barracks');
  // A farm large enough for the chosen army avoids tutorial-created hunger.
  await build('plot-3', 'farm');
  await build('plot-3', 'farm');
  await wait(800000);
  const train = async (unit, amount) => {
    const payload = { trainingSlotId: 'military-plot-1', unit, amount };
    const q = await request(c, 'training.preview', payload, 'training.preview');
    await request(c, 'training.enqueue', {
      ...payload,
      researchEffect: q.researchEffect,
    });
    p = await storage.loadPlayer(id);
    now = p.military.trainingQueue.at(-1).finishesAt;
    await sync();
  };
  await train('infantry', 30);
  await train('scout', 1);
  assert.equal(p.tasks.training[p.cityId], 10);
  const npc = storage.world.map.entities
    .filter((e) => e.kind === 'npc')
    .sort((a, b) => a.difficulty - b.difficulty)[0];
  const sc = { targetId: npc.id, generalId: gid, scouts: 1 };
  const sq = await request(c, 'scouting.preview', sc, 'scouting.preview');
  await request(c, 'scouting.start', { ...sc, preview: sq });
  p = await storage.loadPlayer(id);
  now = p.military.missions.at(-1).returnsAt;
  await sync();
  assert.ok(p.tasks.completed['intro.scout']);
  // Normal additional training and its stationed upkeep create actual loot space.
  await train('infantry', 30);
  await wait(200000);
  const raid = {
    targetId: npc.id,
    generalId: gid,
    units: { infantry: 30, truck: 0 },
  };
  const rq = await request(c, 'raid.preview', raid, 'raid.preview');
  await request(c, 'raid.start', { ...raid, preview: rq });
  p = await storage.loadPlayer(id);
  now = p.military.missions.at(-1).returnsAt;
  await sync();
  assert.equal(
    TASKS.filter((x) => x.id.startsWith('intro.')).every(
      (x) => p.tasks.completed[x.id],
    ),
    true,
    JSON.stringify({
      tasks: p.tasks,
      reports: p.military.reports,
      food: p.city.resources.food,
    }),
  );
  assert.equal(
    Object.values(p.tasks.completed).some((x) => x.claim),
    false,
  );
  assert.ok(p.military.reports.find((r) => r.type === 'raid').storedFood >= 1);
});

test('completion evidence survives locked prerequisites, demolition and roles; enqueue/transfer/balances are not training', async (t) => {
  const f = await fixture(t);
  let p = await f.storage.loadPlayer(f.id);
  p.city.buildingSlots[3] = {
    ...p.city.buildingSlots[3],
    building: 'warehouse',
    level: 1,
  };
  p.military.trainingQueue = [
    {
      id: 'training-proof',
      unit: 'infantry',
      amount: 6,
      startsAt: f.now,
      finishesAt: f.now + 1000,
    },
    {
      id: 'training-proof-two',
      unit: 'infantry',
      amount: 4,
      startsAt: f.now + 1000,
      finishesAt: f.now + 2000,
    },
  ];
  p.military.units.infantry = 500;
  await f.storage.savePlayer(p);
  p = await f.advance(f.now);
  assert.equal(p.tasks.evidence['intro.training'], undefined);
  assert.equal(p.tasks.evidence['intro.storage'], true);
  assert.equal(p.tasks.completed['intro.storage'], undefined);
  p = await f.advance(f.now + 1000);
  assert.equal(p.tasks.training[p.cityId], 6);
  p = await f.advance(f.now + 1000);
  assert.equal(p.tasks.training[p.cityId], 10);
  p.city.buildingSlots[3].building = null;
  p.city.buildingSlots[3].level = 0;
  p.city.buildingSlots[2].level = 2;
  await f.storage.savePlayer(p);
  p = await f.advance(f.now);
  assert.ok(p.tasks.completed['intro.storage']);
  assert.equal(p.tasks.evidence['intro.training'], true);
  const before = structuredClone(p.tasks);
  p = await f.advance(f.now);
  assert.deepEqual(p.tasks, before);
});

test('raid needs positive stored loot, scout return intelligence and own delivery needs actual food acceptance', async (t) => {
  const f = await fixture(t);
  let p = await f.storage.loadPlayer(f.id);
  p.military.reports = [
    { type: 'raid', victory: true, returnedAt: f.now, storedFood: 0 },
    { type: 'scout', intelligence: null, returnedAt: f.now },
    { type: 'field-scout', intelligence: {}, returnedAt: f.now },
  ];
  observeTaskRecords(p, f.now);
  assert.equal(p.tasks.evidence['intro.raid'], undefined);
  assert.equal(p.tasks.evidence['intro.scout'], undefined);
  p.military.reports.push(
    { type: 'raid', victory: true, returnedAt: f.now, storedFood: 1 },
    { type: 'scout', intelligence: {}, returnedAt: f.now },
  );
  observeTaskRecords(p, f.now);
  assert.equal(p.tasks.evidence['intro.raid'], true);
  assert.equal(p.tasks.evidence['intro.scout'], true);
  const other = foundedCity('target', 'Target', f.now),
    canonical = canonicalJSON(p);
  canonical.cities.push(other);
  canonical.cities.forEach((c) => {
    c.resources = { wood: 1000, stone: 1000, food: 2000, oil: 2000 };
    c.buildingSlots.forEach((s) => {
      s.building = null;
      s.level = 0;
    });
  });
  canonical.cities[0].military.units.truck = 2;
  const origin = canonical.cities[0].id;
  Object.assign(
    f.storage.world.map.entities.find((e) => e.id === origin),
    { x: 0, y: 0 },
  );
  f.storage.world.map.entities.push({
    id: other.id,
    kind: 'player',
    playerId: f.id,
    name: 'Target',
    x: 1,
    y: 0,
  });
  await f.storage.commitPlayers([canonical], true);
  async function send() {
    let p = await f.storage.loadPlayer(f.id);
    const cmd = {
      id: `delivery-${f.now}`,
      type: 'delivery',
      originCityId: origin,
      targetCityId: other.id,
      units: { truck: 1 },
      cargo: { food: 50 },
    };
    const q = cityTransportQuote(
      p,
      cmd,
      f.storage.world,
      f.config.logistics,
      f.config.cityLogistics,
      f.now,
    );
    p = startCityTransport(
      p,
      { ...cmd, preview: q },
      f.storage.world,
      f.config.logistics,
      f.config.cityLogistics,
      f.now,
    );
    await f.storage.savePlayer(p);
    return p.military.missions.at(-1);
  }
  let m = await send();
  p = await f.advance(m.returnsAt);
  assert.equal(p.tasks.evidence['expansion.supply'], undefined);
  p.cities[1].resources.food = 1999;
  await f.storage.savePlayer(p);
  m = await send();
  p = await f.advance(m.arrivesAt);
  assert.equal(p.tasks.evidence['expansion.supply'], true);
  assert.equal(p.military.missions.at(-1).delivered.food, 1);
});

test('claim full reward or nothing, exact space, frozen values and no commander points', async (t) => {
  const f = await fixture(t);
  let p = await f.storage.loadPlayer(f.id);
  qualify(p);
  const score = playerScore(p),
    claim = p.tasks.completed['intro.farm'];
  claim.reward.wood = 101;
  claim.catalogVersion = 'frozen-original';
  const caps = resourceCapacities(p.city);
  p.city.resources = {
    wood: caps.wood - 100,
    stone: 0,
    food: 0,
    oil: caps.oil + 10,
  };
  const before = structuredClone(p);
  assert.throws(
    () => claimTask(p, 'intro.farm', p.cityId, 'claim-0001', f.now),
    /Holz/,
  );
  assert.deepEqual(p, before);
  p.city.resources.wood--;
  const result = claimTask(p, 'intro.farm', p.cityId, 'claim-0001', f.now);
  assert.equal(result.reward.wood, 101);
  assert.equal(result.catalogVersion, 'frozen-original');
  assert.equal(p.city.resources.wood, caps.wood);
  assert.equal(p.city.resources.oil, caps.oil + 10);
  assert.deepEqual(playerScore(p), score);
  assert.throws(
    () => claimTask(p, 'intro.farm', p.cityId, 'claim-0002', f.now),
    /bereits abgeholt/,
  );
});

test('five-city schema17 migration preserves all non-task data, uses historical proofs once and rejects damaged tasks', async (t) => {
  const f = await fixture(t);
  let p = canonicalJSON(await f.storage.loadPlayer(f.id));
  for (let i = 1; i < 5; i++)
    p.cities.push(foundedCity(`city-${i}`, `City ${i}`, f.now));
  p.schemaVersion = 17;
  delete p.tasks;
  p.cities[4].buildingSlots[2].level = 2;
  p.research.levels.forestry = 1;
  p.military.reports = [
    {
      id: 'old-scout',
      missionId: 'old-scout',
      type: 'scout',
      returnedAt: 90000,
      intelligence: { food: { amount: 1 } },
    },
    {
      id: 'old-raid',
      type: 'raid',
      victory: true,
      returnedAt: 90000,
      storedFood: 1,
    },
  ];
  p.cities[2].military.trainingQueue = [
    {
      id: 'old-pending-job',
      unit: 'infantry',
      amount: 3,
      startsAt: f.now,
      finishesAt: f.now + 10000,
    },
  ];
  // A real in-flight own convoy is retained byte for byte by schema 17 → 18.
  p.cities[0].military.units.truck = 1;
  p.cities[0].resources.oil = 100;
  Object.assign(
    f.storage.world.map.entities.find((e) => e.id === p.cities[0].id),
    { x: 0, y: 0 },
  );
  f.storage.world.map.entities.push({
    id: p.cities[1].id,
    kind: 'player',
    playerId: p.playerId,
    name: p.cities[1].name,
    x: 1,
    y: 0,
  });
  const command = {
    id: 'migration-convoy',
    type: 'delivery',
    originCityId: p.cities[0].id,
    targetCityId: p.cities[1].id,
    units: { truck: 1 },
    cargo: { food: 10 },
  };
  const quote = cityTransportQuote(
    exposeCity(p),
    command,
    f.storage.world,
    f.config.logistics,
    f.config.cityLogistics,
    f.now,
  );
  p = canonicalJSON(
    startCityTransport(
      p,
      { ...command, preview: quote },
      f.storage.world,
      f.config.logistics,
      f.config.cityLogistics,
      f.now,
    ),
  );
  await f.storage.saveWorld();
  const original = JSON.parse(JSON.stringify(p));
  await f.storage.savePlayer(p);
  p = await f.storage.loadPlayer(f.id);
  assert.equal(p.schemaVersion, 18);
  assert.ok(p.tasks.completed['intro.farm']);
  assert.equal(p.tasks.evidence['intro.scout'], true);
  assert.equal(p.tasks.evidence['intro.raid'], true);
  assert.deepEqual(p.tasks.training, {});
  const rest = canonicalJSON(p);
  delete rest.tasks;
  rest.schemaVersion = 17;
  assert.deepEqual(rest, original);
  assert.deepEqual(await f.storage.loadPlayer(f.id), p);
  p.tasks.schemaVersion = 999;
  await f.storage.savePlayer(p);
  const bytes = await readFile(f.storage.playerFile(f.id), 'utf8');
  await assert.rejects(() => f.storage.loadPlayer(f.id), /Aufgabenstand/);
  assert.equal(await readFile(f.storage.playerFile(f.id), 'utf8'), bytes);
});

for (const failure of ['journal', 'player'])
  test(`two tabs claim once, immutable retries, restart and ${failure} failure recover atomically`, async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'claim-socket-'));
    let now = 100000,
      running = await start(dir, () => now);
    const clients = [];
    t.after(async () => {
      clients.forEach((c) => c.close());
      await close(running.server);
      await rm(dir, { recursive: true, force: true });
    });
    const a = await websocket(running.port),
      b = await websocket(running.port);
    clients.push(a, b);
    const auth = await authenticate(a, 'register', 'ClaimOwner');
    await authenticate(b, 'login', 'ClaimOwner');
    const storage = running.server.storage;
    let p = await storage.loadPlayer(auth.snapshot.player.id);
    qualify(p);
    p.city.resources = { wood: 0, stone: 0, food: 0, oil: 0 };
    await storage.savePlayer(p);
    const payload = { taskId: 'intro.farm', cityId: p.cityId };
    await request(
      a,
      'tasks.claim',
      { ...payload, cityId: 'foreign-city' },
      'command.error',
      'foreign-claim',
    );
    const blocked =
      failure === 'journal'
        ? storage.journalFile
        : storage.playerFile(p.playerId);
    let saved;
    if (failure === 'player') {
      saved = await readFile(blocked);
      await rm(blocked);
    }
    await mkdir(blocked);
    // A player path cannot be a directory during advanceWorld. Inject at commit only.
    if (failure === 'player') {
      await rm(blocked, { recursive: true });
      await writeFile(blocked, saved);
      const commit = storage.commitPlayers.bind(storage);
      storage.commitPlayers = async (...args) => {
        await rm(blocked);
        await mkdir(blocked);
        try {
          return await commit(...args);
        } finally {
          storage.commitPlayers = commit;
        }
      };
    }
    assert.match(
      (
        await request(
          a,
          'tasks.claim',
          payload,
          'command.error',
          'failed-claim-001',
        )
      ).message,
      /directory|EISDIR/i,
    );
    await rm(blocked, { recursive: true, force: true });
    if (failure === 'player') await writeFile(blocked, saved);
    // Recovery loads the journal first; a failure before journaling leaves no award.
    await storage.exclusive(() => storage.advanceWorld(now));
    p = await storage.loadPlayer(p.playerId);
    const recovered = failure === 'player';
    assert.equal(!!p.tasks.completed['intro.farm'].claim, recovered);
    if (recovered) {
      assert.equal(
        (
          await request(
            a,
            'tasks.claim',
            payload,
            'command.ok',
            'failed-claim-001',
          )
        ).duplicate,
        true,
      );
      assert.equal(p.city.resources.wood, 100);
    } else assert.equal(p.city.resources.wood, 0);
    const taskId = recovered ? 'intro.storage' : 'intro.farm',
      command = { ...payload, taskId };
    const r1 = a.send('tasks.claim', command, 'parallel-claim-a'),
      r2 = b.send('tasks.claim', command, 'parallel-claim-b');
    const [events1, events2] = await Promise.all([
      new Promise((resolve) => {
        const fn = (e) => {
          if (
            e.requestId === r1 &&
            ['command.ok', 'command.error'].includes(e.type)
          ) {
            a.off('event', fn);
            resolve(e);
          }
        };
        a.on('event', fn);
      }),
      new Promise((resolve) => {
        const fn = (e) => {
          if (
            e.requestId === r2 &&
            ['command.ok', 'command.error'].includes(e.type)
          ) {
            b.off('event', fn);
            resolve(e);
          }
        };
        b.on('event', fn);
      }),
    ]);
    assert.equal(
      [events1, events2].filter((e) => e.type === 'command.ok').length,
      1,
    );
    const success = events1.type === 'command.ok' ? r1 : r2;
    assert.equal(
      (await request(a, 'tasks.claim', command, 'command.ok', success))
        .duplicate,
      true,
    );
    assert.match(
      (
        await request(
          a,
          'tasks.claim',
          { ...command, taskId: 'intro.mayor' },
          'command.error',
          success,
        )
      ).message,
      /anderem Inhalt/,
    );
    p = await storage.loadPlayer(p.playerId);
    const resources = { ...p.city.resources };
    p.processedCommands = [];
    await storage.savePlayer(p);
    clients.forEach((c) => c.close());
    await close(running.server);
    running = await start(dir, () => now);
    const c = await websocket(running.port);
    clients.push(c);
    await authenticate(c, 'login', 'ClaimOwner');
    assert.equal(
      (await request(c, 'tasks.claim', command, 'command.ok', success))
        .duplicate,
      true,
    );
    assert.deepEqual(
      (await running.server.storage.loadPlayer(p.playerId)).city.resources,
      resources,
    );
  });

test('overview uses each city and global research, finite per-hour rates, separate shortage and actual grace/recovery', async (t) => {
  const f = await fixture(t);
  let p = canonicalJSON(await f.storage.loadPlayer(f.id));
  p.cities.push(foundedCity('hungry', 'Hungry', f.now));
  p.cities[0].buildingSlots[2].level = 10;
  p.cities[0].resources.food = 1000;
  p.cities[1].resources.food = 100;
  p.cities[1].military.units.infantry = 30;
  p.research.levels.agriculture = 1;
  const g = p.military.generals[0];
  g.status = 'mayor';
  p.cities[0].military.mayorGeneralId = g.id;
  await f.storage.savePlayer(p);
  p = await f.advance(f.now);
  let overview = cityOverview(p, f.storage.world.map.entities, f.now);
  const [a, b] = overview.cities;
  assert.ok(a.netPerHour + b.netPerHour > 0);
  assert.equal(b.status, 'declining');
  assert.equal(b.secondsUntilEmpty, 100 / (3 - 1.05));
  for (const c of overview.cities) {
    const core = supplySummary(cityView(canonicalJSON(p), c.id));
    assert.equal(c.netPerHour, core.net * 3600);
    assert.equal(c.productionPerHour, core.production * 3600);
    assert.equal(c.upkeepPerHour, core.upkeep * 3600);
  }
  assert.equal(a.secondsUntilEmpty, null);
  assert.ok(!JSON.stringify(overview).includes('Infinity'));
  p = await f.advance(f.now + 100000);
  overview = cityOverview(p, [], f.now);
  assert.equal(overview.cities[1].status, 'grace');
  assert.ok(overview.cities[1].nextLossAt > f.now);
  const selected = exposeCity(canonicalJSON(p), 'hungry');
  qualify(selected);
  selected.city.resources.wood = 0;
  selected.city.resources.stone = 0;
  const shortageMs = selected.supply.shortageMs;
  claimTask(selected, 'intro.mayor', 'hungry', 'shortage-claim', f.now);
  await f.storage.savePlayer(selected);
  p = await f.advance(f.now);
  assert.equal(p.cities[1].supply.shortageMs, shortageMs);
  assert.equal(cityOverview(p, [], f.now).cities[1].status, 'recovery');
});

test('claim advances overdue hunger first; expired ordinary receipts cannot recreate an award', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'claim-hunger-'));
  let now = 100000;
  let running = await start(dir, () => now);
  const c = await websocket(running.port);
  t.after(async () => {
    c.close();
    await close(running.server);
    await rm(dir, { recursive: true, force: true });
  });
  const auth = await authenticate(c, 'register', 'HungryClaim');
  let p = await running.server.storage.loadPlayer(auth.snapshot.player.id);
  qualify(p);
  p.city.buildingSlots.forEach((s) => {
    s.level = 0;
    s.building = null;
  });
  p.city.resources = { wood: 0, stone: 0, food: 0, oil: 0 };
  p.military.units.infantry = 20;
  await running.server.storage.savePlayer(p);
  await request(c, 'city.sync', {}, 'city.snapshot');
  p = await running.server.storage.loadPlayer(p.playerId);
  const due = p.supply.nextLossAt;
  now = due + 1;
  const payload = { taskId: 'intro.farm', cityId: p.cityId },
    result = await request(
      c,
      'tasks.claim',
      payload,
      'command.ok',
      'hunger-claim-001',
    );
  p = await running.server.storage.loadPlayer(p.playerId);
  assert.equal(p.military.units.infantry, 19);
  assert.equal(p.supply.events.length, 1);
  assert.ok(p.supply.shortageMs >= 1800000);
  assert.ok(p.supply.recoveryStartedAt >= due);
  assert.equal(result.reward.food, 150);
  // All ordinary receipts would have expired. Keep the task's permanent claim record.
  p.processedCommands = p.processedCommands.filter((x) => x.durable);
  await running.server.storage.savePlayer(p);
  now += 31 * 24 * 3600000;
  await request(
    c,
    'tasks.claim',
    payload,
    'command.error',
    'claim-after-expiry',
  );
  p = await running.server.storage.loadPlayer(p.playerId);
  assert.equal(
    p.tasks.completed['intro.farm'].claim.requestId,
    'hunger-claim-001',
  );
});

test('offline job completion, persistent state evidence and journal replay have identical bounded progress', async (t) => {
  const f = await fixture(t);
  let p = await f.storage.loadPlayer(f.id);
  p.city.resources.food = 2000;
  p.military.trainingQueue = [
    {
      id: 'offline-job-1',
      unit: 'infantry',
      amount: 5,
      startsAt: f.now,
      finishesAt: f.now + 1000,
    },
    {
      id: 'offline-job-2',
      unit: 'infantry',
      amount: 5,
      startsAt: f.now + 1000,
      finishesAt: f.now + 2000,
    },
  ];
  await f.storage.savePlayer(p);
  const original = canonicalJSON(p);
  const fine = await f.advance(f.now + 1000);
  assert.equal(fine.tasks.training[p.cityId], 5);
  const end = f.now + 1000;
  await f.advance(end);
  const expected = canonicalJSON(await f.storage.loadPlayer(f.id));
  await f.storage.savePlayer(original);
  const recovered = await new WorldStorage(
    f.dir,
    'tasks',
    () => end,
    f.config,
  ).initialize();
  p = canonicalJSON(await recovered.loadPlayer(f.id));
  assert.deepEqual(p.tasks, expected.tasks);
  assert.deepEqual(p.cities, expected.cities);
  assert.equal(Object.keys(p.tasks.training).length, 1);
  // Model a crash after durable journal write but before player rename.
  await writeFile(
    recovered.journalFile,
    JSON.stringify({ id: 'replay-tasks-001', world: null, players: [p] }),
  );
  await recovered.savePlayer(original);
  const restarted = await new WorldStorage(
    f.dir,
    'tasks',
    () => end,
    f.config,
  ).initialize();
  p = canonicalJSON(await restarted.loadPlayer(f.id));
  assert.deepEqual(p.tasks, expected.tasks);
  await restarted.advanceWorld(end);
  assert.deepEqual(
    canonicalJSON(await restarted.loadPlayer(f.id)).tasks,
    p.tasks,
  );
});

test('migration never infers training before activation from overdue jobs or existing units', async (t) => {
  const f = await fixture(t);
  let p = canonicalJSON(await f.storage.loadPlayer(f.id));
  p.schemaVersion = 17;
  delete p.tasks;
  p.cities[0].military.units.infantry = 100;
  p.cities[0].military.trainingQueue = [
    {
      id: 'pre-activation-job',
      unit: 'infantry',
      amount: 10,
      startsAt: f.now - 2000,
      finishesAt: f.now - 1000,
    },
  ];
  await f.storage.savePlayer(p);
  p = await f.advance(f.now);
  assert.equal(p.military.units.infantry, 110);
  assert.deepEqual(p.tasks.training, {});
  assert.equal(p.tasks.evidence['intro.training'], undefined);
});
