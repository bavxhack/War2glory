import { parseArgs } from 'node:util';
import { createGameServer } from './server.js';

const { values } = parseArgs({ options: {
  port: { type: 'string', default: '3000' },
  world: { type: 'string', default: 'alpha' },
  host: { type: 'string', default: '127.0.0.1' },
  origins: { type: 'string', default: '' },
} });
if (!/^[a-zA-Z0-9_-]{1,40}$/.test(values.world)) throw new Error('Weltname: 1–40 Buchstaben, Ziffern, _ oder -.');
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Ungültiger Port.');
if (!['127.0.0.1', '0.0.0.0'].includes(values.host)) throw new Error('Host muss 127.0.0.1 oder 0.0.0.0 sein.');
const server = createGameServer({
  worldDir: `data/${values.world}`,
  worldName: values.world,
  allowedOrigins: values.origins.split(',').map(value => value.trim()).filter(Boolean),
});
await server.ready;
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, values.host, () => console.log(`Welt ${values.world}: http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
