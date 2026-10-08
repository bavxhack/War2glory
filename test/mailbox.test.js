import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorldStorage, atomicWrite, PLAYER_SCHEMA_VERSION } from '../apps/server/storage.js';
import { validateMail, markMailRead, unreadMail } from '../packages/game-core/mailbox.js';
import { WebSocketPeer } from '../apps/server/websocket.js';
import { EventEmitter } from 'node:events';

async function setup(t) {
  const dir = await mkdtemp(join(tmpdir(), 'postbox-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const storage = await new WorldStorage(dir, 'mail', () => 100000).initialize();
  const a = (await storage.register('Sender', 'sicheres-passwort')).player;
  const b = (await storage.register('Recipient', 'sicheres-passwort')).player;
  await storage.advanceWorld(100000);
  return { dir, storage, a: await storage.loadPlayer(a.playerId), b: await storage.loadPlayer(b.playerId) };
}
const mail = { recipient: 'Recipient', subject: 'Betreff', body: 'Text\nZweite Zeile' };

test('mail validation rejects empty/oversized/control text and permits literal markup as text', () => {
  assert.equal(validateMail({ ...mail, subject: '<img onerror=alert(1)>' }).subject, '<img onerror=alert(1)>');
  for (const invalid of [{ body: ' ' }, { subject: 'x'.repeat(101) }, { body: 'x'.repeat(4001) }, { body: 'a\x00b' }, { subject: 'a\nb' }, { recipient: {} }]) assert.throws(() => validateMail({ ...mail, ...invalid }));
});

test('schema 11 migration preserves historical reports and game state; later reports become unread', async t => {
  const { dir, storage, a } = await setup(t);
  a.schemaVersion = 11; delete a.mailbox;
  a.military.reports.push({ id: 'historic', type: 'raid', arbitrary: { preserved: true } });
  const before = structuredClone(a); await storage.savePlayer(a);
  const migrated = await storage.loadPlayer(a.playerId);
  assert.equal(migrated.schemaVersion, PLAYER_SCHEMA_VERSION); assert.equal(unreadMail(migrated), 0);
  const compare = structuredClone(migrated); delete compare.mailbox; compare.schemaVersion = 11;
  assert.deepEqual(compare, before);
  migrated.military.reports.push({ id: 'fresh', type: 'scout' }); assert.equal(unreadMail(migrated), 1);
  markMailRead(migrated, { kind: 'report', id: 'fresh' }, 100000);
  markMailRead(migrated, { kind: 'report', id: 'fresh' }, 100001);
  assert.equal(unreadMail(migrated), 0); assert.throws(() => markMailRead(migrated, { kind: 'report', id: 'foreign' }, 100000));
  await storage.savePlayer(migrated);
  const restarted = await new WorldStorage(dir, 'mail', () => 100000).initialize();
  assert.deepEqual(await restarted.loadPlayer(a.playerId), migrated);
});

test('send retries persist beyond generic command retention, reject conflicts and rate-limit without writes', async t => {
  const { storage, a, b } = await setup(t);
  for (let i = 0; i < 5; i++) await storage.exclusive(() => storage.sendMail(a.playerId, `request-${i}`, mail, 100000));
  const before = await readFile(storage.playerFile(b.playerId), 'utf8');
  await assert.rejects(storage.exclusive(() => storage.sendMail(a.playerId, 'sixth', mail, 100000)), /fünf/);
  assert.equal(await readFile(storage.playerFile(b.playerId), 'utf8'), before);
  const duplicate = await storage.exclusive(() => storage.sendMail(a.playerId, 'request-0', mail, 9999999999));
  assert.equal(duplicate.duplicate, true);
  await assert.rejects(storage.exclusive(() => storage.sendMail(a.playerId, 'request-0', { ...mail, body: 'Changed' }, 100000)), /anderem Inhalt/);
  await assert.rejects(storage.exclusive(() => storage.sendMail(a.playerId, 'bad', { ...mail, recipient: 'Sender' }, 100000)), /anderen/);
  await assert.rejects(storage.exclusive(() => storage.sendMail(a.playerId, 'bad', { ...mail, recipient: 'Missing' }, 100000)), /nicht gefunden/);
  await storage.exclusive(() => storage.sendMail(a.playerId, 'sixth', mail, 160000));
  assert.equal((await storage.loadPlayer(b.playerId)).mailbox.messages.length, 6);
});

test('journal recovery completes delivery after interruption between sender and recipient saves', async t => {
  const { dir, storage, a, b } = await setup(t);
  storage.commitPlayers = async players => {
    await atomicWrite(storage.journalFile, { players, world: null });
    await atomicWrite(storage.playerFile(players[0].playerId), players[0]);
    throw new Error('Simulated interruption');
  };
  await assert.rejects(storage.exclusive(() => storage.sendMail(a.playerId, 'interrupted', mail, 100000)));
  const restarted = await new WorldStorage(dir, 'mail', () => 100000).initialize();
  const sender = await restarted.loadPlayer(a.playerId), recipient = await restarted.loadPlayer(b.playerId);
  assert.equal(sender.mailbox.messages.length, 1); assert.deepEqual(sender.mailbox.messages, recipient.mailbox.messages);
  assert.equal((await restarted.exclusive(() => restarted.sendMail(a.playerId, 'interrupted', mail, 100000))).duplicate, true);
});

test('large private snapshots use valid 64-bit WebSocket framing', () => {
  const socket = new EventEmitter(); let data;
  socket.write = chunk => { data = chunk; };
  const peer = new WebSocketPeer(socket);
  const payload = { body: 'x'.repeat(100000) }; peer.send(payload);
  assert.equal(data[1], 127); assert.equal(Number(data.readBigUInt64BE(2)), data.length - 10);
  assert.deepEqual(JSON.parse(data.subarray(10)), payload);
});
