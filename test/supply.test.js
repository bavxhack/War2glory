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

test('Unterhaltsaufschlüsselung enthält stationierte und marschierende Truppen nach Typ', () => {
  const player = playerAt();
  player.military.units = { infantry: 12, scout: 4 };
  player.military.missions.push({ id: 'raid-upkeep', type: 'raid', status: 'returning', infantry: 8, result: { survivors: 6 } });
  player.military.missions.push({ id: 'scout-upkeep', type: 'scout', status: 'outbound', scouts: 3 });
  const summary = supplySummary(player);
  assert.deepEqual(summary.unitCounts, { infantry: 18, scout: 7 });
  assert.equal(summary.upkeep, 2.15);
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

for (const minutes of [30, 31, 35, 46]) test(`Schonfrist unabhängig von Abrufen bis Minute ${minutes}`, () => {
  const initial = playerAt();
  initial.city.buildingSlots[2].level = 0;
  initial.city.resources.food = 0;
  initial.military.units.infantry = 100;
  const direct = advanceSupply(initial, minutes * 60_000, 0);
  const split = advanceSupply(advanceSupply(initial, 10 * 60_000, 0), minutes * 60_000, 0);
  assert.deepEqual(split.supply.events, direct.supply.events);
  assert.equal(split.supply.events[0].at, 30 * 60_000);
  assert.deepEqual(split.military.units, direct.military.units);
});

test('Unabhängige Unterhaltsrechnungen und unveränderte Trainingskosten', () => {
  let p = playerAt(); p.city.buildingSlots[2].level = 0;
  p.city.resources.food = 1000; p.military.units.infantry = 10;
  assert.equal(advanceSupply(p, 60_000, 0).city.resources.food, 940);
  p.city.buildingSlots[2].level = 1;
  assert.equal(supplySummary(p).net, 0);
  p.city.buildingSlots[2].level = 2; p.military.units.infantry = 30;
  p.military.generals[0].attributes.leadership = 10;
  p.military = assignMayor(p.military, 'general-p1');
  assert.equal(supplySummary(p).production, 2.2);
  assert.equal(advanceSupply(p, 60_000, 0).city.resources.food, 952);
});

test('Gebrochener Leerstandszeitpunkt: viele Schritte und exakte Verlustgrenze', () => {
  const initial = playerAt(); initial.city.buildingSlots[2].level = 0;
  initial.city.resources.food = 10; initial.military.units = { infantry: 80, scout: 20 };
  const end = 10 / 9 * 1000 + 35 * 60_000;
  const direct = advanceSupply(initial, end, 0);
  let split = initial;
  for (let t = 1234; t < end; t += 1234) split = advanceSupply(split, t, 0);
  split = advanceSupply(split, end, 0);
  assert.deepEqual(split.military.units, direct.military.units);
  assert.equal(split.supply.events.length, 2);
  for (let i = 0; i < 2; i++) assert.ok(Math.abs(split.supply.events[i].at - direct.supply.events[i].at) < 1e-6);
});

test('Altstadt vor Aktivierungszeitpunkt erhält keine rückwirkende Unterhaltsrechnung', () => {
  const player = playerAt(); player.city.buildingSlots[2].level = 0;
  player.city.resources.food = 1000; player.military.units.infantry = 10;
  const activated = advanceSupply(player, 120000, 60000);
  assert.equal(activated.city.resources.food, 940);
  assert.equal(activated.supply.shortageMs, 0);
  assert.equal(activated.city.resources.wood, 320, 'Alte Grundproduktion bleibt erhalten');
});

test('Reale Zeitstempel und gebrochene Nahrung verursachen keine endlose Offline-Abrechnung', async () => {
  const { spawnSync } = await import('node:child_process');
  const core = new URL('../packages/game-core/index.js', import.meta.url).href;
  const supply = new URL('../packages/game-core/supply.js', import.meta.url).href;
  const military = new URL('../packages/game-core/military.js', import.meta.url).href;
  const script = `
    import { advanceSupply } from ${JSON.stringify(supply)};
    import { newCity } from ${JSON.stringify(core)};
    import { newMilitary } from ${JSON.stringify(military)};
    import assert from 'node:assert/strict';
    const at = 1791450000000;
    for (let i = 1; i < 100; i++) {
      const player = { city: newCity(at), military: newMilitary('p') };
      player.city.resources.food = 1000.1234567 + i / 123;
      player.military.units.infantry = 133 + i;
      const result = advanceSupply(player, at + 3600000, at);
      assert.equal(result.supply.updatedAt, at + 3600000);
      assert.equal(result.city.resources.food, 0);
      assert.ok(result.supply.events.length > 0);
      const split = advanceSupply(advanceSupply(player, at + 600000, at), at + 3600000, at);
      assert.deepEqual(split.military.units, result.military.units);
      assert.equal(split.supply.events.length, result.supply.events.length);
      for (let j = 0; j < result.supply.events.length; j++) assert.ok(Math.abs(split.supply.events[j].at - result.supply.events[j].at) <= 0.001);
    }
  `;
  // A subprocess deadline makes the previous infinite loop fail without hanging the suite.
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { timeout: 5000, encoding: 'utf8' });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});
