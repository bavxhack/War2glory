import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorldStorage } from '../apps/server/storage.js';
import { GENERAL_SKILL_RULES, MILITARY_RULES, applySkillConversion, applySkillDistribution, skillSummary, startRaidMission } from '../packages/game-core/military.js';
import { SUPPLY_RULES } from '../packages/game-core/supply.js';

test('gleichzeitige Offline-Farmzüge werden über Neustarts stabil und nur einmal abgerechnet', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'farm-storage-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let now = 1_000_000;
  let storage = await new WorldStorage(directory, 'test', () => now).initialize();
  const firstRegistration = await storage.register('Erster', 'sicheres-passwort-1', 'Erste Stadt');
  const secondRegistration = await storage.register('Zweiter', 'sicheres-passwort-2', 'Zweite Stadt');
  const target = storage.world.map.entities.find(entity => entity.id === 'npc-1');
  target.garrison.amount = 5;
  target.garrison.capacity = 5;
  target.resources.food.amount = 500;
  target.resources.food.updatedAt = now;
  target.garrison.updatedAt = now;

  for (const [registration, amount] of [[firstRegistration, 10], [secondRegistration, 5]]) {
    const player = await storage.loadPlayer(registration.player.playerId);
    player.military.units.infantry = amount;
    const origin = storage.world.map.entities.find(entity => entity.playerId === player.playerId);
    player.military = startRaidMission(player.military, { id: `raid-${player.playerId}`, generalId: player.military.generals[0].id, infantry: amount }, now, origin, target, storage.nextEventSequence());
    // Give both commands the same fachliche arrival to exercise the persisted sequence tie-breaker.
    player.military.missions[0].arrivesAt = now + 5_000;
    player.military.missions[0].returnsAt = now + 10_000;
    await storage.savePlayer(player);
  }
  await storage.saveWorld();

  now += 5_000;
  storage = await new WorldStorage(directory, 'test', () => now).initialize();
  const npcAfterCombat = storage.world.map.entities.find(entity => entity.id === 'npc-1');
  assert.equal(npcAfterCombat.garrison.amount, 0);
  assert.equal(npcAfterCombat.resources.food.amount, 260);

  now += 5_000;
  storage = await new WorldStorage(directory, 'test', () => now).initialize();
  const first = await storage.loadPlayer(firstRegistration.player.playerId);
  const second = await storage.loadPlayer(secondRegistration.player.playerId);
  assert.deepEqual(first.military.reports.map(report => [report.loadedFood, report.generalExperience, report.combatScore]), [[140, 10, 2]]);
  assert.deepEqual(second.military.reports.map(report => [report.loadedFood, report.generalExperience, report.combatScore]), [[100, 0, 0]]);
  assert.equal(first.military.units.infantry, 7);
  assert.equal(second.military.units.infantry, 5);

  await storage.advanceWorld(now + 60_000);
  const persistedAgain = JSON.parse(await readFile(storage.playerFile(first.playerId), 'utf8'));
  assert.equal(persistedAgain.military.reports.length, 1);
  assert.equal(persistedAgain.military.generals[0].experience, 10);
});

test('Migration und altes offenes Journal erhalten Rollen, Skillzähler, Hunger und laufende alte Mission', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'skills-migration-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const now = 10_000;
  let storage = await new WorldStorage(directory, 'test', () => now).initialize();
  const registration = await storage.register('AltSkills', 'sicheres-passwort-4', 'Alte Stadt');
  const player = await storage.loadPlayer(registration.player.playerId);
  player.schemaVersion = 7; delete player.generalSkillRuleset;
  player.military.generals[0].experience = 100;
  player.military.generals[0] = applySkillDistribution(applySkillConversion(player.military.generals[0], 3), { defense: 1 });
  const target = storage.world.map.entities.find(entity => entity.kind === 'npc');
  player.military.units.infantry = 10;
  player.military = startRaidMission(player.military, { id: 'legacy-active', generalId: player.military.generals[0].id, infantry: 10 }, now, target, target, 1);
  delete player.military.missions[0].ruleset; delete player.military.missions[0].combatBonuses;
  const mayor = structuredClone(player.military.generals[0]); mayor.id = 'legacy-mayor'; mayor.status = 'mayor';
  player.military.generals.push(mayor); player.military.mayorGeneralId = mayor.id;
  player.military.reports.push({ id: 'historic', type: 'raid', attackerLosses: 10, victory: false });
  player.supply = { version: 1, activatedAt: now, updatedAt: now, shortageMs: 1234, recoveryStartedAt: null, nextLossAt: 99_999, events: [] };
  const preserved = structuredClone(player);
  await writeFile(storage.journalFile, JSON.stringify({ id: 'old-journal', world: null, players: [player] }));
  storage = await new WorldStorage(directory, 'test', () => now).initialize();
  const migrated = await storage.loadPlayer(player.playerId);
  assert.equal(migrated.schemaVersion, 11); assert.equal(migrated.generalSkillRuleset, GENERAL_SKILL_RULES.version);
  assert.deepEqual(migrated.military.generals, preserved.military.generals);
  assert.equal(migrated.military.mayorGeneralId, mayor.id);
  assert.equal(migrated.military.missions[0].ruleset, MILITARY_RULES.raidRuleset);
  assert.equal(migrated.military.missions[0].combatBonuses, undefined);
  assert.deepEqual(migrated.military.reports, preserved.military.reports);
  assert.deepEqual(migrated.city, preserved.city);
  assert.equal(migrated.supply.shortageMs, 1234);
  assert.deepEqual(skillSummary(migrated.military.generals[0]), skillSummary(preserved.military.generals[0]));
  const again = await new WorldStorage(directory, 'test', () => now).initialize();
  assert.deepEqual((await again.loadPlayer(player.playerId)).military, migrated.military);
});

test('Alte Mission ignoriert spätere Skills, neue Niederlage bringt Überlebende ohne Beute/duplizierte XP zurück', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'skills-combat-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let now = 10_000;
  let storage = await new WorldStorage(directory, 'test', () => now).initialize();
  const registration = await storage.register('SkillCombat', 'sicheres-passwort-5', 'Kampfstadt');
  let player = await storage.loadPlayer(registration.player.playerId);
  const target = storage.world.map.entities.find(entity => entity.kind === 'npc');
  const resetTarget = () => { target.garrison.amount = 20; target.garrison.capacity = 20; target.garrison.updatedAt = now; };
  resetTarget(); player.military.units.infantry = 10;
  player.military.generals[0] = applySkillConversion({ ...player.military.generals[0], experience: 10_000 }, 20);
  player.military = startRaidMission(player.military, { id: 'old', generalId: player.military.generals[0].id, infantry: 10 }, now, target, target, 1);
  player.military.missions[0].ruleset = MILITARY_RULES.raidRuleset; delete player.military.missions[0].combatBonuses;
  player.military.generals[0] = applySkillDistribution(player.military.generals[0], { defense: 10 });
  await storage.saveWorld(); await storage.savePlayer(player);
  now += 10_000; await storage.advanceWorld(now);
  player = await storage.loadPlayer(player.playerId);
  assert.equal(player.military.reports[0].attackerLosses, 10); assert.equal(player.military.reports[0].combatBonuses, undefined);
  const historic = structuredClone(player.military.reports[0]);
  const npc = storage.world.map.entities.find(entity => entity.id === target.id);
  npc.garrison.amount = 20; npc.garrison.updatedAt = now;
  player.military.units.infantry = 10;
  player.military = startRaidMission(player.military, { id: 'new', generalId: player.military.generals[0].id, infantry: 10 }, now, npc, npc, 2);
  player.military.generals[0] = applySkillDistribution(player.military.generals[0], { attack: 10 });
  await storage.saveWorld(); await storage.savePlayer(player);
  now += 10_000; storage = await new WorldStorage(directory, 'test', () => now).initialize();
  player = await storage.loadPlayer(player.playerId);
  const report = player.military.reports[1];
  assert.equal(report.victory, false); assert.equal(report.attackerLosses, 8); assert.equal(report.defenderLosses, 5);
  assert.equal(report.loadedFood, 0); assert.equal(report.storedFood, 0); assert.equal(report.generalExperience, 10);
  assert.equal(report.combatScore, -3); assert.equal(player.military.units.infantry, 2);
  assert.deepEqual(report.combatBonuses, { attackPercent: 0, defensePercent: 20 });
  assert.deepEqual(player.military.reports[0], historic);
  assert.equal(player.military.generals[0].experience, 10_020);
  storage = await new WorldStorage(directory, 'test', () => now).initialize();
  assert.equal((await storage.loadPlayer(player.playerId)).military.generals[0].experience, 10_020);
});

test('Vollständiger Hungerabgang vor neuem Kampf erzeugt keine Skillstärke, Beute oder XP', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'skills-hunger-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let now = 10_000;
  const storage = await new WorldStorage(directory, 'test', () => now).initialize();
  const registration = await storage.register('HungrySkills', 'sicheres-passwort-6', 'Hungerstadt');
  let player = await storage.loadPlayer(registration.player.playerId);
  player.city.resources.food = 0; player.city.buildingSlots[2].level = 0; player.military.units.infantry = 1;
  player.military.generals[0] = applySkillDistribution(applySkillConversion({ ...player.military.generals[0], experience: 10_000 }, 25), { attack: 25 });
  const target = storage.world.map.entities.find(entity => entity.kind === 'npc');
  player.military = startRaidMission(player.military, { id: 'hungry', generalId: player.military.generals[0].id, infantry: 1 }, now, target, target, 1);
  const mission = player.military.missions[0]; mission.arrivesAt = now + SUPPLY_RULES.graceMs + 1; mission.returnsAt = mission.arrivesAt + 5000;
  await storage.savePlayer(player);
  now = mission.arrivesAt; await storage.advanceWorld(now);
  player = await storage.loadPlayer(player.playerId);
  assert.equal(player.military.missions[0].result.survivors, 0);
  assert.equal(player.military.missions[0].result.generalExperience, 0);
  assert.equal(player.military.missions[0].result.loadedFood, 0);
  assert.equal(player.military.generals[0].status, 'raiding');
  now = mission.returnsAt; await storage.advanceWorld(now);
  player = await storage.loadPlayer(player.playerId);
  assert.equal(player.military.generals[0].status, 'idle'); assert.equal(player.military.generals[0].experience, 10_000);
  assert.equal(player.military.reports[0].hungerLosses, 1); assert.equal(player.military.reports[0].combatScore, 0);
});

test('gleichzeitige Beuterückkehr versorgt die Stadt vor der Hungerwelle', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'supply-return-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let now = 2_000_000;
  const storage = await new WorldStorage(directory, 'test', () => now).initialize();
  const registration = await storage.register('Versorger', 'sicheres-passwort-3', 'Versorgungsstadt');
  const player = await storage.loadPlayer(registration.player.playerId);
  const target = storage.world.map.entities.find(entity => entity.kind === 'npc');
  const origin = storage.world.map.entities.find(entity => entity.playerId === player.playerId);
  player.city.buildingSlots[2].level = 0;
  player.city.resources.food = 0;
  player.military.units.infantry = 10;
  player.military = startRaidMission(player.military, { id: 'return-at-loss', generalId: player.military.generals[0].id, infantry: 10 }, now, origin, target, storage.nextEventSequence());
  const mission = player.military.missions[0];
  mission.status = 'returning';
  mission.arrivesAt = now;
  mission.returnsAt = now + SUPPLY_RULES.graceMs;
  mission.result = { victory: true, attackerLosses: 0, defenderLosses: 0, survivors: 10, loadedFood: 100, capacity: 200, generalExperience: 0, combatScore: 0, defenders: 0 };
  await storage.savePlayer(player);
  await storage.saveWorld();

  now = mission.returnsAt;
  await storage.advanceWorld(now);
  const returned = await storage.loadPlayer(player.playerId);
  assert.equal(returned.military.units.infantry, 10);
  assert.equal(returned.city.resources.food, 100);
  assert.equal(returned.supply.events.length, 0);
  assert.equal(returned.supply.shortageMs, SUPPLY_RULES.graceMs);
  assert.equal(returned.supply.recoveryStartedAt, null, 'Erholung beginnt erst ab dem tatsächlichen Versorgungszeitpunkt');
});
