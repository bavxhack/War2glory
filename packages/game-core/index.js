export const RULESET = 'prototype-0.2';
export const BUILDINGS = Object.freeze({
  sawmill: Object.freeze({ label: 'Sägewerk', resource: 'wood' }),
  quarry: Object.freeze({ label: 'Steinbruch', resource: 'stone' }),
  farm: Object.freeze({ label: 'Bauernhof', resource: 'food' }),
});
export const CAPACITY = 2000;
export const MAX_LEVEL = 10;
export const MAX_QUEUE_LENGTH = 3;
export const BUILDING_SLOT_COUNT = 9;

const slotId = index => `plot-${index + 1}`;

export function newCity(now) {
  return {
    name: 'Gründerstadt',
    resources: { wood: 200, stone: 200, food: 200 },
    buildingSlots: Array.from({ length: BUILDING_SLOT_COUNT }, (_, index) => ({
      id: slotId(index),
      building: index < 3 ? Object.keys(BUILDINGS)[index] : null,
      level: index < 3 ? 1 : 0,
    })),
    constructionQueue: [],
    updatedAt: now,
  };
}

export function constructionQuote(level) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new Error('Ungültige Gebäudestufe.');
  }
  return {
    level,
    cost: { wood: 40 * level, stone: 30 * level },
    durationMs: 5000 * level,
  };
}

export function cityOffers(city) {
  const build = Object.fromEntries(Object.keys(BUILDINGS).map(building => [building, constructionQuote(1)]));
  const upgrade = Object.fromEntries(city.buildingSlots
    .filter(slot => slot.building && slot.level < MAX_LEVEL && !city.constructionQueue.some(job => job.slotId === slot.id))
    .map(slot => [slot.id, constructionQuote(slot.level + 1)]));
  return { build, upgrade };
}

function produce(city, until) {
  const seconds = Math.max(0, until - city.updatedAt) / 1000;
  for (const slot of city.buildingSlots) {
    if (!slot.building) continue;
    const resource = BUILDINGS[slot.building].resource;
    city.resources[resource] = Math.min(CAPACITY, city.resources[resource] + seconds * slot.level);
  }
  city.updatedAt = until;
}

function finishConstruction(city, job) {
  const slot = city.buildingSlots.find(candidate => candidate.id === job.slotId);
  slot.building = job.building;
  slot.level = job.level;
  city.constructionQueue.shift();
}

// Pure transitions: wall-clock time is supplied by the authoritative server.
export function advanceCity(previous, now) {
  const city = structuredClone(previous);
  const until = Math.max(now, city.updatedAt);
  while (city.constructionQueue[0]?.finishesAt <= until) {
    const job = city.constructionQueue[0];
    produce(city, Math.max(city.updatedAt, job.finishesAt));
    finishConstruction(city, job);
  }
  produce(city, until);
  return city;
}

export function enqueueConstruction(previous, command, now) {
  const city = advanceCity(previous, now);
  if (city.constructionQueue.length >= MAX_QUEUE_LENGTH) throw new Error('Die Bauwarteschlange ist voll.');
  if (!command || typeof command.slotId !== 'string' || typeof command.building !== 'string') {
    throw new Error('Bauplatz und Gebäudetyp werden benötigt.');
  }
  if (!Object.hasOwn(BUILDINGS, command.building)) throw new Error('Unbekanntes Gebäude.');
  const slot = city.buildingSlots.find(candidate => candidate.id === command.slotId);
  if (!slot) throw new Error('Unbekannter Bauplatz.');
  if (city.constructionQueue.some(job => job.slotId === slot.id)) {
    throw new Error('Für diesen Bauplatz ist bereits ein Auftrag vorgemerkt.');
  }

  const isBuild = slot.building === null;
  if (!isBuild && slot.building !== command.building) throw new Error('Der Bauplatz ist bereits belegt.');
  const quote = constructionQuote(isBuild ? 1 : slot.level + 1);
  for (const [resource, amount] of Object.entries(quote.cost)) {
    if (city.resources[resource] < amount) throw new Error('Nicht genügend Rohstoffe.');
  }
  for (const [resource, amount] of Object.entries(quote.cost)) city.resources[resource] -= amount;

  const startsAt = city.constructionQueue.at(-1)?.finishesAt ?? city.updatedAt;
  city.constructionQueue.push({
    id: command.id,
    type: isBuild ? 'build' : 'upgrade',
    slotId: slot.id,
    building: command.building,
    level: quote.level,
    startsAt,
    finishesAt: startsAt + quote.durationMs,
  });
  return city;
}
