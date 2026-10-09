import { LOGISTICS_RAID_RULESET, missionUnits, missionCapacity, truckCombatLosses } from '../../packages/game-core/logistics.js';
import { normalizeResearch } from '../../packages/game-core/research.js';
import { normalizeOfficers, syncCandidates } from '../../packages/game-core/officers.js';
import { assignMissingPortraits } from '../../packages/game-core/portraits.js';
import { MAIL_RULES, validateMail } from '../../packages/game-core/mailbox.js';
import { parseConfiguration } from './config.js';
import { createHash, randomBytes, randomInt, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { allSlots, constructionQuote, newCity, resourceCapacities, RULESET } from '../../packages/game-core/index.js';
import { GENERAL_SKILL_RULES, MILITARY_RULES, generalLevel, newMilitary, normalizeGeneral, resolveMissionCombat, skillSummary } from '../../packages/game-core/military.js';
import { advanceSupplyHistory, refreshSupplyAt, SUPPLY_RULES, settleSupplyAt } from '../../packages/game-core/supply.js';
import { advanceNpc, NPC_RULES, randomFreeLocation, terrainAt, WORLD_CONFIG, WORLD_SCHEMA_VERSION } from '../../packages/game-core/world.js';

const scrypt = promisify(scryptCallback);
export const PLAYER_SCHEMA_VERSION = 14;
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
  constructor(worldDir, worldName, clock = Date.now, config = parseConfiguration(), logger = console) {
    this.directory = resolve(worldDir);
    this.playersDirectory = join(this.directory, 'players');
    this.accountsFile = join(this.directory, 'accounts.json');
    this.worldFile = join(this.directory, 'world.json');
    this.journalFile = join(this.directory, 'transaction.json');
    this.worldName = worldName;
    this.clock = clock;
    this.config = config; this.logger = logger;
  }

  async initialize() {
    await mkdir(this.playersDirectory, { recursive: true });
    await this.#recoverTransaction();
    this.accounts = await readJson(this.accountsFile, { schemaVersion: 1, accounts: [], sessions: [] });
    this.world = await readJson(this.worldFile, null);
    if (!this.world) {
      this.world = createWorld(this.worldName, this.clock(), this.config.map);
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
    if (!this.world.supplyRuleHistory) {
      this.world.supplyRuleHistory = [{ effectiveAt: this.world.supplyActivatedAt, rules: { ...structuredClone(SUPPLY_RULES), version: 'supply-1-provisional', upkeepScope: 'all-living', upkeepPerSecond: { infantry: 0.1, scout: 0.05 } } }];
      await atomicWrite(this.worldFile, this.world);
    }
    if (['width', 'height', 'npcCount'].some(key => this.world.map.config[key] !== this.config.map[key])) {
      this.logger.warn('ENV-Kartenerzeugungswerte nicht angewandt: gespeicherte Karte bleibt verbindlich.', this.world.map.config);
    }
    await this.#assignMissingLocations();
    const transitionAt = this.clock();
    const interval = this.config.officers;
    this.world.officerIntervalHistory ??= [];
    if (this.world.officerIntervalHistory.at(-1)?.refreshMs !== interval.refreshMs) {
      this.world.officerIntervalHistory.push({ effectiveAt: transitionAt, refreshMs: interval.refreshMs, version: interval.version });
      await this.#commitTransaction([], true);
    }
    const players = await this.advanceWorld(transitionAt);
    if (JSON.stringify(this.supplyRules) !== JSON.stringify(this.config.supply)) {
      this.world.supplyRuleHistory.push({ effectiveAt: transitionAt, rules: structuredClone(this.config.supply) });
      for (const player of players.values()) {
        player.supply.rules = structuredClone(this.config.supply);
        Object.assign(player, refreshSupplyAt(player, transitionAt));
      }
      await this.#commitTransaction([...players.values()], true);
    }
    this.#expireSessions();
    await atomicWrite(this.accountsFile, this.accounts);
    return this;
  }

  get supplyRules() { return this.world.supplyRuleHistory.at(-1).rules; }
  advanceSupply(player, at, options = {}) { return advanceSupplyHistory(player, at, this.world.supplyActivatedAt, this.world.supplyRuleHistory, options); }

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
        military: newMilitary(playerId), generalSkillRuleset: GENERAL_SKILL_RULES.version, processedCommands: [], createdAt: now,
      };
      player.mailbox = { messages: [], readReportIds: [] };
      normalizeOfficers(player);
      assignMissingPortraits(player, randomInt);
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
      player.schemaVersion = 7;
    }
    if (player.schemaVersion === 7) {
      migrated = true;
      player.military.generals = player.military.generals.map(general => {
        const normalized = normalizeGeneral(general);
        skillSummary(normalized); // Preserve coherent counters; never manufacture spendable XP.
        return normalized;
      });
      for (const mission of player.military.missions) {
        if (mission.type === 'raid') mission.ruleset ??= MILITARY_RULES.raidRuleset;
      }
      player.generalSkillRuleset = GENERAL_SKILL_RULES.version;
      player.schemaVersion = 8;
    }
    if (player.schemaVersion === 8) { migrated = true; normalizeResearch(player.city); player.schemaVersion = 9; }
    if (player.schemaVersion === 9) {
      migrated = true;
      if (player.military.acquiredCount != null && (!Number.isSafeInteger(player.military.acquiredCount) || player.military.acquiredCount < 1)) throw new Error('Inkonsistenter General-Erwerbszähler.');
      player.military.acquiredCount = Math.max(player.military.acquiredCount ?? 1, player.military.generals.length);
      normalizeOfficers(player); player.schemaVersion = 10;
    }
    if (player.schemaVersion === 10) { migrated = true; assignMissingPortraits(player, randomInt); player.schemaVersion = 11; }
    if (player.schemaVersion === 11) {
      migrated = true;
      player.mailbox = { messages: [], readReportIds: player.military.reports.map(report => report.id) };
      player.schemaVersion = 12;
    }
    if (player.schemaVersion === 12) {
      migrated = true;
      player.city.resources.oil ??= 0;
      player.military.units.truck ??= 0;
      normalizeResearch(player.city);
      for (const slot of allSlots(player.city)) if (slot.investment?.paid) slot.investment.paid.oil ??= 0;
      for (const job of player.military.trainingQueue) {
        const slot = player.city.militarySlots.find(s => s.id === (job.trainingSlotId ?? job.barracksSlotId));
        if (!slot || slot.building !== 'barracks' || !['infantry', 'scout'].includes(job.unit)) throw new Error('Inkonsistenter alter Ausbildungsauftrag.');
        job.trainingSlotId ??= job.barracksSlotId;
      }
      player.schemaVersion = 13;
    }
    if (player.schemaVersion === 13) {
      migrated = true;
      for (const mission of player.military.missions) mission.delayMinutes ??= 0;
      player.schemaVersion = 14;
    }
    if (player.schemaVersion !== PLAYER_SCHEMA_VERSION) throw new Error(`Unbekannte Spieler-Schemaversion: ${player.schemaVersion}.`);
    if (!Number.isFinite(player.city.resources.oil) || player.city.resources.oil < 0 || !Number.isSafeInteger(player.military.units.truck) || player.military.units.truck < 0) throw new Error('Inkonsistente Öl- oder LKW-Bestände in Schema 13.');
    normalizeResearch(player.city);
    normalizeOfficers(player);
    if (migrated) await this.savePlayer(player);
    return player;
  }
  savePlayer(player) { return atomicWrite(this.playerFile(player.playerId), player); }
  saveWorld() { return atomicWrite(this.worldFile, this.world); }

  // Caller holds the world's exclusive queue. Delivery and sender copy share its recovery journal.
  async sendMail(senderId, commandId, payload, now) {
    const mail = validateMail(payload);
    const sender = await this.loadPlayer(senderId);
    const fingerprint = createHash('sha256').update(JSON.stringify(mail)).digest('hex');
    const existing = sender.mailbox.messages.find(message => message.senderId === senderId && message.commandId === commandId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error('Diese Befehls-ID wurde bereits mit anderem Inhalt verwendet.');
      return { players: [sender], messageId: existing.id, duplicate: true };
    }
    const account = this.accounts.accounts.find(account => account.normalized === mail.recipient);
    if (!account) throw new Error('Empfänger in dieser Welt nicht gefunden.');
    if (account.playerId === senderId) throw new Error('Bitte einen anderen Kommandanten wählen.');
    if (sender.mailbox.messages.filter(message => message.senderId === senderId && message.sentAt > now - 60000).length >= MAIL_RULES.sendsPerMinute) throw new Error('Höchstens fünf Nachrichten pro Minute. Bitte später erneut senden.');
    const recipient = await this.loadPlayer(account.playerId);
    const message = { id: randomUUID(), commandId, fingerprint, senderId, senderName: sender.commanderName,
      recipientId: recipient.playerId, recipientName: account.displayName, subject: mail.subject, body: mail.body, sentAt: now, readAt: null };
    sender.mailbox.messages.push(structuredClone(message));
    recipient.mailbox.messages.push(structuredClone(message));
    await this.commitPlayers([sender, recipient]);
    return { players: [sender, recipient], messageId: message.id, duplicate: false };
  }

  nextEventSequence() { return this.world.nextEventSequence++; }

  async advanceWorld(now) {
    if (this.needsRecovery) { await this.#recoverTransaction(); this.world = await readJson(this.worldFile); this.needsRecovery = false; }
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
      Object.assign(player, this.advanceSupply(player, at, { deferLossAtEnd: true }));
      const mission = player.military.missions.find(candidate => candidate.id === scheduledMission.id);
      if (event.phase === 'arrival' && mission.status === 'outbound') {
        const npcIndex = this.world.map.entities.findIndex(entity => entity.id === mission.targetId && entity.kind === 'npc');
        if (npcIndex < 0) throw new Error('Einsatzziel existiert nicht mehr.');
        const npc = advanceNpc(this.world.map.entities[npcIndex], at);
        if (mission.type === 'raid') {
          const attackers = missionUnits(mission).infantry;
          const combat = attackers > 0 ? resolveMissionCombat(mission, attackers, npc.garrison.amount) : { victory: false, attackerLosses: 0, defenderLosses: 0, survivors: 0,
            ...(mission.ruleset === MILITARY_RULES.skillRaidRuleset ? { combatBonuses: mission.combatBonuses } : {}) };
          npc.garrison.amount -= combat.defenderLosses;
          npc.garrison.updatedAt = at;
          let truckLosses = 0;
          if (mission.ruleset === LOGISTICS_RAID_RULESET) {
            const before = { ...mission.units };
            truckLosses = truckCombatLosses(before.truck ?? 0, combat.attackerLosses, attackers);
            mission.units.infantry = combat.survivors;
            mission.units.truck = (before.truck ?? 0) - truckLosses;
            combat.combatLossesByUnit = { infantry: combat.attackerLosses, truck: truckLosses };
            combat.combatSurvivorsByUnit = { ...mission.units };
            combat.cancelled = attackers === 0;
          }
          const raidCapacity = mission.units ? missionCapacity(mission) : combat.survivors * 20;
          const availableFood = Math.floor(npc.resources.food.amount);
          const loadedFood = combat.victory ? Math.min(raidCapacity, availableFood) : 0;
          npc.resources.food.amount -= loadedFood;
          mission.result = { ...combat, loadedFood, capacity: raidCapacity, generalExperience: combat.defenderLosses * 2,
            combatScore: combat.defenderLosses - combat.attackerLosses - truckLosses, defenders: combat.defenderLosses + npc.garrison.amount, hungerLosses: mission.hungerLosses ?? 0 };
        } else {
          mission.intelligence = missionUnits(mission).scout > 0
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
          for (const [unit, amount] of Object.entries(missionUnits(mission))) player.military.units[unit] = (player.military.units[unit] ?? 0) + amount;
          const capacity = resourceCapacities(player.city).food;
          const free = Math.max(0, capacity - player.city.resources.food);
          const storedFood = Math.min(free, result.loadedFood);
          player.city.resources.food += storedFood;
          general.experience += result.generalExperience;
          general.level = generalLevel(general.experience); general.leadership = general.level * 20;
          general.version += 1;
          player.military.combatScore = (player.military.combatScore ?? 0) + result.combatScore;
          if (!player.military.reports.some(report => report.missionId === mission.id)) player.military.reports.push({ id: `report-${mission.id}`, type: 'raid', missionId: mission.id,
            targetId: mission.targetId, targetName: mission.targetName, generalId: mission.generalId, generalName: mission.generalName, startedAt: mission.startedAt,
            arrivedAt: mission.arrivesAt, returnedAt: mission.returnsAt, infantry: mission.initialUnits?.infantry ?? mission.initialInfantry ?? mission.infantry + (mission.hungerLosses ?? 0), ...result,
            hungerLosses: mission.hungerLosses ?? 0, originalLoadedFood: result.loadedFood + (mission.foodLostInTransit ?? 0), foodLostInTransit: mission.foodLostInTransit ?? 0,
            storedFood, overflowFood: result.loadedFood - storedFood, ruleset: mission.ruleset,
            ...(mission.units ? { initialUnits: mission.initialUnits, returnedUnits: { ...mission.units }, hungerLossesByUnit: mission.hungerLossesByUnit, paidOil: mission.paidOil, fuelCalculation: mission.fuelCalculation, normalOneWayOil: mission.normalOneWayOil, outboundTravelMs: mission.outboundTravelMs, travelMs: mission.travelMs, delayMinutes: mission.delayMinutes, baseOil: mission.baseOil, delayOil: mission.delayOil, outboundOil: mission.outboundOil, returnOil: mission.returnOil, logistics: mission.logistics, distanceFields: mission.distanceFields, combatBonuses: mission.combatBonuses, finalCapacity: missionCapacity(mission) } : {}) });
        } else {
          player.military.units.scout += missionUnits(mission).scout;
          if (mission.intelligence && !player.military.rewardedNpcIds.includes(mission.targetId)) { player.military.rewardedNpcIds.push(mission.targetId); general.experience += 10; general.level = generalLevel(general.experience); general.leadership = general.level * 20; }
          general.version += 1;
          if (!player.military.reports.some(report => report.missionId === mission.id)) player.military.reports.push({ id: `report-${mission.id}`, type: 'scout', missionId: mission.id, targetId: mission.targetId, targetName: mission.targetName, generalId: mission.generalId, generalName: mission.generalName, coordinates: mission.coordinates, capturedAt: mission.intelligence?.capturedAt, returnedAt: mission.returnsAt, intelligence: mission.intelligence, ...(mission.units ? { initialUnits: mission.initialUnits, returnedUnits: { ...mission.units }, hungerLossesByUnit: mission.hungerLossesByUnit, paidOil: mission.paidOil, logistics: mission.logistics, distanceFields: mission.distanceFields } : {}) });
        }
      } else continue;
      changed.add(player.playerId);
      const hasAnotherPlayerEventAtSameTime = events.slice(eventIndex + 1).some(candidate => candidate.at === at && candidate.player.playerId === player.playerId);
      if (!hasAnotherPlayerEventAtSameTime) Object.assign(player, settleSupplyAt(player, at));
    }
    for (const player of players.values()) {
      const before = JSON.stringify([player.city, player.military, player.supply]);
      Object.assign(player, this.advanceSupply(player, now));
      syncCandidates(player, now, this.config.officers, randomInt, randomUUID, this.world.officerIntervalHistory);
      if (before !== JSON.stringify([player.city, player.military, player.supply])) changed.add(player.playerId);
    }
    if (worldChanged || changed.size) await this.#commitTransaction([...changed].map(id => players.get(id)), worldChanged);
    return players;
  }

  async commitPlayers(players, worldChanged = false) { return this.#commitTransaction(players, worldChanged); }

  async #commitTransaction(players, worldChanged) {
    const transaction = { id: randomUUID(), world: worldChanged ? this.world : null, players };
    try {
    await atomicWrite(this.journalFile, transaction);
    if (transaction.world) await atomicWrite(this.worldFile, transaction.world);
    for (const player of transaction.players) await atomicWrite(this.playerFile(player.playerId), player);
    await unlink(this.journalFile);
    } catch (error) { this.needsRecovery = true; throw error; }
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

function createMap(instanceId, activatedAt = Date.now(), requested = WORLD_CONFIG) {
  const seed = numericSeed(instanceId);
  const config = { ...requested };
  let buildable = 0;
  for (let y = 0; y < config.height; y++) for (let x = 0; x < config.width; x++) if (terrainAt(x, y, seed) !== 'water') buildable++;
  if (config.npcCount >= buildable) throw new Error('WORLD_NPC_COUNT: Zu wenige bebaubare Felder für NPCs und mindestens einen Spieler.');
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

function createWorld(worldName, activatedAt, config) { const instanceId = randomUUID(); return { schemaVersion: WORLD_SCHEMA_VERSION, instanceId, worldName, nextEventSequence: 1, map: createMap(instanceId, activatedAt, config) }; }
