import { parseArgs } from 'node:util';
import { createGameServer } from './server.js';

const { values } = parseArgs({ options: {
  port: { type: 'string', default: '3000' },
  world: { type: 'string', default: 'alpha' },
} });
if (!/^[a-zA-Z0-9_-]{1,40}$/.test(values.world)) throw new Error('Weltname: 1–40 Buchstaben, Ziffern, _ oder -.');
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Ungültiger Port.');
const server = createGameServer({ dataFile: `data/${values.world}/state.json`, worldName: values.world });
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Welt ${values.world}: http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
