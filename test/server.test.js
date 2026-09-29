import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once, EventEmitter } from 'node:events';
import { connect } from 'node:net';
import { randomBytes } from 'node:crypto';
import { createGameServer } from '../apps/server/server.js';
import { migrateLegacyState } from '../apps/server/legacy.js';

async function start(worldDir, clock = Date.now, worldName = 'alpha') {
  const server = createGameServer({ worldDir, clock, worldName });
  await server.ready;
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, port: server.address().port, url: `http://127.0.0.1:${server.address().port}` };
}

async function close(server) {
  server.closeAllConnections();
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, 500);
    server.close(error => { clearTimeout(timeout); error ? reject(error) : resolve(); });
  });
}

class TestSocket extends EventEmitter {
  constructor(socket) { super(); this.socket = socket; this.buffer = Buffer.alloc(0); }
  send(type, payload = {}, requestId = randomBytes(8).toString('hex')) {
    const body = Buffer.from(JSON.stringify({ version: 1, type, requestId, payload }));
    const mask = randomBytes(4);
    const header = body.length < 126 ? Buffer.from([0x81, 0x80 | body.length]) : Buffer.from([0x81, 0xfe, body.length >> 8, body.length & 255]);
    const masked = Buffer.from(body); for (let index = 0; index < masked.length; index += 1) masked[index] ^= mask[index % 4];
    this.socket.write(Buffer.concat([header, mask, masked]));
    return requestId;
  }
  ingest(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2) {
      let length = this.buffer[1] & 127; let offset = 2;
      if (length === 126) { if (this.buffer.length < 4) return; length = this.buffer.readUInt16BE(2); offset = 4; }
      if (this.buffer.length < offset + length) return;
      const opcode = this.buffer[0] & 15; const body = this.buffer.subarray(offset, offset + length); this.buffer = this.buffer.subarray(offset + length);
      if (opcode === 1) this.emit('event', JSON.parse(body.toString()));
    }
  }
  next(type, requestId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.off('event', listener); reject(new Error(`Timeout: ${type}`)); }, 3000);
      const listener = event => { if (event.type === type && (!requestId || event.requestId === requestId)) { clearTimeout(timeout); this.off('event', listener); resolve(event); } };
      this.on('event', listener);
    });
  }
  close() { this.socket.destroy(); }
}

function websocket(port, origin = `http://127.0.0.1:${port}`) {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1'); let handshake = Buffer.alloc(0);
    socket.once('error', reject);
    socket.on('connect', () => socket.write(`GET /game HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nOrigin: ${origin}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: ${randomBytes(16).toString('base64')}\r\n\r\n`));
    const establish = chunk => {
      handshake = Buffer.concat([handshake, chunk]); const boundary = handshake.indexOf('\r\n\r\n'); if (boundary < 0) return;
      socket.off('data', establish); const status = handshake.subarray(0, boundary).toString();
      if (!status.includes('101 Switching Protocols')) return reject(new Error(status));
      const client = new TestSocket(socket); socket.on('data', data => client.ingest(data));
      const remainder = handshake.subarray(boundary + 4); if (remainder.length) client.ingest(remainder); resolve(client);
    };
    socket.on('data', establish);
  });
}

async function authenticate(client, mode, username, password = 'sicheres-passwort') {
  const requestId = client.send(`auth.${mode}`, { username, password, cityName: `${username}burg` });
  const successPromise = client.next('auth.success', requestId); const snapshotPromise = client.next('city.snapshot', requestId);
  return { success: await successPromise, snapshot: (await snapshotPromise).payload };
}

test('Legacy-Migration erhält Stadt, Rohstoffe und laufenden Auftrag', () => {
  const result = migrateLegacyState({ schemaVersion: 1, ruleset: 'prototype-0.1', instanceId: 'old', worldName: 'old', city: {
    name: 'Alte Stadt', resources: { wood: 12, stone: 34, food: 56 }, buildings: { sawmill: 2, quarry: 3, farm: 4 },
    construction: { building: 'sawmill', level: 3, finishesAt: 9000 }, updatedAt: 1000,
  } });
  assert.deepEqual(result.city.resources, { wood: 12, stone: 34, food: 56 });
  assert.deepEqual(result.city.buildingSlots.slice(0, 3).map(slot => slot.level), [2, 3, 4]);
  assert.equal(result.city.constructionQueue[0].slotId, 'plot-1');
  assert.throws(() => migrateLegacyState({ schemaVersion: 99 }), /Unbekannte/);
});

test('WebSocket: getrennte Konten, Sitzung, Deduplizierung, Push und Neustart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'strategy-ws-')); let running; const clients = []; let now = 1000;
  try {
    running = await start(directory, () => now); assert.equal((await fetch(`${running.url}/health`)).status, 200);
    assert.equal((await fetch(`${running.url}/request-id.js`)).status, 200);
    assert.equal((await fetch(`${running.url}/map-navigation.js`)).status, 200);
    assert.equal((await fetch(`${running.url}/assets/scout-aircraft.svg`)).headers.get('content-type'), 'image/svg+xml');
    assert.equal((await fetch(`${running.url}/assets/infantry.svg`)).status, 200);
    assert.equal((await fetch(`${running.url}/api/state`)).status, 410);
    const a = await websocket(running.port); const b = await websocket(running.port); clients.push(a, b);
    const authA = await authenticate(a, 'register', 'Alpha'); const authB = await authenticate(b, 'register', 'Bravo');
    assert.notEqual(authA.snapshot.player.id, authB.snapshot.player.id);
    const id = 'construction-0001'; const okPromise = a.next('command.ok', id); const updatePromise = a.next('city.updated');
    a.send('construction.enqueue', { slotId: 'plot-4', building: 'farm', playerId: authB.snapshot.player.id }, id);
    await okPromise; const updatedA = (await updatePromise).payload;
    assert.equal(updatedA.city.resources.wood, 160); assert.equal(authB.snapshot.city.resources.wood, 200);
    const duplicatePromise = a.next('command.ok', id); a.send('construction.enqueue', { slotId: 'plot-4', building: 'farm' }, id);
    assert.equal((await duplicatePromise).payload.duplicate, true);
    const conflictPromise = a.next('command.error', id); a.send('construction.enqueue', { slotId: 'plot-5', building: 'farm' }, id);
    assert.match((await conflictPromise).payload.message, /anderem Inhalt/);
    const unauthenticated = await websocket(running.port); clients.push(unauthenticated);
    const deniedId = unauthenticated.send('city.sync', { playerId: authA.snapshot.player.id });
    assert.equal((await unauthenticated.next('auth.required', deniedId)).type, 'auth.required');
    const badLoginId = unauthenticated.send('auth.login', { username: 'Alpha', password: 'ganz-falsch!' });
    assert.match((await unauthenticated.next('command.error', badLoginId)).payload.message, /falsch/);
    const resumeClient = await websocket(running.port); clients.push(resumeClient);
    const resumeId = resumeClient.send('auth.resume', { sessionToken: authA.success.payload.sessionToken });
    const resumeSuccess = resumeClient.next('auth.success', resumeId); const resumeSnapshot = resumeClient.next('city.snapshot', resumeId);
    await resumeSuccess; assert.equal((await resumeSnapshot).payload.player.id, authA.snapshot.player.id);
    clients.splice(0).forEach(client => client.close()); await close(running.server); running = null;
    now = 20_000; running = await start(directory, () => now);
    const restored = await websocket(running.port); clients.push(restored); const restoredId = restored.send('auth.resume', { sessionToken: authA.success.payload.sessionToken });
    const restoredSuccess = restored.next('auth.success', restoredId); const restoredSnapshot = restored.next('city.snapshot', restoredId);
    await restoredSuccess; const restoredCity = (await restoredSnapshot).payload.city;
    assert.equal(restoredCity.buildingSlots[3].building, 'farm'); assert.equal(restoredCity.constructionQueue.length, 0);
    const accountData = JSON.parse(readFileSync(join(directory, 'accounts.json'), 'utf8'));
    assert.equal(JSON.stringify(accountData).includes(authA.success.payload.sessionToken), false, 'Sitzung wird nur gehasht gespeichert');
  } finally { clients.forEach(client => client.close()); if (running) await close(running.server); rmSync(directory, { recursive: true, force: true }); }
});

test('WebSocket weist fremde Origins und übergroße Nachrichten ab', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'strategy-security-')); let running;
  try {
    running = await start(directory);
    await assert.rejects(websocket(running.port, 'https://evil.invalid'), /403 Forbidden/);
    const client = await websocket(running.port); client.socket.write(Buffer.from([0x81, 0xfe, 0x40, 0x01]));
    await once(client.socket, 'close');
  } finally { if (running) await close(running.server); rmSync(directory, { recursive: true, force: true }); }
});

test('WebSocket: Generalnamen werden versioniert, dedupliziert und nach Besitz geprüft', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'strategy-generals-')); let running; const clients = [];
  try {
    running = await start(directory);
    const a = await websocket(running.port); const b = await websocket(running.port); clients.push(a, b);
    const first = await authenticate(a, 'register', 'GeneralAlpha');
    const second = await authenticate(b, 'register', 'GeneralBravo');
    const general = first.snapshot.military.generals[0];
    const renameId = 'general-rename-1'; const ok = a.next('command.ok', renameId); const update = a.next('city.updated');
    a.send('general.rename', { generalId: general.id, name: '  Zoë 🚀  ', expectedVersion: general.version }, renameId);
    await ok; const renamed = (await update).payload.military.generals[0];
    assert.equal(renamed.name, 'Zoë 🚀'); assert.equal(renamed.version, 2);
    const duplicate = a.next('command.ok', renameId);
    a.send('general.rename', { generalId: general.id, name: '  Zoë 🚀  ', expectedVersion: general.version }, renameId);
    assert.equal((await duplicate).payload.duplicate, true);
    const staleId = 'general-rename-2'; a.send('general.rename', { generalId: general.id, name: 'Alt', expectedVersion: 1 }, staleId);
    assert.match((await a.next('command.error', staleId)).payload.message, /inzwischen geändert/);
    const foreignId = 'general-rename-3'; a.send('general.rename', { generalId: second.snapshot.military.generals[0].id, name: 'Fremd', expectedVersion: 1 }, foreignId);
    assert.match((await a.next('command.error', foreignId)).payload.message, /nicht gefunden/);
    const skillId = 'general-skills-1'; a.send('general.skills', { generalId: general.id }, skillId);
    assert.match((await a.next('command.error', skillId)).payload.message, /nicht erlaubt/);
  } finally { clients.forEach(client => client.close()); if (running) await close(running.server); rmSync(directory, { recursive: true, force: true }); }
});

test('WebSocket: Abrissvorschau, Bestätigung und Deduplizierung sind serververbindlich', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'strategy-demolition-')); let running; const clients = []; let now = 0;
  try {
    running = await start(directory, () => now);
    const client = await websocket(running.port); clients.push(client);
    await authenticate(client, 'register', 'AbrissTest');
    const buildId = 'warehouse-build-1'; const buildOk = client.next('command.ok', buildId);
    client.send('construction.enqueue', { slotId: 'plot-4', building: 'warehouse' }, buildId); await buildOk;
    now = 5000;
    const syncId = client.send('city.sync'); await client.next('city.snapshot', syncId);
    const previewId = client.send('building.preview', { slotId: 'plot-4' });
    const preview = (await client.next('building.preview', previewId)).payload;
    assert.deepEqual(preview.refund, { wood: 4, stone: 3, food: 0 });
    const demolitionId = 'demolition-command-1'; const demolitionOk = client.next('command.ok', demolitionId);
    client.send('building.demolish', { slotId: preview.slotId, buildingId: preview.buildingId, version: preview.version }, demolitionId);
    assert.equal((await demolitionOk).payload.demolition.building, 'warehouse');
    const duplicate = client.next('command.ok', demolitionId);
    client.send('building.demolish', { slotId: preview.slotId, buildingId: preview.buildingId, version: preview.version }, demolitionId);
    assert.equal((await duplicate).payload.duplicate, true);
    const playerFile = join(directory, 'players', `${running.server.storage.accounts.accounts[0].playerId}.json`);
    const saved = JSON.parse(readFileSync(playerFile, 'utf8'));
    assert.equal(saved.city.buildingSlots[3].building, null);
    assert.equal(saved.city.resources.wood, 169);
  } finally { clients.forEach(client => client.close()); if (running) await close(running.server); rmSync(directory, { recursive: true, force: true }); }
});

test('Gemeinsame Karte vergibt eindeutige Positionen, sendet Push und bleibt nach Neustart stabil', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'strategy-map-')); let running; const clients = [];
  try {
    running = await start(directory);
    const a = await websocket(running.port); clients.push(a);
    const first = await authenticate(a, 'register', 'KarteAlpha');
    const initialMapPromise = a.next('map.snapshot');
    a.send('map.viewport', { x: 0, y: 0, width: 15, height: 15 });
    const initialMap = (await initialMapPromise).payload;
    const b = await websocket(running.port); clients.push(b);
    const pushPromise = a.next('map.changed');
    const second = await authenticate(b, 'register', 'KarteBravo');
    const pushed = (await pushPromise).payload.entity;
    assert.equal(pushed.commanderName, 'KarteBravo');
    const world = JSON.parse(readFileSync(join(directory, 'world.json'), 'utf8'));
    const playerCities = world.map.entities.filter(entity => entity.kind === 'player');
    assert.equal(new Set(playerCities.map(entity => `${entity.x}:${entity.y}`)).size, 2);
    assert.equal(new Set(world.map.entities.filter(entity => entity.kind === 'npc').map(entity => entity.id)).size, 18);
    const npc = world.map.entities.find(entity => entity.kind === 'npc');
    const detailId = a.send('map.details', { id: npc.id }); const detail = (await a.next('map.details', detailId)).payload;
    assert.equal(JSON.stringify(detail).includes('resources'), false); assert.equal(detail.restricted, true);
    const invalidId = a.send('map.viewport', { x: -1, y: 0, width: 99, height: 1 });
    assert.match((await a.next('command.error', invalidId)).payload.message, /Ungültiger|zu groß/);
    assert.notEqual(first.snapshot.player.id, second.snapshot.player.id); assert.ok(initialMap.entities);
    const before = readFileSync(join(directory, 'world.json'), 'utf8');
    clients.splice(0).forEach(client => client.close()); await close(running.server); running = await start(directory);
    assert.equal(readFileSync(join(directory, 'world.json'), 'utf8'), before);
  } finally { clients.forEach(client => client.close()); if (running) await close(running.server); rmSync(directory, { recursive: true, force: true }); }
});
