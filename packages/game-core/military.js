export const MILITARY_RULES = Object.freeze({
  trainingQueueLength: 3,
  maxTrainingAmount: 20,
  scoutTravelMsPerField: 5000,
  minimumTravelMs: 5000,
  firstScoutExperience: 10,
  maxGeneralLevel: 10,
});

export const UNITS = Object.freeze({
  scout: Object.freeze({ label: 'Späher', cost: { wood: 10, stone: 5, food: 5 }, baseDurationMs: 2000 }),
  infantry: Object.freeze({ label: 'Infanterie', cost: { wood: 15, stone: 10, food: 10 }, baseDurationMs: 3000 }),
});

export function generalLevel(experience) {
  let level = 1;
  while (level < MILITARY_RULES.maxGeneralLevel && experience >= 50 * (level + 1) * level) level += 1;
  return level;
}

export function newMilitary(playerId) {
  return { units: { scout: 0, infantry: 0 }, trainingQueue: [], generals: [{ id: `general-${playerId}`, name: 'General', level: 1, experience: 0, leadership: 20, status: 'idle' }], missions: [], reports: [], rewardedNpcIds: [] };
}

export function advanceMilitary(previous, now, npcById = new Map()) {
  const military = structuredClone(previous);
  while (military.trainingQueue[0]?.finishesAt <= now) {
    const job = military.trainingQueue.shift(); military.units[job.unit] += job.amount;
  }
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
      general.status = 'idle';
      if (!military.rewardedNpcIds.includes(mission.targetId)) {
        military.rewardedNpcIds.push(mission.targetId); general.experience += MILITARY_RULES.firstScoutExperience;
        general.level = generalLevel(general.experience); general.leadership = general.level * 20;
      }
      if (!military.reports.some(report => report.missionId === mission.id)) military.reports.push({ id: `report-${mission.id}`, missionId: mission.id, targetId: mission.targetId, targetName: mission.targetName, coordinates: mission.coordinates, capturedAt: mission.intelligence?.capturedAt, returnedAt: mission.returnsAt, intelligence: mission.intelligence });
    }
  }
  return military;
}

export function enqueueTraining(previous, city, command, now) {
  const military = advanceMilitary(previous, now); const definition = UNITS[command.unit];
  if (!definition) throw new Error('Unbekannter Einheitentyp.');
  if (!Number.isInteger(command.amount) || command.amount < 1 || command.amount > MILITARY_RULES.maxTrainingAmount) throw new Error('Ungültige Ausbildungsmenge.');
  if (military.trainingQueue.length >= MILITARY_RULES.trainingQueueLength) throw new Error('Die Ausbildungswarteschlange ist voll.');
  const barracksLevel = city.militarySlots?.find(slot => slot.building === 'barracks')?.level ?? 0;
  if (!barracksLevel) throw new Error('Eine fertige Kaserne wird benötigt.');
  for (const [resource, unitCost] of Object.entries(definition.cost)) if (city.resources[resource] < unitCost * command.amount) throw new Error('Nicht genügend Rohstoffe.');
  const nextCity = structuredClone(city);
  for (const [resource, unitCost] of Object.entries(definition.cost)) nextCity.resources[resource] -= unitCost * command.amount;
  const startsAt = military.trainingQueue.at(-1)?.finishesAt ?? now;
  const durationMs = Math.ceil(definition.baseDurationMs * command.amount / barracksLevel);
  military.trainingQueue.push({ id: command.id, unit: command.unit, amount: command.amount, barracksLevel, startsAt, finishesAt: startsAt + durationMs });
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
  military.missions.push({ id: command.id, targetId: target.id, targetName: target.name, coordinates: { x: target.x, y: target.y }, generalId: general.id, scouts: command.scouts, status: 'outbound', startedAt: now, arrivesAt: now + travelMs, returnsAt: now + 2 * travelMs });
  return military;
}
