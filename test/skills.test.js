import test from 'node:test';
import assert from 'node:assert/strict';
import { newCity } from '../packages/game-core/index.js';
import {
  GENERAL_SKILL_RULES, MILITARY_RULES, applySkillConversion, applySkillDistribution, combatBonuses,
  effectiveAttributes, generalLevel, newMilitary, normalizeGeneral, previewSkillConversion,
  resolveMissionCombat, resolveNpcCombat, skillSummary, startRaidMission,
} from '../packages/game-core/military.js';
import { advanceSupply, assignMayor, mayorBonus, refreshSupplyAt, supplySummary } from '../packages/game-core/supply.js';

const general = (experience = 75) => normalizeGeneral({ ...newMilitary('skills').generals[0], experience, level: generalLevel(experience) });
const mission = (attack = 0, defense = 0) => ({ ruleset: MILITARY_RULES.skillRaidRuleset, combatBonuses: { attackPercent: attack * 2, defensePercent: defense * 2 } });

test('XP: manuelle Käufe erhalten Gesamt-XP/Level und berechnen Preise aus allen erworbenen Punkten', () => {
  const first = general();
  assert.deepEqual(previewSkillConversion(first, 3), { points: 3, cost: 60, remainingExperience: 15, totalPoints: 3 });
  const bought = applySkillConversion(first, 3);
  assert.equal(bought.experience, 75); assert.equal(bought.level, first.level);
  const allocated = applySkillDistribution(bought, { attack: 2, leadership: 1 });
  assert.equal(skillSummary(allocated).freePoints, 0);
  assert.throws(() => applySkillConversion(allocated, 1), /Nicht genügend/);
  const earned = { ...allocated, experience: 165 };
  assert.equal(previewSkillConversion(earned, 2).cost, 90);
  assert.equal(previewSkillConversion(earned, 1).cost, 40);
  const again = applySkillConversion(earned, 2);
  assert.equal(skillSummary(again).availableExperience, 15);
  assert.equal(again.skills.totalPoints, 5);
  assert.equal(first.skills.totalPoints, 0, 'keine automatische Buchung oder Mutation');
});

test('XP und Verteilung lehnen ungültige Zahlen, Überlauf und Teilbuchungen ab', () => {
  const previous = general(Number.MAX_SAFE_INTEGER);
  for (const value of [0, -1, 1.5, Infinity, NaN, '1', Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => applySkillConversion(previous, value));
  }
  const bought = applySkillConversion(previous, 10);
  for (const changes of [null, [], {}, { attack: -1 }, { attack: 1.5 }, { other: 1 }, { attack: Number.MAX_SAFE_INTEGER }, { defense: Infinity }]) {
    assert.throws(() => applySkillDistribution(bought, changes));
  }
  assert.equal(previous.skills.experienceSpent, 0);
  assert.throws(() => skillSummary({ ...previous, skills: { ...previous.skills, allocations: { attack: -1, defense: 1, leadership: 0 } } }), /Inkonsistenter/);
});

test('Skillinvariante, effektive Grundwerte und Wirkungsschranken erhalten Altwerte', () => {
  const bought = applySkillConversion(general(100_000), 100);
  const distributed = applySkillDistribution(bought, { leadership: 30, attack: 25, defense: 25 });
  assert.deepEqual(effectiveAttributes(distributed), { leadership: 50, attack: 25, defense: 25 });
  assert.equal(skillSummary(distributed).freePoints, 20);
  for (const key of ['leadership', 'attack', 'defense']) assert.throws(() => applySkillDistribution(distributed, { [key]: 1 }), /Wirkungsobergrenze/);
  const legacy = { ...bought, attributes: { leadership: 200, attack: 300, defense: 400 } };
  assert.throws(() => applySkillDistribution(legacy, { leadership: 1 }), /Wirkungsobergrenze/);
  const improved = applySkillDistribution(legacy, { attack: 1 });
  assert.equal(improved.attributes.leadership, 200);
  assert.deepEqual(combatBonuses(improved), { attackPercent: 2, defensePercent: 0 });
});

test('Kampf: alle Abnahmerechnungen, rationale Siegschwellen und unverteidigtes Ziel', () => {
  const examples = [[10, 10, 0, 0, false, 10, 5, 0], [10, 10, 5, 0, true, 5, 10, 5],
    [30, 20, 0, 10, true, 8, 20, 22], [10, 20, 0, 10, false, 8, 5, 2]];
  for (const [n, d, a, v, victory, attackerLosses, defenderLosses, survivors] of examples) {
    assert.deepEqual(resolveMissionCombat(mission(a, v), n, d), { victory, attackerLosses, defenderLosses, survivors, combatBonuses: mission(a, v).combatBonuses });
  }
  assert.equal(resolveMissionCombat(mission(5), 100, 110).victory, false, 'exakter Gleichstand');
  assert.equal(resolveMissionCombat(mission(5), 101, 110).victory, true);
  assert.equal(resolveMissionCombat(mission(25, 25), 10, 0).attackerLosses, 0);
  assert.throws(() => resolveMissionCombat({ ruleset: 'unknown' }, 10, 10), /Unbekannte/);
  assert.throws(() => resolveMissionCombat({ ruleset: MILITARY_RULES.skillRaidRuleset }, 10, 10), /Kampfboni/);
});

test('Null-Skills entsprechen immer der alten Version; Angriff/Verteidigung sind monoton', () => {
  for (let n = 1; n <= 40; n++) for (let d = 0; d <= 40; d++) {
    const { combatBonuses: ignored, ...zero } = resolveMissionCombat(mission(), n, d);
    assert.deepEqual(zero, resolveNpcCombat(n, d));
    assert.deepEqual(resolveMissionCombat({}, n, d), zero);
    let previous = resolveMissionCombat(mission(), n, d);
    for (let p = 1; p <= 25; p++) {
      const attack = resolveMissionCombat(mission(p), n, d);
      assert.ok(!previous.victory || attack.victory);
      previous = attack;
      const low = resolveMissionCombat(mission(5, p - 1), n, d);
      const high = resolveMissionCombat(mission(5, p), n, d);
      assert.ok(high.attackerLosses <= low.attackerLosses);
    }
  }
});

test('Neue Mission friert Boni ein; nachträgliche Zuweisung verändert weder Mission noch Reise', () => {
  let military = newMilitary('skills'); military.units.infantry = 100;
  military.generals[0] = applySkillConversion(general(1000), 10);
  military.generals[0] = applySkillDistribution(military.generals[0], { attack: 5, defense: 1 });
  military = startRaidMission(military, { id: 'snapshot', generalId: military.generals[0].id, infantry: 100 }, 0, { x: 0, y: 0 }, { id: 'npc', kind: 'npc', x: 1, y: 1 }, 1);
  const before = structuredClone(military.missions[0]);
  military.generals[0] = applySkillDistribution(military.generals[0], { defense: 4 });
  assert.deepEqual(military.missions[0], before);
  assert.deepEqual(before.combatBonuses, { attackPercent: 10, defensePercent: 2 });
  assert.equal(before.arrivesAt, 10_000); assert.equal(before.returnsAt, 20_000);
  assert.equal(before.infantry, 100); assert.equal(MILITARY_RULES.maxMissionUnits, 10_000);
});

test('Bürgermeister: alte Produktion bis Buchung, nur additive Führung auf Grundproduktion', () => {
  let player = { city: newCity(0), military: newMilitary('skills') };
  player.city.buildingSlots[2].level = 2;
  player.military.generals[0].attributes.leadership = 10;
  player.military.generals[0] = applySkillConversion(player.military.generals[0] = { ...player.military.generals[0], experience: 75 }, 3);
  player.military = assignMayor(player.military, player.military.generals[0].id);
  const initialFood = player.city.resources.food;
  player = advanceSupply(player, 10_000, 0);
  assert.equal(player.city.resources.food, initialFood + 22);
  const wood = player.city.resources.wood;
  player.military.generals[0] = applySkillDistribution(player.military.generals[0], { leadership: 2 });
  player = refreshSupplyAt(player, 10_000);
  assert.equal(player.city.resources.food, initialFood + 22);
  assert.equal(supplySummary(player).production, 2.24);
  assert.equal(mayorBonus(player.military), 0.12);
  player = advanceSupply(player, 20_000, 0);
  assert.ok(Math.abs(player.city.resources.food - (initialFood + 44.4)) < 1e-9);
  assert.equal(player.city.resources.wood, wood + 10);
  assert.equal(supplySummary(player).production, 2.24, 'kein mehrfach aufaddierter Bonus');
  player.military = assignMayor(player.military, null);
  assert.equal(supplySummary(player).production, 2, 'nicht amtierender General verändert keine Produktion');
});

test('Führung prüft tatsächliche Versorgung neu, erhält Mangelzähler und setzt Ausbildung ohne Kosten fort', () => {
  let player = { city: newCity(0), military: newMilitary('skills') };
  player.city.resources.food = 0; player.military.units.infantry = 11;
  player.military.generals[0].attributes.leadership = 0;
  player.military.generals[0] = applySkillConversion({ ...player.military.generals[0], experience: 10_000 }, 11);
  player.military = assignMayor(player.military, player.military.generals[0].id);
  player.military.trainingQueue = [{ id: 'paused', unit: 'scout', amount: 1, startsAt: 0, finishesAt: 500_000, barracksSlotId: 'military-plot-1' }];
  player = advanceSupply(player, 100_000, 0);
  assert.equal(player.supply.shortageMs, 100_000);
  const queue = structuredClone(player.military.trainingQueue);
  player.military.generals[0] = applySkillDistribution(player.military.generals[0], { leadership: 1 });
  player = refreshSupplyAt(player, 100_000);
  assert.equal(player.supply.inShortage, true);
  assert.equal(player.supply.shortageMs, 100_000);
  player.military.generals[0] = applySkillDistribution(player.military.generals[0], { leadership: 10 });
  player = refreshSupplyAt(player, 100_000);
  assert.equal(player.supply.inShortage, false);
  assert.equal(player.supply.shortageMs, 100_000);
  assert.equal(player.supply.recoveryStartedAt, 100_000);
  assert.equal(player.military.trainingQueue[0].pausedForSupply, false);
  assert.equal(player.military.trainingQueue[0].finishesAt, queue[0].finishesAt);
  player = advanceSupply(player, 160_000, 0);
  assert.equal(player.supply.shortageMs, 0);
  assert.equal(player.military.generals[0].skills.experienceSpent, 660);
});
