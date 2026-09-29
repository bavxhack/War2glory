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
