import { CARGO_RAID_RULESET } from './cargo.js';
import { LOGISTICS_RAID_RULESET } from './logistics.js';
export const MILITARY_RULES = Object.freeze({
  trainingQueueLength: 3,
  maxTrainingAmount: 1000,
  scoutTravelMsPerField: 5000,
  minimumTravelMs: 5000,
  firstScoutExperience: 10,
  maxGeneralLevel: 10,
  raidRuleset: 'npc-pve-1-provisional',
  skillRaidRuleset: 'npc-pve-2-skills-provisional',
  baseRaidRuleset: 'npc-pve-3-general-bases-provisional',
  infantryFoodCapacity: 20,
  maxMissionUnits: 10_000,
});

export const UNITS = Object.freeze({
  truck: Object.freeze({ label: 'LKW', building: 'vehicleFactory', cost: { wood: 100, stone: 100 }, baseDurationMs: 10000 }),
  scout: Object.freeze({ label: 'Späher', building: 'barracks', cost: { wood: 10, stone: 5, food: 5 }, baseDurationMs: 2000 }),
  infantry: Object.freeze({ label: 'Infanterie', building: 'barracks', cost: { wood: 15, stone: 10, food: 10 }, baseDurationMs: 3000 }),
});

export const GENERAL_NAME_MAX_CODE_POINTS = 40;
export const GENERAL_SKILL_RULES = Object.freeze({
  enabled: true, version: 'general-skills-1-provisional', xpPerPointIndex: 10,
  militaryPercentPerPoint: 2, maxMilitaryPoints: 25, maxEffectiveLeadership: 50,
});

export function effectiveAttributes(general) {
  const normalized = normalizeGeneral(general);
  return Object.fromEntries(Object.entries(normalized.attributes).map(([key, base]) => [key, base + (normalized.skills.allocations[key] ?? 0)]));
}

export function skillLimits(general) {
  const normalized = normalizeGeneral(general);
  return { leadership: Math.max(0, GENERAL_SKILL_RULES.maxEffectiveLeadership - normalized.attributes.leadership),
    attack: Math.max(0, GENERAL_SKILL_RULES.maxMilitaryPoints - normalized.attributes.attack), defense: Math.max(0, GENERAL_SKILL_RULES.maxMilitaryPoints - normalized.attributes.defense) };
}

export function combatBonuses(general) {
  const attributes = effectiveAttributes(general);
  return { attackPercent: Math.min(50, attributes.attack * GENERAL_SKILL_RULES.militaryPercentPerPoint),
    defensePercent: Math.min(50, attributes.defense * GENERAL_SKILL_RULES.militaryPercentPerPoint) };
}

export function checkedSkillGeneral(military, command) {
  const general = military.generals.find(item => item.id === command.generalId);
  if (!general) throw new Error('Eigener General nicht gefunden.');
  if (command.rulesetVersion !== GENERAL_SKILL_RULES.version) throw new Error('Der Skillregelsatz wurde geändert. Bitte erneut prüfen.');
  if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion !== general.version) throw new Error('Der General wurde inzwischen geändert. Bitte den aktuellen Stand prüfen.');
  return general;
}

export function normalizeGeneral(general) {
  const leadership = Number.isInteger(general.leadership) ? general.leadership : generalLevel(general.experience ?? 0) * 20;
  return {
    ...general,
    version: Number.isInteger(general.version) ? general.version : 1,
    attributes: { leadership, attack: 0, defense: 0, ...general.attributes },
    skills: {
      experienceSpent: 0,
      totalPoints: 0,
      allocations: { leadership: 0, attack: 0, defense: 0 },
      ...general.skills,
      allocations: { leadership: 0, attack: 0, defense: 0, ...general.skills?.allocations },
    },
  };
}

export function validateGeneralName(value) {
  if (typeof value !== 'string') throw new Error('Ein Generalname wird benötigt.');
  const name = value.trim();
  if ([...name].length < 1 || [...name].length > GENERAL_NAME_MAX_CODE_POINTS || /\p{Cc}/u.test(name)) {
    throw new Error('Generalname: 1–40 Zeichen ohne Steuerzeichen.');
  }
  return name;
}

export function renameGeneral(previous, { generalId, name, expectedVersion }) {
  const military = structuredClone(previous);
  const index = military.generals.findIndex(general => general.id === generalId);
  if (index < 0) throw new Error('Eigener General nicht gefunden.');
  const general = normalizeGeneral(military.generals[index]);
  if (!Number.isInteger(expectedVersion) || expectedVersion !== general.version) throw new Error('Der General wurde inzwischen geändert. Bitte den aktuellen Stand prüfen.');
  general.name = validateGeneralName(name);
  general.version += 1;
  military.generals[index] = general;
  return military;
}

export function skillSummary(general) {
  const normalized = normalizeGeneral(general);
  const allocated = Object.values(normalized.skills.allocations).reduce((sum, value) => sum + value, 0);
  if (![normalized.experience, normalized.skills.experienceSpent, normalized.skills.totalPoints, allocated, ...Object.values(normalized.skills.allocations)].every(value => Number.isSafeInteger(value) && value >= 0) || normalized.skills.experienceSpent > normalized.experience || allocated > normalized.skills.totalPoints) throw new Error('Inkonsistenter Skillfortschritt.');
  return { ...normalized.skills, availableExperience: normalized.experience - normalized.skills.experienceSpent, freePoints: normalized.skills.totalPoints - allocated };
}

export function previewSkillConversion(general, points, rules = GENERAL_SKILL_RULES) {
  const summary = skillSummary(general);
  if (rules?.version === GENERAL_SKILL_RULES.version) {
    if (!Number.isSafeInteger(points) || points < 1) throw new Error('Ungültige Skillpunktzahl.');
    const m = BigInt(points), k = BigInt(summary.totalPoints);
    const cost = 5n * m * (2n * k + m + 1n);
    if (cost > BigInt(Number.MAX_SAFE_INTEGER) || k + m > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Skillkosten überschreiten den sicheren Zahlenbereich.');
    if (cost > BigInt(summary.availableExperience)) throw new Error('Nicht genügend verfügbare Erfahrung.');
    return { points, cost: Number(cost), remainingExperience: summary.availableExperience - Number(cost), totalPoints: summary.totalPoints + points };
  }
  if (!rules || typeof rules.costForPoint !== 'function') throw new Error('Kein Skillregelsatz aktiv.');
  if (!Number.isInteger(points) || points < 0 || points > 10_000) throw new Error('Ungültige Skillpunktzahl.');
  let cost = 0;
  for (let offset = 0; offset < points; offset += 1) {
    const nextCost = rules.costForPoint(summary.totalPoints + offset);
    const previousCost = summary.totalPoints + offset > 0 ? rules.costForPoint(summary.totalPoints + offset - 1) : 0;
    if (!Number.isSafeInteger(nextCost) || nextCost <= 0 || nextCost <= previousCost) throw new Error('Skillkosten müssen positive, streng steigende Ganzzahlen sein.');
    cost += nextCost;
    if (!Number.isSafeInteger(cost)) throw new Error('Skillkosten überschreiten den sicheren Zahlenbereich.');
  }
  if (cost > summary.availableExperience) throw new Error('Nicht genügend verfügbare Erfahrung.');
  return { points, cost, remainingExperience: summary.availableExperience - cost, totalPoints: summary.totalPoints + points };
}

export function applySkillConversion(general, points, rules = GENERAL_SKILL_RULES) {
  const preview = previewSkillConversion(general, points, rules);
  const next = normalizeGeneral(general);
  next.skills.experienceSpent += preview.cost;
  next.skills.totalPoints += points;
  next.version += 1;
  return next;
}

export function applySkillDistribution(general, changes) {
  const next = normalizeGeneral(general);
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('Ungültige Skillverteilung.');
  for (const [attribute, amount] of Object.entries(changes ?? {})) {
    if (!Object.hasOwn(next.skills.allocations, attribute) || !Number.isSafeInteger(amount) || amount < 0) throw new Error('Ungültige Skillverteilung.');
    if (amount > 0 && next.skills.allocations[attribute] + amount > skillLimits(next)[attribute]) throw new Error('Die Wirkungsobergrenze dieser Eigenschaft ist erreicht.');
  }
  const total = Object.values(changes ?? {}).reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total) || total < 1) throw new Error('Ungültige Skillverteilung.');
  if (total > skillSummary(next).freePoints) throw new Error('Nicht genügend freie Skillpunkte.');
  for (const [attribute, amount] of Object.entries(changes ?? {})) next.skills.allocations[attribute] += amount;
  next.version += 1;
  return next;
}

export function generalLevel(experience) {
  let level = 1;
  while (level < MILITARY_RULES.maxGeneralLevel && experience >= 50 * (level + 1) * level) level += 1;
  return level;
}

export function validateMissionUnits(units) {
  const amounts = Object.values(units ?? {});
  if (!amounts.length || amounts.some(amount => !Number.isSafeInteger(amount) || amount < 0)) throw new Error('Einsatztruppen müssen als nicht negative Ganzzahlen angegeben werden.');
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  if (!Number.isSafeInteger(total) || total < 1) throw new Error('Mindestens eine Einheit muss entsendet werden.');
  if (total > MILITARY_RULES.maxMissionUnits) throw new Error(`Pro Einsatz dürfen insgesamt höchstens ${MILITARY_RULES.maxMissionUnits} Einheiten entsendet werden.`);
  return total;
}

export function trainingQueueForBarracks(military, barracksSlotId) {
  return military.trainingQueue.filter(job => (job.trainingSlotId ?? job.barracksSlotId) === barracksSlotId);
}

export function barracksIsBusy(military, barracksSlotId) {
  return trainingQueueForBarracks(military, barracksSlotId).length > 0;
}

export function newMilitary(playerId) {
  return { combatScore: 0, units: { scout: 0, infantry: 0, truck: 0 }, trainingQueue: [], generals: [normalizeGeneral({ id: `general-${playerId}`, ownerId: playerId, name: 'General', level: 1, experience: 0, leadership: 20, status: 'idle' })], missions: [], reports: [], rewardedNpcIds: [] };
}

export function advanceMilitary(previous, now, npcById = new Map()) {
  const military = structuredClone(previous);
  const completedTraining = military.trainingQueue.filter(job => job.finishesAt <= now);
  for (const job of completedTraining) military.units[job.unit] += job.amount;
  military.trainingQueue = military.trainingQueue.filter(job => job.finishesAt > now);
  for (const mission of military.missions) {
    // Raids require the shared NPC state and are settled by WorldStorage.
    // Never run them through the legacy scout-only return path.
    if (mission.type === 'raid') continue;
    if (mission.status === 'outbound' && mission.arrivesAt <= now) {
      mission.status = 'returning';
      const npc = npcById.get(mission.targetId);
      mission.intelligence = { capturedAt: mission.arrivesAt, food: npc?.resources?.food ? { amount: npc.resources.food.amount, capacity: npc.resources.food.capacity } : null, garrison: 'not-modelled' };
    }
    if (mission.status === 'returning' && mission.returnsAt <= now) {
      mission.status = 'completed';
      military.units.scout += mission.scouts;
      const general = military.generals.find(item => item.id === mission.generalId);
      if (!general) throw new Error('Der Einsatz verweist auf einen unbekannten General.');
      general.status = 'idle';
      if (!military.rewardedNpcIds.includes(mission.targetId)) {
        military.rewardedNpcIds.push(mission.targetId); general.experience += MILITARY_RULES.firstScoutExperience;
        general.level = generalLevel(general.experience); general.leadership = general.level * 20;
      }
      if (!military.reports.some(report => report.missionId === mission.id)) military.reports.push({ id: `report-${mission.id}`, missionId: mission.id, targetId: mission.targetId, targetName: mission.targetName, generalId: mission.generalId, generalName: mission.generalName, coordinates: mission.coordinates, capturedAt: mission.intelligence?.capturedAt, returnedAt: mission.returnsAt, intelligence: mission.intelligence });
    }
  }
  return military;
}

export function enqueueTraining(previous, city, command, now) {
  const military = structuredClone(previous); const definition = UNITS[command.unit];
  if (!definition) throw new Error('Unbekannter Einheitentyp.');
  if (!Number.isInteger(command.amount) || command.amount < 1 || command.amount > MILITARY_RULES.maxTrainingAmount) throw new Error('Ungültige Ausbildungsmenge.');
  const trainingSlotId = command.trainingSlotId ?? command.barracksSlotId;
  if (typeof trainingSlotId !== 'string') throw new Error('Ein eigenes Ausbildungsgebäude muss ausgewählt werden.');
  const barracks = city.militarySlots?.find(slot => slot.id === trainingSlotId && slot.building === definition.building && slot.level > 0);
  if (!barracks) throw new Error('Ein eigenes fertiges Ausbildungsgebäude des passenden Typs wird benötigt.');
  if (command.unit === 'truck' && !city.research?.levels.motorization) throw new Error('Motorisierung erforderlich.');
  const barracksQueue = trainingQueueForBarracks(military, barracks.id);
  if (barracksQueue.length >= MILITARY_RULES.trainingQueueLength) throw new Error('Die Ausbildungswarteschlange dieses Gebäudes ist voll.');
  if (city.constructionQueue.some(job => job.slotId === barracks.id)) throw new Error('Das Ausbildungsgebäude wird gerade ausgebaut.');
  for (const [resource, unitCost] of Object.entries(definition.cost)) if (city.resources[resource] < unitCost * command.amount) throw new Error('Nicht genügend Rohstoffe.');
  const nextCity = structuredClone(city);
  for (const [resource, unitCost] of Object.entries(definition.cost)) nextCity.resources[resource] -= unitCost * command.amount;
  const startsAt = barracksQueue.at(-1)?.finishesAt ?? now;
  const durationMs = Math.ceil(definition.baseDurationMs * command.amount / barracks.level);
  military.trainingQueue.push({ id: command.id, trainingSlotId: barracks.id, barracksSlotId: barracks.id, paidCost: Object.fromEntries(Object.entries(definition.cost).map(([key, cost]) => [key, cost * command.amount])), unit: command.unit, amount: command.amount, barracksLevel: barracks.level, startsAt, finishesAt: startsAt + durationMs });
  return { city: nextCity, military };
}

export function startScoutMission(previous, command, now, origin, target) {
  const military = structuredClone(previous); const general = military.generals.find(item => item.id === command.generalId);
  if (!general || general.status !== 'idle' || previous.mayorGeneralId === general.id || previous.researcherGeneralId === general.id || previous.missions.some(m => m.generalId === general.id && m.status !== 'completed')) throw new Error('Kein eigener freier General ausgewählt.');
  validateMissionUnits({ scout: command.scouts });
  if (command.scouts > military.units.scout) throw new Error('Nicht genügend verfügbare Späher.');
  if (!target || target.kind !== 'npc') throw new Error('Nur NPC-Städte können aufgeklärt werden.');
  const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
  const travelMs = Math.max(MILITARY_RULES.minimumTravelMs, Math.ceil(distance) * MILITARY_RULES.scoutTravelMsPerField);
  military.units.scout -= command.scouts; general.status = 'scouting'; general.version += 1;
  military.missions.push({ id: command.id, targetId: target.id, targetName: target.name, coordinates: { x: target.x, y: target.y }, generalId: general.id, generalName: general.name,
    scouts: command.scouts, initialScouts: command.scouts, status: 'outbound', startedAt: now, arrivesAt: now + travelMs, returnsAt: now + 2 * travelMs });
  return military;
}

export function resolveNpcCombat(attackers, defenders) {
  if (!Number.isSafeInteger(attackers) || attackers <= 0) throw new Error('Die Infanteriezahl muss eine positive Ganzzahl sein.');
  if (!Number.isSafeInteger(defenders) || defenders < 0) throw new Error('Ungültige NPC-Garnison.');
  if (defenders === 0) return { victory: true, attackerLosses: 0, defenderLosses: 0, survivors: attackers };
  if (attackers > defenders) {
    const attackerLosses = Math.min(attackers, Math.ceil(defenders / 2));
    return { victory: true, attackerLosses, defenderLosses: defenders, survivors: attackers - attackerLosses };
  }
  const defenderLosses = Math.min(defenders, Math.floor(attackers / 2));
  return { victory: false, attackerLosses: attackers, defenderLosses, survivors: 0 };
}

export function resolveMissionCombat(mission, attackers, defenders) {
  if (!mission.ruleset || mission.ruleset === MILITARY_RULES.raidRuleset) return resolveNpcCombat(attackers, defenders);
  if (![MILITARY_RULES.skillRaidRuleset, MILITARY_RULES.baseRaidRuleset, LOGISTICS_RAID_RULESET, CARGO_RAID_RULESET, 'field-conquest-1-provisional'].includes(mission.ruleset)) throw new Error('Unbekannte Kampfregelversion.');
  const { attackPercent, defensePercent } = mission.combatBonuses ?? {};
  if (![attackPercent, defensePercent].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 50)) throw new Error('Ungültige gespeicherte Kampfboni.');
  if (!Number.isSafeInteger(attackers) || attackers <= 0 || !Number.isSafeInteger(defenders) || defenders < 0) throw new Error('Ungültige Kampftruppen.');
  const bonus = { attackPercent, defensePercent };
  if (defenders === 0) return { victory: true, attackerLosses: 0, defenderLosses: 0, survivors: attackers, combatBonuses: bonus };
  const n = BigInt(attackers), d = BigInt(defenders), strength = n * BigInt(100 + attackPercent);
  const victory = strength > d * 100n;
  const numerator = (victory ? d : 2n * n) * BigInt(100 - defensePercent);
  const losses = (numerator + 199n) / 200n;
  const attackerLosses = Number(losses < n ? losses : n);
  const defenderLosses = victory ? defenders : Number(strength / 200n < d ? strength / 200n : d);
  return { victory, attackerLosses, defenderLosses, survivors: attackers - attackerLosses, combatBonuses: bonus };
}

export function startRaidMission(previous, command, now, origin, target, eventSequence) {
  const military = structuredClone(previous);
  const general = military.generals.find(item => item.id === command.generalId);
  if (!general || general.status !== 'idle' || previous.mayorGeneralId === general.id || previous.researcherGeneralId === general.id || previous.missions.some(m => m.generalId === general.id && m.status !== 'completed')) throw new Error('Kein eigener freier General ausgewählt.');
  validateMissionUnits({ infantry: command.infantry });
  if (command.infantry > military.units.infantry) throw new Error('Nicht genügend verfügbare Infanterie.');
  if (!target || target.kind !== 'npc') throw new Error('Nur NPC-Städte können angegriffen werden.');
  const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
  const travelMs = Math.max(MILITARY_RULES.minimumTravelMs, Math.ceil(distance) * MILITARY_RULES.scoutTravelMsPerField);
  military.units.infantry -= command.infantry;
  general.status = 'raiding';
  general.version += 1;
  military.missions.push({ id: command.id, type: 'raid', ruleset: MILITARY_RULES.baseRaidRuleset, effectiveAttributes: effectiveAttributes(general), combatBonuses: combatBonuses(general), eventSequence, targetId: target.id,
    targetName: target.name, coordinates: { x: target.x, y: target.y }, generalId: general.id, generalName: general.name,
    infantry: command.infantry, initialInfantry: command.infantry, status: 'outbound', startedAt: now, arrivesAt: now + travelMs, returnsAt: now + 2 * travelMs });
  return military;
}
