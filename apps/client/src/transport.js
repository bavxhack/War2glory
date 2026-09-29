import { createRequestId } from '../request-id.js';

const initialState = Object.freeze({ status: 'connecting', authenticated: false, game: null, map: null, mapDetails: null, demolition: null, message: '', error: '' });

export class GameTransport {
  #listeners = new Set(); #pending = new Map(); #socket = null; #timer = null; #attempt = 0; #generation = 0; #stopped = true;
  state = initialState;

  constructor({ WebSocketImpl = globalThis.WebSocket, storage = globalThis.localStorage, location = globalThis.location, timers = globalThis } = {}) {
    this.WebSocketImpl = WebSocketImpl; this.storage = storage; this.location = location; this.timers = timers;
  }
  subscribe = listener => { this.#listeners.add(listener); return () => this.#listeners.delete(listener); };
  getSnapshot = () => this.state;
  #set(patch) { this.state = { ...this.state, ...patch }; for (const listener of this.#listeners) listener(); }
  start() { if (!this.#stopped) return; this.#stopped = false; this.#connect(); }
  stop() { this.#stopped = true; this.#generation += 1; this.timers.clearTimeout(this.#timer); this.#socket?.close(); this.#socket = null; }
  #connect() {
    if (this.#stopped) return;
    const generation = ++this.#generation;
    this.#set({ status: 'connecting' });
    const protocol = this.location?.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new this.WebSocketImpl(`${protocol}://${this.location.host}/game`); this.#socket = socket;
    socket.addEventListener('open', () => {
      if (generation !== this.#generation) return;
      this.#attempt = 0; this.#set({ status: 'connected', error: '' });
      const token = this.storage?.getItem('strategy.session'); if (token) this.send('auth.resume', { sessionToken: token });
    });
    socket.addEventListener('message', event => { if (generation === this.#generation) this.#receive(event.data); });
    socket.addEventListener('close', () => {
      if (generation !== this.#generation || this.#stopped) return;
      this.#set({ status: 'disconnected' }); this.#attempt += 1;
      this.#timer = this.timers.setTimeout(() => this.#connect(), Math.min(15_000, 500 * 2 ** this.#attempt));
    });
  }
  #receive(raw) {
    let event; try { event = JSON.parse(raw); } catch { return; }
    if (event.type === 'auth.success') {
      if (event.payload.sessionToken) this.storage?.setItem('strategy.session', event.payload.sessionToken);
      this.#set({ authenticated: true, error: '' });
    } else if (event.type === 'auth.required') {
      this.storage?.removeItem('strategy.session'); this.#pending.clear();
      this.#set({ authenticated: false, game: null, map: null, mapDetails: null, demolition: null, error: event.payload.message ?? '' });
    } else if (['city.snapshot', 'city.updated'].includes(event.type)) this.#set({ game: event.payload });
    else if (event.type === 'map.snapshot') this.#set({ map: event.payload });
    else if (event.type === 'map.changed' && this.state.map && event.payload.revision > this.state.map.revision) this.requestMap(this.state.map.viewport);
    else if (event.type === 'map.details') this.#set({ mapDetails: event.payload });
    else if (event.type === 'building.preview') this.#set({ demolition: event.payload });
    else if (event.type === 'command.error') { this.#pending.delete(event.requestId); this.#set({ error: event.payload.message }); }
    else if (event.type === 'command.ok') {
      this.#pending.delete(event.requestId);
      if (event.payload.loggedOut) { this.storage?.removeItem('strategy.session'); this.#set({ authenticated: false, game: null, map: null, mapDetails: null, demolition: null }); }
      else this.#set({ message: event.payload.duplicate ? 'Auftrag war bereits bestätigt.' : 'Auftrag wurde gespeichert.', error: '' });
    } else if (event.type === 'construction.completed') this.#set({ message: 'Ein Bauauftrag wurde abgeschlossen.' });
  }
  send(type, payload = {}, requestId = createRequestId()) {
    if (this.#socket?.readyState !== this.WebSocketImpl.OPEN) throw new Error('Keine Verbindung zum Spielserver.');
    this.#socket.send(JSON.stringify({ version: 1, type, requestId, payload })); return requestId;
  }
  mutate(type, payload) { const id = createRequestId(); this.#pending.set(id, { type, payload }); this.send(type, payload, id); return id; }
  login(payload, register = false) { return this.send(register ? 'auth.register' : 'auth.login', payload); }
  logout() { return this.send('auth.logout'); }
  sync() { return this.send('city.sync'); }
  requestMap(viewport) { return this.send('map.viewport', viewport); }
  details(id) { return this.send('map.details', { id }); }
  clearDemolition() { this.#set({ demolition: null }); }
  setMapDetails(details) { this.#set({ mapDetails: details }); }
  setMessage(message) { this.#set({ message, error: '' }); }
  hasPending() { return this.#pending.size > 0; }
}

export const gameTransport = new GameTransport();
