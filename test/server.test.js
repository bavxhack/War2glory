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
import { GENERAL_SKILL_RULES } from '../packages/game-core/military.js';
import { parseConfiguration } from '../apps/server/config.js';

async function start(worldDir, clock = Date.now, worldName = 'alpha', config) {
  const server = createGameServer({ worldDir, clock, worldName, config });
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
      if (length === 127) { if (this.buffer.length < 10) return; length = Number(this.buffer.readBigUInt64BE(2)); offset = 10; }
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

test('WebSocket-Skills: Vorschau, Versionen, Besitz, atomare Buchung, Deduplizierung und Neustart', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'skills-ws-'));
  let running = await start(directory, () => 100_000);
  const clients = [];
  t.after(async () => { for (const client of clients) client.close(); await close(running.server); rmSync(directory, { recursive: true, force: true }); });
  const a = await websocket(running.port), b = await websocket(running.port); clients.push(a, b);
  const first = await authenticate(a, 'register', 'SkillOwner');
  await authenticate(b, 'register', 'OtherOwner');
  let player = await running.server.storage.loadPlayer(first.snapshot.player.id);
  player.military.generals[0].experience = 175;
  await running.server.storage.savePlayer(player);
  let general = player.military.generals[0];
  const payload = () => ({ generalId: general.id, expectedVersion: general.version, rulesetVersion: GENERAL_SKILL_RULES.version });
  async function request(client, type, body, responseType = 'command.ok', id) {
    const requestId = client.send(type, body, id); return (await client.next(responseType, requestId)).payload;
  }
  const quote = await request(a, 'general.preview', { ...payload(), points: 3 }, 'general.preview');
  assert.equal(quote.conversion.cost, 60); assert.equal(quote.conversion.remainingExperience, 115);
  assert.match((await request(a, 'general.preview', { ...payload(), points: 0 }, 'command.error')).message, /Ungültige/);
  assert.match((await request(a, 'general.preview', { ...payload(), expectedVersion: -1, points: 1 }, 'command.error')).message, /inzwischen geändert/);
  assert.equal((await running.server.storage.loadPlayer(player.playerId)).military.generals[0].skills.totalPoints, 0);
  assert.match((await request(b, 'general.convert', { ...payload(), points: 3 }, 'command.error')).message, /Eigener/);
  assert.match((await request(a, 'general.convert', { ...payload(), rulesetVersion: 'old', points: 3 }, 'command.error')).message, /Skillregelsatz/);
  const oldPayload = { ...payload(), points: 3 };
  await request(a, 'general.convert', oldPayload, 'command.ok', 'skill-buy-dedup');
  assert.equal((await request(a, 'general.convert', oldPayload, 'command.ok', 'skill-buy-dedup')).duplicate, true);
  assert.match((await request(a, 'general.convert', { ...oldPayload, points: 2 }, 'command.error', 'skill-buy-dedup')).message, /anderem Inhalt/);
  assert.match((await request(a, 'general.convert', oldPayload, 'command.error')).message, /inzwischen geändert/);
  player = await running.server.storage.loadPlayer(player.playerId); general = player.military.generals[0];
  assert.equal(general.experience, 175); assert.equal(general.skills.totalPoints, 3); assert.equal(general.skills.experienceSpent, 60);
  const distribute = { ...payload(), changes: { leadership: 1, defense: 1 } };
  const preview = await request(a, 'general.preview', distribute, 'general.preview');
  assert.equal(preview.effectiveAttributes.leadership, 21);
  // Two sockets for the same identity compete with the same version.
  const secondConnection = await websocket(running.port); clients.push(secondConnection);
  await authenticate(secondConnection, 'login', 'SkillOwner');
  const oneId = a.send('general.distribute', distribute, 'skill-concurrent-one');
  const twoId = secondConnection.send('general.distribute', distribute, 'skill-concurrent-two');
  const outcomes = await Promise.all([
    Promise.race([a.next('command.ok', oneId), a.next('command.error', oneId)]),
    Promise.race([secondConnection.next('command.ok', twoId), secondConnection.next('command.error', twoId)]),
  ]);
  assert.deepEqual(outcomes.map(event => event.type).sort(), ['command.error', 'command.ok']);
  player = await running.server.storage.loadPlayer(player.playerId); general = player.military.generals[0];
  assert.deepEqual(general.skills.allocations, { leadership: 1, attack: 0, defense: 1 });
  assert.match((await request(a, 'general.distribute', { ...payload(), changes: { defense: -1 } }, 'command.error')).message, /Ungültige/);
  const before = structuredClone(general);
  const savePlayer = running.server.storage.savePlayer.bind(running.server.storage);
  let fail = true;
  running.server.storage.savePlayer = async candidate => {
    if (fail && candidate.military.generals[0].skills.totalPoints > 3) { fail = false; throw new Error('Simulierter Speicherfehler'); }
    return savePlayer(candidate);
  };
  const retryPayload = { ...payload(), points: 1 };
  assert.match((await request(a, 'general.convert', retryPayload, 'command.error', 'skill-storage-retry')).message, /Speicherfehler/);
  assert.deepEqual((await running.server.storage.loadPlayer(player.playerId)).military.generals[0], before);
  await request(a, 'general.convert', retryPayload, 'command.ok', 'skill-storage-retry');
  for (const client of clients) client.close();
  await close(running.server);
  running = await start(directory, () => 100_000);
  const after = await websocket(running.port); clients.push(after);
  const loggedIn = await authenticate(after, 'login', 'SkillOwner');
  assert.equal(loggedIn.snapshot.military.generals[0].skills.experienceSpent, 100);
  assert.equal(loggedIn.snapshot.military.generals[0].skills.totalPoints, 4);
  assert.equal((await request(after, 'general.convert', retryPayload, 'command.ok', 'skill-storage-retry')).duplicate, true);
  assert.equal((await running.server.storage.loadPlayer(player.playerId)).military.generals[0].skills.totalPoints, 4);
});

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

test('WebSocket research: private preview, two connections, deduplication, storage failure and restart', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'research-ws-')); let now = 100000;
  let running = await start(directory, () => now); const clients = [];
  t.after(async () => { for (const client of clients) client.close(); await close(running.server); rmSync(directory, { recursive: true, force: true }); });
  const a = await websocket(running.port), b = await websocket(running.port), other = await websocket(running.port); clients.push(a, b, other);
  const owner = await authenticate(a, 'register', 'ResearchOwner');
  await authenticate(b, 'login', 'ResearchOwner'); await authenticate(other, 'register', 'ResearchOther');
  let p = await running.server.storage.loadPlayer(owner.snapshot.player.id);
  Object.assign(p.city.buildingSlots[3], { building: 'university', buildingId: 'owned-university', level: 1 });
  p.city.resources.wood = 1000; p.city.resources.stone = 1000; await running.server.storage.savePlayer(p);
  const command = { technology: 'forestry', targetLevel: 1, universityId: 'owned-university', rulesetVersion: 'research-2-leadership-provisional' };
  async function request(client, type, payload, responseType = 'command.ok', id) { const requestId = client.send(type, payload, id); return (await client.next(responseType, requestId)).payload; }
  assert.match((await request(other, 'research.preview', command, 'command.error')).message, /eigene/);
  const preview = await request(a, 'research.preview', command, 'research.preview'); assert.equal(preview.cost.wood, 100); assert.equal(preview.durationMs, 60000);
  const before = await running.server.storage.loadPlayer(p.playerId); assert.equal(before.city.resources.wood, 1000);
  const payload = { ...command, researcher: preview.researcher, expectedUniversityLevel: preview.expectedUniversityLevel, cost: { wood: 0 }, durationMs: 1 };
  const save = running.server.storage.savePlayer.bind(running.server.storage);
  running.server.storage.savePlayer = async () => { throw new Error('simulated research disk failure'); };
  assert.match((await request(a, 'research.start', payload, 'command.error')).message, /disk failure/);
  running.server.storage.savePlayer = save; assert.equal((await running.server.storage.loadPlayer(p.playerId)).city.resources.wood, 1000);
  const id = 'research-shared-id'; const first = request(a, 'research.start', payload, 'command.ok', id), duplicate = request(b, 'research.start', payload, 'command.ok', id);
  assert.equal((await first).duplicate, false); assert.equal((await duplicate).duplicate, true);
  p = await running.server.storage.loadPlayer(p.playerId); assert.equal(p.city.resources.wood, 900); assert.equal(p.city.research.active.durationMs, 60000);
  assert.match((await request(b, 'research.start', { ...payload, technology: 'masonry' }, 'command.error', id)).message, /anderem Inhalt/);
  assert.match((await request(b, 'research.start', { ...payload, technology: 'masonry' }, 'command.error')).message, /bereits/);
  assert.match((await request(a, 'building.preview', { slotId: 'plot-4' }, 'command.error')).message, /Forschung/);
  const ownEntity = running.server.storage.world.map.entities.find(e => e.playerId === p.playerId);
  const details = await request(other, 'map.details', { id: ownEntity.id }, 'map.details'); assert.equal(details.entity.research, undefined); assert.equal(details.entity.resources, undefined);
  now += 90000; for (const client of clients) client.close(); await close(running.server); running = await start(directory, () => now);
  const resumed = await websocket(running.port); clients.push(resumed); const logged = await authenticate(resumed, 'login', 'ResearchOwner');
  assert.equal(logged.snapshot.city.research.levels.forestry, 1); assert.equal(logged.snapshot.score.research, 10); assert.equal(logged.snapshot.city.research.active, null);
  assert.equal(logged.snapshot.city.resources.wood, 991.5);
  const replay = await request(resumed, 'research.start', payload, 'command.ok', id); assert.equal(replay.duplicate, true);
  const synced = await request(resumed, 'city.sync', {}, 'city.snapshot'); assert.equal(synced.city.resources.wood, 991.5);
});

test('Auftrag 12: two candidate pools, atomic recruitment, three roles, research/restart and demolition', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'officers-ws-')); let now = 100000;
  const config = parseConfiguration({ GENERAL_CANDIDATE_REFRESH_HOURS: String(1 / 60) });
  let running = await start(directory, () => now, 'alpha', config); const clients = [];
  t.after(async () => { clients.forEach(c => c.close()); await close(running.server); rmSync(directory, { recursive: true, force: true }); });
  const a = await websocket(running.port), b = await websocket(running.port), other = await websocket(running.port); clients.push(a, b, other);
  const owner = await authenticate(a, 'register', 'OfficersOwner'); await authenticate(b, 'login', 'OfficersOwner'); await authenticate(other, 'register', 'OfficersOther');
  async function request(client, type, body, responseType = 'command.ok', id) { const requestId = client.send(type, body, id); return (await client.next(responseType, requestId)).payload; }
  const load = () => running.server.storage.loadPlayer(owner.snapshot.player.id);
  let p = await load(); p.city.resources = { wood: 20000, stone: 20000, food: 1000 };
  Object.assign(p.city.militarySlots[0], { building: 'barracks', buildingId: 'barracks', level: 1 });
  Object.assign(p.city.buildingSlots[3], { building: 'university', buildingId: 'university', level: 2 });
  await running.server.storage.savePlayer(p); await request(a, 'city.sync', {}, 'city.snapshot'); p = await load();
  const pool = structuredClone(p.military.candidatePool);
  const quote = await request(a, 'general.recruit.preview', { candidateId: pool.candidates[0].id }, 'general.recruit.preview');
  assert.deepEqual(quote.cost, { wood: 500, stone: 500 });
  assert.match((await request(other, 'general.recruit', quote, 'command.error')).message, /Bewerberauswahl/);
  const save = running.server.storage.savePlayer.bind(running.server.storage);
  running.server.storage.savePlayer = async () => { throw new Error('simulated recruit write failure'); };
  assert.match((await request(a, 'general.recruit', quote, 'command.error')).message, /write failure/);
  running.server.storage.savePlayer = save;
  p = await load(); assert.equal(p.city.resources.wood, 20000); assert.equal(p.military.generals.length, 1); assert.equal(p.military.acquiredCount, 1); assert.deepEqual(p.military.candidatePool, pool);
  const quote2 = await request(b, 'general.recruit.preview', { candidateId: pool.candidates[1].id }, 'general.recruit.preview');
  const id1 = a.send('general.recruit', quote, 'officer-first-one'), id2 = b.send('general.recruit', quote2, 'officer-first-two');
  const results = await Promise.all([Promise.race([a.next('command.ok', id1), a.next('command.error', id1)]), Promise.race([b.next('command.ok', id2), b.next('command.error', id2)])]);
  assert.deepEqual(results.map(r => r.type).sort(), ['command.error', 'command.ok']);
  const winner = results.find(r => r.type === 'command.ok'), winningQuote = winner.requestId === id1 ? quote : quote2;
  assert.equal((await request(a, 'general.recruit', winningQuote, 'command.ok', winner.requestId)).duplicate, true);
  assert.match((await request(a, 'general.recruit', { ...winningQuote, name: 'different' }, 'command.error', winner.requestId)).message, /anderem Inhalt/);
  p = await load(); assert.equal(p.military.generals.length, 2); assert.equal(p.military.acquiredCount, 2); assert.equal(p.city.resources.wood, 19500);
  const oldAttributes = structuredClone(p.military.generals[1].attributes);
  now = pool.expiresAt; await request(a, 'city.sync', {}, 'city.snapshot'); p = await load();
  assert.match((await request(a, 'general.recruit', quote, 'command.error')).message, /Bewerberauswahl|veraltet/);
  const thirdQuote = await request(a, 'general.recruit.preview', { candidateId: p.military.candidatePool.candidates[0].id }, 'general.recruit.preview'); assert.equal(thirdQuote.cost.wood, 2000);
  await request(a, 'general.recruit', thirdQuote); p = await load(); assert.equal(p.military.generals.length, 3); assert.equal(p.city.resources.wood, 17500);
  assert.deepEqual(p.military.generals[1].attributes, oldAttributes);
  const [A, B, C] = p.military.generals;
  await request(a, 'general.mayor', { generalId: A.id, expectedRoleVersion: p.military.roleVersion }); p = await load();
  await request(a, 'general.researcher', { generalId: B.id, expectedRoleVersion: p.military.roleVersion }); p = await load();
  assert.match((await request(a, 'general.mayor', { generalId: B.id, expectedRoleVersion: p.military.roleVersion }, 'command.error')).message, /freier/);
  p.military.units.infantry = 20; p.city.research.levels.forestry = 1; await running.server.storage.savePlayer(p);
  const target = running.server.storage.world.map.entities.find(e => e.kind === 'npc');
  await request(a, 'raid.start', { generalId: C.id, targetId: target.id, infantry: 20 });
  const researchCommand = { universityId: 'university', technology: 'forestry', targetLevel: 2, rulesetVersion: 'research-2-leadership-provisional' };
  const researchPreview = await request(a, 'research.preview', researchCommand, 'research.preview');
  assert.equal(researchPreview.durationWithoutGeneralMs, 110000);
  await request(a, 'research.start', { ...researchCommand, expectedUniversityLevel: 2, researcher: researchPreview.researcher });
  assert.match((await request(a, 'general.researcher', { generalId: null, expectedRoleVersion: (await load()).military.roleVersion }, 'command.error')).message, /laufender/);
  p = await load(); const job = structuredClone(p.city.research.active);
  await request(a, 'general.rename', { generalId: B.id, name: 'Research leader', expectedVersion: p.military.generals[1].version });
  assert.equal((await load()).city.research.active.finishesAt, job.finishesAt);
  clients.forEach(c => c.close()); await close(running.server); now = job.finishesAt;
  running = await start(directory, () => now, 'alpha', config);
  const resumed = await websocket(running.port); clients.push(resumed); await authenticate(resumed, 'login', 'OfficersOwner');
  p = await load(); assert.equal(p.city.research.levels.forestry, 2); assert.equal(p.city.research.active, null); assert.equal(p.military.researcherGeneralId, B.id); assert.equal(p.military.generals[1].status, 'researcher');
  assert.equal((await request(resumed, 'general.recruit', winningQuote, 'command.ok', winner.requestId)).duplicate, true);
  assert.equal(p.military.acquiredCount, 3); assert.equal(p.military.generals[1].name, 'Research leader');
  const demolition = await request(resumed, 'building.preview', { slotId: p.city.buildingSlots[3].id }, 'building.preview');
  await request(resumed, 'building.demolish', demolition); p = await load(); assert.equal(p.military.researcherGeneralId, null); assert.equal(p.military.generals[1].status, 'idle');
});

test('research appointment and mission compete for the same binding; stale removal cannot replace newer office', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'officer-role-race-')); const running = await start(directory, () => 100000); const clients = [];
  t.after(async () => { clients.forEach(c => c.close()); await close(running.server); rmSync(directory, { recursive: true, force: true }); });
  const a = await websocket(running.port), b = await websocket(running.port); clients.push(a, b);
  const owner = await authenticate(a, 'register', 'RoleRace'); await authenticate(b, 'login', 'RoleRace');
  let p = await running.server.storage.loadPlayer(owner.snapshot.player.id);
  Object.assign(p.city.buildingSlots[3], { building: 'university', buildingId: 'uni', level: 1 }); p.military.units.infantry = 10; await running.server.storage.savePlayer(p);
  const generalId = p.military.generals[0].id, targetId = running.server.storage.world.map.entities.find(e => e.kind === 'npc').id;
  const first = a.send('general.researcher', { generalId, expectedRoleVersion: p.military.roleVersion }), second = b.send('raid.start', { generalId, targetId, infantry: 10 });
  const outcomes = await Promise.all([Promise.race([a.next('command.ok', first), a.next('command.error', first)]), Promise.race([b.next('command.ok', second), b.next('command.error', second)])]);
  assert.deepEqual(outcomes.map(e => e.type).sort(), ['command.error', 'command.ok']);
  p = await running.server.storage.loadPlayer(p.playerId);
  assert.equal(p.military.researcherGeneralId === generalId, p.military.missions.length === 0);
  if (p.military.researcherGeneralId) {
    const requestId = a.send('general.researcher', { generalId: null, expectedRoleVersion: p.military.roleVersion - 1 }); assert.match((await a.next('command.error', requestId)).payload.message, /veraltet/);
    assert.equal((await running.server.storage.loadPlayer(p.playerId)).military.researcherGeneralId, generalId);
  }
});

test('Postbox: private delivery, all tabs, report/message reads, retry, offline delivery and restart', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'mail-ws-'));
  let now = 100000;
  let running = await start(directory, () => now);
  const clients = [];
  t.after(async () => { clients.forEach(client => client.close()); await close(running.server); rmSync(directory, { recursive: true, force: true }); });
  const a = await websocket(running.port), b = await websocket(running.port), e = await websocket(running.port), b2 = await websocket(running.port);
  clients.push(a, b, e, b2);
  const alice = await authenticate(a, 'register', 'MailAlice');
  const bob = await authenticate(b, 'register', 'MailBob');
  await authenticate(e, 'register', 'MailEve');
  await authenticate(b2, 'login', 'MailBob');
  const payload = { recipient: 'mailbob', subject: '<script>Betreff</script>', body: 'Hallo\nKommandant!' };
  const incoming = b.next('city.updated'), otherTab = b2.next('city.updated');
  const id = a.send('mail.send', payload);
  const receipt = (await a.next('command.ok', id)).payload;
  assert.equal(receipt.duplicate, false);
  for (const event of [await incoming, await otherTab]) {
    assert.equal(event.payload.mailbox.unreadCount, 1);
    assert.equal(event.payload.mailbox.messages[0].body, payload.body);
    assert.equal(event.payload.mailbox.messages[0].senderId, alice.snapshot.player.id);
  }
  let sync = e.send('city.sync');
  assert.deepEqual((await e.next('city.snapshot', sync)).payload.mailbox.messages, []);
  const foreign = e.send('mail.read', { kind: 'message', id: receipt.messageId });
  await e.next('command.error', foreign);
  a.send('mail.send', payload, id);
  assert.equal((await a.next('command.ok', id)).payload.duplicate, true);
  a.send('mail.send', { ...payload, body: 'Anderer Inhalt' }, id);
  await a.next('command.error', id);
  const readTab = b2.next('city.updated');
  const readId = b.send('mail.read', { kind: 'message', id: receipt.messageId });
  await b.next('command.ok', readId);
  assert.equal((await readTab).payload.mailbox.unreadCount, 0);
  let player = await running.server.storage.loadPlayer(bob.snapshot.player.id);
  player.military.reports.push({ id: 'new-scout', type: 'scout', returnedAt: now, intelligence: { food: { amount: 55 } } }, { id: 'new-raid', type: 'raid', returnedAt: now });
  await running.server.storage.savePlayer(player);
  sync = b.send('city.sync'); assert.equal((await b.next('city.snapshot', sync)).payload.mailbox.unreadCount, 2);
  const reportRead = b.send('mail.read', { kind: 'report', id: 'new-scout' }); await b.next('command.ok', reportRead);
  clients.forEach(client => client.close()); await close(running.server);
  running = await start(directory, () => now);
  const anew = await websocket(running.port); clients.push(anew); await authenticate(anew, 'login', 'MailAlice');
  now += 61000;
  const offline = anew.send('mail.send', { recipient: 'MailBob', subject: 'Offline', body: 'Bleibt gespeichert' }); await anew.next('command.ok', offline);
  const bnew = await websocket(running.port); clients.push(bnew);
  const resumed = await authenticate(bnew, 'login', 'MailBob');
  assert.equal(resumed.snapshot.mailbox.unreadCount, 2); // unread raid and offline message
  assert.equal(resumed.snapshot.mailbox.messages.length, 2);
  assert.equal(resumed.snapshot.mailbox.messages[0].readAt, 100000);
  assert.ok(resumed.snapshot.mailbox.readReportIds.includes('new-scout'));
  assert.equal(resumed.snapshot.military.reports.length, 2);
});
