import { parseArgs } from 'node:util';
import { loadConfiguration } from './config.js';
import { createGameServer } from './server.js';

const { values } = parseArgs({ options: {
  port: { type: 'string' },
  world: { type: 'string' },
  host: { type: 'string' },
  origins: { type: 'string' },
} });
const config = await loadConfiguration({ env: process.env, cli: values });
const server = createGameServer({
  worldDir: `data/${config.world}`,
  worldName: config.world,
  allowedOrigins: config.allowedOrigins, config,
});
await server.ready;
console.log(`Versorgungsregeln ${server.storage.supplyRules.version}: ${JSON.stringify(server.storage.supplyRules.upkeepPerSecond)} Nahrung/Einheit/Sekunde; wirksam ab ${new Date(server.storage.world.supplyRuleHistory.at(-1).effectiveAt).toISOString()}`);
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(config.port, config.host, () => console.log(`Welt ${config.world}: http://localhost:${config.port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
