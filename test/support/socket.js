import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once, EventEmitter } from 'node:events';
import { connect } from 'node:net';
import { randomBytes } from 'node:crypto';
import { createGameServer } from '../../apps/server/server.js';
import { migrateLegacyState } from '../../apps/server/legacy.js';
import { GENERAL_SKILL_RULES } from '../../packages/game-core/military.js';
import { parseConfiguration } from '../../apps/server/config.js';

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


export { start, close, websocket, authenticate };
