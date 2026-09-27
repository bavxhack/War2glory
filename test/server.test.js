import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createGameServer } from '../apps/server/server.js';

async function start(dataFile, clock) {
  const server = createGameServer({ dataFile, clock });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
async function close(server) {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

test('HTTP: Bau, Neustart, Instanzidentität, Zeitfortschritt und isolierte Welten', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'strategy-test-'));
  let now = 0;
  let running;
  let other;
  try {
    running = await start(join(directory, 'alpha.json'), () => now);
    const initial = await (await fetch(`${running.url}/api/state`)).json();
    assert.match(await (await fetch(running.url)).text(), /Gründerstadt/);
    for (const asset of ['/app.js', '/style.css']) assert.equal((await fetch(running.url + asset)).status, 200);
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ building: 'sawmill' }) };
    assert.equal((await fetch(`${running.url}/api/upgrade`, options)).status, 200);
    assert.equal((await fetch(`${running.url}/api/upgrade`, options)).status, 409);
    assert.equal((await fetch(`${running.url}/api/upgrade`, { ...options, headers: { ...options.headers, Origin: 'https://foreign.invalid' } })).status, 403);
    assert.equal((await fetch(`${running.url}/api/upgrade`, { ...options, body: '{broken' })).status, 400);
    await close(running.server);
    running = null;
    now = 20000;
    running = await start(join(directory, 'alpha.json'), () => now);
    const restored = await (await fetch(`${running.url}/api/state`)).json();
    assert.equal(restored.world.instanceId, initial.world.instanceId);
    assert.equal(restored.city.buildings.sawmill, 2);
    assert.equal(restored.city.resources.wood, 150);
    other = await start(join(directory, 'beta.json'), () => now);
    const isolated = await (await fetch(`${other.url}/api/state`)).json();
    assert.notEqual(isolated.world.instanceId, initial.world.instanceId);
    assert.equal(isolated.city.buildings.sawmill, 1);
    const descriptor = await (await fetch(`${running.url}/.well-known/federated-strategy`)).json();
    assert.equal(descriptor.federationEnabled, false);
    assert.deepEqual(descriptor.capabilities, []);
  } finally {
    if (running) await close(running.server);
    if (other) await close(other.server);
    rmSync(directory, { recursive: true, force: true });
  }
});
