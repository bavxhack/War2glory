import { CARGO_RULES, CARGO_RAID_RULESET, CARGO_SCOUT_RULESET, validateCargo, cargoAmount, oneWayFuelMilli, goodsCapacity } from './cargo.js';
import { combatBonuses, effectiveAttributes, MILITARY_RULES, validateMissionUnits } from './military.js';

export const LOGISTICS_RULES = Object.freeze({ version: 'fuel-3-cargo-ratio-provisional', scoutFuelCapacity: 20, cargoRules: CARGO_RULES, maxAttackDelayMinutes: 1440, oilMilliPerField: Object.freeze({ infantry: 100, scout: 200, truck: 1000 }), cargoPerUnit: Object.freeze({ infantry: 20, scout: 0, truck: 200 }) });
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
export function missionTimes(startedAt, travelMs, delayMinutes) {
  if (!Number.isSafeInteger(travelMs) || travelMs <= 0 || !Number.isSafeInteger(delayMinutes) || delayMinutes < 0 || delayMinutes > 10080) throw new Error('Ungültige Einsatzdauer.');
  const arrivesAt = startedAt + travelMs + delayMinutes * 60_000;
  const returnsAt = arrivesAt + travelMs;
  if (![startedAt, travelMs, arrivesAt, returnsAt].every(Number.isSafeInteger) || startedAt < 0 || returnsAt > 8_640_000_000_000_000) throw new Error('Ungültige oder zu große Einsatzzeit.');
  return { arrivesAt, returnsAt };
}

// Exact rational fuel arithmetic; decimal display values are never used for payment.
export function fuelPlan(oneWayMilli, travelMs, delayMinutes) {
  if (typeof oneWayMilli !== 'bigint' || oneWayMilli < 0n || !Number.isSafeInteger(travelMs) || travelMs <= 0 || !Number.isSafeInteger(delayMinutes) || delayMinutes < 0 || delayMinutes > 10080) throw new Error('Ungültige Kraftstoffgrundlage.');
  const delayMs = delayMinutes * 60_000;
  const denominator = 1000n * BigInt(travelMs);
  const numerator = oneWayMilli * (2n * BigInt(travelMs) + BigInt(delayMs));
  const totalOil = Number((numerator + denominator - 1n) / denominator);
  if (!Number.isSafeInteger(totalOil)) throw new Error('Ölpreis überschreitet den sicheren Zahlenbereich.');
  return { totalOil, baseOil: Number(2n * oneWayMilli) / 1000, normalOneWayOil: Number(oneWayMilli) / 1000,
    delayOil: Number(oneWayMilli * BigInt(delayMs)) / Number(denominator),
    outboundOil: Number(oneWayMilli * (BigInt(travelMs) + BigInt(delayMs))) / Number(denominator), returnOil: Number(oneWayMilli) / 1000,
    fuelCalculation: { oneWayMilli: oneWayMilli.toString(), numerator: numerator.toString(), denominator: denominator.toString() } };
}

export function missionQuote(player, command, origin, target, rules = LOGISTICS_RULES, now = player.city.updatedAt) {
  const type = command.type;
  const delayMinutes = command.delayMinutes === undefined ? 0 : command.delayMinutes;
  if (!Number.isSafeInteger(delayMinutes) || delayMinutes < 0 || delayMinutes > rules.maxAttackDelayMinutes) throw new Error(`Zusatzverzögerung: ganze Minuten zwischen 0 und ${rules.maxAttackDelayMinutes} erforderlich.`);
  if (type === 'scout' && delayMinutes > 0) throw new Error('Aufklärung unterstützt keine Zusatzverzögerung.');
  const units = type === 'raid' ? command.units ?? { infantry: command.infantry, truck: command.trucks ?? 0 } : { scout: command.scouts };
  if (!['raid', 'scout'].includes(type) || !units || Array.isArray(units) || Object.keys(units).some(key => !(type === 'raid' ? ['infantry', 'truck'] : ['scout']).includes(key))) throw new Error('Unbekannte Einsatztruppen.');
  validateMissionUnits(units);
  for (const unit of Object.keys(units)) if (!Number.isSafeInteger(rules.oilMilliPerField[unit]) || rules.oilMilliPerField[unit] <= 0) throw new Error(`Positive Ölrate für ${unit} erforderlich.`);
  if (type === 'raid' && (!Number.isSafeInteger(units.infantry) || units.infantry < 1)) throw new Error('Mindestens ein Infanterist muss den Farmzug begleiten.');
  const military = player.military;
  const general = military.generals.find(g => g.id === command.generalId);
  if (!general || general.status !== 'idle' || military.mayorGeneralId === general.id || military.researcherGeneralId === general.id || military.missions.some(m => m.generalId === general.id && m.status !== 'completed')) throw new Error('Kein eigener freier General ausgewählt.');
  for (const [unit, amount] of Object.entries(units)) if (amount > (military.units[unit] ?? 0)) throw new Error('Nicht genügend verfügbare Truppen.');
  if (!origin || !target || target.kind !== 'npc') throw new Error('Nur eigene Einsätze gegen NPC-Städte sind erlaubt.');
  const distanceFields = Math.max(1, Math.ceil(Math.hypot(target.x - origin.x, target.y - origin.y)));
  if (!Number.isSafeInteger(distanceFields)) throw new Error('Ungültige Einsatzdistanz.');
  const oneWayMilli = oneWayFuelMilli(units, distanceFields, rules.oilMilliPerField);
  const travelMs = Math.max(MILITARY_RULES.minimumTravelMs, distanceFields * MILITARY_RULES.scoutTravelMsPerField);
  const times = missionTimes(now, travelMs, delayMinutes);
  const delayMs = delayMinutes * 60_000;
  const fuel = fuelPlan(oneWayMilli, travelMs, delayMinutes);
  const ownCargo = validateCargo(command.cargo);
  const ownCargoAmount = cargoAmount(ownCargo);
  const capacity = cargoCapacity(units, rules.cargoPerUnit);
  const startOccupancy = ownCargoAmount + fuel.totalOil;
  if (!Number.isSafeInteger(startOccupancy)) throw new Error('Startladung überschreitet den sicheren Zahlenbereich.');
  if (type === 'scout') {
    if (ownCargoAmount) throw new Error('Späher haben keine Gütertraglast; ihre Tanks sind ausschließlich für Betriebsöl.');
    if (!Number.isSafeInteger(rules.scoutFuelCapacity) || rules.scoutFuelCapacity < 1) throw new Error('Ungültige Spähertankkapazität.');
    if (fuel.totalOil > units.scout * rules.scoutFuelCapacity) throw new Error('Spähertankkapazität zu klein für das gesamte Betriebsöl.');
  } else {
    for (const [unit, amount] of Object.entries(units)) if (amount > 0 && BigInt(distanceFields) * BigInt(rules.oilMilliPerField[unit]) > BigInt(rules.cargoPerUnit[unit]) * 1000n) throw new Error(`Rückwegreserve für ${unit} zu groß: Öl je Einheit überschreitet deren Traglast.`);
    if (startOccupancy > capacity) throw new Error(`Ladung zu schwer: eigene Güter und Betriebsöl belegen ${startOccupancy} von ${capacity} Plätzen.`);
  }
  for (const [resource, amount] of Object.entries(ownCargo)) if ((player.city.resources[resource] ?? 0) < amount + (resource === 'oil' ? fuel.totalOil : 0)) throw new Error(resource === 'oil' ? 'Nicht genügend Öl in der Stadt für freiwillige Ölladung und Betriebsöl für Hin- und Rückweg.' : `Nicht genügend ${resource} für eigene Ladung.`);
  const upkeepPerHour = Object.entries(units).reduce((sum, [unit, amount]) => sum + amount * (player.supply?.rules.upkeepPerSecond[unit] ?? 0) * 3600, 0);
  const upkeepBeforePerHour = Object.entries(military.units).reduce((sum, [unit, amount]) => sum + amount * (player.supply?.rules.upkeepPerSecond[unit] ?? 0) * 3600, 0);
  return { type, targetId: target.id, generalId: general.id, generalVersion: general.version, units: { ...units },
    available: Object.fromEntries(Object.keys(units).map(unit => [unit, military.units[unit] ?? 0])),
    distanceFields, travelMs, delayMinutes, delayMs: delayMinutes * 60_000,
    previewAt: now, ...times, outboundTravelMs: travelMs + delayMs,
    ...fuel,
    upkeepBeforePerHour, upkeepAfterPerHour: Math.max(0, upkeepBeforePerHour - upkeepPerHour),
    logistics: structuredClone(rules), supplyVersion: player.supply?.rules.version, upkeepPerHour,
    capacity, ownCargo, ownCargoAmount, startOccupancy, freeStartCapacity: type === 'raid' ? capacity - startOccupancy : 0,
    tankCapacity: type === 'scout' ? units.scout * rules.scoutFuelCapacity : 0,
    outboundConsumption: fuel.totalOil - fuel.returnOil, returnReserve: fuel.returnOil,
    projectedLootCapacity: type === 'raid' ? goodsCapacity(capacity, oneWayMilli) - ownCargoAmount : 0,
    effectiveAttributes: effectiveAttributes(general), combatBonuses: combatBonuses(general) };
}
export function startLogisticsMission(previous, command, now, origin, target, rules = LOGISTICS_RULES) {
  const quote = missionQuote(previous, command, origin, target, rules, now);
  // Absolute preview times move with server departure time; every other visible value is bound.
  const binding = ({ previewAt, arrivesAt, returnsAt, ...values }) => values;
  if (!command.preview || JSON.stringify(binding(command.preview)) !== JSON.stringify(binding(quote))) throw new Error('Einsatzvorschau geändert. Bitte erneut prüfen und bestätigen.');
  const player = structuredClone(previous);
  player.city.resources.oil -= quote.totalOil;
  for (const [resource, amount] of Object.entries(quote.ownCargo)) player.city.resources[resource] -= amount;
  for (const [unit, amount] of Object.entries(quote.units)) player.military.units[unit] -= amount;
  const general = player.military.generals.find(g => g.id === quote.generalId);
  general.status = quote.type === 'raid' ? 'raiding' : 'scouting'; general.version++;
  player.military.missions.push({ ...quote, id: command.id, ruleset: quote.type === 'raid' ? CARGO_RAID_RULESET : CARGO_SCOUT_RULESET,
    cargo: { version: CARGO_RULES.version, initial: { ...quote.ownCargo }, retained: { ...quote.ownCargo }, lost: { wood: 0, stone: 0, food: 0, oil: 0 }, returnFuelMilli: quote.fuelCalculation.oneWayMilli, lostFuelMilli: '0' },
    initialUnits: { ...quote.units }, paidOil: quote.totalOil, targetName: target.name, coordinates: { x: target.x, y: target.y }, generalName: general.name,
    hungerLossesByUnit: {}, status: 'outbound', startedAt: now, ...missionTimes(now, quote.travelMs, quote.delayMinutes) });
  return player;
}
export function truckCombatLosses(trucks, infantryLosses, infantry) {
  if (!infantry) return 0;
  return Math.min(trucks, Number((BigInt(trucks) * BigInt(infantryLosses) + BigInt(infantry) - 1n) / BigInt(infantry)));
}
