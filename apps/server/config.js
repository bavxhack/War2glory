import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { SUPPLY_RULES } from '../../packages/game-core/supply.js';

const definitions = {
  WORLD_WIDTH: [24, 2, 64, true], WORLD_HEIGHT: [24, 2, 64, true], WORLD_NPC_COUNT: [18, 0, 4095, true],
  UPKEEP_INFANTRY_PER_HOUR: [360, 0, 3600000], UPKEEP_SCOUT_PER_HOUR: [180, 0, 3600000],
  SUPPLY_GRACE_SECONDS: [1800, 0.001, 31536000], SUPPLY_LOSS_INTERVAL_SECONDS: [300, 0.001, 31536000],
  SUPPLY_LOSS_PERCENT: [5, 0.000001, 100], SUPPLY_RECOVERY_SECONDS: [60, 0.001, 31536000],
};

export function parseConfiguration(env = {}) {
  const numbers = {};
  for (const [name, [fallback, min, max, integer]] of Object.entries(definitions)) {
    const raw = env[name];
    const value = raw === undefined ? fallback : typeof raw === 'string' && /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new Error(`${name}: ${integer ? 'Ganzzahl' : 'Dezimalzahl mit Punkt'} zwischen ${min} und ${max} erwartet; keine leeren Werte oder Einheiten.`);
    }
    numbers[name] = value;
  }
  const supply = { ...SUPPLY_RULES, upkeepPerSecond: { infantry: numbers.UPKEEP_INFANTRY_PER_HOUR / 3600, scout: numbers.UPKEEP_SCOUT_PER_HOUR / 3600 },
    graceMs: numbers.SUPPLY_GRACE_SECONDS * 1000, lossIntervalMs: numbers.SUPPLY_LOSS_INTERVAL_SECONDS * 1000,
    lossRate: numbers.SUPPLY_LOSS_PERCENT / 100, recoveryMs: numbers.SUPPLY_RECOVERY_SECONDS * 1000 };
  const changed = Object.keys(SUPPLY_RULES).some(key => key !== 'version' && JSON.stringify(supply[key]) !== JSON.stringify(SUPPLY_RULES[key]));
  if (changed) supply.version = `supply-env-1-${createHash('sha256').update(JSON.stringify(supply)).digest('hex').slice(0, 16)}`;
  return { map: { width: numbers.WORLD_WIDTH, height: numbers.WORLD_HEIGHT, npcCount: numbers.WORLD_NPC_COUNT, maxViewport: 15 }, supply };
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
