import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { newCity, RULESET } from '../../packages/game-core/index.js';

const scrypt = promisify(scryptCallback);
export const PLAYER_SCHEMA_VERSION = 1;
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
      this.world = { schemaVersion: 1, instanceId: randomUUID(), worldName: this.worldName };
      await atomicWrite(this.worldFile, this.world);
    }
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
        processedCommands: [], createdAt: now,
      };
      const account = { playerId, displayName, normalized, password: credentials, createdAt: now };
      await atomicWrite(this.playerFile(playerId), player);
      this.accounts.accounts.push(account);
      try { await atomicWrite(this.accountsFile, this.accounts); }
      catch (error) { this.accounts.accounts.pop(); throw error; }
      return { account, player, session: await this.#newSession(playerId) };
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
  loadPlayer(playerId) { return readJson(this.playerFile(playerId)); }
  savePlayer(player) { return atomicWrite(this.playerFile(player.playerId), player); }

  async #newSession(playerId) {
    this.#expireSessions();
    const token = randomBytes(32).toString('base64url');
    const expiresAt = this.clock() + SESSION_LIFETIME_MS;
    this.accounts.sessions.push({ tokenHash: createTokenHash(token), playerId, expiresAt, createdAt: this.clock() });
    await atomicWrite(this.accountsFile, this.accounts);
    return { token, expiresAt };
  }

  #expireSessions() {
    this.accounts.sessions = this.accounts.sessions.filter(session => session.expiresAt > this.clock());
  }
}

function createTokenHash(token) {
  return createHash('sha256').update(token).digest('base64url');
}
