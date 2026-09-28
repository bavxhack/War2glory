import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  advanceCity, BUILDINGS, CAPACITY, cityOffers, enqueueConstruction, MAX_LEVEL, MAX_QUEUE_LENGTH, RULESET,
} from '../../packages/game-core/index.js';
import { WorldStorage } from './storage.js';
import { acceptWebSocket } from './websocket.js';
import { publicMap } from '../../packages/game-core/world.js';

const MAX_PROCESSED_COMMANDS = 500;
const COMMAND_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TICK_MS = 1000;
const clientRoot = fileURLToPath(new URL('../client/', import.meta.url));
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']], ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/request-id.js', ['request-id.js', 'text/javascript; charset=utf-8']],
  ['/map-navigation.js', ['map-navigation.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);

function commandFingerprint(payload) {
  return JSON.stringify({ slotId: payload?.slotId, building: payload?.building });
}

function validRequest(message) {
  return message && message.version === 1 && typeof message.type === 'string' &&
    /^[a-z]+\.[a-z]+$/.test(message.type) && typeof message.requestId === 'string' &&
    /^[a-zA-Z0-9_-]{8,100}$/.test(message.requestId) && message.payload && typeof message.payload === 'object';
}

export function createGameServer({ dataFile, worldDir, worldName = 'alpha', clock = Date.now, allowedOrigins = [] }) {
  const directory = resolve(worldDir ?? dirname(dataFile));
  const storage = new WorldStorage(directory, worldName, clock);
  const ready = storage.initialize();
  const connections = new Set();
  const playerConnections = new Map();
  const mapRequestTimes = new WeakMap();
  const loginAttempts = new Map();

  const response = (peer, type, requestId, payload = {}) => peer.send({ version: 1, type, requestId, payload });
  const errorResponse = (peer, requestId, error) => response(peer, 'command.error', requestId, { message: error.message });
  const snapshot = (player, account) => {
    const now = clock();
    const city = advanceCity(player.city, now);
    return {
      world: { name: storage.world.worldName, instanceId: storage.world.instanceId }, ruleset: RULESET,
      player: { id: player.playerId, commanderName: account.displayName }, city, serverTime: now,
      buildings: BUILDINGS, offers: cityOffers(city), capacity: CAPACITY, maxLevel: MAX_LEVEL, maxQueueLength: MAX_QUEUE_LENGTH,
    };
  };
  const broadcast = (playerId, type, payloadFactory) => {
    for (const peer of playerConnections.get(playerId) ?? []) peer.send({ version: 1, type, payload: payloadFactory(peer) });
  };
  const setIdentity = (peer, result) => {
    peer.playerId = result.player.playerId;
    peer.account = result.account;
    peer.sessionToken = result.session.token;
    if (!playerConnections.has(peer.playerId)) playerConnections.set(peer.playerId, new Set());
    playerConnections.get(peer.playerId).add(peer);
    return result;
  };
  const mapSnapshot = (playerId, viewport) => ({ world: { name: storage.world.worldName, instanceId: storage.world.instanceId }, ...publicMap(storage.world, playerId, viewport) });
  const pushMapChange = entity => {
    const publicEntity = { id: entity.id, type: 'player-city', name: entity.name, commanderName: entity.commanderName, x: entity.x, y: entity.y };
    for (const connection of connections) if (connection.playerId) connection.send({ version: 1, type: 'map.changed', payload: { revision: storage.world.map.revision, entity: { ...publicEntity, type: connection.playerId === entity.playerId ? 'own-city' : 'player-city' } } });
  };

  async function authenticate(peer, message) {
    const address = peer.socket.remoteAddress;
    const attempts = loginAttempts.get(address) ?? { count: 0, since: clock() };
    if (clock() - attempts.since > 60_000) Object.assign(attempts, { count: 0, since: clock() });
    if (attempts.count >= 10) throw new Error('Zu viele Anmeldeversuche. Bitte später erneut versuchen.');
    try {
      const result = message.type === 'auth.register'
        ? await storage.register(message.payload.username, message.payload.password, message.payload.cityName)
        : await storage.login(message.payload.username, message.payload.password);
      loginAttempts.delete(address);
      setIdentity(peer, result);
      response(peer, 'auth.success', message.requestId, {
        sessionToken: result.session.token, expiresAt: result.session.expiresAt,
        commanderName: result.account.displayName, playerId: result.player.playerId,
      });
      response(peer, 'city.snapshot', message.requestId, snapshot(result.player, result.account));
      response(peer, 'map.snapshot', message.requestId, mapSnapshot(result.player.playerId));
      if (message.type === 'auth.register') pushMapChange(storage.world.map.entities.find(entity => entity.playerId === result.player.playerId));
    } catch (error) {
      attempts.count += 1;
      loginAttempts.set(address, attempts);
      throw error;
    }
  }

  async function onMessage(peer, raw) {
    let message;
    try { message = JSON.parse(raw); } catch { return errorResponse(peer, 'unknown', new Error('Ungültiges JSON.')); }
    if (!validRequest(message)) return errorResponse(peer, message?.requestId ?? 'unknown', new Error('Ungültiges Ereignisformat.'));
    try {
      if (['auth.register', 'auth.login'].includes(message.type)) return await authenticate(peer, message);
      if (message.type === 'auth.resume') {
        const result = await storage.resume(message.payload.sessionToken);
        if (!result) return response(peer, 'auth.required', message.requestId, { message: 'Sitzung ist ungültig oder abgelaufen.' });
        setIdentity(peer, result);
        response(peer, 'auth.success', message.requestId, { expiresAt: result.session.expiresAt, commanderName: result.account.displayName, playerId: result.player.playerId });
        response(peer, 'city.snapshot', message.requestId, snapshot(result.player, result.account));
        return response(peer, 'map.snapshot', message.requestId, mapSnapshot(result.player.playerId));
      }
      if (!peer.playerId) return response(peer, 'auth.required', message.requestId, { message: 'Bitte zuerst anmelden.' });
      if (message.type === 'auth.logout') {
        await storage.logout(peer.sessionToken);
        playerConnections.get(peer.playerId)?.delete(peer);
        peer.playerId = null;
        response(peer, 'command.ok', message.requestId, { loggedOut: true });
        return;
      }
      if (message.type === 'city.sync') {
        const player = await storage.loadPlayer(peer.playerId);
        return response(peer, 'city.snapshot', message.requestId, snapshot(player, peer.account));
      }
      if (message.type === 'map.viewport') {
        const payload = mapSnapshot(peer.playerId, message.payload);
        const previous = mapRequestTimes.get(peer) ?? 0;
        if (clock() - previous < 75) throw new Error('Kartenanfragen erfolgen zu schnell.');
        mapRequestTimes.set(peer, clock());
        return response(peer, 'map.snapshot', message.requestId, payload);
      }
      if (message.type === 'map.details') {
        if (typeof message.payload.id !== 'string' || message.payload.id.length > 100) throw new Error('Ungültige Kartenidentität.');
        const entity = storage.world.map.entities.find(candidate => candidate.id === message.payload.id);
        if (!entity) throw new Error('Stadt nicht gefunden.');
        const view = publicMap(storage.world, peer.playerId, { x: entity.x, y: entity.y, width: 1, height: 1 });
        return response(peer, 'map.details', message.requestId, { entity: view.entities[0], terrain: view.terrain[0], restricted: entity.playerId !== peer.playerId });
      }
      if (message.type !== 'construction.enqueue') throw new Error('Ereignistyp ist nicht erlaubt.');
      await storage.exclusive(async () => {
        const player = await storage.loadPlayer(peer.playerId);
        const now = clock();
        player.processedCommands = (player.processedCommands ?? []).filter(item => item.acceptedAt + COMMAND_TTL_MS > now).slice(-MAX_PROCESSED_COMMANDS);
        const existing = player.processedCommands.find(item => item.id === message.requestId);
        const fingerprint = commandFingerprint(message.payload);
        if (existing && existing.fingerprint !== fingerprint) throw new Error('Diese Befehls-ID wurde bereits mit anderem Inhalt verwendet.');
        if (!existing) {
          const city = enqueueConstruction(player.city, { id: message.requestId, ...message.payload }, now);
          player.city = city;
          player.processedCommands.push({ id: message.requestId, fingerprint, acceptedAt: now });
          await storage.savePlayer(player);
        }
        response(peer, 'command.ok', message.requestId, { duplicate: Boolean(existing) });
        broadcast(peer.playerId, 'city.updated', connection => snapshot(player, connection.account));
      });
    } catch (error) { errorResponse(peer, message.requestId, error); }
  }

  const server = createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'none'");
    try {
      await ready;
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && staticFiles.has(path)) {
        const [name, type] = staticFiles.get(path);
        res.writeHead(200, { 'Content-Type': type });
        return res.end(await readFile(resolve(clientRoot, name)));
      }
      if (req.method === 'GET' && path === '/health') return json(200, { status: 'ok' });
      if (req.method === 'GET' && path === '/.well-known/federated-strategy') return json(200, {
        protocolVersion: '0.1-draft', instanceId: storage.world.instanceId, name: storage.world.worldName,
        ruleset: RULESET, federationEnabled: false, capabilities: [],
      });
      if (path.startsWith('/api/')) return json(410, { error: 'Spielzugriff ist ausschließlich über WebSocket möglich.' });
      return json(404, { error: 'Nicht gefunden.' });
    } catch (error) { console.error(error); return json(500, { error: 'Interner Serverfehler.' }); }
  });

  server.on('upgrade', async (request, socket, head) => {
    try {
      await ready;
      const host = request.headers.host;
      const origin = request.headers.origin;
      const permitted = new Set(allowedOrigins.length ? allowedOrigins : [`http://${host}`, `https://${host}`]);
      if (new URL(request.url, 'http://localhost').pathname !== '/game' || !origin || !permitted.has(origin)) {
        return socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      }
      const peer = acceptWebSocket(request, socket, head);
      if (!peer) return;
      connections.add(peer);
      response(peer, 'auth.required', 'connection', { message: 'Sitzung wiederaufnehmen oder anmelden.' });
      peer.on('message', raw => void onMessage(peer, raw));
      peer.on('close', () => {
        connections.delete(peer);
        if (peer.playerId) playerConnections.get(peer.playerId)?.delete(peer);
      });
    } catch { socket.destroy(); }
  });

  const timer = setInterval(async () => {
    for (const [playerId, peers] of playerConnections) {
      if (!peers.size) continue;
      try {
        await storage.exclusive(async () => {
          const player = await storage.loadPlayer(playerId);
          const previousJobs = new Set(player.city.constructionQueue.map(job => job.id));
          const nextCity = advanceCity(player.city, clock());
          const completed = [...previousJobs].filter(id => !nextCity.constructionQueue.some(job => job.id === id));
          player.city = nextCity;
          await storage.savePlayer(player);
          if (completed.length) broadcast(playerId, 'construction.completed', () => ({ commandIds: completed }));
          broadcast(playerId, 'city.updated', peer => snapshot(player, peer.account));
        });
      } catch (error) { console.error('Tick konnte nicht gespeichert werden:', error.message); }
    }
  }, TICK_MS);
  timer.unref();
  const closeHttpServer = server.close.bind(server);
  server.close = callback => {
    clearInterval(timer);
    for (const peer of connections) peer.close(1001, 'Server beendet');
    return closeHttpServer(callback);
  };
  server.ready = ready;
  server.storage = storage;
  return server;
}
