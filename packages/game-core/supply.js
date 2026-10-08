import { advanceCity, buildingProductionRates, productionRates } from './index.js';
import { effectiveAttributes } from './military.js';

export const SUPPLY_RULES = Object.freeze({
  version: 'supply-1-provisional',
  upkeepPerSecond: Object.freeze({ infantry: 0.1, scout: 0.05 }),
  graceMs: 30 * 60_000,
  lossIntervalMs: 5 * 60_000,
  lossRate: 0.05,
  recoveryMs: 60_000,
  mayorLeadershipBonus: 0.01,
  mayorBonusCap: 0.5,
  maxEvents: 100,
});

export function mayorBonus(military) {
  const mayor = military.generals.find(general => general.id === military.mayorGeneralId);
  const leadership = mayor ? effectiveAttributes(mayor).leadership : 0;
  return mayor ? Math.min(SUPPLY_RULES.mayorBonusCap, Math.max(0, leadership) * SUPPLY_RULES.mayorLeadershipBonus) : 0;
}

export function livingUnitGroups(military) {
  const groups = Object.entries(military.units).map(([unit, amount]) => ({ id: `stationed:${unit}`, kind: 'stationed', unit, amount }));
  for (const mission of military.missions.filter(item => item.status === 'outbound' || item.status === 'returning')) {
    if (mission.type === 'raid') groups.push({ id: `mission:${mission.id}:infantry`, kind: 'mission', mission, unit: 'infantry', amount: mission.result?.survivors ?? mission.infantry });
    else groups.push({ id: `mission:${mission.id}:scout`, kind: 'mission', mission, unit: 'scout', amount: mission.scouts });
  }
  return groups.filter(group => group.amount > 0);
}

export function supplySummary(player) {
  const rules = player.supply?.rules ?? SUPPLY_RULES;
  const groups = livingUnitGroups(player.military);
  const unitCounts = Object.fromEntries(Object.keys(rules.upkeepPerSecond).map(unit => [unit,
    groups.filter(group => group.unit === unit).reduce((sum, group) => sum + group.amount, 0),
  ]));
  const upkeep = groups.reduce((sum, group) => sum + group.amount * (rules.upkeepPerSecond[group.unit] ?? 0), 0);
  const baseProduction = buildingProductionRates(player.city).food;
  const researchedProduction = productionRates(player.city).food;
  const researchProduction = researchedProduction - baseProduction;
  const bonus = mayorBonus(player.military);
  const production = researchedProduction * (1 + bonus);
  return { baseProduction, researchProduction, mayorBonus: bonus, mayorProduction: production - researchedProduction, production, upkeep, net: production - upkeep,
    units: groups.reduce((sum, group) => sum + group.amount, 0), unitCounts };
}

function normalizeSupply(player, activatedAt) {
  player.supply ??= { version: 1, activatedAt, updatedAt: Math.max(activatedAt, player.city.updatedAt), shortageMs: 0, recoveryStartedAt: null, nextLossAt: null, events: [] };
  player.supply.events ??= [];
  return player.supply;
}

function applyLossWave(player, at) {
  const rules = player.supply.cycleRules ?? player.supply.rules ?? SUPPLY_RULES;
  const groups = livingUnitGroups(player.military).filter(group => (player.supply.rules ?? SUPPLY_RULES).upkeepPerSecond[group.unit] > 0).sort((a, b) => a.id.localeCompare(b.id));
  const total = groups.reduce((sum, group) => sum + group.amount, 0);
  if (!total) return 0;
  const loss = Math.min(total, Math.max(1, Math.ceil(total * rules.lossRate)));
  const shares = groups.map(group => ({ group, loss: Math.floor(loss * group.amount / total), remainder: loss * group.amount / total % 1 }));
  let remaining = loss - shares.reduce((sum, share) => sum + share.loss, 0);
  shares.sort((a, b) => b.remainder - a.remainder || a.group.id.localeCompare(b.group.id));
  for (const share of shares) if (remaining-- > 0) share.loss += 1;
  const losses = {};
  for (const { group, loss: amount } of shares) {
    if (!amount) continue;
    losses[group.unit] = (losses[group.unit] ?? 0) + amount;
    if (group.kind === 'stationed') player.military.units[group.unit] -= amount;
    else if (group.unit === 'infantry') {
      if (group.mission.result) group.mission.result.survivors -= amount;
      else group.mission.infantry -= amount;
      group.mission.hungerLosses = (group.mission.hungerLosses ?? 0) + amount;
      const capacity = (group.mission.result?.survivors ?? group.mission.infantry) * 20;
      if (group.mission.result?.loadedFood > capacity) {
        group.mission.foodLostInTransit = (group.mission.foodLostInTransit ?? 0) + group.mission.result.loadedFood - capacity;
        group.mission.result.loadedFood = capacity;
      }
    } else { group.mission.scouts -= amount; group.mission.hungerLosses = (group.mission.hungerLosses ?? 0) + amount; }
  }
  player.supply.events.push({ id: `hunger-${at}`, at, type: 'hunger-loss', total: loss, losses });
  player.supply.events = player.supply.events.slice(-SUPPLY_RULES.maxEvents);
  return loss;
}

export function settleSupplyAt(previous, at) {
  const player = structuredClone(previous);
  const supply = player.supply;
  if (supply?.pendingLossAt !== at) return player;
  const summary = supplySummary(player);
  const shortage = player.city.resources.food <= 0 && summary.upkeep > summary.production && summary.units > 0;
  if (shortage) applyLossWave(player, at);
  supply.pendingLossAt = null;
  supply.inShortage = shortage;
  return player;
}

export function advanceSupply(previous, now, activatedAt = previous.supply?.activatedAt ?? now, { deferLossAtEnd = false, rules = previous.supply?.rules ?? SUPPLY_RULES } = {}) {
  const player = structuredClone(previous);
  const supply = normalizeSupply(player, activatedAt);
  supply.rules = structuredClone(rules);
  if (supply.shortageMs > 0) supply.cycleRules ??= structuredClone(rules);
  let cycleRules = supply.cycleRules ?? rules;
  let cursor = Math.max(supply.updatedAt, activatedAt);
  const until = Math.max(cursor, now);
  // A legacy city can predate supply activation: accrue its old economy without an upkeep adjustment.
  if (player.city.updatedAt < cursor) player.city = advanceCity(player.city, cursor);
  const previouslyDue = player.military.trainingQueue.filter(job => job.finishesAt <= cursor && !job.pausedForSupply);
  for (const job of previouslyDue) player.military.units[job.unit] += job.amount;
  player.military.trainingQueue = player.military.trainingQueue.filter(job => !previouslyDue.includes(job));
  supply.lossThresholdMs ??= supply.shortageMs < cycleRules.graceMs ? cycleRules.graceMs
    : cycleRules.graceMs + (Math.floor((supply.shortageMs - cycleRules.graceMs) / cycleRules.lossIntervalMs) + 1) * cycleRules.lossIntervalMs;
  while (cursor < until) {
    const summary = supplySummary(player);
    const shortage = player.city.resources.food <= 0 && summary.net < 0 && summary.units > 0;
    let boundary = until;
    const constructionAt = player.city.constructionQueue[0]?.finishesAt;
    if (constructionAt > cursor) boundary = Math.min(boundary, constructionAt);
    const trainingAt = !shortage ? Math.min(...player.military.trainingQueue.map(job => job.finishesAt).filter(at => at > cursor), Infinity) : Infinity;
    boundary = Math.min(boundary, trainingAt);
    const researchAt = player.city.research?.active?.finishesAt;
    if (researchAt > cursor) boundary = Math.min(boundary, researchAt);
    const depletionAt = !shortage && summary.net < 0 && player.city.resources.food > 0
      ? cursor + player.city.resources.food / -summary.net * 1000 : Infinity;
    boundary = Math.min(boundary, depletionAt);
    if (shortage) {
      if (!supply.cycleRules) { supply.cycleRules = structuredClone(rules); cycleRules = supply.cycleRules; supply.lossThresholdMs = cycleRules.graceMs; }
      supply.recoveryStartedAt = null;
      boundary = Math.min(boundary, cursor + Math.max(0, supply.lossThresholdMs - supply.shortageMs));
    } else if (supply.shortageMs > 0) {
      supply.recoveryStartedAt ??= cursor;
      boundary = Math.min(boundary, supply.recoveryStartedAt + cycleRules.recoveryMs);
    }
    const lossBoundary = shortage && boundary === cursor + Math.max(0, supply.lossThresholdMs - supply.shortageMs);
    const elapsed = Math.max(0, boundary - cursor);
    player.city = advanceCity(player.city, boundary, { food: summary.mayorProduction - summary.upkeep });
    // Absolute epoch timestamps cannot represent every fractional millisecond. At the
    // calculated depletion event the balance is zero, even when subtraction leaves
    // a tiny positive remainder whose next timestamp rounds back to the same cursor.
    if (boundary === depletionAt) player.city.resources.food = 0;
    if (shortage) {
      supply.shortageMs += elapsed;
      for (const job of player.military.trainingQueue) { job.startsAt += elapsed; job.finishesAt += elapsed; job.pausedForSupply = true; }
    } else for (const job of player.military.trainingQueue) job.pausedForSupply = false;
    cursor = boundary;
    if (!shortage && trainingAt === cursor) {
      const completed = player.military.trainingQueue.filter(job => job.finishesAt <= cursor);
      for (const job of completed) player.military.units[job.unit] += job.amount;
      player.military.trainingQueue = player.military.trainingQueue.filter(job => !completed.includes(job));
    }
    if (lossBoundary) {
      supply.shortageMs = supply.lossThresholdMs;
      supply.lossThresholdMs += cycleRules.lossIntervalMs;
      if (deferLossAtEnd && cursor === until) supply.pendingLossAt = cursor;
      else if (player.city.resources.food <= 0 && supplySummary(player).net < 0) applyLossWave(player, cursor);
    }
    if (!shortage && supply.recoveryStartedAt != null && cursor >= supply.recoveryStartedAt + cycleRules.recoveryMs) { supply.shortageMs = 0; supply.cycleRules = null; cycleRules = rules; supply.lossThresholdMs = rules.graceMs; supply.recoveryStartedAt = null; }

  }
  supply.updatedAt = until;
  const summary = supplySummary(player);
  supply.inShortage = player.city.resources.food <= 0 && summary.upkeep > summary.production && summary.units > 0;
  supply.nextLossAt = supply.inShortage ? until + Math.max(0, supply.lossThresholdMs - supply.shortageMs) : null;
  return player;
}

export function assignMayor(previous, generalId) {
  const military = structuredClone(previous);
  if (generalId != null && generalId === military.mayorGeneralId && military.generals.find(g => g.id === generalId)?.status === 'mayor') return military;
  if (generalId === null) {
    const current = military.generals.find(general => general.id === military.mayorGeneralId);
    if (current) { current.status = 'idle'; current.version += 1; }
    military.mayorGeneralId = null;
    return military;
  }
  const general = military.generals.find(candidate => candidate.id === generalId);
  if (!general || general.status !== 'idle' || military.researcherGeneralId === general.id || military.missions.some(m => m.generalId === general.id && m.status !== 'completed')) throw new Error('Nur ein eigener freier General kann Bürgermeister werden.');
  const current = military.generals.find(candidate => candidate.id === military.mayorGeneralId);
  if (current && current.id !== general.id) { current.status = 'idle'; current.version += 1; }
  general.status = 'mayor'; general.version += 1; military.mayorGeneralId = general.id;
  return military;
}

// Re-evaluate an instantaneous production change without consuming time or resetting hunger.
export function refreshSupplyAt(player, at) {
  const next = advanceSupply(player, at);
  const supply = next.supply;
  if (!supply.inShortage && supply.shortageMs > 0) supply.recoveryStartedAt ??= at;
  if (supply.inShortage) supply.recoveryStartedAt = null;
  for (const job of next.military.trainingQueue) job.pausedForSupply = supply.inShortage;
  return next;
}

// Saved history is the authority for elapsed intervals, including old journal/player snapshots.
export function advanceSupplyHistory(previous, now, activatedAt, history, options = {}) {
  let player = previous;
  const cursor = Math.max(previous.supply?.updatedAt ?? previous.city.updatedAt, activatedAt);
  for (const change of history.filter(item => item.effectiveAt > cursor && item.effectiveAt <= now)) {
    const old = history.filter(item => item.effectiveAt < change.effectiveAt).at(-1)?.rules ?? SUPPLY_RULES;
    player = advanceSupply(player, change.effectiveAt, activatedAt, { rules: old });
  }
  const rules = history.filter(item => item.effectiveAt <= Math.max(cursor, now)).at(-1)?.rules ?? SUPPLY_RULES;
  return advanceSupply(player, now, activatedAt, { ...options, rules });
}
