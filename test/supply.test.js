import test from 'node:test';
import assert from 'node:assert/strict';
import { newCity } from '../packages/game-core/index.js';
import { newMilitary, startRaidMission } from '../packages/game-core/military.js';
import { advanceSupply, assignMayor, settleSupplyAt, supplySummary, SUPPLY_RULES } from '../packages/game-core/supply.js';

function playerAt(now = 0) {
  return { playerId: 'p1', city: newCity(now), military: newMilitary('p1') };
}

test('Bürgermeisterwechsel ist exklusiv und erhöht nur die Nahrungsproduktion', () => {
  const player = playerAt();
  const base = supplySummary(player);
  player.military = assignMayor(player.military, 'general-p1');
  const withMayor = supplySummary(player);
  assert.equal(player.military.generals[0].status, 'mayor');
  assert.equal(withMayor.baseProduction, base.baseProduction);
  assert.equal(withMayor.production, base.production * 1.2);
  assert.equal(withMayor.mayorBonus, 0.2);
  assert.equal(assignMayor(player.military, null).generals[0].status, 'idle');
  assert.throws(() => assignMayor({ ...player.military, generals: [{ ...player.military.generals[0], status: 'raiding' }] }, 'general-p1'), /freier General/);
});

test('Offline-Unterhalt endet bei null und erzeugt nach Schonfrist genau eine proportionale Verlustwelle', () => {
  const player = playerAt();
  player.city.buildingSlots[2].level = 0;
  player.city.resources.food = 10;
  player.military.units = { infantry: 80, scout: 20 };
  const depletionMs = 10 / 9 * 1000;
  const result = advanceSupply(player, depletionMs + SUPPLY_RULES.graceMs, 0);
  assert.equal(result.city.resources.food, 0);
  assert.equal(result.military.units.infantry + result.military.units.scout, 95);
  assert.deepEqual(result.supply.events[0].losses, { infantry: 4, scout: 1 });
  assert.equal(player.military.units.infantry, 80, 'Eingabe bleibt unverändert');
});

test('Unterwegs befindliche Truppen zählen einmal und verlieren bei Hunger Traglast', () => {
  const player = playerAt();
  player.city.buildingSlots[2].level = 0;
  player.city.resources.food = 0;
  player.military.units.infantry = 10;
  player.military = startRaidMission(player.military, { id: 'raid', generalId: 'general-p1', infantry: 10 }, 0,
    { x: 0, y: 0 }, { id: 'npc', kind: 'npc', name: 'NPC', x: 1, y: 0 }, 1);
  player.military.missions[0].status = 'returning';
  player.military.missions[0].result = { survivors: 10, loadedFood: 200 };
  assert.equal(supplySummary(player).upkeep, 1);
  const result = advanceSupply(player, SUPPLY_RULES.graceMs, 0);
  assert.equal(result.military.missions[0].result.survivors, 9);
  assert.equal(result.military.missions[0].result.loadedFood, 180);
  assert.equal(result.military.missions[0].foodLostInTransit, 20);
});

test('Kurze Versorgung pausiert den Zähler, stabile Versorgung setzt ihn zurück', () => {
  let player = playerAt();
  player.city.buildingSlots[2].level = 0;
  player.city.resources.food = 0;
  player.military.units.infantry = 20;
  player = advanceSupply(player, 10 * 60_000, 0);
  player.city.resources.food = 1;
  player = advanceSupply(player, 10 * 60_000 + 1_000, 0);
  assert.ok(player.supply.shortageMs > 10 * 60_000 && player.supply.shortageMs < 10 * 60_000 + 1_000);
  player.military.units.infantry = 0;
  player = advanceSupply(player, 11 * 60_000 + 1_000, 0);
  assert.equal(player.supply.shortageMs, 0);
});

test('Nahrung wird als Nettobilanz bei vollem Lager und Überbestand korrekt verrechnet', () => {
  const covered = playerAt();
  covered.military.units.infantry = 5;
  covered.city.resources.food = 2000;
  const coveredLater = advanceSupply(covered, 10_000, 0);
  assert.equal(coveredLater.city.resources.food, 2000, 'Produktion deckt Unterhalt auch am Lagerlimit direkt');

  const deficit = playerAt();
  deficit.military.units.infantry = 20;
  deficit.city.resources.food = 2_100;
  const deficitLater = advanceSupply(deficit, 100_000, 0);
  assert.equal(deficitLater.city.resources.food, 2_000, 'negative Nettobilanz baut Überbestand ab, ohne ihn abzuschneiden');
  assert.equal(deficitLater.supply.inShortage, false);
});

test('Viele kleine Versorgungsschritte ergeben denselben Bestand wie ein Offline-Schritt', () => {
  const initial = playerAt();
  initial.military.units = { infantry: 13, scout: 7 };
  const oneStep = advanceSupply(initial, 123_456, 0);
  let manySteps = initial;
  for (const at of [1_000, 9_999, 60_000, 100_000, 123_456]) manySteps = advanceSupply(manySteps, at, 0);
  assert.ok(Math.abs(oneStep.city.resources.food - manySteps.city.resources.food) < 1e-9);
  assert.equal(oneStep.supply.shortageMs, manySteps.supply.shortageMs);
});

test('Eine am Zeitrand zurückkehrende Versorgung verhindert die fällige Hungerwelle', () => {
  const player = playerAt();
  player.city.buildingSlots[2].level = 0;
  player.city.resources.food = 0;
  player.military.units.infantry = 20;
  const beforeReturn = advanceSupply(player, SUPPLY_RULES.graceMs, 0, { deferLossAtEnd: true });
  assert.equal(beforeReturn.supply.pendingLossAt, SUPPLY_RULES.graceMs);
  beforeReturn.city.resources.food = 100;
  const settled = settleSupplyAt(beforeReturn, SUPPLY_RULES.graceMs);
  assert.equal(settled.military.units.infantry, 20);
  assert.equal(settled.supply.events.length, 0);
});
