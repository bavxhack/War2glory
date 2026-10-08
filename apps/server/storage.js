import { createHash, randomBytes, randomInt, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { allSlots, constructionQuote, newCity, resourceCapacities, RULESET } from '../../packages/game-core/index.js';
import { generalLevel, newMilitary, normalizeGeneral, resolveNpcCombat } from '../../packages/game-core/military.js';
import { advanceSupply, settleSupplyAt } from '../../packages/game-core/supply.js';
import { advanceNpc, NPC_RULES, randomFreeLocation, terrainAt, WORLD_CONFIG, WORLD_SCHEMA_VERSION } from '../../packages/game-core/world.js';

const scrypt = promisify(scryptCallback);
export const PLAYER_SCHEMA_VERSION = 7;
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
    this.journalFile = join(this.directory, 'transaction.json');
    this.worldName = worldName;
    this.clock = clock;
  }

  async initialize() {
    await mkdir(this.playersDirectory, { recursive: true });
    await this.#recoverTransaction();
    this.accounts = await readJson(this.accountsFile, { schemaVersion: 1, accounts: [], sessions: [] });
    this.world = await readJson(this.worldFile, null);
    if (!this.world) {
      this.world = createWorld(this.worldName, this.clock());
      await atomicWrite(this.worldFile, this.world);
    } else if (this.world.schemaVersion === 1) {
      await copyFile(this.worldFile, `${this.worldFile}.schema-1.backup`);
      this.world = { ...this.world, schemaVersion: WORLD_SCHEMA_VERSION, nextEventSequence: 1, map: createMap(this.world.instanceId, this.clock()) };
      await this.#assignMissingLocations();
      await atomicWrite(this.worldFile, this.world);
    } else if (this.world.schemaVersion === 2) {
      const activatedAt = this.clock();
      this.world.schemaVersion = WORLD_SCHEMA_VERSION;
      this.world.nextEventSequence = 1;
      for (const npc of this.world.map.entities.filter(entity => entity.kind === 'npc')) {
        const capacity = NPC_RULES.infantryPerDifficulty * npc.difficulty;
        npc.garrison = { amount: capacity, capacity, progressMs: 0, updatedAt: activatedAt, activatedAt };
        npc.resources.food.updatedAt = activatedAt;
      }
      await atomicWrite(this.worldFile, this.world);
    } else if (this.world.schemaVersion !== WORLD_SCHEMA_VERSION || !this.world.map) {
      throw new Error(`Unbekannte Welt-Schemaversion: ${this.world.schemaVersion}.`);
    }
    if (!Number.isFinite(this.world.supplyActivatedAt)) {
      this.world.supplyActivatedAt = this.clock();
      await atomicWrite(this.worldFile, this.world);
    }
    await this.#assignMissingLocations();
    await this.advanceWorld(this.clock());
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
      player.schemaVersion = 3;
    }
    if (player.schemaVersion === 3) {
      migrated = true;
      for (const slot of allSlots(player.city)) {
        slot.area ??= slot.id.startsWith('military-') ? 'military' : 'civil';
        slot.buildingId = slot.building ? `legacy-${player.playerId}-${slot.id}` : null;
        slot.investment = slot.building ? { complete: false, paid: { wood: 0, stone: 0, food: 0 } } : null;
      }
      player.city.constructionQueue = player.city.constructionQueue.map(job => ({
        ...job,
        buildingId: job.buildingId ?? (allSlots(player.city).find(slot => slot.id === job.slotId)?.buildingId || `legacy-job-${job.id}`),
        // A persisted queue entry can only have been created after the old server charged this exact ruleset quote.
        paidCost: job.paidCost ?? constructionQuote(job.level).cost,
      }));
      player.schemaVersion = 4;
      player.ruleset = RULESET;
    }
    if (player.schemaVersion === 4) {
      migrated = true;
      player.military ??= newMilitary(player.playerId);
      player.military.generals = (player.military.generals?.length ? player.military.generals : newMilitary(player.playerId).generals)
        .map(general => normalizeGeneral({ ownerId: player.playerId, ...general }));
      player.schemaVersion = 5;
      player.ruleset = RULESET;
    }
    if (player.schemaVersion === 5) {
      migrated = true;
      player.military.combatScore ??= 0;
      for (const mission of player.military.missions) mission.type ??= 'scout';
      player.schemaVersion = 6;
    }
    if (player.schemaVersion === 6) {
      migrated = true;
      player.military.mayorGeneralId ??= null;
      player.supply = { version: 1, activatedAt: this.world.supplyActivatedAt, updatedAt: Math.max(this.world.supplyActivatedAt, player.city.updatedAt), shortageMs: 0, recoveryStartedAt: null, nextLossAt: null, events: [] };
      player.schemaVersion = PLAYER_SCHEMA_VERSION;
    }
    if (player.schemaVersion !== PLAYER_SCHEMA_VERSION) throw new Error(`Unbekannte Spieler-Schemaversion: ${player.schemaVersion}.`);
    if (migrated) await this.savePlayer(player);
    return player;
  }
  savePlayer(player) { return atomicWrite(this.playerFile(player.playerId), player); }
  saveWorld() { return atomicWrite(this.worldFile, this.world); }

  nextEventSequence() { return this.world.nextEventSequence++; }

  async advanceWorld(now) {
    const files = (await readdir(this.playersDirectory)).filter(file => file.endsWith('.json')).sort();
    const players = new Map();
    for (const file of files) {
      const player = await this.loadPlayer(file.slice(0, -5));
      players.set(player.playerId, player);
    }
    const events = [];
    for (const player of players.values()) for (const mission of player.military.missions) {
      if (mission.status === 'outbound' && mission.arrivesAt <= now) events.push({ at: mission.arrivesAt, sequence: mission.eventSequence ?? Number.MAX_SAFE_INTEGER, phase: 'arrival', player, mission });
      if ((mission.status === 'outbound' || mission.status === 'returning') && mission.returnsAt <= now) events.push({ at: mission.returnsAt, sequence: mission.eventSequence ?? Number.MAX_SAFE_INTEGER, phase: 'return', player, mission });
    }
    events.sort((a, b) => a.at - b.at || a.sequence - b.sequence || a.player.playerId.localeCompare(b.player.playerId) || a.phase.localeCompare(b.phase));
    let worldChanged = false;
    const changed = new Set();
    for (const [eventIndex, event] of events.entries()) {
      const { player, mission: scheduledMission, at } = event;
      Object.assign(player, advanceSupply(player, at, this.world.supplyActivatedAt, { deferLossAtEnd: true }));
      const mission = player.military.missions.find(candidate => candidate.id === scheduledMission.id);
      const completedTraining = player.military.trainingQueue.filter(job => job.finishesAt <= at);
      for (const job of completedTraining) player.military.units[job.unit] += job.amount;
      player.military.trainingQueue = player.military.trainingQueue.filter(job => job.finishesAt > at);
      if (event.phase === 'arrival' && mission.status === 'outbound') {
        const npcIndex = this.world.map.entities.findIndex(entity => entity.id === mission.targetId && entity.kind === 'npc');
        if (npcIndex < 0) throw new Error('Einsatzziel existiert nicht mehr.');
        const npc = advanceNpc(this.world.map.entities[npcIndex], at);
        if (mission.type === 'raid') {
          const attackers = mission.result?.survivors ?? mission.infantry;
          const combat = attackers > 0 ? resolveNpcCombat(attackers, npc.garrison.amount) : { victory: false, attackerLosses: 0, defenderLosses: 0, survivors: 0 };
          npc.garrison.amount -= combat.defenderLosses;
          npc.garrison.updatedAt = at;
          const availableFood = Math.floor(npc.resources.food.amount);
          const loadedFood = combat.victory ? Math.min(combat.survivors * 20, availableFood) : 0;
          npc.resources.food.amount -= loadedFood;
          mission.result = { ...combat, loadedFood, capacity: combat.survivors * 20, generalExperience: combat.defenderLosses * 2,
            combatScore: combat.defenderLosses - combat.attackerLosses, defenders: combat.defenderLosses + npc.garrison.amount, hungerLosses: mission.hungerLosses ?? 0 };
        } else {
          mission.intelligence = mission.scouts > 0
            ? { capturedAt: at, food: { amount: npc.resources.food.amount, capacity: npc.resources.food.capacity }, garrison: { amount: npc.garrison.amount, capacity: npc.garrison.capacity } }
            : null;
        }
        this.world.map.entities[npcIndex] = npc;
        mission.status = 'returning';
        worldChanged = true;
      } else if (event.phase === 'return' && mission.status === 'returning') {
        mission.status = 'completed';
        const general = player.military.generals.find(item => item.id === mission.generalId);
        if (!general) throw new Error('Einsatzgeneral existiert nicht mehr.');
        general.status = 'idle';
        if (mission.type === 'raid') {
          const result = mission.result;
          player.military.units.infantry += result.survivors;
          const capacity = resourceCapacities(player.city).food;
          const free = Math.max(0, capacity - player.city.resources.food);
          const storedFood = Math.min(free, result.loadedFood);
          player.city.resources.food += storedFood;
          general.experience += result.generalExperience;
          general.level = generalLevel(general.experience); general.leadership = general.level * 20;
          player.military.combatScore += result.combatScore;
          if (!player.military.reports.some(report => report.missionId === mission.id)) player.military.reports.push({ id: `report-${mission.id}`, type: 'raid', missionId: mission.id,
            targetId: mission.targetId, targetName: mission.targetName, generalId: mission.generalId, generalName: mission.generalName, startedAt: mission.startedAt,
            arrivedAt: mission.arrivesAt, returnedAt: mission.returnsAt, infantry: mission.initialInfantry ?? mission.infantry + (mission.hungerLosses ?? 0), ...result,
            hungerLosses: mission.hungerLosses ?? 0, originalLoadedFood: result.loadedFood + (mission.foodLostInTransit ?? 0), foodLostInTransit: mission.foodLostInTransit ?? 0,
            storedFood, overflowFood: result.loadedFood - storedFood, ruleset: mission.ruleset });
        } else {
          player.military.units.scout += mission.scouts;
          if (mission.intelligence && !player.military.rewardedNpcIds.includes(mission.targetId)) { player.military.rewardedNpcIds.push(mission.targetId); general.experience += 10; general.level = generalLevel(general.experience); general.leadership = general.level * 20; }
          if (!player.military.reports.some(report => report.missionId === mission.id)) player.military.reports.push({ id: `report-${mission.id}`, type: 'scout', missionId: mission.id, targetId: mission.targetId, targetName: mission.targetName, generalId: mission.generalId, generalName: mission.generalName, coordinates: mission.coordinates, capturedAt: mission.intelligence?.capturedAt, returnedAt: mission.returnsAt, intelligence: mission.intelligence });
        }
      } else continue;
      changed.add(player.playerId);
      const hasAnotherPlayerEventAtSameTime = events.slice(eventIndex + 1).some(candidate => candidate.at === at && candidate.player.playerId === player.playerId);
      if (!hasAnotherPlayerEventAtSameTime) Object.assign(player, settleSupplyAt(player, at));
    }
    for (const player of players.values()) {
      const before = JSON.stringify([player.city, player.military, player.supply]);
      Object.assign(player, advanceSupply(player, now, this.world.supplyActivatedAt));
      const completedTraining = player.military.trainingQueue.filter(job => job.finishesAt <= now && !job.pausedForSupply);
      for (const job of completedTraining) player.military.units[job.unit] += job.amount;
      player.military.trainingQueue = player.military.trainingQueue.filter(job => !completedTraining.includes(job));
      if (before !== JSON.stringify([player.city, player.military, player.supply])) changed.add(player.playerId);
    }
    if (worldChanged || changed.size) await this.#commitTransaction([...changed].map(id => players.get(id)), worldChanged);
    return players;
  }

  async #commitTransaction(players, worldChanged) {
    const transaction = { id: randomUUID(), world: worldChanged ? this.world : null, players };
    await atomicWrite(this.journalFile, transaction);
    if (transaction.world) await atomicWrite(this.worldFile, transaction.world);
    for (const player of transaction.players) await atomicWrite(this.playerFile(player.playerId), player);
    await unlink(this.journalFile);
  }

  async #recoverTransaction() {
    const transaction = await readJson(this.journalFile, null);
    if (!transaction) return;
    if (transaction.world) await atomicWrite(this.worldFile, transaction.world);
    for (const player of transaction.players ?? []) await atomicWrite(this.playerFile(player.playerId), player);
    await unlink(this.journalFile);
  }

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

function createMap(instanceId, activatedAt = Date.now()) {
  const seed = numericSeed(instanceId);
  const config = { ...WORLD_CONFIG };
  const entities = [];
  for (let index = 0; index < config.npcCount; index += 1) {
    let position = (seed + index * 97) % (config.width * config.height);
    while (entities.some(entity => entity.x === position % config.width && entity.y === Math.floor(position / config.width)) || terrainAt(position % config.width, Math.floor(position / config.width), seed) === 'water') position = (position + 1) % (config.width * config.height);
    const difficulty = 1 + index % 3; const garrisonCapacity = NPC_RULES.infantryPerDifficulty * difficulty;
    entities.push({ id: `npc-${index + 1}`, kind: 'npc', name: `Freie Stadt ${index + 1}`, difficulty, x: position % config.width, y: Math.floor(position / config.width),
      resources: { schemaVersion: 1, food: { amount: 500, capacity: 500, regenerationPerHour: 25, updatedAt: activatedAt } },
      garrison: { amount: garrisonCapacity, capacity: garrisonCapacity, progressMs: 0, updatedAt: activatedAt, activatedAt } });
  }
  return { seed, revision: 1, config, entities };
}

function createWorld(worldName, activatedAt) { const instanceId = randomUUID(); return { schemaVersion: WORLD_SCHEMA_VERSION, instanceId, worldName, nextEventSequence: 1, map: createMap(instanceId, activatedAt) }; }
