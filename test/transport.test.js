import test from 'node:test';
import assert from 'node:assert/strict';
import { GameTransport } from '../apps/client/src/transport.js';

class FakeSocket {
  static OPEN = 1;
  static instances = [];
  readyState = 0; listeners = new Map(); sent = [];
  constructor(url) { this.url = url; FakeSocket.instances.push(this); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  emit(type, value = {}) { this.listeners.get(type)?.(value); }
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = 3; this.emit('close'); }
}

const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };

test('zentraler Transport startet auch bei wiederholtem Mount nur eine Verbindung', () => {
  FakeSocket.instances = []; const transport = new GameTransport({ WebSocketImpl: FakeSocket, storage: storage(), location: { protocol: 'http:', host: 'localhost' } });
  transport.start(); transport.start(); assert.equal(FakeSocket.instances.length, 1);
  transport.stop(); transport.stop(); assert.equal(FakeSocket.instances.length, 1);
});

test('Sitzungswechsel entfernt private Zustände und offene Dialogdaten', () => {
  FakeSocket.instances = []; const session = storage(); const transport = new GameTransport({ WebSocketImpl: FakeSocket, storage: session, location: { protocol: 'http:', host: 'localhost' } });
  transport.start(); const socket = FakeSocket.instances[0]; socket.readyState = FakeSocket.OPEN; socket.emit('open');
  socket.emit('message', { data: JSON.stringify({ type: 'auth.success', payload: { sessionToken: 'secret' } }) });
  socket.emit('message', { data: JSON.stringify({ type: 'city.snapshot', payload: { player: { id: 'old' } } }) });
  socket.emit('message', { data: JSON.stringify({ type: 'building.preview', payload: { slotId: 'plot-1' } }) });
  socket.emit('message', { data: JSON.stringify({ type: 'auth.required', payload: { message: 'Abgelaufen' } }) });
  assert.equal(session.getItem('strategy.session'), null); assert.equal(transport.state.authenticated, false); assert.equal(transport.state.game, null); assert.equal(transport.state.demolition, null);
});

test('Mutationen werden nach Verbindungsabbruch nicht blind erneut gesendet', () => {
  FakeSocket.instances = []; const scheduled = []; const transport = new GameTransport({ WebSocketImpl: FakeSocket, storage: storage(), location: { protocol: 'http:', host: 'localhost' }, timers: { setTimeout: callback => { scheduled.push(callback); return 1; }, clearTimeout() {} } });
  transport.start(); const first = FakeSocket.instances[0]; first.readyState = FakeSocket.OPEN; first.emit('open'); transport.mutate('construction.enqueue', { slotId: 'plot-4', building: 'farm' }); assert.equal(first.sent.length, 1);
  first.emit('close'); scheduled[0](); const second = FakeSocket.instances[1]; second.readyState = FakeSocket.OPEN; second.emit('open'); assert.equal(second.sent.length, 0);
});

test('Skillanfragen verwenden den zentralen Socket und verwerfen Antworten nach Sitzungsende', async () => {
  FakeSocket.instances = [];
  const transport = new GameTransport({ WebSocketImpl: FakeSocket, storage: storage(), location: { protocol: 'http:', host: 'localhost' } });
  transport.start(); const socket = FakeSocket.instances[0]; socket.readyState = FakeSocket.OPEN; socket.emit('open');
  const quote = transport.request('general.preview', { points: 3 });
  socket.emit('message', { data: JSON.stringify({ type: 'general.preview', requestId: socket.sent[0].requestId, payload: { conversion: { cost: 60 } } }) });
  assert.equal((await quote).conversion.cost, 60);
  const saving = transport.request('general.convert', { points: 3 });
  socket.emit('message', { data: JSON.stringify({ type: 'auth.required', payload: { message: 'Abgelaufen' } }) });
  await assert.rejects(saving, /Sitzung beendet/);
  assert.equal(FakeSocket.instances.length, 1);
  transport.stop();
});

test('connection greeting preserves resumed token and logistics previews resolve on the central socket', async () => {
  FakeSocket.instances = []; const session = storage(); session.setItem('strategy.session', 'saved-token');
  const transport = new GameTransport({ WebSocketImpl: FakeSocket, storage: session, location: { protocol: 'http:', host: 'localhost' } });
  transport.start(); const socket = FakeSocket.instances[0]; socket.readyState = FakeSocket.OPEN; socket.emit('open');
  assert.equal(socket.sent[0].type, 'auth.resume');
  socket.emit('message', { data: JSON.stringify({ type: 'auth.required', requestId: 'connection', payload: { message: 'Sitzung wiederaufnehmen' } }) });
  socket.emit('message', { data: JSON.stringify({ type: 'auth.success', payload: {} }) });
  assert.equal(session.getItem('strategy.session'), 'saved-token'); assert.equal(transport.state.authenticated, true);
  for (const type of ['raid.preview', 'scouting.preview']) {
    const promise = transport.request(type, { generalId: 'general', targetId: 'npc' });
    socket.emit('message', { data: JSON.stringify({ type, requestId: socket.sent.at(-1).requestId, payload: { totalOil: 40 } }) });
    assert.equal((await promise).totalOil, 40);
  }
  transport.stop();
});

test('tab city selection persists, all commands include cityId, late city/map/dialog events cannot overwrite another city', async () => {
  FakeSocket.instances = []; const tab = storage();
  const transport = new GameTransport({ WebSocketImpl: FakeSocket, storage: storage(), tabStorage: tab, location: { protocol: 'http:', host: 'localhost' } });
  transport.start(); const socket = FakeSocket.instances[0]; socket.readyState = FakeSocket.OPEN; socket.emit('open');
  const cities = [{ id: 'city-a' }, { id: 'city-b' }];
  const emit = (type,payload) => socket.emit('message', { data: JSON.stringify({ type, payload }) });
  emit('city.snapshot', { cityId: 'city-a', cities });
  const pending = transport.request('field.scout.preview', { x: 1, y: 2 }); const rejected = assert.rejects(pending, /Stadt/);
  assert.equal(socket.sent.at(-1).payload.cityId, 'city-a');
  transport.selectCity('city-b'); await rejected; assert.equal(tab.getItem('strategy.city'), 'city-b');
  emit('city.snapshot', { cityId: 'city-b', cities });
  emit('city.updated', { cityId: 'city-a', cities, city: { name: 'Wrong' } });
  emit('building.preview', { cityId: 'city-a', slotId: 'old' });
  emit('map.snapshot', { cityId: 'city-a', ownCity: { id: 'city-a' } });
  assert.equal(transport.state.game.cityId, 'city-b'); assert.equal(transport.state.demolition, null); assert.equal(transport.state.map, null);
  transport.mutate('construction.enqueue', { slotId: 'plot-4', building: 'farm' }); assert.equal(socket.sent.at(-1).payload.cityId, 'city-b');
  const reconnected = new GameTransport({ tabStorage: tab }); assert.equal(reconnected.selectedCityId, 'city-b'); transport.stop();
});
