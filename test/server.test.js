import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createGameServer, migrateState } from '../apps/server/server.js';

async function start(dataFile, clock, worldName) {
  const server = createGameServer({ dataFile, clock, worldName });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

async function close(server) {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

function post(url, body, origin) {
  return fetch(`${url}/api/construction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('Migration erhält Identität, Gebäude, Rohstoffe und aktiven Auftrag', () => {
  const legacy = {
    schemaVersion: 1,
    ruleset: 'prototype-0.1',
    instanceId: 'stable-instance',
    worldName: 'legacy',
    city: {
      name: 'Alte Stadt', resources: { wood: 12, stone: 34, food: 56 },
      buildings: { sawmill: 2, quarry: 3, farm: 4 },
      construction: { building: 'sawmill', level: 3, finishesAt: 9000 },
      updatedAt: 1000,
    },
  };
  const migrated = migrateState(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.instanceId, legacy.instanceId);
  assert.deepEqual(migrated.city.resources, legacy.city.resources);
  assert.deepEqual(migrated.city.buildingSlots.slice(0, 3).map(slot => [slot.building, slot.level]),
    [['sawmill', 2], ['quarry', 3], ['farm', 4]]);
  assert.equal(migrated.city.constructionQueue[0].slotId, 'plot-1');
  assert.throws(() => migrateState({ schemaVersion: 99, ruleset: 'unknown' }), /Unbekannte/);
});

test('HTTP: Warteschlange, Deduplizierung, Neustart und isolierte Welten', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'strategy-test-'));
  let now = 0;
  let running;
  let other;
  try {
    const alphaFile = join(directory, 'alpha.json');
    running = await start(alphaFile, () => now, 'alpha');
    const initial = await (await fetch(`${running.url}/api/state`)).json();
    assert.equal(initial.city.buildingSlots.length, 9);
    assert.equal(initial.maxQueueLength, 3);
    assert.match(await (await fetch(running.url)).text(), /STADTKARTE/i);
    for (const asset of ['/app.js', '/style.css']) assert.equal((await fetch(running.url + asset)).status, 200);

    const first = { id: 'request-0001', slotId: 'plot-1', building: 'sawmill' };
    assert.equal((await post(running.url, first)).status, 200);
    const afterFirst = await (await post(running.url, first)).json();
    assert.equal(afterFirst.city.resources.wood, 120, 'wiederholte ID zieht Kosten nicht erneut ab');
    assert.equal(afterFirst.city.constructionQueue.length, 1);
    assert.equal((await post(running.url, { id: 'request-0002', slotId: 'plot-1', building: 'sawmill' })).status, 409);
    assert.equal((await post(running.url, { id: 'request-0003', slotId: 'plot-2', building: 'quarry' })).status, 200);
    assert.equal((await post(running.url, { id: 'request-0004', slotId: 'plot-4', building: 'farm' })).status, 200);
    assert.equal((await post(running.url, { id: 'request-0005', slotId: 'plot-5', building: 'farm' })).status, 409);
    assert.equal((await post(running.url, first, 'https://foreign.invalid')).status, 403);
    assert.equal((await post(running.url, '{broken')).status, 400);
    assert.equal(JSON.parse(readFileSync(alphaFile, 'utf8')).city.constructionQueue.length, 3);

    await close(running.server);
    running = null;
    now = 30000;
    running = await start(alphaFile, () => now, 'alpha');
    const restored = await (await fetch(`${running.url}/api/state`)).json();
    assert.equal(restored.world.instanceId, initial.world.instanceId);
    assert.deepEqual(restored.city.buildingSlots.slice(0, 4).map(slot => slot.level), [2, 2, 1, 1]);
    assert.equal(restored.city.constructionQueue.length, 0);

    other = await start(join(directory, 'beta.json'), () => now, 'beta');
    const isolated = await (await fetch(`${other.url}/api/state`)).json();
    assert.notEqual(isolated.world.instanceId, initial.world.instanceId);
    assert.equal(isolated.world.name, 'beta');
    assert.equal(isolated.city.buildingSlots[0].level, 1);
    const descriptor = await (await fetch(`${running.url}/.well-known/federated-strategy`)).json();
    assert.equal(descriptor.federationEnabled, false);
  } finally {
    if (running) await close(running.server);
    if (other) await close(other.server);
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Server migriert Version 1 beim Start und weist unbekannte Versionen ab', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'strategy-migration-'));
  const file = join(directory, 'state.json');
  const legacy = {
    schemaVersion: 1, ruleset: 'prototype-0.1', instanceId: 'migration-instance', worldName: 'old',
    city: { name: 'Stadt', resources: { wood: 200, stone: 200, food: 200 }, buildings: { sawmill: 1, quarry: 1, farm: 1 }, construction: null, updatedAt: 0 },
  };
  let running;
  try {
    writeFileSync(file, JSON.stringify(legacy));
    running = await start(file, () => 0, 'ignored');
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).schemaVersion, 2);
    await close(running.server);
    running = null;
    writeFileSync(file, JSON.stringify({ schemaVersion: 88, ruleset: 'future' }));
    assert.throws(() => createGameServer({ dataFile: file, clock: () => 0 }), /Unbekannte/);
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).schemaVersion, 88);
  } finally {
    if (running) await close(running.server);
    rmSync(directory, { recursive: true, force: true });
  }
});
