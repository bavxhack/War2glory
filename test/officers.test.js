import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newCity, advanceCity, enqueueConstruction } from '../packages/game-core/index.js';
import { newMilitary, applySkillConversion, applySkillDistribution, effectiveAttributes, combatBonuses, startRaidMission, resolveMissionCombat, MILITARY_RULES } from '../packages/game-core/military.js';
import { assignMayor } from '../packages/game-core/supply.js';
import { assignResearcher, normalizeOfficers, OFFICER_RULES, recruitGeneral, recruitQuote, recruitmentCost, syncCandidates } from '../packages/game-core/officers.js';
import { RESEARCH_RULES, researchQuote, startResearch } from '../packages/game-core/research.js';
import { parseConfiguration, loadConfiguration } from '../apps/server/config.js';
import { WorldStorage } from '../apps/server/storage.js';

let sequence = 0;
const id = () => `test-id-${++sequence}`;
const random = () => 0;
function fixture() {
  const p = { playerId: 'p', city: newCity(0), military: newMilitary('p') };
  p.city.resources = { wood: 20000, stone: 20000, food: 1000 };
  Object.assign(p.city.militarySlots[0], { building: 'barracks', level: 1 });
  Object.assign(p.city.buildingSlots[3], { building: 'university', buildingId: 'uni', level: 2 });
  normalizeOfficers(p); syncCandidates(p, 0, OFFICER_RULES, random, id);
  return p;
}
function purchase(p, now = 0, index = 0, rules = OFFICER_RULES) {
  return recruitGeneral(p, { ...recruitQuote(p, p.military.candidatePool.candidates[index].id, now, rules), name: '  Zoë 🦊  ' }, now, rules, id);
}
const researchCommand = { id: 'job', technology: 'forestry', targetLevel: 2, universityId: 'uni', expectedUniversityLevel: 2, rulesetVersion: RESEARCH_RULES.version };

test('independent prices, one purchase per pool, constant budget and acquired counter', () => {
  for (const [k, amount] of [[1, 500], [2, 2000], [3, 4500], [4, 8000]]) assert.deepEqual(recruitmentCost(k), { wood: amount, stone: amount });
  assert.throws(() => recruitmentCost(Number.MAX_SAFE_INTEGER), /sicheren/);
  let p = fixture(); const before = structuredClone(p);
  const profiles = p.military.candidatePool.candidates.map(c => c.profile);
  assert.equal(new Set(profiles).size, 3);
  for (const c of p.military.candidatePool.candidates) assert.equal(Object.values(c.attributes).reduce((a, b) => a + b), 30);
  p = purchase(p); assert.equal(p.city.resources.wood, 19500); assert.equal(p.military.acquiredCount, 2);
  assert.equal(p.military.generals[1].name, 'Zoë 🦊'); assert.equal(p.military.generals[1].experience, 0);
  assert.equal(p.military.generals[1].skills.totalPoints, 0);
  assert.deepEqual(p.military.generals[1].attributes, before.military.candidatePool.candidates[0].attributes);
  assert.throws(() => purchase(p), /verbraucht/);
  syncCandidates(p, 86400000, OFFICER_RULES, random, id); p = purchase(p, 86400000);
  assert.equal(p.city.resources.wood, 17500); assert.equal(p.military.acquiredCount, 3);
  syncCandidates(p, 172800000, OFFICER_RULES, random, id); assert.throws(() => purchase(p, 172800000), /Limit/);
  assert.deepEqual(before.military.generals, newMilitary('p').generals);
});

test('pool anchors, exact expiry, O(1) offline skip and interval change at stored boundary', () => {
  let p = fixture(); const first = structuredClone(p.military.candidatePool);
  assert.equal(syncCandidates(p, 1000, OFFICER_RULES, random, id), false);
  p.city.militarySlots[0].building = null;
  assert.equal(syncCandidates(p, 5000, OFFICER_RULES, random, id), false);
  assert.deepEqual(p.military.candidatePool, first);
  p.city.militarySlots[0].building = 'barracks';
  assert.doesNotThrow(() => recruitQuote(p, first.candidates[0].id, first.expiresAt - 1));
  assert.throws(() => recruitQuote(p, first.candidates[0].id, first.expiresAt), /abgelaufen/);
  const rules = { ...OFFICER_RULES, version: 'officers-1-test', refreshMs: 60000 };
  // A change at hour 25 first applies at the old boundary at hour 48.
  const history = [{ effectiveAt: 25 * 3600000, refreshMs: 60000, version: rules.version }];
  syncCandidates(p, 26 * 3600000, rules, random, id, history);
  assert.equal(p.military.candidatePool.createdAt, 24 * 3600000); assert.equal(p.military.candidatePool.expiresAt, 48 * 3600000);
  syncCandidates(p, 48 * 3600000, rules, random, id, history); assert.equal(p.military.candidatePool.intervalMs, 60000);
  let generated = 0;
  syncCandidates(p, 1000000000000, rules, random, () => { generated++; return id(); }, history);
  assert.equal(generated, 4); assert.equal(p.military.candidatePool.candidates.length, 3);
  assert.ok(p.military.candidatePool.createdAt <= 1000000000000 && p.military.candidatePool.expiresAt > 1000000000000);
});

test('failed purchases preserve pool, counter, resources; changed quotes and foreign IDs reject', () => {
  const p = fixture(); const q = recruitQuote(p, p.military.candidatePool.candidates[0].id, 0);
  const before = structuredClone(p);
  for (const change of [{ name: '\u0000' }, { poolId: 'foreign' }, { candidateId: 'foreign' }, { acquiredCount: 2 }, { rosterVersion: 99 }, { rulesetVersion: 'old' }]) assert.throws(() => recruitGeneral(p, { ...q, ...change }, 0, OFFICER_RULES, id));
  assert.throws(() => recruitGeneral(p, q, 0, { ...OFFICER_RULES, version: 'changed', wood: 900 }, id), /veraltet/);
  assert.deepEqual(p, before);
  p.city.resources.wood = 499; const poor = structuredClone(p); assert.throws(() => purchase(p), /Rohstoffe/); assert.deepEqual(p, poor);
});

test('effective bases influence version 3 and skill caps, historical missions retain rules', () => {
  let p = purchase(fixture(), 0, 1); let g = p.military.generals[1];
  assert.equal(g.attributes.attack, 15); assert.equal(combatBonuses(g).attackPercent, 30);
  g.experience = 10000; g = applySkillDistribution(applySkillConversion(g, 12), { attack: 2 });
  assert.equal(combatBonuses(g).attackPercent, 34); assert.equal(effectiveAttributes(g).attack, 17);
  assert.equal(g.skills.experienceSpent, 780); assert.throws(() => applySkillDistribution(g, { attack: 9 }), /obergrenze/);
  g = applySkillDistribution(g, { attack: 8 }); assert.equal(combatBonuses(g).attackPercent, 50);
  p.military.generals[1] = g; p.military.units.infantry = 10;
  const m = startRaidMission(p.military, { id: 'raid', generalId: g.id, infantry: 10 }, 0, { x: 0, y: 0 }, { id: 'npc', kind: 'npc', x: 1, y: 0 }, 1);
  assert.equal(m.missions[0].ruleset, MILITARY_RULES.baseRaidRuleset);
  assert.equal(resolveMissionCombat(m.missions[0], 10, 10).victory, true);
  assert.equal(resolveMissionCombat({ ruleset: MILITARY_RULES.skillRaidRuleset, combatBonuses: { attackPercent: 0, defensePercent: 0 } }, 10, 10).victory, false);
  assert.equal(resolveMissionCombat({ ruleset: MILITARY_RULES.raidRuleset }, 10, 10).survivors, 0);
});

test('exclusive offices, independent duration arithmetic, stale snapshots and fixed running bonus', () => {
  let p = purchase(fixture()); p.city.research.levels.forestry = 1;
  p.military = assignMayor(p.military, p.military.generals[0].id);
  assert.throws(() => assignResearcher(p, { generalId: p.military.generals[0].id, expectedRoleVersion: p.military.roleVersion }), /freier/);
  p = assignResearcher(p, { generalId: p.military.generals[1].id, expectedRoleVersion: p.military.roleVersion });
  const options = { military: p.military, officerRules: OFFICER_RULES };
  const q = researchQuote(p.city, researchCommand, options);
  assert.equal(q.durationWithoutGeneralMs, 110000); assert.equal(q.durationMs, 91000); assert.equal(q.researcher.bonusPercent, 20);
  assert.equal(researchQuote(p.city, researchCommand, { military: p.military, officerRules: { ...OFFICER_RULES, leadershipPercent: 0 } }).durationMs, 110000);
  const high = structuredClone(p.military); high.generals[1].attributes.leadership = 100;
  const capped = researchQuote(p.city, researchCommand, { military: high, officerRules: OFFICER_RULES });
  assert.equal(capped.researcher.bonusPercent, 50); assert.equal(capped.durationMs, 73000);
  const command = { ...researchCommand, researcher: q.researcher };
  p.military.generals[1].version++; assert.throws(() => startResearch(p.city, command, 0, options), /geändert/);
  p.military.generals[1].version--; p.city = startResearch(p.city, command, 0, options);
  assert.throws(() => assignResearcher(p, { generalId: null, expectedRoleVersion: p.military.roleVersion }), /laufender/);
  assert.throws(() => assignMayor(p.military, p.military.generals[1].id), /freier/);
  p.military.generals[1].name = 'Changed'; p.military.generals[1].attributes.leadership = 100;
  p.city.buildingSlots[3].level = 5; assert.equal(p.city.research.active.finishesAt, 91000); assert.equal(p.city.research.active.researcher.generalName, 'Zoë 🦊');
  p.city = advanceCity(p.city, 91000); assert.equal(p.city.research.levels.forestry, 2); assert.equal(p.military.generals[1].status, 'researcher');
  p = assignResearcher(p, { generalId: null, expectedRoleVersion: p.military.roleVersion }); assert.equal(p.military.generals[1].status, 'idle');
});

test('ENV validation, allowed zero bonus, native/Compose forwarding and isolation', async () => {
  const c = parseConfiguration(); assert.equal(c.officers.maxCount, 3); assert.equal(c.officers.exponent, 2);
  for (const key of ['GENERAL_MAX_COUNT', 'GENERAL_RECRUIT_WOOD', 'GENERAL_RECRUIT_STONE', 'GENERAL_RECRUIT_COST_EXPONENT', 'GENERAL_CANDIDATE_REFRESH_HOURS']) assert.throws(() => parseConfiguration({ [key]: '0' }), new RegExp(key));
  for (const [key, value] of [['GENERAL_MAX_COUNT', '101'], ['GENERAL_RECRUIT_COST_EXPONENT', '4'], ['GENERAL_RECRUIT_WOOD', '1.5'], ['RESEARCH_BONUS_CAP_PERCENT', '101'], ['GENERAL_CANDIDATE_REFRESH_HOURS', '0.01']]) assert.throws(() => parseConfiguration({ [key]: value }));
  const zero = parseConfiguration({ RESEARCH_LEADERSHIP_PERCENT: '0', RESEARCH_BONUS_CAP_PERCENT: '0' }); assert.equal(zero.officers.leadershipPercent, 0);
  assert.equal(c.officers.leadershipPercent, 1); assert.notEqual(zero.officers.version, c.officers.version);
  const { readFile } = await import('node:fs/promises');
  const compose = await readFile(new URL('../compose.yaml', import.meta.url), 'utf8');
  const example = await loadConfiguration({ file: new URL('../.env.example', import.meta.url) }); assert.deepEqual(example.officers, c.officers);
  for (const name of ['GENERAL_MAX_COUNT', 'GENERAL_RECRUIT_WOOD', 'GENERAL_RECRUIT_STONE', 'GENERAL_RECRUIT_COST_EXPONENT', 'GENERAL_CANDIDATE_REFRESH_HOURS', 'RESEARCH_LEADERSHIP_PERCENT', 'RESEARCH_BONUS_CAP_PERCENT']) assert.ok(compose.includes(`${name}: \u0024{${name}-`));
});

test('schema 9/8, larger counts, legacy research, eligibility timestamp and saved interval restart', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'officers-')); t.after(() => rm(directory, { recursive: true, force: true }));
  let now = 0, storage = await new WorldStorage(directory, 'test', () => now).initialize();
  let { player } = await storage.register('OfficersMigration', 'sicheres-passwort');
  player.schemaVersion = 8; delete player.city.research; delete player.military.acquiredCount;
  await storage.savePlayer(player); player = await storage.loadPlayer(player.playerId);
  assert.equal(player.schemaVersion, 13); assert.equal(player.military.acquiredCount, 1); assert.equal(player.military.researcherGeneralId, null);
  player.schemaVersion = 9; player.military.acquiredCount = 9; await storage.savePlayer(player);
  player = await storage.loadPlayer(player.playerId); assert.equal(player.military.acquiredCount, 9); assert.equal(player.military.generals.length, 1);
  player.city = enqueueConstruction(player.city, { id: 'b', slotId: player.city.militarySlots[0].id, building: 'barracks' }, 0);
  await storage.savePlayer(player); now = 20000; await storage.advanceWorld(now); player = await storage.loadPlayer(player.playerId);
  assert.equal(player.city.officerEligibleAt, 5000); assert.equal(player.military.candidatePool.createdAt, 5000);
  const pool = structuredClone(player.military.candidatePool);
  storage = await new WorldStorage(directory, 'test', () => now, parseConfiguration({ GENERAL_CANDIDATE_REFRESH_HOURS: '1', GENERAL_MAX_COUNT: '1' })).initialize();
  player = await storage.loadPlayer(player.playerId); assert.deepEqual(player.military.candidatePool, pool);
  Object.assign(player.city.buildingSlots[3], { building: 'university', buildingId: 'uni', level: 2 });
  player.city.research.active = { id: 'old', technology: 'forestry', targetLevel: 1, universityId: 'uni', paidCost: { wood: 100, stone: 100 }, ruleset: 'research-1-provisional', durationMs: 60000, startsAt: 20000, finishesAt: 80000 };
  await storage.savePlayer(player); now = 80000; await storage.advanceWorld(now); player = await storage.loadPlayer(player.playerId);
  assert.equal(player.city.research.levels.forestry, 1); assert.equal(player.city.research.active, null); assert.equal(player.military.generals[0].experience, 0);
});
