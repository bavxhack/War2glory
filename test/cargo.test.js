import test from 'node:test';
import assert from 'node:assert/strict';
import { newCity } from '../packages/game-core/index.js';
import { newMilitary, resolveMissionCombat } from '../packages/game-core/military.js';
import { LOGISTICS_RULES, missionQuote, startLogisticsMission, fuelPlan } from '../packages/game-core/logistics.js';
import { validateCargo, retainCargo, resolveCargoArrival, operatingFuel, unloadCargo, cargoAmount } from '../packages/game-core/cargo.js';
import { parseConfiguration, loadConfiguration } from '../apps/server/config.js';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const home = { x: 0, y: 0 }, npc = { id: 'npc', kind: 'npc', x: 3, y: 4, name: 'NPC' };
function fixture() {
  const p = { city: newCity(0), military: newMilitary('p') };
  p.city.resources = { wood: 2000, stone: 2000, food: 2000, oil: 2000 };
  p.military.units = { infantry: 20, truck: 4, scout: 2 };
  p.military.generals[0].attributes = { leadership: 20, attack: 0, defense: 0 };
  return p;
}
const command = (p, extra = {}) => ({ type: 'raid', id: 'cargo-mission', generalId: p.military.generals[0].id, units: { infantry: 20, truck: 4 }, cargo: { wood: 100, stone: 100, food: 50, oil: 50 }, ...extra });
const quote = (p, c = command(p), rules = LOGISTICS_RULES) => missionQuote(p, c, home, npc, rules, 0);
function send(p = fixture(), c = command(p), rules = LOGISTICS_RULES) { return startLogisticsMission(p, { ...c, preview: quote(p, c, rules) }, 0, home, npc, rules); }
const empty = { wood: 0, stone: 0, food: 0, oil: 0 };

test('shared cargo and fuel fit exactly; one too heavy; stocks and invalid resources fail atomically', () => {
  const p = fixture(), before = structuredClone(p);
  const full = command(p, { cargo: { wood: 300, stone: 300, food: 300, oil: 240 } });
  const q = quote(p, full); assert.equal(q.startOccupancy, 1200); assert.equal(q.freeStartCapacity, 0); assert.equal(q.projectedLootCapacity, 30);
  assert.throws(() => quote(p, { ...full, cargo: { ...full.cargo, wood: 301 } }), /Ladung zu schwer/);
  for (const cargo of [{ wood: -1 }, { oil: 0.5 }, { stone: NaN }, { food: Infinity }, { food: '1' }, { wood: Number.MAX_SAFE_INTEGER + 1 }, { iron: 0 }, { oil: null }, [], null]) assert.throws(() => quote(p, command(p, { cargo })), /ladung|Ladung|Ganzzahl/);
  assert.throws(() => validateCargo({ wood: Number.MAX_SAFE_INTEGER, stone: 1 }), /Zahlenbereich/);
  const poor = fixture(); poor.city.resources.oil = 100;
  assert.throws(() => send(poor), /Öl/); assert.equal(poor.city.resources.oil, 100); assert.equal(poor.military.generals[0].status, 'idle');
  poor.city.resources.wood = 50; assert.throws(() => quote(poor), /wood/);
  assert.deepEqual(p, before);
});

test('voluntary oil plus operating fuel deducted once; rounding remainder burns outbound, fuel frees capacity', () => {
  const p = fixture(), sent = send(p), m = sent.military.missions[0];
  assert.deepEqual(sent.city.resources, { wood: 1900, stone: 1900, food: 1950, oil: 1890 });
  assert.equal(m.paidOil, 60); assert.equal(m.cargo.initial.oil, 50); assert.equal(p.city.resources.oil, 2000);
  assert.equal(operatingFuel(m, 0).remaining, 60); assert.equal(operatingFuel(m, 12500).remaining, 45);
  assert.equal(operatingFuel(m, 25000).remaining, 30);
  const q = quote(p); assert.equal(q.projectedLootCapacity, 870); assert.equal(q.startOccupancy, 360);
  const fractional = send(p, command(p, { units: { infantry: 1 }, cargo: {} }), { ...LOGISTICS_RULES, oilMilliPerField: { ...LOGISTICS_RULES.oilMilliPerField, infantry: 1 } }).military.missions[0];
  assert.equal(fractional.paidOil, 1); assert.equal(fractional.returnReserve, 0.005); assert.equal(fractional.outboundConsumption, 0.995);
  assert.equal(operatingFuel(fractional, 25000).remaining, 0.005);
  resolveCargoArrival(fractional, 20); fractional.status = 'returning';
  assert.equal(operatingFuel(fractional, 37500).remaining, 0.0025);
  fractional.status = 'completed'; const f = operatingFuel(fractional, 50000); assert.equal(f.remaining, 0); assert.equal(f.burned, 1);
  const exact = f.exact; assert.equal(BigInt(exact.burnedNumerator) + BigInt(exact.lostNumerator) + BigInt(exact.remainingNumerator), BigInt(f.loaded) * BigInt(exact.denominator));
});

test('documented 1000/200/100/100 has 700 loot slots and +9min costs110', () => {
  const p = fixture(); p.military.units.infantry = 10; p.military.units.truck = 4;
  const rules = { ...LOGISTICS_RULES, oilMilliPerField: { ...LOGISTICS_RULES.oilMilliPerField, infantry: 400, truck: 4000 } };
  const q = quote(p, command(p, { units: { infantry: 10, truck: 4 }, cargo: { wood: 200 } }), rules);
  assert.equal(q.capacity, 1000); assert.equal(q.totalOil, 200); assert.equal(q.outboundConsumption, 100); assert.equal(q.returnReserve, 100); assert.equal(q.startOccupancy, 400); assert.equal(q.freeStartCapacity, 600); assert.equal(q.projectedLootCapacity, 700);
  const fuel = fuelPlan(10000n, 60000, 9); assert.equal(fuel.totalOil, 110);
});

test('survivors1200→900 reserve22.5, lost7.5, goods877 and loot577; cargo1000 loses123', () => {
  const m = send().military.missions[0];
  const combat = resolveMissionCombat(m, 20, 10); assert.equal(combat.attackerLosses, 5);
  m.units = { infantry: 15, truck: 3 };
  const arrival = resolveCargoArrival(m, 900); m.status = 'returning';
  assert.deepEqual(arrival, { goodsCapacity: 877, lootCapacity: 577 }); assert.equal(cargoAmount(m.cargo.retained), 300);
  const fuel = operatingFuel(m, 25000); assert.equal(fuel.burned, 30); assert.equal(fuel.lost, 7.5); assert.equal(fuel.remaining, 22.5);
  assert.equal(operatingFuel(m, 37500).remaining, 11.25);
  m.status = 'completed'; assert.deepEqual([operatingFuel(m, 50000).burned, operatingFuel(m, 50000).lost, operatingFuel(m, 50000).remaining], [52.5, 7.5, 0]);
  const heavy = send(fixture(), command(fixture(), { cargo: { wood: 250, stone: 250, food: 250, oil: 250 } })).military.missions[0];
  heavy.units = { infantry: 15, truck: 3 }; assert.equal(resolveCargoArrival(heavy, 900).lootCapacity, 0);
  assert.deepEqual(heavy.cargo.retained, { wood: 220, stone: 219, food: 219, oil: 219 }); assert.equal(cargoAmount(heavy.cargo.lost), 123);
});

test('largest remainder and fixed ties preserve exact integer goods; defeats retain survivors, total loss loses all', () => {
  assert.deepEqual(retainCargo({ wood: 2, stone: 2, food: 2, oil: 2 }, 3).retained, { wood: 1, stone: 1, food: 1, oil: 0 });
  assert.deepEqual(retainCargo({ wood: 1, stone: 7, food: 2, oil: 0 }, 4).retained, { wood: 0, stone: 3, food: 1, oil: 0 });
  const m = send().military.missions[0]; m.units = { infantry: 2, truck: 1 };
  const a = resolveCargoArrival(m, 240); assert.equal(a.goodsCapacity, 234); assert.equal(cargoAmount(m.cargo.retained), 234);
  m.units = { infantry: 0, truck: 0 }; assert.deepEqual(resolveCargoArrival(m, 0), { goodsCapacity: 0, lootCapacity: 0 });
  assert.deepEqual(m.cargo.retained, empty); assert.deepEqual(m.cargo.lost, m.cargo.initial); m.status = 'completed';
  const fuel = operatingFuel(m, 50000); assert.equal(fuel.burned, 30); assert.equal(fuel.lost, 30); assert.equal(fuel.remaining, 0);
});

test('scout tank boundary grants no goods or loot; per-type return reserve checked against stored rates', () => {
  const p = fixture(), c = { type: 'scout', generalId: p.military.generals[0].id, scouts: 2 };
  const boundary = { ...LOGISTICS_RULES, scoutFuelCapacity: 2 };
  assert.equal(quote(p, c, boundary).totalOil, 4); assert.equal(quote(p, c, boundary).capacity, 0); assert.equal(quote(p, c, boundary).tankCapacity, 4);
  assert.throws(() => quote(p, c, { ...boundary, scoutFuelCapacity: 1 }), /tankkapazität/);
  assert.throws(() => quote(p, { ...c, cargo: { oil: 1 } }), /keine Gütertraglast/);
  assert.throws(() => quote(p, command(p, { cargo: {} }), { ...LOGISTICS_RULES, oilMilliPerField: { ...LOGISTICS_RULES.oilMilliPerField, infantry: 4001 } }), /Rückwegreserve für infantry/);
  assert.throws(() => quote(p, command(p, { cargo: {} }), { ...LOGISTICS_RULES, oilMilliPerField: { ...LOGISTICS_RULES.oilMilliPerField, truck: 40001 } }), /Rückwegreserve für truck/);
});

test('own goods stored first per resource; loot and own overflow separate, voluntary oil returns, no operating refund', () => {
  const m = send().military.missions[0]; m.units = { infantry: 15, truck: 3 }; resolveCargoArrival(m, 900); m.result = { loadedFood: 577 };
  const resources = { wood: 1950, stone: 2000, food: 1900, oil: 1980 };
  const delivery = unloadCargo(m, resources, { wood: 2000, stone: 2000, food: 2000, oil: 2000 });
  assert.deepEqual(delivery.storedOwn, { wood: 50, stone: 0, food: 50, oil: 20 });
  assert.deepEqual(delivery.overflowOwn, { wood: 50, stone: 100, food: 0, oil: 30 });
  assert.equal(delivery.storedLoot.food, 50); assert.equal(delivery.overflowLoot.food, 527);
  assert.deepEqual(resources, { wood: 2000, stone: 2000, food: 2000, oil: 2000 });
  const overstock = { wood: 3000, stone: 3000, food: 3000, oil: 3000 }; unloadCargo(m, overstock, { wood: 2000, stone: 2000, food: 2000, oil: 2000 }); assert.deepEqual(overstock, { wood: 3000, stone: 3000, food: 3000, oil: 3000 });
});

test('SCOUT_FUEL_CAPACITY validates native precedence, compose forwarding and frozen snapshots', async t => {
  assert.equal(parseConfiguration().logistics.scoutFuelCapacity, 20);
  for (const raw of ['0', '-1', '', '1.5', 'NaN', 'Infinity', '1000001']) assert.throws(() => parseConfiguration({ SCOUT_FUEL_CAPACITY: raw }), /SCOUT_FUEL_CAPACITY/);
  const dir = await mkdtemp(join(tmpdir(), 'cargo-env-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, '.env'); await writeFile(file, 'SCOUT_FUEL_CAPACITY=25\n'); assert.equal((await loadConfiguration({ file, env: { SCOUT_FUEL_CAPACITY: '30' } })).logistics.scoutFuelCapacity, 30);
  assert.match(await readFile(new URL('../compose.yaml', import.meta.url), 'utf8'), /SCOUT_FUEL_CAPACITY: \$\{SCOUT_FUEL_CAPACITY-20\}/);
});
