import { newCity, commanderScore } from './index.js';
import { newMilitary } from './military.js';
import { advanceSupplyHistory, refreshSupplyAt, settleSupplyAt } from './supply.js';
export const MAX_CITIES = 5;
const localMilitary = ['units', 'trainingQueue', 'mayorGeneralId'];
export function ownedCity(player, id) {
  const city = player.cities?.find(c => c.id === id);
  if (typeof id !== 'string' || !city) throw new Error('Unbekannte oder fremde cityId.');
  return city;
}
export function cityView(player, id) {
  const city = ownedCity(player, id);
  const { military: local, supply: localSupply, ...economy } = city;
  return { ...player, cityId: id, city: { ...economy, research: { ...player.research, active: player.research.active?.cityId === id ? player.research.active : null } }, supply: city.supply,
    military: { ...player.military, ...city.military, missions: player.military.missions.filter(m => m.originCityId === id) } };
}
export function exposeCity(player, id = player.cityId ?? player.cities?.[0]?.id) {
  const view = cityView(player, id);
  player.cityId = id; player.city = view.city; player.supply = view.supply;
  for (const key of localMilitary) player.military[key] = view.military[key];
  return player;
}
export function migrateCities(player, entities = []) {
  if (player.schemaVersion !== 15) return player;
  const id = entities.find(e => e.kind === 'player' && e.playerId === player.playerId)?.id ?? `city-${player.playerId}`;
  const city = player.city; city.id = id;
  city.military = Object.fromEntries(localMilitary.map(k => [k, player.military[k] ?? (k === 'mayorGeneralId' ? null : undefined)])); if (player.supply !== undefined) city.supply = player.supply;
  player.research = city.research;
  if (player.research.active) player.research.active.cityId = id;
  for (const mission of player.military.missions) mission.originCityId ??= id;
  delete city.research;
  player.cities = [city]; player.schemaVersion = 16;
  return exposeCity(player, id);
}
export function commitCity(player, view) {
  const index = player.cities.findIndex(c => c.id === view.cityId);
  if (index < 0) throw new Error('Unbekannte oder fremde cityId.');
  const { research, military: unused, supply: unusedSupply, ...city } = view.city;
  city.id = view.cityId;
  city.military = Object.fromEntries(localMilitary.map(k => [k, view.military[k]])); if (view.supply !== undefined) city.supply = view.supply; else delete city.supply;
  player.cities[index] = city; player.research.levels = research.levels;
  if (!player.research.active || player.research.active.cityId === view.cityId) player.research.active = research.active ? { ...research.active, cityId: view.cityId } : null;
  player.military = { ...view.military, missions: [...player.military.missions.filter(m => m.originCityId !== view.cityId), ...view.military.missions] };
  for (const key of localMilitary) delete player.military[key];
  for (const key of ['mailbox', 'processedCommands']) if (view[key]) player[key] = view[key];
  return player;
}
export function canonicalJSON(previous) {
  const player = structuredClone(previous);
  if (player.schemaVersion !== 16) return player;
  for (const mission of player.military.missions) mission.originCityId ??= player.cities[0].id;
  if (player.city) commitCity(player, { ...player, military: { ...player.military, missions: player.military.missions.filter(m => m.originCityId === player.cityId) } });
  delete player.city; delete player.supply; delete player.cityId;
  for (const city of player.cities) delete city.research;
  for (const key of localMilitary) delete player.military[key];
  return player;
}
export function advanceCities(previous, at, activatedAt, history, options = {}) {
  const player = canonicalJSON(previous), finishAt = player.research.active?.finishesAt;
  for (const boundary of [...new Set(finishAt <= at ? [finishAt, at] : [at])]) {
    // Take all views before finishing global research, so every local economy
    // accrues the pre-completion interval using the old research levels.
    const results = player.cities.map(city => advanceSupplyHistory(cityView(player, city.id), boundary, activatedAt, history, { ...options, deferLossAtEnd: boundary === finishAt || options.deferLossAtEnd }));
    const completed = results.find(v => v.city.id === player.research.active?.cityId);
    for (const view of results.filter(v => v !== completed)) commitCity(player, view);
    if (completed) commitCity(player, completed);
    if (boundary === finishAt && !(options.deferLossAtEnd && boundary === at)) for (const city of [...player.cities]) commitCity(player, settleSupplyAt(cityView(player, city.id), boundary));
  }
  return exposeCity(player, previous.cityId ?? player.cities[0].id);
}
function applyEach(previous, at, action) {
  const player = canonicalJSON(previous);
  for (const city of [...player.cities]) commitCity(player, action(cityView(player, city.id), at));
  return exposeCity(player, previous.cityId ?? player.cities[0].id);
}
export const refreshCities = (player, at) => applyEach(player, at, refreshSupplyAt);
export const settleCities = (player, at) => applyEach(player, at, settleSupplyAt);
export function playerScore(player) {
  const buildings = player.cities.reduce((sum, city) => sum + commanderScore(city).buildings, 0);
  const research = commanderScore({ ...player.cities[0], research: player.research }).research, combat = player.military.combatScore ?? 0;
  return { version: 3, buildings, research, combat, total: Math.max(0, buildings + research + combat) };
}
export function foundedCity(id, name, now) {
  const city = newCity(now), military = newMilitary('unused'); delete city.research;
  return { ...city, id, name, resources: { wood: 0, stone: 0, food: 0, oil: 0 }, military: Object.fromEntries(localMilitary.map(k => [k, military[k] ?? (k === 'mayorGeneralId' ? null : undefined)])) };
}

export function validateCities(player) {
  if (!Array.isArray(player.cities) || player.cities.length < 1 || player.cities.length > MAX_CITIES || new Set(player.cities.map(c => c.id)).size !== player.cities.length) throw new Error('Inkonsistente Stadtsammlung.');
  for (const city of player.cities) {
    if (typeof city.id !== 'string' || !city.id || !Array.isArray(city.constructionQueue) || !Array.isArray(city.military?.trainingQueue) || Object.values(city.resources ?? {}).some(n => !Number.isFinite(n) || n < 0) || ['wood','stone','food','oil'].some(k => !Number.isFinite(city.resources?.[k])) || ['infantry','scout','truck'].some(k => !Number.isSafeInteger(city.military?.units?.[k]) || city.military.units[k] < 0)) throw new Error('Inkonsistente Stadtbestände oder Queues.');
  }
  if (player.research.active) ownedCity(player, player.research.active.cityId);
  for (const mission of player.military.missions) ownedCity(player, mission.originCityId);
}
