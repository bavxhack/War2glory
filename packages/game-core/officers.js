import { effectiveAttributes, normalizeGeneral, validateGeneralName } from './military.js';
import { randomPortraitId } from './portraits.js';

export const OFFICER_RULES = Object.freeze({ version: 'officers-1-provisional', maxCount: 3, wood: 500, stone: 500, exponent: 2, refreshMs: 86400000, leadershipPercent: 1, bonusCapPercent: 50 });
export const PROFILES = Object.freeze({ Organisator: { leadership: 20, attack: 5, defense: 5 }, Angreifer: { leadership: 10, attack: 15, defense: 5 }, Verteidiger: { leadership: 10, attack: 5, defense: 15 }, Allrounder: { leadership: 10, attack: 10, defense: 10 } });
const names = ['Alex', 'Robin', 'Kim', 'Charlie', 'Sam', 'Andrea', 'Sascha', 'Mika'];
export function normalizeOfficers(player) {
  const m = player.military;
  m.researcherGeneralId ??= null;
  m.rosterVersion ??= 1;
  m.roleVersion ??= 1;
  m.acquiredCount ??= m.generals.length;
  if (!Number.isSafeInteger(m.acquiredCount) || m.acquiredCount < m.generals.length || m.acquiredCount < 1) throw new Error('Inkonsistenter General-Erwerbszähler.');
  m.candidatePool ??= null;
  if (![m.rosterVersion, m.roleVersion].every(v => Number.isSafeInteger(v) && v > 0)) throw new Error('Inkonsistente General-Konfliktversion.');
  if (m.candidatePool && (m.candidatePool.version < 1 || !/^officers-1-/.test(m.candidatePool.ruleset) || !['open', 'consumed'].includes(m.candidatePool.state) || !Number.isFinite(m.candidatePool.expiresAt) || !(m.candidatePool.intervalMs > 0))) throw new Error('Unbekannte oder inkonsistente Bewerberpool-Version.');
  validateRoles(player);
  return player;
}
export function validateRoles(player) {
  const m = player.military;
  const roles = new Map();
  const bind = (id, status) => {
    if (!id) return;
    const g = m.generals.find(g => g.id === id && g.ownerId === player.playerId);
    if (!g || roles.has(id) || g.status !== status) throw new Error('Inkonsistente General-Rollenreferenz.');
    roles.set(id, status);
  };
  bind(m.mayorGeneralId, 'mayor'); bind(m.researcherGeneralId, 'researcher');
  for (const mission of m.missions.filter(x => x.status !== 'completed')) bind(mission.generalId, mission.type === 'raid' ? 'raiding' : 'scouting');
  for (const g of m.generals) if (g.status !== 'idle' && !roles.has(g.id)) throw new Error('Generalstatus ohne Rollenreferenz.');
  const bound = player.city.research?.active?.researcher?.generalId;
  if (bound && bound !== m.researcherGeneralId) throw new Error('Forschungsauftrag ohne zugehörige Generalbindung.');
}
export function recruitmentCost(k, rules = OFFICER_RULES) {
  if (!Number.isSafeInteger(k) || k < 1) throw new Error('Ungültige Preisstufe.');
  const power = BigInt(k) ** BigInt(rules.exponent);
  return Object.fromEntries(['wood', 'stone'].map(key => {
    const cost = BigInt(rules[key]) * power;
    if (cost > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Rekrutierungskosten überschreiten den sicheren Zahlenbereich.');
    return [key, Number(cost)];
  }));
}
export function hasBarracks(player) { return player.city.militarySlots.some(s => s.building === 'barracks' && s.level > 0); }
export function syncCandidates(player, now, rules = OFFICER_RULES, randomIndex, idFactory, intervalHistory = []) {
  normalizeOfficers(player);
  const m = player.military, old = m.candidatePool;
  if (!old && !hasBarracks(player)) return false;
  if (old && now < old.expiresAt) return false;
  // The old expiry is the first boundary of the new interval rules. Skip missed windows in O(1).
  let anchor = old?.expiresAt ?? player.city.officerEligibleAt ?? now;
  let intervalMs = old?.intervalMs ?? rules.refreshMs;
  let intervalRuleset = old?.intervalRuleset ?? old?.ruleset ?? rules.version;
  for (const entry of intervalHistory) {
    if (entry.effectiveAt > now) break;
    const boundary = anchor + Math.max(0, Math.ceil((entry.effectiveAt - anchor) / intervalMs)) * intervalMs;
    if (boundary > now) continue;
    anchor = boundary; intervalMs = entry.refreshMs; intervalRuleset = entry.version;
  }
  const createdAt = anchor + Math.floor((now - anchor) / intervalMs) * intervalMs;
  const profiles = Object.keys(PROFILES);
  const usedPortraits = m.generals.map(g => g.portraitId).filter(Boolean);
  const candidates = Array.from({ length: 3 }, () => {
    const profile = profiles.splice(randomIndex(profiles.length), 1)[0];
    const portraitId = randomPortraitId(randomIndex, usedPortraits); usedPortraits.push(portraitId);
    return { id: idFactory(), profile, name: names[randomIndex(names.length)], portraitId, attributes: { ...PROFILES[profile] } };
  });
  m.candidatePool = { id: idFactory(), version: 1, ruleset: rules.version, intervalRuleset, intervalMs, createdAt, expiresAt: createdAt + intervalMs, state: 'open', candidates };
  return true;
}
export function recruitQuote(player, candidateId, now, rules = OFFICER_RULES, checkAvailability = true) {
  const m = player.military, pool = m.candidatePool;
  const candidate = pool?.candidates.find(c => c.id === candidateId);
  if (!candidate || now >= pool.expiresAt || pool.state !== 'open') throw new Error('Bewerberauswahl ist abgelaufen oder verbraucht.');
  if (checkAvailability && (!hasBarracks(player) || m.generals.length >= rules.maxCount)) throw new Error('Fertige Kaserne benötigt oder General-Limit erreicht.');
  const cost = recruitmentCost(m.acquiredCount, rules);
  if (checkAvailability && Object.entries(cost).some(([r, n]) => player.city.resources[r] < n)) throw new Error('Nicht genügend Rohstoffe zur Rekrutierung.');
  let nextCost = null; try { nextCost = recruitmentCost(m.acquiredCount + 1, rules); } catch { /* Current purchase can still be safe. */ }
  return { poolId: pool.id, poolVersion: pool.version, candidateId, expiresAt: pool.expiresAt, acquiredCount: m.acquiredCount, rosterVersion: m.rosterVersion, rulesetVersion: rules.version, cost, nextCost };
}
export function recruitGeneral(previous, command, now, rules = OFFICER_RULES, idFactory) {
  const player = structuredClone(previous), m = player.military;
  const quote = recruitQuote(player, command.candidateId, now, rules);
  for (const key of ['poolId', 'poolVersion', 'expiresAt', 'acquiredCount', 'rosterVersion', 'rulesetVersion']) if (command[key] !== quote[key]) throw new Error('Rekrutierungsvorschau veraltet. Bitte erneut prüfen.');
  const c = m.candidatePool.candidates.find(c => c.id === command.candidateId);
  const name = validateGeneralName(command.name ?? c.name);
  const general = normalizeGeneral({ id: idFactory(), ownerId: player.playerId, name, portraitId: c.portraitId, level: 1, experience: 0, leadership: c.attributes.leadership, attributes: { ...c.attributes }, status: 'idle', acquisition: { ...quote, profile: c.profile, portraitId: c.portraitId, attributes: { ...c.attributes }, acquiredAt: now, paidCost: quote.cost } });
  for (const [r, n] of Object.entries(quote.cost)) player.city.resources[r] -= n;
  if (!Number.isSafeInteger(m.acquiredCount + 1)) throw new Error('Erwerbszähler überschreitet den sicheren Zahlenbereich.');
  m.generals.push(general); m.acquiredCount++; m.rosterVersion++; m.candidatePool.state = 'consumed'; m.candidatePool.version++;
  return player;
}
export function researcherSnapshot(military, rules = OFFICER_RULES) {
  const g = military?.generals.find(g => g.id === military.researcherGeneralId);
  if (!g) return { generalId: null, generalVersion: null, generalName: null, leadership: 0, bonusPercent: 0, roleVersion: military?.roleVersion ?? 1, officerRuleset: rules.version };
  const leadership = effectiveAttributes(g).leadership;
  return { generalId: g.id, generalVersion: g.version, generalName: g.name, leadership, bonusPercent: Math.min(rules.bonusCapPercent, Math.max(0, leadership) * rules.leadershipPercent), roleVersion: military.roleVersion ?? 1, officerRuleset: rules.version };
}
export function assignResearcher(previous, command) {
  const player = structuredClone(previous), m = player.military;
  validateRoles(player);
  if (player.city.research.active) throw new Error('Forschungsleitung während laufender Forschung gesperrt.');
  if (command.expectedRoleVersion !== m.roleVersion) throw new Error('Rollenstand veraltet.');
  if (command.generalId === m.researcherGeneralId) return player;
  const next = command.generalId == null ? null : m.generals.find(g => g.id === command.generalId && g.ownerId === player.playerId);
  if (command.generalId != null && (!next || next.status !== 'idle')) throw new Error('Eigener freier General benötigt.');
  if (next && !player.city.buildingSlots.some(s => s.building === 'university' && s.level > 0)) throw new Error('Fertige Universität benötigt.');
  const old = m.generals.find(g => g.id === m.researcherGeneralId);
  if (old) { old.status = 'idle'; old.version++; }
  if (next) { next.status = 'researcher'; next.version++; }
  m.researcherGeneralId = next?.id ?? null; m.roleVersion++;
  return player;
}
