import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorldStorage } from '../apps/server/storage.js';
import { startRaidMission } from '../packages/game-core/military.js';
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
