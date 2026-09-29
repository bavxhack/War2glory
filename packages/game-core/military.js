export const MILITARY_RULES = Object.freeze({
  trainingQueueLength: 3,
  maxTrainingAmount: 1000,
  scoutTravelMsPerField: 5000,
  minimumTravelMs: 5000,
  firstScoutExperience: 10,
  maxGeneralLevel: 10,
});

export const UNITS = Object.freeze({
  scout: Object.freeze({ label: 'Späher', cost: { wood: 10, stone: 5, food: 5 }, baseDurationMs: 2000 }),
  infantry: Object.freeze({ label: 'Infanterie', cost: { wood: 15, stone: 10, food: 10 }, baseDurationMs: 3000 }),
});

export const GENERAL_NAME_MAX_CODE_POINTS = 40;
export const GENERAL_SKILL_RULES = Object.freeze({ enabled: false, version: null });

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
  if (![normalized.experience, normalized.skills.experienceSpent, normalized.skills.totalPoints, allocated].every(value => Number.isSafeInteger(value) && value >= 0) || normalized.skills.experienceSpent > normalized.experience || allocated > normalized.skills.totalPoints) throw new Error('Inkonsistenter Skillfortschritt.');
  return { ...normalized.skills, availableExperience: normalized.experience - normalized.skills.experienceSpent, freePoints: normalized.skills.totalPoints - allocated };
}

export function previewSkillConversion(general, points, rules) {
  const summary = skillSummary(general);
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

export function applySkillConversion(general, points, rules) {
  const preview = previewSkillConversion(general, points, rules);
  const next = normalizeGeneral(general);
  next.skills.experienceSpent += preview.cost;
  next.skills.totalPoints += points;
  next.version += 1;
  return next;
}

export function applySkillDistribution(general, changes) {
  const next = normalizeGeneral(general);
  for (const [attribute, amount] of Object.entries(changes ?? {})) {
    if (!Object.hasOwn(next.skills.allocations, attribute) || !Number.isInteger(amount) || amount < 0) throw new Error('Ungültige Skillverteilung.');
  }
  const total = Object.values(changes ?? {}).reduce((sum, value) => sum + value, 0);
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

export function trainingQueueForBarracks(military, barracksSlotId) {
  return military.trainingQueue.filter(job => job.barracksSlotId === barracksSlotId);
}

export function barracksIsBusy(military, barracksSlotId) {
  return trainingQueueForBarracks(military, barracksSlotId).length > 0;
}

export function newMilitary(playerId) {
  return { units: { scout: 0, infantry: 0 }, trainingQueue: [], generals: [normalizeGeneral({ id: `general-${playerId}`, ownerId: playerId, name: 'General', level: 1, experience: 0, leadership: 20, status: 'idle' })], missions: [], reports: [], rewardedNpcIds: [] };
}

export function advanceMilitary(previous, now, npcById = new Map()) {
  const military = structuredClone(previous);
  const completedTraining = military.trainingQueue.filter(job => job.finishesAt <= now);
  for (const job of completedTraining) military.units[job.unit] += job.amount;
  military.trainingQueue = military.trainingQueue.filter(job => job.finishesAt > now);
  for (const mission of military.missions) {
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
  const military = advanceMilitary(previous, now); const definition = UNITS[command.unit];
  if (!definition) throw new Error('Unbekannter Einheitentyp.');
  if (!Number.isInteger(command.amount) || command.amount < 1 || command.amount > MILITARY_RULES.maxTrainingAmount) throw new Error('Ungültige Ausbildungsmenge.');
  if (typeof command.barracksSlotId !== 'string') throw new Error('Eine eigene Kaserne muss ausgewählt werden.');
  const barracks = city.militarySlots?.find(slot => slot.id === command.barracksSlotId && slot.building === 'barracks');
  if (!barracks) throw new Error('Eine eigene fertige Kaserne wird benötigt.');
  const barracksQueue = trainingQueueForBarracks(military, barracks.id);
  if (barracksQueue.length >= MILITARY_RULES.trainingQueueLength) throw new Error('Die Ausbildungswarteschlange dieser Kaserne ist voll.');
  if (city.constructionQueue.some(job => job.slotId === barracks.id)) throw new Error('Die Kaserne wird gerade ausgebaut.');
  for (const [resource, unitCost] of Object.entries(definition.cost)) if (city.resources[resource] < unitCost * command.amount) throw new Error('Nicht genügend Rohstoffe.');
  const nextCity = structuredClone(city);
  for (const [resource, unitCost] of Object.entries(definition.cost)) nextCity.resources[resource] -= unitCost * command.amount;
  const startsAt = barracksQueue.at(-1)?.finishesAt ?? now;
  const durationMs = Math.ceil(definition.baseDurationMs * command.amount / barracks.level);
  military.trainingQueue.push({ id: command.id, barracksSlotId: barracks.id, unit: command.unit, amount: command.amount, barracksLevel: barracks.level, startsAt, finishesAt: startsAt + durationMs });
  return { city: nextCity, military };
}

export function startScoutMission(previous, command, now, origin, target) {
  const military = advanceMilitary(previous, now); const general = military.generals.find(item => item.id === command.generalId);
  if (!general || general.status !== 'idle') throw new Error('Kein eigener freier General ausgewählt.');
  if (!Number.isInteger(command.scouts) || command.scouts < 1 || command.scouts > military.units.scout || command.scouts > general.leadership) throw new Error('Nicht genügend verfügbare Späher oder Führungskapazität.');
  if (!target || target.kind !== 'npc') throw new Error('Nur NPC-Städte können aufgeklärt werden.');
  const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
  const travelMs = Math.max(MILITARY_RULES.minimumTravelMs, Math.ceil(distance) * MILITARY_RULES.scoutTravelMsPerField);
  military.units.scout -= command.scouts; general.status = 'scouting';
  military.missions.push({ id: command.id, targetId: target.id, targetName: target.name, coordinates: { x: target.x, y: target.y }, generalId: general.id, generalName: general.name, scouts: command.scouts, status: 'outbound', startedAt: now, arrivesAt: now + travelMs, returnsAt: now + 2 * travelMs });
  return military;
}
