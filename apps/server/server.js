import { canonicalJSON, exposeCity, ownedCity, playerScore, refreshCities } from '../../packages/game-core/multicity.js';
import { ensureField, fieldMissionQuote, startFieldMission, foundingQuote, foundCity } from '../../packages/game-core/settlement.js';
import { operatingFuel } from '../../packages/game-core/cargo.js';
import { missionQuote, startLogisticsMission } from '../../packages/game-core/logistics.js';
import { RESEARCH_RULES, TECHNOLOGIES, researchOffers, researchQuote, startResearch } from '../../packages/game-core/research.js';
import { markMailRead, unreadMail } from '../../packages/game-core/mailbox.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUILDINGS, buildingProductionRates, capacityBreakdown, cityOffers, commanderScore, demolishBuilding, demolitionPreview,
  enqueueConstruction, MAX_LEVEL, MAX_QUEUE_LENGTH, productionRates, resourceCapacities, RULESET, STORAGE_RULES,
} from '../../packages/game-core/index.js';
import { applySkillConversion, applySkillDistribution, checkedSkillGeneral, combatBonuses, effectiveAttributes, previewSkillConversion, skillLimits, skillSummary, barracksIsBusy, enqueueTraining, GENERAL_SKILL_RULES, MILITARY_RULES, renameGeneral, UNITS } from '../../packages/game-core/military.js';
import { assignMayor, refreshSupplyAt, supplySummary } from '../../packages/game-core/supply.js';
import { WorldStorage } from './storage.js';
import { acceptWebSocket } from './websocket.js';
import { publicMap } from '../../packages/game-core/world.js';
import { randomUUID, randomInt } from 'node:crypto';
import { assignResearcher, hasBarracks, recruitGeneral, recruitQuote, recruitmentCost, researcherSnapshot, validateRoles } from '../../packages/game-core/officers.js';

const MAX_PROCESSED_COMMANDS = 500;
const COMMAND_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TICK_MS = 1000;
const clientRoot = fileURLToPath(new URL('../client/', import.meta.url));
const clientDistRoot = resolve(clientRoot, 'dist');
const staticFiles = new Map([
  ['/request-id.js', ['request-id.js', 'text/javascript; charset=utf-8']],
  ['/map-navigation.js', ['map-navigation.js', 'text/javascript; charset=utf-8']],
  ...['truck', 'refinery', 'vehicleFactory'].map(key => [`/assets/${key}.svg`, [`assets/${key}.svg`, 'image/svg+xml']]),
  ['/assets/scout-aircraft.svg', ['assets/scout-aircraft.svg', 'image/svg+xml']],
  ['/assets/infantry.svg', ['assets/infantry.svg', 'image/svg+xml']],
]);
const mimeTypes = new Map([['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'], ['.woff2', 'font/woff2']]);

function commandFingerprint(type, payload) {
  if (type.startsWith('field.') || type === 'city.found') return JSON.stringify([type, payload]);
  return JSON.stringify([payload?.cityId, legacyCommandFingerprint(type, payload)]);
}
function legacyCommandFingerprint(type, payload) {
  if (['general.recruit', 'general.researcher'].includes(type)) {
    const keys = type === 'general.recruit' ? ['candidateId', 'poolId', 'poolVersion', 'expiresAt', 'acquiredCount', 'rosterVersion', 'rulesetVersion', 'name'] : ['generalId', 'expectedRoleVersion'];
    return JSON.stringify([type, ...keys.map(k => payload?.[k])]);
  }
  if (['general.convert', 'general.distribute'].includes(type)) {
    const changes = payload?.changes;
    return JSON.stringify([type, payload?.generalId, payload?.expectedVersion, payload?.rulesetVersion, payload?.points,
      changes && typeof changes === 'object' ? Object.entries(changes).sort(([a], [b]) => a.localeCompare(b)) : changes]);
  }
  const allowed = type === 'research.start' ? ['universityId', 'technology', 'targetLevel', 'expectedUniversityLevel', 'rulesetVersion', 'researcher'] : type === 'construction.enqueue' ? ['slotId', 'building'] : type === 'training.enqueue' ? ['barracksSlotId', 'trainingSlotId', 'unit', 'amount'] :
    type === 'scouting.start' ? ['targetId', 'generalId', 'scouts', 'delayMinutes', 'cargo', 'preview'] : type === 'raid.start' ? ['targetId', 'generalId', 'infantry', 'trucks', 'units', 'delayMinutes', 'cargo', 'preview'] : type === 'general.rename' ? ['generalId', 'name', 'expectedVersion'] : type === 'general.mayor' ? ['generalId', 'expectedRoleVersion'] : ['slotId', 'buildingId', 'version'];
  return JSON.stringify(Object.fromEntries(allowed.map(key => [key, payload?.[key]])));
}

function validRequest(message) {
  return message && message.version === 1 && typeof message.type === 'string' &&
    /^[a-z]+(?:\.[a-z]+){1,2}$/.test(message.type) && typeof message.requestId === 'string' &&
    /^[a-zA-Z0-9_-]{8,100}$/.test(message.requestId) && message.payload && typeof message.payload === 'object';
}

export function createGameServer({ dataFile, worldDir, worldName = 'alpha', clock = Date.now, allowedOrigins = [], config }) {
  const directory = resolve(worldDir ?? dirname(dataFile));
  const storage = new WorldStorage(directory, worldName, clock, config);
  const ready = storage.initialize();
  const connections = new Set();
  const playerConnections = new Map();
  const mapRequestTimes = new WeakMap();
  const loginAttempts = new Map();

  const response = (peer, type, requestId, payload = {}) => peer.send({ version: 1, type, requestId, payload });
  const errorResponse = (peer, requestId, error) => response(peer, 'command.error', requestId, { message: error.message });
  const snapshot = (player, account, cityId = player.cities[0].id) => {
    const now = clock();
    const current = exposeCity(canonicalJSON(player), cityId);
    const city = current.city;
    const military = current.military;
    return {
      world: { name: storage.world.worldName, instanceId: storage.world.instanceId }, ruleset: RULESET,
      cityId, cities: player.cities.map(c => ({ id: c.id, name: c.name, ...(() => { const e = storage.world.map.entities.find(e => e.id === c.id); return { x: e?.x, y: e?.y }; })(), resources: c.resources, constructionQueue: c.constructionQueue })),
      claims: Object.values(storage.world.fields ?? {}).filter(f => f.claim?.playerId === player.playerId).map(f => ({ ...f.claim, x: f.x, y: f.y })),
      player: { id: player.playerId, commanderName: account.displayName }, city: { ...city, research: current.research }, serverTime: now,
      mailbox: { readReportIds: current.mailbox.readReportIds, messages: current.mailbox.messages.map(({ commandId, fingerprint, ...message }) => message), unreadCount: unreadMail(current) },
      military: { ...military, missions: military.missions.filter(m => m.originCityId === cityId).map(({ commandFingerprint, ...mission }) => ({ ...mission, ...(mission.cargo ? { operatingFuel: operatingFuel(mission, now) } : {}) })) }, score: playerScore(player), buildings: BUILDINGS, offers: cityOffers(city), capacities: resourceCapacities(city),
      capacityBreakdown: capacityBreakdown(city), productionRates: productionRates(city), buildingProductionRates: buildingProductionRates(city), researchOffers: researchOffers({ ...city, research: current.research }, { military, officerRules: storage.config.officers }), researchRules: RESEARCH_RULES, technologies: TECHNOLOGIES, storageRules: STORAGE_RULES,
      officerRules: storage.config.officers, researcher: researcherSnapshot(military, storage.config.officers), recruitment: (() => {
        let cost = null, nextCost = null, reason = null;
        try { cost = recruitmentCost(military.acquiredCount, storage.config.officers); nextCost = recruitmentCost(military.acquiredCount + 1, storage.config.officers); } catch (error) { reason = error.message; }
        return { cost, nextCost, reason: reason ?? (!hasBarracks(player) ? 'Zuerst eine fertige Kaserne errichten.' : military.generals.length >= storage.config.officers.maxCount ? 'General-Limit erreicht.' : null) };
      })(),
      maxLevel: MAX_LEVEL, maxQueueLength: MAX_QUEUE_LENGTH,
      logisticsRules: storage.config.logistics, units: UNITS, militaryRules: MILITARY_RULES, generalSkillRules: GENERAL_SKILL_RULES, supply: { ...current.supply, ...supplySummary(current) }, supplyRules: storage.supplyRules,
    };
  };
  const broadcast = (playerId, type, payloadFactory) => {
    for (const peer of playerConnections.get(playerId) ?? []) peer.send({ version: 1, type, payload: payloadFactory(peer) });
  };
  const setIdentity = (peer, result) => {
    peer.cityId = result.player.cities[0].id;
    peer.playerId = result.player.playerId;
    peer.account = result.account;
    peer.sessionToken = result.session.token;
    if (!playerConnections.has(peer.playerId)) playerConnections.set(peer.playerId, new Set());
    playerConnections.get(peer.playerId).add(peer);
    return result;
  };
  const mapSnapshot = (playerId, viewport) => ({ world: { name: storage.world.worldName, instanceId: storage.world.instanceId }, cityId: viewport?.cityId, ...publicMap(storage.world, playerId, viewport, viewport?.cityId) });
  const pushMapChange = entity => {
    const publicEntity = { id: entity.id, type: 'player-city', name: entity.name, commanderName: entity.commanderName, x: entity.x, y: entity.y };
    for (const connection of connections) if (connection.playerId) connection.send({ version: 1, type: 'map.changed', payload: { revision: storage.world.map.revision, entity: { ...publicEntity, type: connection.playerId === entity.playerId ? 'own-city' : 'player-city' } } });
  };

  async function loadSelected(playerId, cityId) { const player = await storage.loadPlayer(playerId); ownedCity(player, cityId); return exposeCity(player, cityId); }

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
        return await storage.exclusive(async () => {
          await storage.advanceWorld(clock());
          const player = await storage.loadPlayer(peer.playerId);
          ownedCity(player, message.payload.cityId); peer.cityId = message.payload.cityId;
          await storage.savePlayer(player);
          return response(peer, 'city.snapshot', message.requestId, snapshot(player, peer.account, peer.cityId));
        });
      }
      if (message.type === 'map.viewport') {
        const player = await storage.loadPlayer(peer.playerId); ownedCity(player, message.payload.cityId);
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
        const player = await storage.loadPlayer(peer.playerId); ownedCity(player, message.payload.cityId);
        const view = publicMap(storage.world, peer.playerId, { x: entity.x, y: entity.y, width: 1, height: 1 }, message.payload.cityId);
        return response(peer, 'map.details', message.requestId, { cityId: message.payload.cityId, entity: view.entities[0], terrain: view.terrain[0], restricted: entity.playerId !== peer.playerId });
      }
      if (message.type === 'building.preview') {
        return await storage.exclusive(async () => {
          await storage.advanceWorld(clock());
          const player = await loadSelected(peer.playerId, message.payload.cityId); const now = clock();
          const slot = [...player.city.buildingSlots, ...(player.city.militarySlots ?? [])].find(item => item.id === message.payload.slotId);
          if (['barracks', 'vehicleFactory'].includes(slot?.building) && barracksIsBusy(player.military, slot.id)) throw new Error('Dieses Ausbildungsgebäude ist durch Ausbildung belegt.');
          const { preview } = demolitionPreview(player.city, message.payload.slotId, now);
          return response(peer, 'building.preview', message.requestId, { ...preview, cityId: player.cityId });
        });
      }
      if (['field.scout.preview', 'field.conquest.preview', 'city.found.preview'].includes(message.type)) return await storage.exclusive(async () => {
        const now = clock(); await storage.advanceWorld(now);
        const player = await loadSelected(peer.playerId, message.payload.cityId);
        if (message.type === 'city.found.preview') return response(peer, message.type, message.requestId, foundingQuote(player, storage.world, message.payload.claimId, now, storage.config.settlement));
        const field = ensureField(storage.world, message.payload.x, message.payload.y, storage.config.settlement, randomInt);
        await storage.commitPlayers([], true);
        const origin = storage.world.map.entities.find(e => e.id === player.cityId);
        return response(peer, message.type, message.requestId, fieldMissionQuote(player, storage.world, { ...message.payload, type: message.type === 'field.conquest.preview' ? 'conquest' : 'field-scout' }, origin, field, storage.config.logistics, now));
      });
      if (['raid.preview', 'scouting.preview'].includes(message.type)) return await storage.exclusive(async () => {
        const now = clock(); await storage.advanceWorld(now);
        const player = await loadSelected(peer.playerId, message.payload.cityId);
        const origin = storage.world.map.entities.find(e => e.id === player.cityId && e.playerId === peer.playerId);
        const target = storage.world.map.entities.find(e => e.id === message.payload.targetId);
        return response(peer, message.type, message.requestId, missionQuote(player, { ...message.payload, type: message.type === 'raid.preview' ? 'raid' : 'scout' }, origin, target, storage.config.logistics));
      });
      if (message.type === 'research.preview') {
        return await storage.exclusive(async () => {
          await storage.advanceWorld(clock());
          const player = await loadSelected(peer.playerId, message.payload.cityId);
          if (player.research.active) throw new Error('Es läuft bereits eine spielerweite Forschung.');
          return response(peer, 'research.preview', message.requestId, researchQuote(player.city, message.payload, { military: player.military, officerRules: storage.config.officers }));
        });
      }
      if (message.type === 'general.preview') {
        return await storage.exclusive(async () => {
          await storage.advanceWorld(clock());
          const player = await storage.loadPlayer(peer.playerId);
          const general = checkedSkillGeneral(player.military, message.payload);
          const summary = skillSummary(general);
          const conversion = message.payload.points == null ? null : previewSkillConversion(general, message.payload.points);
          const proposed = message.payload.changes == null ? general : applySkillDistribution(general, message.payload.changes);
          return response(peer, 'general.preview', message.requestId, { generalId: general.id, expectedVersion: general.version,
            rulesetVersion: GENERAL_SKILL_RULES.version, summary, conversion, nextPointCost: 10 * (summary.totalPoints + 1),
            limits: skillLimits(general), effectiveAttributes: effectiveAttributes(proposed), combatBonuses: combatBonuses(proposed) });
        });
      }
      if (message.type === 'general.recruit.preview') return await storage.exclusive(async () => {
        await storage.advanceWorld(clock()); const player = await loadSelected(peer.playerId, message.payload.cityId);
        return response(peer, message.type, message.requestId, recruitQuote(player, message.payload.candidateId, clock(), storage.config.officers));
      });
      if (['mail.send', 'mail.read'].includes(message.type)) return await storage.exclusive(async () => {
        const now = clock();
        await storage.advanceWorld(now);
        let players, result;
        if (message.type === 'mail.send') {
          const sent = await storage.sendMail(peer.playerId, message.requestId, message.payload, now);
          players = sent.players; result = { messageId: sent.messageId, duplicate: sent.duplicate };
        } else {
          const player = await storage.loadPlayer(peer.playerId);
          markMailRead(player, message.payload, now);
          await storage.savePlayer(player);
          players = [player]; result = {};
        }
        response(peer, 'command.ok', message.requestId, result);
        for (const player of players) broadcast(player.playerId, 'city.updated', connection => snapshot(player, connection.account, connection.cityId));
      });
      if (!['field.scout.start', 'field.conquest.start', 'city.found', 'general.recruit', 'general.researcher', 'construction.enqueue', 'training.enqueue', 'scouting.start', 'raid.start', 'building.demolish', 'general.rename', 'general.mayor', 'general.convert', 'general.distribute', 'research.start'].includes(message.type)) throw new Error('Ereignistyp ist nicht erlaubt.');
      await storage.exclusive(async () => {
        const now = clock();
        await storage.advanceWorld(now);
        let player = await storage.loadPlayer(peer.playerId);
        const cityCommands = !['general.rename', 'general.convert', 'general.distribute'].includes(message.type);
        if (cityCommands) exposeCity(player, ownedCity(player, message.payload.cityId).id);
        player.processedCommands = (player.processedCommands ?? []).filter(item => item.acceptedAt + COMMAND_TTL_MS > now).slice(-MAX_PROCESSED_COMMANDS);
        const missionReceipt = ['raid.start', 'scouting.start', 'field.scout.start', 'field.conquest.start'].includes(message.type) ? player.military.missions.find(m => m.id === message.requestId && m.commandFingerprint) : null;
        const existing = player.processedCommands.find(item => item.id === message.requestId) ?? (missionReceipt ? { fingerprint: missionReceipt.commandFingerprint, result: {} } : null);
        const fingerprint = commandFingerprint(message.type, message.payload);
        if (existing && existing.fingerprint !== fingerprint) throw new Error('Diese Befehls-ID wurde bereits mit anderem Inhalt verwendet.');
        if (!existing) {
          validateRoles(player);
          if (message.type === 'general.recruit') Object.assign(player, recruitGeneral(player, message.payload, now, storage.config.officers, randomUUID));
          if (message.type === 'general.researcher') Object.assign(player, assignResearcher(player, message.payload));
          if (message.type === 'research.start' && player.research.active) throw new Error('Es läuft bereits eine spielerweite Forschung.');
          if (message.type === 'research.start') player.city = startResearch(player.city, { ...message.payload, id: message.requestId }, now, { military: player.military, officerRules: storage.config.officers });
          if (message.type === 'construction.enqueue') {
            const slot = player.city.militarySlots?.find(candidate => candidate.id === message.payload.slotId);
            if (['barracks', 'vehicleFactory'].includes(slot?.building) && barracksIsBusy(player.military, slot.id)) throw new Error('Dieses Ausbildungsgebäude ist durch Ausbildung belegt.');
            player.city = enqueueConstruction(player.city, { ...message.payload, id: message.requestId }, now);
          }
          if (message.type === 'training.enqueue') {
            if (player.supply?.inShortage) throw new Error('Ausbildung ist wegen Nahrungsmangel pausiert.');
            const result = enqueueTraining(player.military, player.city, { ...message.payload, id: message.requestId }, now);
            player.city = result.city; player.military = result.military;
          }
          if (['scouting.start', 'raid.start'].includes(message.type)) {
            const origin = storage.world.map.entities.find(e => e.id === player.cityId && e.playerId === peer.playerId);
            const target = storage.world.map.entities.find(e => e.id === message.payload.targetId);
            Object.assign(player, startLogisticsMission(player, { ...message.payload, id: message.requestId, type: message.type === 'raid.start' ? 'raid' : 'scout' }, now, origin, target, storage.config.logistics));
            // Reserve the sequence in the same journal as payment and the request receipt.
            player.military.missions.at(-1).commandFingerprint = fingerprint;
            player.military.missions.at(-1).eventSequence = storage.world.nextEventSequence;
          }
          if (message.type === 'general.rename') player.military = renameGeneral(player.military, message.payload);
          if (message.type === 'general.mayor') {
            if (message.payload.expectedRoleVersion !== player.military.roleVersion) throw new Error('Rollenstand veraltet.');
            const oldMayor = player.military.mayorGeneralId ?? null;
            player.military = assignMayor(player.military, message.payload.generalId ?? null);
            if (oldMayor !== (player.military.mayorGeneralId ?? null)) player.military.roleVersion++;
          }
          if (['general.convert', 'general.distribute'].includes(message.type)) {
            const general = checkedSkillGeneral(player.military, message.payload);
            const updated = message.type === 'general.convert' ? applySkillConversion(general, message.payload.points)
              : applySkillDistribution(general, message.payload.changes);
            player.military.generals[player.military.generals.findIndex(item => item.id === general.id)] = updated;
            if (message.type === 'general.distribute') Object.assign(player, refreshSupplyAt(player, now));
          }
          let result = {};
          if (['field.scout.start', 'field.conquest.start'].includes(message.type)) {
            const field = ensureField(storage.world, message.payload.x, message.payload.y, storage.config.settlement, randomInt);
            const origin = storage.world.map.entities.find(e => e.id === player.cityId);
            Object.assign(player, startFieldMission(player, storage.world, { ...message.payload, id: message.requestId, type: message.type === 'field.conquest.start' ? 'conquest' : 'field-scout' }, now, origin, field, storage.config.logistics, storage.config.settlement));
            player.military.missions.at(-1).commandFingerprint = fingerprint;
          }
          if (message.type === 'city.found') {
            const selected = player.cityId;
            player = canonicalJSON(player);
            result = foundCity(player, storage.world, message.payload, now, storage.config.settlement, randomUUID);
            exposeCity(player, selected);
          }

          if (message.type === 'general.recruit') result.generalId = player.military.generals.at(-1).id;
          if (message.type === 'building.demolish') {
            const slot = [...player.city.buildingSlots, ...(player.city.militarySlots ?? [])].find(item => item.id === message.payload.slotId);
            if (player.research.active?.cityId === player.cityId && player.research.active.universityId === slot?.buildingId) throw new Error('Universität durch Forschung belegt.');
            if (['barracks', 'vehicleFactory'].includes(slot?.building) && barracksIsBusy(player.military, slot.id)) throw new Error('Dieses Ausbildungsgebäude ist durch Ausbildung belegt.');
            const demolition = demolishBuilding(player.city, message.payload, now);
            player.city = demolition.city; result = { demolition: demolition.result };
            if (player.military.researcherGeneralId && !player.cities.some(c => (c.id === player.cityId ? player.city : c).buildingSlots.some(s => s.building === 'university' && s.level > 0))) Object.assign(player, assignResearcher(player, { generalId: null, expectedRoleVersion: player.military.roleVersion }));
          }
          Object.assign(player, refreshCities(player, now));
          player.processedCommands.push({ id: message.requestId, fingerprint, acceptedAt: now, result });
          if (['scouting.start', 'raid.start', 'field.scout.start', 'field.conquest.start', 'city.found'].includes(message.type)) {
            storage.world.nextEventSequence++;
            try { await storage.commitPlayers([player], true); } catch (error) { storage.world.nextEventSequence--; throw error; }
          }
          else await storage.savePlayer(player);
        }
        response(peer, 'command.ok', message.requestId, { duplicate: Boolean(existing), ...(existing?.result ?? player.processedCommands.at(-1)?.result ?? {}) });
        if (message.type === 'city.found') pushMapChange(storage.world.map.entities.find(e => e.id === (existing?.result ?? player.processedCommands.at(-1)?.result).cityId));
        broadcast(peer.playerId, 'city.updated', connection => snapshot(player, connection.account, connection.cityId));
      });
    } catch (error) {
      errorResponse(peer, message.requestId, error);
      if (peer.playerId && ['general.preview', 'general.convert', 'general.distribute', 'research.preview', 'research.start', 'raid.preview', 'raid.start', 'scouting.preview', 'scouting.start'].includes(message.type)) {
        await storage.exclusive(async () => {
          const player = await storage.loadPlayer(peer.playerId);
          response(peer, 'city.snapshot', message.requestId, snapshot(player, peer.account, peer.cityId));
        }).catch(() => {});
      }
    }
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
    try {
      await storage.exclusive(async () => {
        const mapRevision = storage.world.map.revision;
        const oldJobs = new Map();
        for (const [playerId, peers] of playerConnections) if (peers.size) oldJobs.set(playerId, (await storage.loadPlayer(playerId)).cities.flatMap(city => city.constructionQueue.map(job => ({ id: job.id, cityId: city.id }))));
        const players = await storage.advanceWorld(clock());
        if (storage.world.map.revision !== mapRevision) for (const peer of connections) if (peer.playerId) response(peer, 'map.changed', undefined, { revision: storage.world.map.revision });
        for (const [playerId, peers] of playerConnections) {
          if (!peers.size) continue;
          const player = players.get(playerId);
          if (player) {
            const completed = (oldJobs.get(playerId) ?? []).filter(old => !player.cities.find(c => c.id === old.cityId).constructionQueue.some(job => job.id === old.id));
            for (const peer of peers) { const commandIds = completed.filter(job => job.cityId === peer.cityId).map(job => job.id); if (commandIds.length) response(peer, 'construction.completed', undefined, { cityId: peer.cityId, commandIds }); }
            broadcast(playerId, 'city.updated', peer => snapshot(player, peer.account, peer.cityId));
          }
        }
      });
    } catch (error) { console.error('Weltzeit konnte nicht gespeichert werden:', error.message); }
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
