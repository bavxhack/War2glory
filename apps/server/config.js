import { SETTLEMENT_RULES } from '../../packages/game-core/settlement.js';
import { LOGISTICS_RULES } from '../../packages/game-core/logistics.js';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { SUPPLY_RULES } from '../../packages/game-core/supply.js';
import { OFFICER_RULES } from '../../packages/game-core/officers.js';

const definitions = {
  FIELD_DEFENDER_MIN: [5, 1, 100000, true], FIELD_DEFENDER_MAX: [30, 1, 100000, true], CITY_CLAIM_TTL_HOURS: [24, 1 / 60, 8760],
  CITY_FOUND_WOOD: [500, 1, 1000000, true], CITY_FOUND_STONE: [500, 1, 1000000, true], CITY_FOUND_FOOD: [500, 1, 1000000, true],
  GENERAL_MAX_COUNT: [3, 1, 100, true], GENERAL_RECRUIT_WOOD: [500, 1, 1000000, true], GENERAL_RECRUIT_STONE: [500, 1, 1000000, true],
  GENERAL_RECRUIT_COST_EXPONENT: [2, 1, 3, true], GENERAL_CANDIDATE_REFRESH_HOURS: [24, 1 / 60, 8760],
  RESEARCH_LEADERSHIP_PERCENT: [1, 0, 10], RESEARCH_BONUS_CAP_PERCENT: [50, 0, 100],
  WORLD_WIDTH: [24, 2, 64, true], WORLD_HEIGHT: [24, 2, 64, true], WORLD_NPC_COUNT: [18, 0, 4095, true],
  UPKEEP_TRUCK_PER_HOUR: [180, 0, 3600000],
  OIL_INFANTRY_PER_FIELD: [LOGISTICS_RULES.oilMilliPerField.infantry / 1000, 0.001, 100000], OIL_SCOUT_PER_FIELD: [LOGISTICS_RULES.oilMilliPerField.scout / 1000, 0.001, 100000], OIL_TRUCK_PER_FIELD: [LOGISTICS_RULES.oilMilliPerField.truck / 1000, 0.001, 100000],
  SCOUT_FUEL_CAPACITY: [20, 1, 1000000, true],
  TRUCK_CARGO_CAPACITY: [200, 1, 1000000, true],
  MAX_ATTACK_DELAY_MINUTES: [1440, 0, 10080, true],
  UPKEEP_INFANTRY_PER_HOUR: [360, 0, 3600000], UPKEEP_SCOUT_PER_HOUR: [180, 0, 3600000],
  SUPPLY_GRACE_SECONDS: [1800, 0.001, 31536000], SUPPLY_LOSS_INTERVAL_SECONDS: [300, 0.001, 31536000],
  SUPPLY_LOSS_PERCENT: [5, 0.000001, 100], SUPPLY_RECOVERY_SECONDS: [60, 0.001, 31536000],
};

export function parseConfiguration(env = {}) {
  if (Object.hasOwn(env, 'OIL_DELAY_PER_UNIT_PER_MINUTE')) throw new Error('OIL_DELAY_PER_UNIT_PER_MINUTE wurde entfernt. Schlüssel aus .env/Prozesskonfiguration entfernen; Verzögerungsöl wird aus Typ-Raten und Hinreisezeit berechnet.');
  const numbers = {};
  for (const [name, [fallback, min, max, integer]] of Object.entries(definitions)) {
    const raw = env[name];
    const value = raw === undefined ? fallback : typeof raw === 'string' && /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new Error(`${name}: ${name.startsWith('OIL_') ? 'Neue Bewegungen benötigen positive Typ-Raten; bisherige Nullwerte bitte ersetzen. ' : ''}${integer ? 'Ganzzahl' : 'Dezimalzahl mit Punkt'} zwischen ${min} und ${max} erwartet; keine leeren Werte oder Einheiten.`);
    }
    if (name.startsWith('OIL_') && raw !== undefined && !/^\d+(?:\.\d{1,3})?$/.test(raw)) throw new Error(`${name}: höchstens drei Nachkommastellen.`);
    numbers[name] = value;
  }
  const supply = { ...SUPPLY_RULES, upkeepPerSecond: { infantry: numbers.UPKEEP_INFANTRY_PER_HOUR / 3600, scout: numbers.UPKEEP_SCOUT_PER_HOUR / 3600, truck: numbers.UPKEEP_TRUCK_PER_HOUR / 3600 },
    graceMs: numbers.SUPPLY_GRACE_SECONDS * 1000, lossIntervalMs: numbers.SUPPLY_LOSS_INTERVAL_SECONDS * 1000,
    lossRate: numbers.SUPPLY_LOSS_PERCENT / 100, recoveryMs: numbers.SUPPLY_RECOVERY_SECONDS * 1000 };
  const changed = Object.keys(SUPPLY_RULES).some(key => key !== 'version' && JSON.stringify(supply[key]) !== JSON.stringify(SUPPLY_RULES[key]));
  if (changed) supply.version = `supply-env-1-${createHash('sha256').update(JSON.stringify(supply)).digest('hex').slice(0, 16)}`;
  const officers = { ...OFFICER_RULES, maxCount: numbers.GENERAL_MAX_COUNT, wood: numbers.GENERAL_RECRUIT_WOOD, stone: numbers.GENERAL_RECRUIT_STONE,
    exponent: numbers.GENERAL_RECRUIT_COST_EXPONENT, refreshMs: Math.round(numbers.GENERAL_CANDIDATE_REFRESH_HOURS * 3600000),
    leadershipPercent: numbers.RESEARCH_LEADERSHIP_PERCENT, bonusCapPercent: numbers.RESEARCH_BONUS_CAP_PERCENT };
  officers.version = `officers-1-${createHash('sha256').update(JSON.stringify(officers)).digest('hex').slice(0, 16)}`;
  const logistics = { ...LOGISTICS_RULES, scoutFuelCapacity: numbers.SCOUT_FUEL_CAPACITY, maxAttackDelayMinutes: numbers.MAX_ATTACK_DELAY_MINUTES, oilMilliPerField: Object.fromEntries(['infantry', 'scout', 'truck'].map(unit => [unit, Math.round(numbers[`OIL_${unit.toUpperCase()}_PER_FIELD`] * 1000)])), cargoPerUnit: { ...LOGISTICS_RULES.cargoPerUnit, truck: numbers.TRUCK_CARGO_CAPACITY } };
  logistics.version = `fuel-3-cargo-${createHash('sha256').update(JSON.stringify(logistics)).digest('hex').slice(0, 16)}`;
  if (numbers.FIELD_DEFENDER_MIN > numbers.FIELD_DEFENDER_MAX) throw new Error('FIELD_DEFENDER_MIN darf FIELD_DEFENDER_MAX nicht überschreiten.');
  const settlement = { ...SETTLEMENT_RULES, defenderMin: numbers.FIELD_DEFENDER_MIN, defenderMax: numbers.FIELD_DEFENDER_MAX, claimTtlMs: Math.round(numbers.CITY_CLAIM_TTL_HOURS * 3600000), cost: { wood: numbers.CITY_FOUND_WOOD, stone: numbers.CITY_FOUND_STONE, food: numbers.CITY_FOUND_FOOD } };
  settlement.version = `settlement-1-${createHash('sha256').update(JSON.stringify(settlement)).digest('hex').slice(0, 16)}`;
  return { settlement, logistics, map: { width: numbers.WORLD_WIDTH, height: numbers.WORLD_HEIGHT, npcCount: numbers.WORLD_NPC_COUNT, maxViewport: 15 }, supply, officers };
}

export async function loadConfiguration({ env = {}, file = '.env', cli = {} } = {}) {
  let source = '';
  try { source = await readFile(file, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  // A deliberately small single-line dotenv dialect; malformed lines never silently disappear.
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (!/^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line)) throw new Error(`${file}:${index + 1}: Ungültige ENV-Zuweisung.`);
    const value = line.slice(line.indexOf('=') + 1).trim();
    if ((value.startsWith('"') && !/^"[^"\r\n]*"\s*(?:#.*)?$/.test(value)) || (value.startsWith("'") && !/^'[^'\r\n]*'\s*(?:#.*)?$/.test(value))) throw new Error(`${file}:${index + 1}: Ungültiger ENV-Wert.`);
  }
  const merged = { ...parseEnv(source), ...env };
  const config = parseConfiguration(merged);
  const world = cli.world ?? merged.WORLD_NAME ?? 'alpha';
  const portRaw = cli.port ?? merged.PORT ?? '3000';
  const host = cli.host ?? merged.HOST ?? '127.0.0.1';
  const origins = cli.origins ?? merged.ALLOWED_ORIGINS ?? '';
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(world)) throw new Error('Weltname: 1–40 Buchstaben, Ziffern, _ oder -.');
  if (!/^\d+$/.test(portRaw) || Number(portRaw) < 1 || Number(portRaw) > 65535) throw new Error('Ungültiger Port.');
  if (!['127.0.0.1', '0.0.0.0'].includes(host)) throw new Error('Host muss 127.0.0.1 oder 0.0.0.0 sein.');
  return { ...config, world, port: Number(portRaw), host, allowedOrigins: origins.split(',').map(value => value.trim()).filter(Boolean) };
}
