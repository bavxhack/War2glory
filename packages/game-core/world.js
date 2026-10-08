export const WORLD_SCHEMA_VERSION = 3;
export const WORLD_CONFIG = Object.freeze({ width: 24, height: 24, npcCount: 18, maxViewport: 15 });
export const NPC_RULES = Object.freeze({ version: 'npc-pve-1-provisional', infantryPerDifficulty: 5, rebuildMs: 300_000 });

export function advanceNpc(npc, at) {
  if (npc.kind !== 'npc') return npc;
  const next = structuredClone(npc);
  const food = next.resources.food;
  const foodElapsed = Math.max(0, at - food.updatedAt);
  food.amount = Math.min(food.capacity, food.amount + food.regenerationPerHour * foodElapsed / 3_600_000);
  food.updatedAt = Math.max(food.updatedAt, at);
  const garrison = next.garrison;
  const elapsed = Math.max(0, at - garrison.updatedAt);
  if (garrison.amount >= garrison.capacity) {
    garrison.progressMs = 0;
  } else {
    const progress = (garrison.progressMs ?? 0) + elapsed;
    const rebuilt = Math.min(garrison.capacity - garrison.amount, Math.floor(progress / NPC_RULES.rebuildMs));
    garrison.amount += rebuilt;
    garrison.progressMs = garrison.amount >= garrison.capacity ? 0 : progress - rebuilt * NPC_RULES.rebuildMs;
  }
  garrison.updatedAt = Math.max(garrison.updatedAt, at);
  return next;
}

export function mapDistance(from, to) {
  if (![from?.x, from?.y, to?.x, to?.y].every(Number.isFinite)) throw new Error('Ungültige Koordinaten.');
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function terrainAt(x, y, seed) {
  let hash = seed;
  for (const character of `${x}:${y}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return hash % 11 < 2 ? 'forest' : hash % 13 === 0 ? 'hills' : hash % 17 === 0 ? 'water' : 'plains';
}

export function isCoordinate(config, x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < config.width && y < config.height;
}

export function randomFreeLocation(map, randomIndex) {
  if (typeof randomIndex !== 'function') throw new TypeError('Eine Zufallsfunktion wird benötigt.');
  const occupied = new Set(map.entities.map(entity => `${entity.x}:${entity.y}`));
  const available = [];
  for (let y = 0; y < map.config.height; y += 1) {
    for (let x = 0; x < map.config.width; x += 1) {
      if (!occupied.has(`${x}:${y}`) && terrainAt(x, y, map.seed) !== 'water') available.push({ x, y });
    }
  }
  if (available.length === 0) throw new Error('Die Weltkarte ist voll. Es ist kein Stadtfeld mehr frei.');
  const index = randomIndex(available.length);
  if (!Number.isInteger(index) || index < 0 || index >= available.length) throw new RangeError('Die Zufallsfunktion lieferte einen ungültigen Index.');
  return available[index];
}

export function publicMap(world, ownPlayerId, viewport) {
  const { config } = world.map;
  const width = viewport?.width ?? Math.min(config.maxViewport, config.width);
  const height = viewport?.height ?? Math.min(config.maxViewport, config.height);
  const x = viewport?.x ?? 0;
  const y = viewport?.y ?? 0;
  if (![x, y, width, height].every(Number.isInteger) || width < 1 || height < 1 ||
      width > config.maxViewport || height > config.maxViewport || !isCoordinate(config, x, y) ||
      !isCoordinate(config, x + width - 1, y + height - 1)) throw new Error('Ungültiger oder zu großer Kartenausschnitt.');
  const own = world.map.entities.find(entity => entity.kind === 'player' && entity.playerId === ownPlayerId);
  const entities = world.map.entities.filter(entity => entity.x >= x && entity.x < x + width && entity.y >= y && entity.y < y + height)
    .map(entity => ({ id: entity.id, type: entity.kind === 'npc' ? 'npc' : entity.playerId === ownPlayerId ? 'own-city' : 'player-city', name: entity.name,
      ...(entity.kind === 'player' ? { commanderName: entity.commanderName } : { difficulty: entity.difficulty }), x: entity.x, y: entity.y,
      distance: own ? mapDistance(own, entity) : null }));
  const terrain = [];
  for (let row = y; row < y + height; row += 1) for (let column = x; column < x + width; column += 1) terrain.push({ x: column, y: row, type: terrainAt(column, row, world.map.seed) });
  return { revision: world.map.revision, bounds: { width: config.width, height: config.height }, viewport: { x, y, width, height }, terrain, entities,
    ownCity: own ? { id: own.id, x: own.x, y: own.y } : null, distanceModel: 'euclidean-air-line' };
}
