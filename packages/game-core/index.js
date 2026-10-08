import { newResearch, researchFactor, finishResearch, RESEARCH_RULES } from './research.js';
export const RULESET = 'prototype-0.5';
export const RESOURCE_KEYS = Object.freeze(['wood', 'stone', 'food']);
export const BUILDINGS = Object.freeze({
  sawmill: Object.freeze({ label: 'Sägewerk', resource: 'wood', area: 'civil' }),
  quarry: Object.freeze({ label: 'Steinbruch', resource: 'stone', area: 'civil' }),
  farm: Object.freeze({ label: 'Bauernhof', resource: 'food', area: 'civil' }),
  warehouse: Object.freeze({ label: 'Lagerhaus', resource: null, area: 'civil' }),
  university: Object.freeze({ label: 'Universität', resource: null, area: 'civil' }),
  barracks: Object.freeze({ label: 'Kaserne', resource: null, area: 'military' }),
});
export const STORAGE_RULES = Object.freeze({ baseCapacity: 2000, productionBuildingPerLevelAboveOne: 250, warehousePerLevel: 500, demolitionRefundRate: 0.1 });
export const CAPACITY = STORAGE_RULES.baseCapacity; // Compatibility for integrations using the former base-capacity constant.
export const MAX_LEVEL = 10;
export const MAX_QUEUE_LENGTH = 3;
export const BUILDING_SLOT_COUNT = 9;
export const MILITARY_SLOT_COUNT = 4;

const emptyInvestment = (complete = true) => ({ complete, paid: Object.fromEntries(RESOURCE_KEYS.map(resource => [resource, 0])) });
const slotId = index => `plot-${index + 1}`;
const buildingId = commandId => `building-${commandId}`;

export function newCity(now) {
  return {
    name: 'Gründerstadt', resources: { wood: 200, stone: 200, food: 200 },
    buildingSlots: Array.from({ length: BUILDING_SLOT_COUNT }, (_, index) => ({
      id: slotId(index), area: 'civil', building: index < 3 ? Object.keys(BUILDINGS)[index] : null,
      level: index < 3 ? 1 : 0, buildingId: index < 3 ? `initial-${slotId(index)}` : null,
      investment: index < 3 ? emptyInvestment() : null,
    })),
    militarySlots: Array.from({ length: MILITARY_SLOT_COUNT }, (_, index) => ({ id: `military-plot-${index + 1}`, area: 'military', building: null, level: 0, buildingId: null, investment: null })),
    research: newResearch(), constructionQueue: [], updatedAt: now,
  };
}

export function constructionQuote(level) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) throw new Error('Ungültige Gebäudestufe.');
  return { level, cost: { wood: 40 * level, stone: 30 * level }, durationMs: 5000 * level };
}

export function resourceCapacities(city) {
  const capacities = Object.fromEntries(RESOURCE_KEYS.map(resource => [resource, STORAGE_RULES.baseCapacity]));
  for (const slot of allSlots(city)) {
    if (!slot.building) continue;
    if (slot.building === 'warehouse') {
      for (const resource of RESOURCE_KEYS) capacities[resource] += STORAGE_RULES.warehousePerLevel * slot.level;
      continue;
    }
    const resource = BUILDINGS[slot.building]?.resource;
    if (resource) capacities[resource] += STORAGE_RULES.productionBuildingPerLevelAboveOne * Math.max(0, slot.level - 1);
  }
  for (const resource of RESOURCE_KEYS) capacities[resource] = Math.floor(capacities[resource] * researchFactor(city, 'logistics'));
  return capacities;
}

export function capacityBreakdown(city) {
  const totals = resourceCapacities(city);
  return Object.fromEntries(RESOURCE_KEYS.map(resource => [resource, {
    total: totals[resource], researchFactor: researchFactor(city, 'logistics'), base: STORAGE_RULES.baseCapacity,
    contributions: allSlots(city).filter(slot => slot.building && (slot.building === 'warehouse' || BUILDINGS[slot.building]?.resource === resource)).map(slot => ({
      slotId: slot.id, building: slot.building, level: slot.level,
      amount: slot.building === 'warehouse' ? STORAGE_RULES.warehousePerLevel * slot.level : STORAGE_RULES.productionBuildingPerLevelAboveOne * Math.max(0, slot.level - 1),
    })).filter(item => item.amount > 0),
  }]));
}

export function cityOffers(city) {
  const build = Object.fromEntries(Object.keys(BUILDINGS).map(building => [building, { ...constructionQuote(1), capacityAfter: quoteCapacity(city, null, building, 1) }]));
  const upgrade = Object.fromEntries(allSlots(city).filter(slot => slot.building && slot.level < MAX_LEVEL && !city.constructionQueue.some(job => job.slotId === slot.id)).map(slot => [slot.id, { ...constructionQuote(slot.level + 1), capacityAfter: quoteCapacity(city, slot, slot.building, slot.level + 1) }]));
  return { build, upgrade };
}

function quoteCapacity(city, currentSlot, building, level) {
  const copy = structuredClone(city);
  const slot = currentSlot ? allSlots(copy).find(item => item.id === currentSlot.id) : copy.buildingSlots.find(item => !item.building && !copy.constructionQueue.some(job => job.slotId === item.id));
  if (!slot) return resourceCapacities(copy);
  Object.assign(slot, { building, level });
  return resourceCapacities(copy);
}

function produce(city, until, rateAdjustments = {}) {
  const seconds = Math.max(0, until - city.updatedAt) / 1000;
  const capacities = resourceCapacities(city);
  const rates = productionRates(city);
  for (const resource of RESOURCE_KEYS) {
    const rate = rates[resource] + (rateAdjustments[resource] ?? 0);
    if (rate < 0) city.resources[resource] = Math.max(0, city.resources[resource] + seconds * rate);
    else if (city.resources[resource] < capacities[resource]) city.resources[resource] = Math.min(capacities[resource], city.resources[resource] + seconds * rate);
  }
  city.updatedAt = until;
}

function finishConstruction(city, job) {
  const slot = allSlots(city).find(candidate => candidate.id === job.slotId);
  if (job.type === 'build') {
    slot.building = job.building; slot.buildingId = job.buildingId; slot.investment = emptyInvestment();
  }
  slot.level = job.level;
  slot.investment ??= emptyInvestment(false);
  for (const resource of RESOURCE_KEYS) slot.investment.paid[resource] = (slot.investment.paid[resource] ?? 0) + (job.paidCost?.[resource] ?? 0);
  city.constructionQueue.shift();
}

export function advanceCity(previous, now, rateAdjustments = {}) {
  const city = structuredClone(previous); const until = Math.max(now, city.updatedAt);
  while (true) {
    const eventAt = Math.min(city.constructionQueue[0]?.finishesAt ?? Infinity, city.research?.active?.finishesAt ?? Infinity);
    if (eventAt > until) break;
    produce(city, Math.max(city.updatedAt, eventAt), rateAdjustments);
    while (city.constructionQueue[0]?.finishesAt <= eventAt) finishConstruction(city, city.constructionQueue[0]);
    finishResearch(city, eventAt);
  }
  produce(city, until, rateAdjustments); return city;
}

export function enqueueConstruction(previous, command, now) {
  const city = advanceCity(previous, now);
  if (city.constructionQueue.length >= MAX_QUEUE_LENGTH) throw new Error('Die Bauwarteschlange ist voll.');
  if (!command || typeof command.slotId !== 'string' || typeof command.building !== 'string') throw new Error('Bauplatz und Gebäudetyp werden benötigt.');
  if (!Object.hasOwn(BUILDINGS, command.building)) throw new Error('Unbekanntes Gebäude.');
  const slot = allSlots(city).find(candidate => candidate.id === command.slotId);
  if (!slot) throw new Error('Unbekannter Bauplatz.');
  if (BUILDINGS[command.building].area !== (slot.area ?? 'civil')) throw new Error('Dieses Gebäude ist auf diesem Baubereich nicht erlaubt.');
  if (city.constructionQueue.some(job => job.slotId === slot.id)) throw new Error('Für diesen Bauplatz ist bereits ein Auftrag vorgemerkt.');
  const isBuild = slot.building === null;
  if (!isBuild && slot.building !== command.building) throw new Error('Der Bauplatz ist bereits belegt.');
  const quote = constructionQuote(isBuild ? 1 : slot.level + 1);
  for (const [resource, amount] of Object.entries(quote.cost)) if (city.resources[resource] < amount) throw new Error('Nicht genügend Rohstoffe.');
  for (const [resource, amount] of Object.entries(quote.cost)) city.resources[resource] -= amount;
  const startsAt = city.constructionQueue.at(-1)?.finishesAt ?? city.updatedAt;
  city.constructionQueue.push({ id: command.id, type: isBuild ? 'build' : 'upgrade', slotId: slot.id, building: command.building,
    buildingId: isBuild ? buildingId(command.id) : slot.buildingId, level: quote.level, paidCost: structuredClone(quote.cost), startsAt, finishesAt: startsAt + quote.durationMs });
  return city;
}

export function buildingProductionRates(city) {
  const rates = Object.fromEntries(RESOURCE_KEYS.map(resource => [resource, 0]));
  for (const slot of allSlots(city)) if (slot.building && BUILDINGS[slot.building]?.resource) rates[BUILDINGS[slot.building].resource] += slot.level;
  return rates;
}

export function productionRates(city) {
  const rates = buildingProductionRates(city);
  for (const [resource, technology] of Object.entries({ wood: 'forestry', stone: 'masonry', food: 'agriculture' })) rates[resource] *= researchFactor(city, technology);
  return rates;
}

function demolitionVersion(slot) {
  return JSON.stringify([slot.id, slot.buildingId, slot.building, slot.level, slot.investment]);
}

export function demolitionPreview(previous, slotId, now) {
  const city = advanceCity(previous, now); const slot = allSlots(city).find(item => item.id === slotId);
  if (!slot?.building) throw new Error('Auf diesem Bauplatz steht kein fertiges Gebäude.');
  if (city.research?.active?.universityId === slot.buildingId) throw new Error('Diese Universität ist durch laufende Forschung belegt.');
  if (city.constructionQueue.some(job => job.slotId === slot.id)) throw new Error('Das Gebäude besitzt einen laufenden oder wartenden Bauauftrag.');
  const paid = slot.investment?.paid ?? {};
  const refund = Object.fromEntries(RESOURCE_KEYS.map(resource => [resource, Math.floor((paid[resource] ?? 0) * STORAGE_RULES.demolitionRefundRate)]));
  const next = structuredClone(city); const nextSlot = allSlots(next).find(item => item.id === slot.id);
  Object.assign(nextSlot, { building: null, level: 0, buildingId: null, investment: null });
  return { city, preview: { slotId, buildingId: slot.buildingId, building: slot.building, level: slot.level, version: demolitionVersion(slot), refund,
    investmentComplete: slot.investment?.complete === true, productionLoss: productionRates(city)[BUILDINGS[slot.building].resource] ? { resource: BUILDINGS[slot.building].resource, amount: productionRates(city)[BUILDINGS[slot.building].resource] - productionRates(next)[BUILDINGS[slot.building].resource] } : null,
    capacityBefore: resourceCapacities(city), capacityAfter: resourceCapacities(next), scoreBefore: commanderScore(city).total, scoreAfter: commanderScore(next).total } };
}

export function demolishBuilding(previous, command, now) {
  const { city, preview } = demolitionPreview(previous, command.slotId, now);
  if (command.buildingId !== preview.buildingId || command.version !== preview.version) throw new Error('Die Abrissvorschau ist veraltet. Bitte erneut prüfen.');
  const slot = allSlots(city).find(item => item.id === command.slotId);
  Object.assign(slot, { building: null, level: 0, buildingId: null, investment: null });
  for (const resource of RESOURCE_KEYS) city.resources[resource] += preview.refund[resource];
  return { city, result: preview };
}

export function allSlots(city) { return [...city.buildingSlots, ...(city.militarySlots ?? [])]; }
export function commanderScore(city) {
  const buildings = allSlots(city).reduce((score, slot) => score + (slot.building ? slot.level * 10 : 0), 0);
  const research = RESEARCH_RULES.pointsPerLevel * Object.values(city.research?.levels ?? {}).reduce((sum, level) => sum + level, 0);
  return { version: 2, total: Math.max(0, buildings + research), buildings, research, combat: null, defeatInfluence: null };
}
