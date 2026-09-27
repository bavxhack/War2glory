export const RULESET = 'prototype-0.1';
export const BUILDINGS = Object.freeze({
  sawmill: { label: 'Sägewerk', resource: 'wood' },
  quarry: { label: 'Steinbruch', resource: 'stone' },
  farm: { label: 'Bauernhof', resource: 'food' },
});
export const CAPACITY = 2000;
export const MAX_LEVEL = 10;

export function newCity(now) {
  return {
    name: 'Gründerstadt',
    resources: { wood: 200, stone: 200, food: 200 },
    buildings: { sawmill: 1, quarry: 1, farm: 1 },
    construction: null,
    updatedAt: now,
  };
}

export function upgradeQuote(city, building) {
  if (!Object.hasOwn(BUILDINGS, building)) throw new Error('Unbekanntes Gebäude.');
  const level = city.buildings[building] + 1;
  if (level > MAX_LEVEL) throw new Error('Maximale Stufe erreicht.');
  return { level, cost: { wood: 40 * level, stone: 30 * level }, durationMs: 5000 * level };
}

function produce(city, until) {
  const seconds = Math.max(0, until - city.updatedAt) / 1000;
  for (const [key, building] of Object.entries(BUILDINGS)) {
    city.resources[building.resource] = Math.min(CAPACITY,
      city.resources[building.resource] + seconds * city.buildings[key]);
  }
  city.updatedAt = until;
}

// Pure transitions: wall-clock time is supplied by the authoritative server.
export function advanceCity(previous, now) {
  const city = structuredClone(previous);
  const until = Math.max(now, city.updatedAt);
  if (city.construction && city.construction.finishesAt <= until) {
    produce(city, Math.max(city.updatedAt, city.construction.finishesAt));
    city.buildings[city.construction.building] = city.construction.level;
    city.construction = null;
  }
  produce(city, until);
  return city;
}

export function startUpgrade(previous, building, now) {
  const city = advanceCity(previous, now);
  if (city.construction) throw new Error('Es läuft bereits ein Bauauftrag.');
  const quote = upgradeQuote(city, building);
  for (const [resource, amount] of Object.entries(quote.cost)) {
    if (city.resources[resource] < amount) throw new Error('Nicht genügend Rohstoffe.');
  }
  for (const [resource, amount] of Object.entries(quote.cost)) city.resources[resource] -= amount;
  city.construction = { building, level: quote.level, finishesAt: city.updatedAt + quote.durationMs };
  return city;
}
