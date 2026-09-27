import { parseArgs } from 'node:util';
import { readFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WorldStorage } from './storage.js';
import { migrateLegacyState } from './legacy.js';

const { values } = parseArgs({ options: {
  world: { type: 'string' }, username: { type: 'string' }, confirm: { type: 'boolean', default: false },
} });
if (!values.world || !/^[a-zA-Z0-9_-]{1,40}$/.test(values.world) || !values.username || !values.confirm) {
  throw new Error('Aufruf: npm run claim-legacy -- --world NAME --username KONTO --confirm');
}
const directory = resolve('data', values.world);
const storage = await new WorldStorage(directory, values.world).initialize();
const normalized = values.username.trim().normalize('NFKC').toLocaleLowerCase('de-DE');
const account = storage.accounts.accounts.find(candidate => candidate.normalized === normalized);
if (!account) throw new Error('Konto wurde nicht gefunden. Zuerst registrieren, dann den Server stoppen.');
const legacyFile = resolve(directory, 'state.json');
const legacy = migrateLegacyState(JSON.parse(await readFile(legacyFile, 'utf8')));
const player = await storage.loadPlayer(account.playerId);
player.city = legacy.city;
player.processedCommands = (legacy.processedCommands ?? []).map(id => ({ id, fingerprint: 'legacy', acceptedAt: Date.now() }));
await storage.savePlayer(player);
await rename(legacyFile, `${legacyFile}.claimed-${Date.now()}.bak`);
console.log(`Alte Demo-Stadt wurde ${account.displayName} zugeordnet; die Quelldatei wurde als Backup umbenannt.`);
