import { OFFICER_RULES, researcherSnapshot } from './officers.js';
export const RESEARCH_RULES = Object.freeze({ version: 'research-2-leadership-provisional', maxLevel: 5, bonusPerLevel: 0.05,
  costPerLevel: 100, secondsPerLevel: 60, universitySpeedPerLevel: 0.1, pointsPerLevel: 10 });
export const TECHNOLOGIES = Object.freeze({
  forestry: Object.freeze({ label: 'Forstwirtschaft', resource: 'wood', kind: 'production' }),
  masonry: Object.freeze({ label: 'Steinverarbeitung', resource: 'stone', kind: 'production' }),
  agriculture: Object.freeze({ label: 'Landwirtschaft', resource: 'food', kind: 'production' }),
  logistics: Object.freeze({ label: 'Lagerlogistik', kind: 'capacity' }),
});
export function newResearch() { return { ruleset: RESEARCH_RULES.version, levels: Object.fromEntries(Object.keys(TECHNOLOGIES).map(key => [key, 0])), active: null }; }
export function normalizeResearch(city) {
  city.research ??= newResearch();
  city.research.levels ??= {};
  for (const key of Object.keys(TECHNOLOGIES)) {
    city.research.levels[key] ??= 0;
    if (!Number.isInteger(city.research.levels[key]) || city.research.levels[key] < 0 || city.research.levels[key] > RESEARCH_RULES.maxLevel) throw new Error('Inkonsistente Forschungsstufe.');
  }
  city.research.ruleset ??= RESEARCH_RULES.version;
  city.research.active ??= null;
  return city;
}
export function researchFactor(city, technology) { return 1 + RESEARCH_RULES.bonusPerLevel * (city.research?.levels[technology] ?? 0); }
export function researchQuote(city, command, { checkAvailability = true, military, officerRules = OFFICER_RULES } = {}) {
  if (!command || !Object.hasOwn(TECHNOLOGIES, command.technology)) throw new Error('Unbekannte Technologie.');
  if (command.rulesetVersion !== RESEARCH_RULES.version) throw new Error('Die Forschungsregeln sind veraltet. Bitte erneut prüfen.');
  const currentLevel = city.research?.levels[command.technology] ?? 0;
  const targetLevel = currentLevel + 1;
  if (command.targetLevel !== targetLevel || targetLevel > RESEARCH_RULES.maxLevel) throw new Error('Die nächste Forschungsstufe ist nicht verfügbar.');
  if (checkAvailability && city.research?.active) throw new Error('In dieser Stadt läuft bereits eine Forschung.');
  const university = city.buildingSlots.find(slot => slot.buildingId === command.universityId && slot.building === 'university' && slot.level > 0);
  if (!university) throw new Error('Eine eigene fertige Universität wird benötigt.');
  if (checkAvailability && university.level < targetLevel) throw new Error(`Universität Stufe ${targetLevel} erforderlich.`);
  if (command.expectedUniversityLevel != null && command.expectedUniversityLevel !== university.level) throw new Error('Die Universität hat sich geändert. Bitte erneut prüfen.');
  const cost = { wood: RESEARCH_RULES.costPerLevel * targetLevel, stone: RESEARCH_RULES.costPerLevel * targetLevel };
  for (const [resource, amount] of Object.entries(cost)) if (checkAvailability && city.resources[resource] < amount) throw new Error('Nicht genügend Rohstoffe für Forschung.');
  const researcher = researcherSnapshot(military, officerRules);
  const universityFactor = 1 + RESEARCH_RULES.universitySpeedPerLevel * (university.level - 1);
  const durationWithoutGeneralMs = Math.ceil(RESEARCH_RULES.secondsPerLevel * targetLevel / universityFactor) * 1000;
  const durationMs = Math.max(1, Math.ceil(RESEARCH_RULES.secondsPerLevel * targetLevel / (universityFactor * (1 + researcher.bonusPercent / 100)))) * 1000;
  return { technology: command.technology, currentLevel, targetLevel, universityId: university.buildingId, expectedUniversityLevel: university.level,
    rulesetVersion: RESEARCH_RULES.version, cost, durationMs, durationWithoutGeneralMs, universityFactor, researcher, factorBefore: researchFactor(city, command.technology), factorAfter: 1 + RESEARCH_RULES.bonusPerLevel * targetLevel };
}
export function startResearch(previous, command, now, options = {}) {
  const city = normalizeResearch(structuredClone(previous));
  if (!Number.isFinite(now) || now !== city.updatedAt) throw new Error('Vor Forschungsstart muss die Stadtzeit abgerechnet sein.');
  if (!Number.isInteger(command.expectedUniversityLevel)) throw new Error('Universitätsstand der Vorschau wird benötigt.');
  const quote = researchQuote(city, command, options);
  if (options.military && JSON.stringify(command.researcher) !== JSON.stringify(quote.researcher)) throw new Error('Forschungsleitung oder Regeln geändert. Bitte erneut prüfen.');
  for (const [resource, amount] of Object.entries(quote.cost)) city.resources[resource] -= amount;
  city.research.active = { id: command.id, technology: quote.technology, targetLevel: quote.targetLevel, universityId: quote.universityId,
    universityLevel: quote.expectedUniversityLevel, paidCost: quote.cost, ruleset: quote.rulesetVersion, durationMs: quote.durationMs, durationWithoutGeneralMs: quote.durationWithoutGeneralMs, universityFactor: quote.universityFactor, researcher: quote.researcher, startsAt: now, finishesAt: now + quote.durationMs };
  return city;
}
export function finishResearch(city, at) {
  const job = city.research?.active;
  if (!job || job.finishesAt > at) return false;
  if (!['research-1-provisional', RESEARCH_RULES.version].includes(job.ruleset) || city.research.levels[job.technology] !== job.targetLevel - 1) throw new Error('Inkonsistenter Forschungsabschluss.');
  city.research.levels[job.technology] = job.targetLevel;
  city.research.active = null;
  return true;
}
export function researchOffers(city, options = {}) {
  return Object.entries(TECHNOLOGIES).map(([technology, definition]) => {
    const level = city.research?.levels[technology] ?? 0;
    const universities = city.buildingSlots.filter(slot => slot.building === 'university' && slot.level > 0).map(slot => {
      const command = { technology, targetLevel: level + 1, universityId: slot.buildingId, rulesetVersion: RESEARCH_RULES.version };
      let quote = null;
      try { quote = researchQuote(city, command, { ...options, checkAvailability: false }); researchQuote(city, command, options); return { universityId: slot.buildingId, slotId: slot.id, quote }; }
      catch (error) { return { universityId: slot.buildingId, slotId: slot.id, quote, reason: error.message }; }
    });
    return { technology, ...definition, level, nextLevel: level < RESEARCH_RULES.maxLevel ? level + 1 : null,
      factor: researchFactor(city, technology), nextCost: level < RESEARCH_RULES.maxLevel ? { wood: RESEARCH_RULES.costPerLevel * (level + 1), stone: RESEARCH_RULES.costPerLevel * (level + 1) } : null, universities, reason: !universities.length ? 'Zuerst eine Universität errichten.' : null };
  });
}
