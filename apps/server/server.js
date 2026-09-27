import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { advanceCity, newCity, startUpgrade, RULESET, BUILDINGS, CAPACITY, MAX_LEVEL } from '../../packages/game-core/index.js';

const clientRoot = fileURLToPath(new URL('../client/', import.meta.url));
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);

export function createGameServer({ dataFile, worldName = 'alpha', clock = Date.now }) {
  const file = resolve(dataFile);
  mkdirSync(dirname(file), { recursive: true });
  let state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {
    schemaVersion: 1, ruleset: RULESET, instanceId: randomUUID(), worldName, city: newCity(clock()),
  };
  if (state.schemaVersion !== 1 || state.ruleset !== RULESET) {
    throw new Error('Spielstand benötigt eine Migration. Datei wird nicht überschrieben.');
  }
  const save = next => {
    writeFileSync(`${file}.tmp`, JSON.stringify(next, null, 2), { mode: 0o600 });
    renameSync(`${file}.tmp`, file);
    state = next;
  };
  save(state);
  const publicState = () => ({
    world: { name: state.worldName, instanceId: state.instanceId },
    ruleset: RULESET, city: advanceCity(state.city, clock()), serverTime: clock(),
    buildings: BUILDINGS, capacity: CAPACITY, maxLevel: MAX_LEVEL,
  });
  const server = createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    try {
      // Local demo only. Reject foreign Host/Origin values to prevent browser cross-site writes.
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
      if (req.method === 'POST' && path === '/api/upgrade') {
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
        if (!command || typeof command.building !== 'string') return json(400, { error: 'Gebäude fehlt.' });
        let city;
        try { city = startUpgrade(state.city, command.building, clock()); }
        catch (error) { return json(409, { error: error.message }); }
        save({ ...state, city });
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
