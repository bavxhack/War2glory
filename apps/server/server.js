import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  advanceCity,
  BUILDINGS,
  BUILDING_SLOT_COUNT,
  CAPACITY,
  cityOffers,
  enqueueConstruction,
  MAX_LEVEL,
  MAX_QUEUE_LENGTH,
  newCity,
  RULESET,
} from '../../packages/game-core/index.js';

const SCHEMA_VERSION = 2;
const LEGACY_RULESET = 'prototype-0.1';
const MAX_PROCESSED_COMMANDS = 100;
const clientRoot = fileURLToPath(new URL('../client/', import.meta.url));
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);

export function migrateState(saved) {
  if (saved?.schemaVersion === SCHEMA_VERSION && saved.ruleset === RULESET) return structuredClone(saved);
  if (saved?.schemaVersion !== 1 || saved.ruleset !== LEGACY_RULESET) {
    throw new Error('Unbekannte Spielstandsversion; Datei wird nicht überschrieben.');
  }

  const buildingEntries = Object.entries(saved.city?.buildings ?? {});
  const buildingSlots = Array.from({ length: BUILDING_SLOT_COUNT }, (_, index) => {
    const [building, level] = buildingEntries[index] ?? [];
    return { id: `plot-${index + 1}`, building: building ?? null, level: level ?? 0 };
  });
  const legacyJob = saved.city.construction;
  const constructionQueue = legacyJob ? [{
    id: `migration-${legacyJob.building}-${legacyJob.finishesAt}`,
    type: 'upgrade',
    slotId: buildingSlots.find(slot => slot.building === legacyJob.building)?.id,
    building: legacyJob.building,
    level: legacyJob.level,
    startsAt: saved.city.updatedAt,
    finishesAt: legacyJob.finishesAt,
  }] : [];

  return {
    ...saved,
    schemaVersion: SCHEMA_VERSION,
    ruleset: RULESET,
    processedCommands: [],
    city: {
      name: saved.city.name,
      resources: structuredClone(saved.city.resources),
      buildingSlots,
      constructionQueue,
      updatedAt: saved.city.updatedAt,
    },
  };
}

export function createGameServer({ dataFile, worldName = 'alpha', clock = Date.now }) {
  const file = resolve(dataFile);
  mkdirSync(dirname(file), { recursive: true });
  const initial = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {
    schemaVersion: SCHEMA_VERSION,
    ruleset: RULESET,
    instanceId: randomUUID(),
    worldName,
    processedCommands: [],
    city: newCity(clock()),
  };
  let state = migrateState(initial);
  const save = next => {
    writeFileSync(`${file}.tmp`, JSON.stringify(next, null, 2), { mode: 0o600 });
    renameSync(`${file}.tmp`, file);
    state = next;
  };
  save(state);

  const publicState = () => {
    const now = clock();
    const city = advanceCity(state.city, now);
    return {
      world: { name: state.worldName, instanceId: state.instanceId },
      ruleset: RULESET,
      city,
      serverTime: now,
      buildings: BUILDINGS,
      offers: cityOffers(city),
      capacity: CAPACITY,
      maxLevel: MAX_LEVEL,
      maxQueueLength: MAX_QUEUE_LENGTH,
    };
  };

  const server = createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    try {
      const authority = req.headers.host;
      const port = server.address().port;
      if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(authority)) {
        return json(403, { error: 'Nur lokaler Zugriff ist freigegeben.' });
      }
      const path = new URL(req.url, `http://${authority}`).pathname;
      if (req.method === 'GET' && staticFiles.has(path)) {
        const [name, type] = staticFiles.get(path);
        res.writeHead(200, { 'Content-Type': type });
        return res.end(readFileSync(resolve(clientRoot, name)));
      }
      if (req.method === 'GET' && path === '/api/state') return json(200, publicState());
      if (req.method === 'GET' && path === '/.well-known/federated-strategy') {
        return json(200, {
          protocolVersion: '0.1-draft', instanceId: state.instanceId,
          name: state.worldName, ruleset: RULESET,
          federationEnabled: false, capabilities: [],
        });
      }
      if (req.method === 'POST' && path === '/api/construction') {
        if (req.headers.origin && req.headers.origin !== `http://${authority}`) {
          return json(403, { error: 'Ursprung nicht erlaubt.' });
        }
        if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
          return json(415, { error: 'JSON erwartet.' });
        }
        let body = '';
        for await (const chunk of req) {
          body += chunk.toString();
          if (Buffer.byteLength(body) > 4096) return json(413, { error: 'Anfrage zu groß.' });
        }
        let command;
        try { command = JSON.parse(body); } catch { return json(400, { error: 'Ungültiges JSON.' }); }
        if (!command || typeof command.id !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(command.id)) {
          return json(400, { error: 'Gültige Auftrags-ID fehlt.' });
        }
        if (state.processedCommands.includes(command.id)) return json(200, publicState());

        let city;
        try { city = enqueueConstruction(state.city, command, clock()); }
        catch (error) { return json(409, { error: error.message }); }
        save({
          ...state,
          city,
          processedCommands: [...state.processedCommands, command.id].slice(-MAX_PROCESSED_COMMANDS),
        });
        return json(200, publicState());
      }
      json(404, { error: 'Nicht gefunden.' });
    } catch (error) {
      console.error(error);
      if (!res.headersSent) json(500, { error: 'Interner Serverfehler.' });
      else res.end();
    }
  });
  server.requestTimeout = 10000;
  return server;
}
