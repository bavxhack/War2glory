import { OFFICER_RULES, researcherSnapshot } from './officers.js';
export const RESEARCH_RULES = Object.freeze({ version: 'research-4-engineering-provisional', maxLevel: 5, bonusPerLevel: 0.05,
  costPerLevel: 100, secondsPerLevel: 60, universitySpeedPerLevel: 0.1, pointsPerLevel: 10 });
const catalog = {
  forestry: Object.freeze({ label: 'Forstwirtschaft', resource: 'wood', maxLevel: 5, baseCost: 100, baseSeconds: 60, kind: 'production' }),
  masonry: Object.freeze({ label: 'Steinverarbeitung', resource: 'stone', maxLevel: 5, baseCost: 100, baseSeconds: 60, kind: 'production' }),
  agriculture: Object.freeze({ label: 'Landwirtschaft', resource: 'food', maxLevel: 5, baseCost: 100, baseSeconds: 60, kind: 'production' }),
  oilProcessing: Object.freeze({ label: 'Ölverarbeitung', kind: 'unlock', maxLevel: 1, universityLevel: 1, prerequisites: {}, baseCost: 300, baseSeconds: 120, unlocks: ['refinery'] }),
  motorization: Object.freeze({ label: 'Motorisierung', kind: 'unlock', maxLevel: 1, universityLevel: 2, prerequisites: { oilProcessing: 1, logistics: 1 }, baseCost: 500, baseSeconds: 240, unlocks: ['vehicleFactory', 'truck'] }),
  constructionEngineering: { label: 'Bautechnik', kind: 'constructionSpeed', maxLevel: 5, universityMinimum: 2, prerequisites: { masonry: 1 }, baseCost: 150, baseSeconds: 90 },
  trainingTechniques: { label: 'Ausbildungstechnik', kind: 'trainingSpeed', maxLevel: 5, universityMinimum: 2, prerequisites: {}, baseCost: 150, baseSeconds: 90 },
  loadingTechniques: { label: 'Ladetechnik', kind: 'cargo', maxLevel: 5, universityMinimum: 2, prerequisites: { logistics: 1 }, baseCost: 150, baseSeconds: 90 },
  logistics: Object.freeze({ label: 'Lagerlogistik', maxLevel: 5, baseCost: 100, baseSeconds: 60, kind: 'capacity' }),
};
export const TECHNOLOGIES = Object.freeze(Object.fromEntries(Object.entries(catalog).map(([id, d]) => [id, Object.freeze({ id, category: ['production', 'capacity', 'unlock'].includes(d.kind) ? 'Wirtschaft und Logistik' : 'Technik', prerequisites: {}, universityLevel: null, rulesetVersion: RESEARCH_RULES.version, ...d })])));
export function newResearch() { return { ruleset: RESEARCH_RULES.version, levels: Object.fromEntries(Object.keys(TECHNOLOGIES).map(key => [key, 0])), active: null }; }
export function normalizeResearch(city) {
  city.research ??= newResearch();
  city.research.levels ??= {};
  for (const id of Object.keys(city.research.levels)) if (!Object.hasOwn(TECHNOLOGIES, id)) throw new Error(`Unbekannte gespeicherte Technologie: ${id}.`);
  for (const key of Object.keys(TECHNOLOGIES)) {
    city.research.levels[key] ??= 0;
    if (!Number.isInteger(city.research.levels[key]) || city.research.levels[key] < 0 || city.research.levels[key] > TECHNOLOGIES[key].maxLevel) throw new Error('Inkonsistente Forschungsstufe.');
  }
  city.research.ruleset ??= RESEARCH_RULES.version;
  city.research.active ??= null;
  return city;
}
export function researchFactor(city, technology) { return TECHNOLOGIES[technology]?.kind === 'unlock' ? 1 : 1 + RESEARCH_RULES.bonusPerLevel * (city.research?.levels[technology] ?? 0); }
export function researchQuote(city, command, { checkAvailability = true, military, officerRules = OFFICER_RULES, effectRules = RESEARCH_EFFECT_RULES } = {}) {
  if (!command || !Object.hasOwn(TECHNOLOGIES, command.technology)) throw new Error('Unbekannte Technologie.');
  if (command.rulesetVersion !== RESEARCH_RULES.version) throw new Error('Die Forschungsregeln sind veraltet. Bitte erneut prüfen.');
  const definition = TECHNOLOGIES[command.technology];
  const currentLevel = city.research?.levels[command.technology] ?? 0;
  const targetLevel = currentLevel + 1;
  if (command.targetLevel !== targetLevel || targetLevel > definition.maxLevel) throw new Error('Die nächste Forschungsstufe ist nicht verfügbar.');
  if (checkAvailability && city.research?.active) throw new Error('In dieser Stadt läuft bereits eine Forschung.');
  const university = city.buildingSlots.find(slot => slot.buildingId === command.universityId && slot.building === 'university' && slot.level > 0);
  if (!university) throw new Error('Eine eigene fertige Universität wird benötigt.');
  const requiredUniversity = universityRequirement(definition, targetLevel);
  if (checkAvailability && university.level < requiredUniversity) throw new Error(`Universität Stufe ${requiredUniversity} erforderlich.`);
  for (const [key, level] of Object.entries(definition.prerequisites ?? {})) if (checkAvailability && (city.research?.levels[key] ?? 0) < level) throw new Error(`${TECHNOLOGIES[key].label} Stufe ${level} erforderlich.`);
  if (command.expectedUniversityLevel != null && command.expectedUniversityLevel !== university.level) throw new Error('Die Universität hat sich geändert. Bitte erneut prüfen.');
  const cost = { wood: definition.baseCost * targetLevel, stone: definition.baseCost * targetLevel };
  for (const [resource, amount] of Object.entries(cost)) if (checkAvailability && city.resources[resource] < amount) throw new Error('Nicht genügend Rohstoffe für Forschung.');
  const researcher = researcherSnapshot(military, officerRules);
  const universityFactor = 1 + RESEARCH_RULES.universitySpeedPerLevel * (university.level - 1);
  const durationWithoutGeneralMs = Math.ceil(definition.baseSeconds * targetLevel / universityFactor) * 1000;
  const durationMs = Math.max(1, Math.ceil(definition.baseSeconds * targetLevel / (universityFactor * (1 + researcher.bonusPercent / 100)))) * 1000;
  return { technology: command.technology, currentLevel, targetLevel, universityId: university.buildingId, expectedUniversityLevel: university.level,
    rulesetVersion: RESEARCH_RULES.version, cost, durationMs, durationWithoutGeneralMs, universityFactor, researcher, effectRules: structuredClone(effectRules), factorBefore: technologyFactor(city, command.technology, effectRules), factorAfter: definition.kind === 'unlock' ? 1 : 1 + technologyBonus(command.technology, effectRules) * targetLevel };
}
export function startResearch(previous, command, now, options = {}) {
  const city = normalizeResearch(structuredClone(previous));
  if (!Number.isFinite(now) || now !== city.updatedAt) throw new Error('Vor Forschungsstart muss die Stadtzeit abgerechnet sein.');
  if (!Number.isInteger(command.expectedUniversityLevel)) throw new Error('Universitätsstand der Vorschau wird benötigt.');
  const quote = researchQuote(city, command, options);
  if (command.effectRules && JSON.stringify(command.effectRules) !== JSON.stringify(quote.effectRules)) throw new Error('Forschungsregeln geändert. Bitte erneut prüfen.');
  if (options.military && JSON.stringify(command.researcher) !== JSON.stringify(quote.researcher)) throw new Error('Forschungsleitung oder Regeln geändert. Bitte erneut prüfen.');
  for (const [resource, amount] of Object.entries(quote.cost)) city.resources[resource] -= amount;
  city.research.active = { id: command.id, technology: quote.technology, targetLevel: quote.targetLevel, universityId: quote.universityId,
    universityLevel: quote.expectedUniversityLevel, paidCost: quote.cost, ruleset: quote.rulesetVersion, durationMs: quote.durationMs, durationWithoutGeneralMs: quote.durationWithoutGeneralMs, universityFactor: quote.universityFactor, researcher: quote.researcher, startsAt: now, finishesAt: now + quote.durationMs };
  return city;
}
export function finishResearch(city, at) {
  const job = city.research?.active;
  if (!job || job.finishesAt > at) return false;
  if (!['research-1-provisional', 'research-2-leadership-provisional', 'research-3-logistics-provisional', RESEARCH_RULES.version].includes(job.ruleset) || city.research.levels[job.technology] !== job.targetLevel - 1) throw new Error('Inkonsistenter Forschungsabschluss.');
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
    const reasons = researchBlockers(city, technology, options);
    return { technology, ...definition, reasons, level, nextLevel: level < definition.maxLevel ? level + 1 : null,
      category: definition.category, requiredUniversity: universityRequirement(definition, level + 1), prerequisites: definition.prerequisites, bonusPerLevel: technologyBonus(technology, options.effectRules), factor: technologyFactor(city, technology, options.effectRules), nextCost: level < definition.maxLevel ? { wood: definition.baseCost * (level + 1), stone: definition.baseCost * (level + 1) } : null, universities, reason: reasons.map(r => r.message).join(' ') || null };
  });
}

export const RESEARCH_EFFECT_RULES = Object.freeze({ version: 'research-effects-1-500-500-500', constructionBonusBps: 500, trainingBonusBps: 500, loadingBonusBps: 500 });
export function universityRequirement(definition, level) { return definition.universityLevel ?? Math.max(definition.universityMinimum ?? 1, level); }
export function technologyBonus(id, rules = RESEARCH_EFFECT_RULES) {
  const key = { constructionEngineering: 'constructionBonusBps', trainingTechniques: 'trainingBonusBps', loadingTechniques: 'loadingBonusBps' }[id];
  return key ? rules[key] / 10000 : TECHNOLOGIES[id]?.kind === 'unlock' ? 0 : RESEARCH_RULES.bonusPerLevel;
}
export function technologyFactor(city, id, rules = RESEARCH_EFFECT_RULES) { return 1 + (city.research?.levels[id] ?? 0) * technologyBonus(id, rules); }
export function workQuote(baseDurationMs, city, technology, rules = RESEARCH_EFFECT_RULES) {
  const level = city.research?.levels[technology] ?? 0;
  const bonusBps = rules[technology === 'constructionEngineering' ? 'constructionBonusBps' : 'trainingBonusBps'];
  const numerator = BigInt(baseDurationMs) * 10000n, denominator = 10000n + BigInt(bonusBps) * BigInt(level);
  return { durationMs: Math.max(1, Number((numerator + denominator - 1n) / denominator)), researchEffect: { rulesetVersion: rules.version, technology, level, bonusBps, durationWithoutResearchMs: baseDurationMs } };
}
export function loadingRules(base, city, rules = base.researchEffects ?? RESEARCH_EFFECT_RULES) {
  const level = city.research?.levels.loadingTechniques ?? 0;
  const cargoPerUnit = Object.fromEntries(Object.entries(base.cargoPerUnit).map(([id, capacity]) => [id, Number(BigInt(capacity) * (10000n + BigInt(rules.loadingBonusBps) * BigInt(level)) / 10000n)]));
  return { ...base, cargoPerUnit, loadingResearch: { rulesetVersion: rules.version, level, bonusBps: rules.loadingBonusBps, baseCargoPerUnit: { ...base.cargoPerUnit } } };
}
export function researchBlockers(city, technology, options = {}) {
  const d = TECHNOLOGIES[technology], target = (city.research?.levels[technology] ?? 0) + 1, reasons = [];
  const add = (code, message, details = {}) => reasons.push({ code, message, ...details });
  if (target > d.maxLevel) add('maximum', 'Maximale Stufe erreicht.');
  if (city.research?.active) add('active', 'Es läuft bereits eine spielerweite Forschung.');
  const required = universityRequirement(d, target);
  if (!city.buildingSlots.some(s => s.building === 'university' && s.level >= required)) add('university', `Universität Stufe ${required} erforderlich.`, { required });
  for (const [id, level] of Object.entries(d.prerequisites)) if ((city.research?.levels[id] ?? 0) < level) add('prerequisite', `${TECHNOLOGIES[id].label} Stufe ${level} erforderlich.`, { technology: id, level });
  for (const resource of ['wood', 'stone']) if (city.resources[resource] < d.baseCost * target) add('resources', `Nicht genügend ${resource === 'wood' ? 'Holz' : 'Stein'}.`, { resource, required: d.baseCost * target });
  if (options.military?.researcherGeneralId && options.cityId && options.military.generals.find(g => g.id === options.military.researcherGeneralId)?.cityId !== options.cityId) add('researcher', 'Forschungsleitung ist in einer anderen Stadt.');
  return reasons;
}
export function validateTechnologyCatalog(catalog = TECHNOLOGIES) {
  const visiting = new Set(), done = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error('Zyklus im Forschungskatalog.');
    if (done.has(id)) return;
    const d = catalog[id];
    if (!d || !Number.isInteger(d.maxLevel) || d.maxLevel < 1 || !(d.baseCost > 0) || !(d.baseSeconds > 0)) throw new Error('Ungültige Forschungsdefinition.');
    visiting.add(id);
    for (const [key, level] of Object.entries(d.prerequisites ?? {})) {
      if (!catalog[key] || !Number.isInteger(level) || level < 1 || level > catalog[key].maxLevel) throw new Error('Ungültige Forschungsvoraussetzung.');
      visit(key);
    }
    visiting.delete(id); done.add(id);
  }
  Object.keys(catalog).forEach(visit); return true;
}
validateTechnologyCatalog();
