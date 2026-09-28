import { createHash, randomBytes, randomInt, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { newCity, RULESET } from '../../packages/game-core/index.js';
import { newMilitary } from '../../packages/game-core/military.js';
import { randomFreeLocation, terrainAt, WORLD_CONFIG, WORLD_SCHEMA_VERSION } from '../../packages/game-core/world.js';

const scrypt = promisify(scryptCallback);
export const PLAYER_SCHEMA_VERSION = 3;
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}

export async function atomicWrite(file, value) {
  await mkdir(resolve(file, '..'), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temporary, file);
}

function normalizeUsername(value) {
  if (typeof value !== 'string') throw new Error('Kommandantenname wird benötigt.');
  const displayName = value.trim();
  const normalized = displayName.normalize('NFKC').toLocaleLowerCase('de-DE');
  if (!/^[\p{L}\p{N}_-]{3,24}$/u.test(normalized)) throw new Error('Name: 3–24 Buchstaben, Ziffern, _ oder -.');
  return { displayName, normalized };
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    throw new Error('Passwort: 10–128 Zeichen.');
  }
}

async function passwordHash(password, salt = randomBytes(16).toString('base64url')) {
  return { salt, hash: Buffer.from(await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 })).toString('base64url') };
}

export class WorldStorage {
  #queue = Promise.resolve();
  constructor(worldDir, worldName, clock = Date.now) {
    this.directory = resolve(worldDir);
    this.playersDirectory = join(this.directory, 'players');
    this.accountsFile = join(this.directory, 'accounts.json');
    this.worldFile = join(this.directory, 'world.json');
    this.worldName = worldName;
    this.clock = clock;
  }

  async initialize() {
    await mkdir(this.playersDirectory, { recursive: true });
    this.accounts = await readJson(this.accountsFile, { schemaVersion: 1, accounts: [], sessions: [] });
    this.world = await readJson(this.worldFile, null);
    if (!this.world) {
      this.world = createWorld(this.worldName);
      await atomicWrite(this.worldFile, this.world);
    } else if (this.world.schemaVersion === 1) {
      await copyFile(this.worldFile, `${this.worldFile}.schema-1.backup`);
      this.world = { ...this.world, schemaVersion: WORLD_SCHEMA_VERSION, map: createMap(this.world.instanceId) };
      await this.#assignMissingLocations();
      await atomicWrite(this.worldFile, this.world);
    } else if (this.world.schemaVersion !== WORLD_SCHEMA_VERSION || !this.world.map) {
      throw new Error(`Unbekannte Welt-Schemaversion: ${this.world.schemaVersion}.`);
    }
    await this.#assignMissingLocations();
    this.#expireSessions();
    await atomicWrite(this.accountsFile, this.accounts);
    return this;
  }

  exclusive(operation) {
    const result = this.#queue.then(operation, operation);
    this.#queue = result.catch(() => {});
    return result;
  }

  async register(username, password, cityName) {
    return this.exclusive(async () => {
      const { displayName, normalized } = normalizeUsername(username);
      validatePassword(password);
      if (this.accounts.accounts.some(account => account.normalized === normalized)) throw new Error('Dieser Kommandantenname ist bereits vergeben.');
      const credentials = await passwordHash(password);
      const playerId = randomUUID();
      const now = this.clock();
      const player = {
        schemaVersion: PLAYER_SCHEMA_VERSION, ruleset: RULESET, playerId, commanderName: displayName,
        city: { ...newCity(now), name: typeof cityName === 'string' && cityName.trim().length >= 3 && cityName.trim().length <= 32 ? cityName.trim() : `${displayName}s Stadt` },
        military: newMilitary(playerId), processedCommands: [], createdAt: now,
      };
      const account = { playerId, displayName, normalized, password: credentials, createdAt: now };
      const entity = this.#allocatePlayerCity(player, account);
      await atomicWrite(this.worldFile, this.world);
      try { await atomicWrite(this.playerFile(playerId), player); }
      catch (error) { this.#removeEntity(entity.id); await atomicWrite(this.worldFile, this.world); throw error; }
      const session = this.#prepareSession(playerId);
      this.accounts.accounts.push(account);
      try { await atomicWrite(this.accountsFile, this.accounts); }
      catch (error) { this.accounts.accounts.pop(); this.accounts.sessions = this.accounts.sessions.filter(candidate => candidate.playerId !== playerId); this.#removeEntity(entity.id); await Promise.allSettled([unlink(this.playerFile(playerId)), atomicWrite(this.worldFile, this.world)]); throw error; }
      return { account, player, session };
    });
  }

  async login(username, password) {
    return this.exclusive(async () => {
      const { normalized } = normalizeUsername(username);
      validatePassword(password);
      const account = this.accounts.accounts.find(candidate => candidate.normalized === normalized);
      if (!account) throw new Error('Name oder Passwort ist falsch.');
      const actual = Buffer.from((await passwordHash(password, account.password.salt)).hash);
      const expected = Buffer.from(account.password.hash);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Name oder Passwort ist falsch.');
      return { account, player: await this.loadPlayer(account.playerId), session: await this.#newSession(account.playerId) };
    });
  }

  async resume(token) {
    if (typeof token !== 'string' || token.length > 200) return null;
    const tokenHash = createTokenHash(token);
    const session = this.accounts.sessions.find(candidate => candidate.tokenHash === tokenHash && candidate.expiresAt > this.clock());
    if (!session) return null;
    const account = this.accounts.accounts.find(candidate => candidate.playerId === session.playerId);
    return account ? { account, player: await this.loadPlayer(account.playerId), session: { token, expiresAt: session.expiresAt } } : null;
  }

  async logout(token) {
    return this.exclusive(async () => {
      const hash = createTokenHash(token);
      this.accounts.sessions = this.accounts.sessions.filter(session => session.tokenHash !== hash);
      await atomicWrite(this.accountsFile, this.accounts);
    });
  }

  playerFile(playerId) { return join(this.playersDirectory, `${playerId}.json`); }
  async loadPlayer(playerId) {
    const player = await readJson(this.playerFile(playerId));
    let migrated = false;
    if (player.schemaVersion === 1) {
      migrated = true;
      player.schemaVersion = 2;
      player.city.buildingSlots = player.city.buildingSlots.map(slot => ({ area: 'civil', ...slot }));
      player.city.militarySlots ??= newCity(player.city.updatedAt).militarySlots;
      player.military = newMilitary(player.playerId);
    }
    if (player.schemaVersion === 2) {
      migrated = true;
      const fallbackBarracks = player.city.militarySlots.find(slot => slot.building === 'barracks')?.id;
      if (player.military.trainingQueue.length && !fallbackBarracks) throw new Error('Ausbildungsaufträge ohne vorhandene Kaserne können nicht migriert werden.');
      player.military.trainingQueue = player.military.trainingQueue.map(job => ({ ...job, barracksSlotId: job.barracksSlotId ?? fallbackBarracks }));
      player.schemaVersion = PLAYER_SCHEMA_VERSION;
    }
    if (player.schemaVersion !== PLAYER_SCHEMA_VERSION) throw new Error(`Unbekannte Spieler-Schemaversion: ${player.schemaVersion}.`);
    if (migrated) await this.savePlayer(player);
    return player;
  }
  savePlayer(player) { return atomicWrite(this.playerFile(player.playerId), player); }

  async #newSession(playerId) {
    this.#expireSessions();
    const session = this.#prepareSession(playerId);
    await atomicWrite(this.accountsFile, this.accounts);
    return session;
  }

  #prepareSession(playerId) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = this.clock() + SESSION_LIFETIME_MS;
    this.accounts.sessions.push({ tokenHash: createTokenHash(token), playerId, expiresAt, createdAt: this.clock() });
    return { token, expiresAt };
  }

  #expireSessions() {
    this.accounts.sessions = this.accounts.sessions.filter(session => session.expiresAt > this.clock());
  }

  #removeEntity(id) { this.world.map.entities = this.world.map.entities.filter(entity => entity.id !== id); this.world.map.revision += 1; }

  #allocatePlayerCity(player, account) {
    const location = randomFreeLocation(this.world.map, upperBound => randomInt(upperBound));
    const entity = { id: `city-${player.playerId}`, kind: 'player', playerId: player.playerId, name: player.city.name, commanderName: account.displayName, ...location };
    this.world.map.entities.push(entity); this.world.map.revision += 1;
    return entity;
  }

  async #assignMissingLocations() {
    let changed = false;
    for (const account of this.accounts.accounts) {
      if (this.world.map.entities.some(entity => entity.playerId === account.playerId)) continue;
      const player = await this.loadPlayer(account.playerId);
      this.#allocatePlayerCity(player, account); changed = true;
    }
    if (changed) await atomicWrite(this.worldFile, this.world);
  }
}

function createTokenHash(token) {
  return createHash('sha256').update(token).digest('base64url');
}

function numericSeed(value) { return [...value].reduce((seed, character) => Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0, 2166136261); }

function createMap(instanceId) {
  const seed = numericSeed(instanceId);
  const config = { ...WORLD_CONFIG };
  const entities = [];
  for (let index = 0; index < config.npcCount; index += 1) {
    let position = (seed + index * 97) % (config.width * config.height);
    while (entities.some(entity => entity.x === position % config.width && entity.y === Math.floor(position / config.width)) || terrainAt(position % config.width, Math.floor(position / config.width), seed) === 'water') position = (position + 1) % (config.width * config.height);
    entities.push({ id: `npc-${index + 1}`, kind: 'npc', name: `Freie Stadt ${index + 1}`, difficulty: 1 + index % 3, x: position % config.width, y: Math.floor(position / config.width),
      resources: { schemaVersion: 1, food: { amount: 500, capacity: 500, regenerationPerHour: 25, updatedAt: Date.now() } } });
  }
  return { seed, revision: 1, config, entities };
}

function createWorld(worldName) { const instanceId = randomUUID(); return { schemaVersion: WORLD_SCHEMA_VERSION, instanceId, worldName, map: createMap(instanceId) }; }
