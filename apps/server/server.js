import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUILDINGS, capacityBreakdown, cityOffers, commanderScore, demolishBuilding, demolitionPreview,
  enqueueConstruction, MAX_LEVEL, MAX_QUEUE_LENGTH, productionRates, resourceCapacities, RULESET, STORAGE_RULES,
} from '../../packages/game-core/index.js';
import { barracksIsBusy, enqueueTraining, GENERAL_SKILL_RULES, MILITARY_RULES, renameGeneral, startRaidMission, startScoutMission, UNITS } from '../../packages/game-core/military.js';
import { advanceSupply, assignMayor, SUPPLY_RULES, supplySummary } from '../../packages/game-core/supply.js';
import { WorldStorage } from './storage.js';
import { acceptWebSocket } from './websocket.js';
import { publicMap } from '../../packages/game-core/world.js';

const MAX_PROCESSED_COMMANDS = 500;
const COMMAND_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TICK_MS = 1000;
const clientRoot = fileURLToPath(new URL('../client/', import.meta.url));
const clientDistRoot = resolve(clientRoot, 'dist');
const staticFiles = new Map([
  ['/request-id.js', ['request-id.js', 'text/javascript; charset=utf-8']],
  ['/map-navigation.js', ['map-navigation.js', 'text/javascript; charset=utf-8']],
  ['/assets/scout-aircraft.svg', ['assets/scout-aircraft.svg', 'image/svg+xml']],
  ['/assets/infantry.svg', ['assets/infantry.svg', 'image/svg+xml']],
  ['/assets/general.svg', ['assets/general.svg', 'image/svg+xml']],
  ['/assets/city-player.svg', ['assets/city-player.svg', 'image/svg+xml']],
  ['/assets/city-npc.svg', ['assets/city-npc.svg', 'image/svg+xml']],
  ...['sawmill', 'quarry', 'farm', 'warehouse', 'barracks'].map(building => [`/assets/buildings/${building}.svg`, [`assets/buildings/${building}.svg`, 'image/svg+xml']]),
]);
const mimeTypes = new Map([['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.webp', 'image/webp'], ['.woff2', 'font/woff2']]);

function commandFingerprint(type, payload) {
  const allowed = type === 'construction.enqueue' ? ['slotId', 'building'] : type === 'training.enqueue' ? ['barracksSlotId', 'unit', 'amount'] :
    type === 'scouting.start' ? ['targetId', 'generalId', 'scouts'] : type === 'raid.start' ? ['targetId', 'generalId', 'infantry'] : type === 'general.rename' ? ['generalId', 'name', 'expectedVersion'] : type === 'general.mayor' ? ['generalId'] : ['slotId', 'buildingId', 'version'];
  return JSON.stringify(Object.fromEntries(allowed.map(key => [key, payload?.[key]])));
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
    const current = advanceSupply(player, now, storage.world.supplyActivatedAt);
    const city = current.city;
    const military = current.military;
    return {
      world: { name: storage.world.worldName, instanceId: storage.world.instanceId }, ruleset: RULESET,
      player: { id: player.playerId, commanderName: account.displayName }, city, serverTime: now,
      military, score: { ...commanderScore(city), combat: military.combatScore ?? 0, total: Math.max(0, commanderScore(city).buildings + (military.combatScore ?? 0)) }, buildings: BUILDINGS, offers: cityOffers(city), capacities: resourceCapacities(city),
      capacityBreakdown: capacityBreakdown(city), productionRates: productionRates(city), storageRules: STORAGE_RULES,
      maxLevel: MAX_LEVEL, maxQueueLength: MAX_QUEUE_LENGTH,
      units: UNITS, militaryRules: MILITARY_RULES, generalSkillRules: GENERAL_SKILL_RULES, supply: { ...current.supply, ...supplySummary(current) }, supplyRules: SUPPLY_RULES,
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
      await storage.exclusive(async () => { await storage.advanceWorld(clock()); result.player = await storage.loadPlayer(result.player.playerId); });
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
        await storage.exclusive(async () => { await storage.advanceWorld(clock()); result.player = await storage.loadPlayer(result.player.playerId); });
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
        return storage.exclusive(async () => {
          await storage.advanceWorld(clock());
          const player = await storage.loadPlayer(peer.playerId);
          await storage.savePlayer(player);
          return response(peer, 'city.snapshot', message.requestId, snapshot(player, peer.account));
        });
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
      if (message.type === 'building.preview') {
        return storage.exclusive(async () => {
          await storage.advanceWorld(clock());
          const player = await storage.loadPlayer(peer.playerId); const now = clock();
          const slot = [...player.city.buildingSlots, ...(player.city.militarySlots ?? [])].find(item => item.id === message.payload.slotId);
          if (slot?.building === 'barracks' && barracksIsBusy(player.military, slot.id)) throw new Error('Diese Kaserne ist durch Ausbildung belegt.');
          const { preview } = demolitionPreview(player.city, message.payload.slotId, now);
          return response(peer, 'building.preview', message.requestId, preview);
        });
      }
      if (!['construction.enqueue', 'training.enqueue', 'scouting.start', 'raid.start', 'building.demolish', 'general.rename', 'general.mayor'].includes(message.type)) throw new Error('Ereignistyp ist nicht erlaubt.');
      await storage.exclusive(async () => {
        await storage.advanceWorld(clock());
        const player = await storage.loadPlayer(peer.playerId);
        const now = clock();
        player.processedCommands = (player.processedCommands ?? []).filter(item => item.acceptedAt + COMMAND_TTL_MS > now).slice(-MAX_PROCESSED_COMMANDS);
        const existing = player.processedCommands.find(item => item.id === message.requestId);
        const fingerprint = commandFingerprint(message.type, message.payload);
        if (existing && existing.fingerprint !== fingerprint) throw new Error('Diese Befehls-ID wurde bereits mit anderem Inhalt verwendet.');
        if (!existing) {
          if (message.type === 'construction.enqueue') {
            const slot = player.city.militarySlots?.find(candidate => candidate.id === message.payload.slotId);
            if (slot?.building === 'barracks' && barracksIsBusy(player.military, slot.id)) throw new Error('Diese Kaserne ist durch Ausbildung belegt.');
            player.city = enqueueConstruction(player.city, { id: message.requestId, ...message.payload }, now);
          }
          if (message.type === 'training.enqueue') {
            if (player.supply?.inShortage) throw new Error('Ausbildung ist wegen Nahrungsmangel pausiert.');
            const result = enqueueTraining(player.military, player.city, { id: message.requestId, ...message.payload }, now);
            player.city = result.city; player.military = result.military;
          }
          if (message.type === 'scouting.start') {
            const origin = storage.world.map.entities.find(entity => entity.playerId === peer.playerId);
            const target = storage.world.map.entities.find(entity => entity.id === message.payload.targetId);
            player.military = startScoutMission(player.military, { id: message.requestId, ...message.payload }, now, origin, target);
            player.military.missions.at(-1).type = 'scout';
            player.military.missions.at(-1).eventSequence = storage.nextEventSequence();
          }
          if (message.type === 'raid.start') {
            const origin = storage.world.map.entities.find(entity => entity.playerId === peer.playerId);
            const target = storage.world.map.entities.find(entity => entity.id === message.payload.targetId);
            player.military = startRaidMission(player.military, { id: message.requestId, ...message.payload }, now, origin, target, storage.nextEventSequence());
          }
          if (message.type === 'general.rename') player.military = renameGeneral(player.military, message.payload);
          if (message.type === 'general.mayor') player.military = assignMayor(player.military, message.payload.generalId ?? null);
          let result = {};
          if (message.type === 'building.demolish') {
            const slot = [...player.city.buildingSlots, ...(player.city.militarySlots ?? [])].find(item => item.id === message.payload.slotId);
            if (slot?.building === 'barracks' && barracksIsBusy(player.military, slot.id)) throw new Error('Diese Kaserne ist durch Ausbildung belegt.');
            const demolition = demolishBuilding(player.city, message.payload, now);
            player.city = demolition.city; result = { demolition: demolition.result };
          }
          player.processedCommands.push({ id: message.requestId, fingerprint, acceptedAt: now, result });
          if (message.type === 'scouting.start' || message.type === 'raid.start') await storage.saveWorld();
          await storage.savePlayer(player);
        }
        response(peer, 'command.ok', message.requestId, { duplicate: Boolean(existing), ...(existing?.result ?? player.processedCommands.at(-1)?.result ?? {}) });
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
      if (req.method === 'GET' && (path === '/' || path.startsWith('/assets/'))) {
        const assetPath = resolve(clientDistRoot, path === '/' ? 'index.html' : `.${path}`);
        if (relative(clientDistRoot, assetPath).startsWith('..')) return json(404, { error: 'Nicht gefunden.' });
        try {
          const content = await readFile(assetPath);
          res.writeHead(200, { 'Content-Type': mimeTypes.get(extname(assetPath)) ?? 'application/octet-stream', 'Cache-Control': path === '/' ? 'no-cache' : 'public, max-age=31536000, immutable' });
          return res.end(content);
        } catch (error) {
          if (path === '/' && error.code === 'ENOENT') return json(503, { error: 'Frontend-Build fehlt. Bitte zuerst `npm install` und `npm run build` ausführen.' });
          if (error.code === 'ENOENT') return json(404, { error: 'Nicht gefunden.' });
          throw error;
        }
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
    try { await storage.exclusive(() => storage.advanceWorld(clock())); }
    catch (error) { console.error('Weltzeit konnte nicht gespeichert werden:', error.message); }
    for (const [playerId, peers] of playerConnections) {
      if (!peers.size) continue;
      try {
        await storage.exclusive(async () => {
          await storage.advanceWorld(clock());
          const player = await storage.loadPlayer(playerId);
          const previousJobs = new Set(player.city.constructionQueue.map(job => job.id));
          const current = advanceSupply(player, clock(), storage.world.supplyActivatedAt);
          const nextCity = current.city;
          const nextMilitary = current.military;
          const completed = [...previousJobs].filter(id => !nextCity.constructionQueue.some(job => job.id === id));
          player.city = nextCity;
          player.military = nextMilitary;
          player.supply = current.supply;
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
