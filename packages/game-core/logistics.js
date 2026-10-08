import { combatBonuses, effectiveAttributes, MILITARY_RULES, validateMissionUnits } from './military.js';

export const LOGISTICS_RULES = Object.freeze({ version: 'logistics-1-provisional', oilMilliPerField: Object.freeze({ infantry: 0, scout: 0, truck: 1000 }), cargoPerUnit: Object.freeze({ infantry: 20, scout: 0, truck: 200 }) });
export const LOGISTICS_RAID_RULESET = 'npc-pve-4-logistics-provisional';

// Legacy scalar missions are read only through this adapter. New missions have one authoritative inventory.
export function missionUnits(mission) {
  if (mission.units) return mission.units;
  return mission.type === 'raid' ? { infantry: mission.result?.survivors ?? mission.infantry } : { scout: mission.scouts };
}
export function cargoCapacity(units, cargo = LOGISTICS_RULES.cargoPerUnit) {
  return Object.entries(units).reduce((sum, [unit, amount]) => sum + amount * (cargo[unit] ?? 0), 0);
}
export function missionCapacity(mission) { return cargoCapacity(missionUnits(mission), mission.logistics?.cargoPerUnit); }
export function clampMissionCargo(mission) {
  const capacity = missionCapacity(mission);
  if (mission.result?.loadedFood > capacity) {
    mission.foodLostInTransit = (mission.foodLostInTransit ?? 0) + mission.result.loadedFood - capacity;
    mission.result.loadedFood = capacity;
  }
}
export function missionQuote(player, command, origin, target, rules = LOGISTICS_RULES) {
  const type = command.type;
  const units = type === 'raid' ? command.units ?? { infantry: command.infantry, truck: command.trucks ?? 0 } : { scout: command.scouts };
  if (!['raid', 'scout'].includes(type) || !units || Array.isArray(units) || Object.keys(units).some(key => !(type === 'raid' ? ['infantry', 'truck'] : ['scout']).includes(key))) throw new Error('Unbekannte Einsatztruppen.');
  validateMissionUnits(units);
  if (type === 'raid' && (!Number.isSafeInteger(units.infantry) || units.infantry < 1)) throw new Error('Mindestens ein Infanterist muss den Farmzug begleiten.');
  const military = player.military;
  const general = military.generals.find(g => g.id === command.generalId);
  if (!general || general.status !== 'idle' || military.mayorGeneralId === general.id || military.researcherGeneralId === general.id || military.missions.some(m => m.generalId === general.id && m.status !== 'completed')) throw new Error('Kein eigener freier General ausgewählt.');
  for (const [unit, amount] of Object.entries(units)) if (amount > (military.units[unit] ?? 0)) throw new Error('Nicht genügend verfügbare Truppen.');
  if (!origin || !target || target.kind !== 'npc') throw new Error('Nur eigene Einsätze gegen NPC-Städte sind erlaubt.');
  const distanceFields = Math.max(1, Math.ceil(Math.hypot(target.x - origin.x, target.y - origin.y)));
  const oneWayMilli = BigInt(distanceFields) * Object.entries(units).reduce((sum, [unit, amount]) => sum + BigInt(amount) * BigInt(rules.oilMilliPerField[unit]), 0n);
  const totalOil = Number((2n * oneWayMilli + 999n) / 1000n);
  if (!Number.isSafeInteger(totalOil)) throw new Error('Ölpreis überschreitet den sicheren Zahlenbereich.');
  if ((player.city.resources.oil ?? 0) < totalOil) throw new Error('Nicht genügend Öl für Hin- und Rückweg.');
  const upkeepPerHour = Object.entries(units).reduce((sum, [unit, amount]) => sum + amount * (player.supply?.rules.upkeepPerSecond[unit] ?? 0) * 3600, 0);
  return { type, targetId: target.id, generalId: general.id, generalVersion: general.version, units: { ...units },
    available: Object.fromEntries(Object.keys(units).map(unit => [unit, military.units[unit] ?? 0])),
    distanceFields, travelMs: Math.max(MILITARY_RULES.minimumTravelMs, distanceFields * MILITARY_RULES.scoutTravelMsPerField),
    totalOil, outboundOil: Number(oneWayMilli) / 1000, returnOil: Number(oneWayMilli) / 1000,
    logistics: structuredClone(rules), supplyVersion: player.supply?.rules.version, upkeepPerHour,
    capacity: cargoCapacity(units, rules.cargoPerUnit), effectiveAttributes: effectiveAttributes(general), combatBonuses: combatBonuses(general) };
}
export function startLogisticsMission(previous, command, now, origin, target, rules = LOGISTICS_RULES) {
  const quote = missionQuote(previous, command, origin, target, rules);
  if (JSON.stringify(command.preview) !== JSON.stringify(quote)) throw new Error('Einsatzvorschau geändert. Bitte erneut prüfen und bestätigen.');
  const player = structuredClone(previous);
  player.city.resources.oil -= quote.totalOil;
  for (const [unit, amount] of Object.entries(quote.units)) player.military.units[unit] -= amount;
  const general = player.military.generals.find(g => g.id === quote.generalId);
  general.status = quote.type === 'raid' ? 'raiding' : 'scouting'; general.version++;
  player.military.missions.push({ ...quote, id: command.id, ruleset: quote.type === 'raid' ? LOGISTICS_RAID_RULESET : 'npc-scout-2-logistics-provisional',
    initialUnits: { ...quote.units }, paidOil: quote.totalOil, targetName: target.name, coordinates: { x: target.x, y: target.y }, generalName: general.name,
    hungerLossesByUnit: {}, status: 'outbound', startedAt: now, arrivesAt: now + quote.travelMs, returnsAt: now + 2 * quote.travelMs });
  return player;
}
export function truckCombatLosses(trucks, infantryLosses, infantry) {
  if (!infantry) return 0;
  return Math.min(trucks, Number((BigInt(trucks) * BigInt(infantryLosses) + BigInt(infantry) - 1n) / BigInt(infantry)));
}
