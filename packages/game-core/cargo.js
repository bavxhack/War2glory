// Provisional project balance: every resource weighs one cargo slot.
export const CARGO_RULES = Object.freeze({ version: 'cargo-1-provisional', weights: Object.freeze({ wood: 1, stone: 1, food: 1, oil: 1 }) });
export const CARGO_RAID_RULESET = 'npc-pve-5-cargo-provisional';
export const CARGO_SCOUT_RULESET = 'npc-scout-3-cargo-provisional';
export const RESOURCE_ORDER = Object.keys(CARGO_RULES.weights);
const zero = () => Object.fromEntries(RESOURCE_ORDER.map(key => [key, 0]));

export function validateCargo(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !RESOURCE_ORDER.includes(key))) throw new Error('Unbekannte Ressourcenladung.');
  const cargo = zero();
  for (const key of RESOURCE_ORDER) {
    const value = input[key] ?? 0;
    if ((Object.hasOwn(input, key) && input[key] == null) || !Number.isSafeInteger(value) || value < 0) throw new Error(`${key}: Ladung muss eine nicht negative sichere Ganzzahl sein.`);
    cargo[key] = value;
  }
  cargoAmount(cargo);
  return cargo;
}
export function cargoAmount(cargo) {
  const total = RESOURCE_ORDER.reduce((sum, key) => sum + BigInt(cargo[key]), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Ressourcenladung überschreitet den sicheren Zahlenbereich.');
  return Number(total);
}
export function oneWayFuelMilli(units, distance, rates) {
  if (!Number.isSafeInteger(distance) || distance < 1) throw new Error('Ungültige Einsatzdistanz.');
  return BigInt(distance) * Object.entries(units).reduce((sum, [unit, count]) => {
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(rates[unit]) || rates[unit] <= 0) throw new Error(`Ungültige Menge/Ölrate für ${unit}.`);
    return sum + BigInt(count) * BigInt(rates[unit]);
  }, 0n);
}
export function goodsCapacity(capacity, reserveMilli) {
  const freeMilli = BigInt(capacity) * 1000n - reserveMilli;
  if (freeMilli < 0n) throw new Error('Rückwegreserve überschreitet die Überlebendenkapazität.');
  return Number(freeMilli / 1000n);
}
// Largest remainder allocation with stable wood/stone/food/oil ties.
export function retainCargo(cargo, capacity) {
  const total = cargoAmount(cargo);
  if (total <= capacity) return { retained: { ...cargo }, lost: zero() };
  const denominator = BigInt(total), slots = BigInt(capacity);
  const rows = RESOURCE_ORDER.map((key, index) => { const n = BigInt(cargo[key]) * slots; return { key, index, count: Number(n / denominator), remainder: n % denominator }; });
  let remaining = capacity - rows.reduce((sum, row) => sum + row.count, 0);
  rows.sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const row of rows) if (remaining-- > 0) row.count++;
  const retained = zero(), lost = zero();
  for (const row of rows) { retained[row.key] = row.count; lost[row.key] = cargo[row.key] - row.count; }
  return { retained, lost };
}
export function resolveCargoArrival(mission, capacity) {
  const originalMilli = BigInt(mission.fuelCalculation.oneWayMilli);
  const reserveMilli = oneWayFuelMilli(mission.units, mission.distanceFields, mission.logistics.oilMilliPerField);
  if (reserveMilli > originalMilli) throw new Error('Rückwegöl überschreitet das Startöl.');
  const goods = goodsCapacity(capacity, reserveMilli);
  const { retained, lost } = retainCargo(mission.cargo.initial, goods);
  mission.cargo.retained = retained; mission.cargo.lost = lost;
  mission.cargo.returnFuelMilli = reserveMilli.toString();
  mission.cargo.lostFuelMilli = (originalMilli - reserveMilli).toString();
  return { goodsCapacity: goods, lootCapacity: goods - cargoAmount(retained) };
}
// Derived from original times, never accumulated by ticks. Exact ratios are JSON safe.
export function operatingFuel(mission, now) {
  if (!mission.cargo) return null;
  const initialMilli = BigInt(mission.paidOil) * 1000n;
  const originalReturn = BigInt(mission.fuelCalculation.oneWayMilli);
  const outbound = initialMilli - originalReturn;
  let remainingNumerator, denominator, lost = 0n;
  if (mission.status === 'outbound') {
    denominator = BigInt(mission.arrivesAt - mission.startedAt);
    const elapsed = BigInt(Math.max(0, Math.min(Number(denominator), now - mission.startedAt)));
    remainingNumerator = initialMilli * denominator - outbound * elapsed;
  } else {
    const reserve = BigInt(mission.cargo.returnFuelMilli ?? originalReturn);
    lost = BigInt(mission.cargo.lostFuelMilli ?? '0');
    denominator = BigInt(mission.returnsAt - mission.arrivesAt);
    const elapsed = mission.status === 'completed' ? denominator : BigInt(Math.max(0, Math.min(Number(denominator), now - mission.arrivesAt)));
    remainingNumerator = reserve * (denominator - elapsed);
  }
  const burnedNumerator = (initialMilli - lost) * denominator - remainingNumerator;
  const oilDenominator = denominator * 1000n;
  return { loaded: mission.paidOil, burned: Number(burnedNumerator) / Number(oilDenominator), lost: Number(lost) / 1000, remaining: Number(remainingNumerator) / Number(oilDenominator),
    exact: { burnedNumerator: burnedNumerator.toString(), remainingNumerator: remainingNumerator.toString(), lostNumerator: (lost * denominator).toString(), denominator: oilDenominator.toString() } };
}
export function unloadCargo(mission, resources, capacities) {
  const storedOwn = zero(), overflowOwn = zero(), storedLoot = zero(), overflowLoot = zero();
  for (const key of RESOURCE_ORDER) {
    const free = Math.max(0, capacities[key] - resources[key]);
    storedOwn[key] = Math.min(free, mission.cargo.retained[key]);
    overflowOwn[key] = mission.cargo.retained[key] - storedOwn[key];
    resources[key] += storedOwn[key];
    const loot = key === 'food' ? mission.result?.loadedFood ?? 0 : 0;
    storedLoot[key] = Math.min(Math.max(0, capacities[key] - resources[key]), loot);
    overflowLoot[key] = loot - storedLoot[key];
    resources[key] += storedLoot[key];
  }
  mission.cargo.delivery = { storedOwn, overflowOwn, storedLoot, overflowLoot };
  return mission.cargo.delivery;
}

export function validateMissionCargo(mission) {
  const newVersion = [CARGO_RAID_RULESET, CARGO_SCOUT_RULESET, 'field-conquest-1-provisional', 'field-scout-1-provisional'].includes(mission.ruleset);
  if (!mission.cargo && !newVersion) return;
  if (!newVersion || mission.cargo?.version !== CARGO_RULES.version) throw new Error('Unbekannte oder fehlende Missionsfrachtversion.');
  const { initial, retained, lost } = mission.cargo;
  for (const cargo of [initial, retained, lost]) {
    validateCargo(cargo);
    if (!cargo || RESOURCE_ORDER.some(key => !Object.hasOwn(cargo, key))) throw new Error('Unvollständige Missionsladung.');
  }
  if (RESOURCE_ORDER.some(key => retained[key] + lost[key] !== initial[key])) throw new Error('Inkonsistente Missionsladungsbilanz.');
  const decimals = [mission.fuelCalculation?.oneWayMilli, mission.cargo.returnFuelMilli, mission.cargo.lostFuelMilli];
  if (decimals.some(value => typeof value !== 'string' || !/^\d{1,32}$/.test(value))) throw new Error('Ungültige gespeicherte Betriebsölgrundlage.');
  const [original, reserve, fuelLost] = decimals.map(BigInt);
  if (!Number.isSafeInteger(mission.paidOil) || mission.paidOil < 0 || original > BigInt(mission.paidOil) * 1000n || reserve + fuelLost !== original) throw new Error('Inkonsistente Betriebsölbilanz.');
  if (!['outbound', 'returning', 'completed'].includes(mission.status) || ![mission.startedAt, mission.arrivesAt, mission.returnsAt].every(Number.isSafeInteger) || mission.startedAt < 0 || mission.arrivesAt <= mission.startedAt || mission.returnsAt <= mission.arrivesAt) throw new Error('Inkonsistente Frachtmissionstermine.');
}
