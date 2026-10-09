import { isCoordinate, terrainAt } from './world.js';
import { MAX_CITIES, foundedCity, ownedCity } from './multicity.js';
import { missionQuote, startLogisticsMission } from './logistics.js';
export const SETTLEMENT_RULES = Object.freeze({ version: 'settlement-1-provisional', defenderMin: 5, defenderMax: 30, claimTtlMs: 86400000, cost: { wood: 500, stone: 500, food: 500 } });
export const FIELD_RAID_RULESET = 'field-conquest-1-provisional', FIELD_SCOUT_RULESET = 'field-scout-1-provisional';
export const fieldId = (world, x, y) => `field-${world.instanceId}-${x}-${y}`;
export function freeField(world, x, y) {
  if (!isCoordinate(world.map.config, x, y) || terrainAt(x, y, world.map.seed) === 'water') throw new Error('Nur freie Nicht-Wasser-Felder innerhalb der Welt sind gründbar.');
  if (world.map.entities.some(e => e.x === x && e.y === y)) throw new Error('Feld ist bereits besetzt oder reserviert.');
}
export function ensureField(world, x, y, rules, randomIndex) {
  freeField(world, x, y); const id = fieldId(world, x, y); world.fields ??= {};
  if (!world.fields[id]) {
    const originalDefenders = rules.defenderMin + randomIndex(rules.defenderMax - rules.defenderMin + 1);
    world.fields[id] = { id, x, y, revision: 1, originalDefenders, defenders: originalDefenders, claim: null };
  }
  return world.fields[id];
}
export function reservedSlot(player, world) {
  return player.military.missions.some(m => m.type === 'conquest' && m.status === 'outbound') || Object.values(world.fields ?? {}).some(f => f.claim?.playerId === player.playerId);
}
export function checkConquest(player, world, field, command) {
  if (player.cities.length >= MAX_CITIES) throw new Error('Maximal fünf eigene Städte erlaubt.');
  if (reservedSlot(player, world)) throw new Error('Bereits ein Eroberungszug oder ungenutzter Anspruch aktiv.');
  freeField(world, field.x, field.y);
  if (!player.military.reports.some(r => r.id === command.reportId && r.type === 'field-scout' && r.targetId === field.id && r.intelligence?.fieldRevision === field.revision)) throw new Error('Eigene abgeschlossene Aufklärung mit aktueller Feldrevision erforderlich.');
}
export function fieldMissionQuote(player, world, command, origin, field, rules, now) {
  const conquest = command.type === 'conquest';
  if (conquest) checkConquest(player, world, field, command); else freeField(world, field.x, field.y);
  const quote = missionQuote(player, { ...command, type: conquest ? 'raid' : 'scout' }, origin, { ...field, kind: 'npc', name: `Feld (${field.x}, ${field.y})` }, rules, now);
  return { ...quote, type: command.type, originCityId: origin.id, fieldRevision: field.revision, reportId: conquest ? command.reportId : null, projectedLootCapacity: 0 };
}
export function startFieldMission(player, world, command, now, origin, field, rules, settlementRules) {
  const quote = fieldMissionQuote(player, world, command, origin, field, rules, now);
  const binding = ({ previewAt, arrivesAt, returnsAt, ...rest }) => rest;
  if (!command.preview || JSON.stringify(binding(command.preview)) !== JSON.stringify(binding(quote))) throw new Error('Einsatzvorschau geändert. Bitte erneut prüfen.');
  const basic = { ...command, type: command.type === 'conquest' ? 'raid' : 'scout' }, target = { ...field, kind: 'npc', name: `Feld (${field.x}, ${field.y})` };
  const next = startLogisticsMission(player, { ...basic, preview: missionQuote(player, basic, origin, target, rules, now) }, now, origin, target, rules);
  Object.assign(next.military.missions.at(-1), { ...quote, ruleset: command.type === 'conquest' ? FIELD_RAID_RULESET : FIELD_SCOUT_RULESET, settlementRules: structuredClone(settlementRules) });
  return next;
}
export function expireClaims(world, at) {
  let changed = false;
  for (const field of Object.values(world.fields ?? {})) if (field.claim && at >= field.claim.expiresAt) {
    world.map.entities = world.map.entities.filter(e => e.id !== field.claim.id);
    field.claim = null; field.defenders = field.originalDefenders; field.revision++; world.map.revision++; changed = true;
  }
  return changed;
}
export function foundingQuote(player, world, claimId, now, rules) {
  const field = Object.values(world.fields ?? {}).find(f => f.claim?.id === claimId), claim = field?.claim;
  if (!claim || claim.playerId !== player.playerId) throw new Error('Unbekannter oder fremder Feldanspruch.');
  if (now >= claim.expiresAt) throw new Error('Feldanspruch abgelaufen.');
  if (player.cities.length >= MAX_CITIES) throw new Error('Maximal fünf eigene Städte erlaubt.');
  ownedCity(player, claim.originCityId);
  return { claimId, originCityId: claim.originCityId, fieldRevision: field.revision, cityCount: player.cities.length, expiresAt: claim.expiresAt, rulesetVersion: rules.version, cost: Object.fromEntries(Object.entries(rules.cost).map(([key, amount]) => [key, amount * player.cities.length])) };
}
export function validateCityName(value) {
  if (typeof value !== 'string' || /[\p{Cc}\p{Cf}]/u.test(value)) throw new Error('Stadtname: 1–40 Zeichen ohne Steuerzeichen.');
  const name = value.trim();
  if ([...name].length < 1 || [...name].length > 40) throw new Error('Stadtname: 1–40 Zeichen ohne Steuerzeichen.');
  return name;
}
export function foundCity(player, world, command, now, rules, idFactory) {
  const quote = foundingQuote(player, world, command.claimId, now, rules);
  if (JSON.stringify(command.preview) !== JSON.stringify(quote)) throw new Error('Gründungsvorschau veraltet. Bitte erneut prüfen.');
  const name = validateCityName(command.name), origin = ownedCity(player, quote.originCityId);
  if (Object.entries(quote.cost).some(([key, amount]) => origin.resources[key] < amount)) throw new Error('Nicht genügend Rohstoffe in der Ausgangsstadt für die Gründungsgebühr.');
  const field = Object.values(world.fields).find(f => f.claim?.id === command.claimId), city = foundedCity(`city-${idFactory()}`, name, now);
  for (const [key, amount] of Object.entries(quote.cost)) origin.resources[key] -= amount;
  world.map.entities = world.map.entities.filter(e => e.id !== field.claim.id);
  world.map.entities.push({ id: city.id, kind: 'player', playerId: player.playerId, commanderName: player.commanderName, name, x: field.x, y: field.y });
  field.claim = null; field.revision++; world.map.revision++; player.cities.push(city);
  return { cityId: city.id, quote };
}
