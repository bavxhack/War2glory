import { createRequestId } from '../request-id.js';

const initialState = Object.freeze({ status: 'connecting', authenticated: false, game: null, map: null, mapDetails: null, demolition: null, message: '', error: '' });

export class GameTransport {
  #listeners = new Set(); #pending = new Map(); #socket = null; #timer = null; #attempt = 0; #generation = 0; #stopped = true;
  #requests = new Map();
  state = initialState;

  constructor({ WebSocketImpl = globalThis.WebSocket, storage = globalThis.localStorage, tabStorage = globalThis.sessionStorage, location = globalThis.location, timers = globalThis } = {}) {
    this.tabStorage = tabStorage; this.selectedCityId = tabStorage?.getItem("strategy.city") ?? null;
    this.WebSocketImpl = WebSocketImpl; this.storage = storage; this.location = location; this.timers = timers;
  }
  subscribe = listener => { this.#listeners.add(listener); return () => this.#listeners.delete(listener); };
  getSnapshot = () => this.state;
  #set(patch) { this.state = { ...this.state, ...patch }; for (const listener of this.#listeners) listener(); }
  start() { if (!this.#stopped) return; this.#stopped = false; this.#connect(); }
  #rejectRequests(message) { for (const request of this.#requests.values()) request.reject(new Error(message)); this.#requests.clear(); }
  stop() { this.#rejectRequests('Verbindung beendet.'); this.#stopped = true; this.#generation += 1; this.timers.clearTimeout(this.#timer); this.#socket?.close(); this.#socket = null; }
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
      this.#rejectRequests('Verbindung unterbrochen. Bitte den gespeicherten Stand prüfen.');
      this.#set({ status: 'disconnected' }); this.#attempt += 1;
      this.#timer = this.timers.setTimeout(() => this.#connect(), Math.min(15_000, 500 * 2 ** this.#attempt));
    });
  }
  #receive(raw) {
    let event; try { event = JSON.parse(raw); } catch { return; }
    // The connection greeting is not a failed resume and must preserve the stored token.
    if (event.type === 'auth.required' && event.requestId === 'connection') {
      if (!this.state.authenticated) this.#set({ message: event.payload.message ?? '' });
      return;
    }
    const request = this.#requests.get(event.requestId);
    if (request && ['field.scout.preview', 'field.conquest.preview', 'city.found.preview', 'raid.preview', 'scouting.preview', 'general.recruit.preview', 'general.preview', 'research.preview', 'command.ok', 'command.error'].includes(event.type)) {
      this.#requests.delete(event.requestId);
      if (event.type === 'command.error') request.reject(new Error(event.payload.message));
      else if (request.cityId && request.cityId !== this.selectedCityId) request.reject(new Error('Stadt wurde gewechselt. Bitte erneut prüfen.'));
      else request.resolve(event.payload);
    }
    if (event.type === 'auth.success') {
      if (event.payload.sessionToken) this.storage?.setItem('strategy.session', event.payload.sessionToken);
      this.#set({ authenticated: true, error: '' });
    } else if (event.type === 'auth.required') {
      this.#rejectRequests('Sitzung beendet.');
      this.storage?.removeItem('strategy.session'); this.#pending.clear();
      this.#set({ authenticated: false, game: null, map: null, mapDetails: null, demolition: null, error: event.payload.message ?? '' });
    } else if (['city.snapshot', 'city.updated'].includes(event.type)) {
      const cities = event.payload.cities;
      if (cities) {
        if (!cities.some(c => c.id === this.selectedCityId)) this.selectedCityId = cities[0].id;
        if (event.payload.cityId !== this.selectedCityId) { this.sync(); this.requestMap({}); return; }
      }
      if (this.state.game?.cityId === event.payload.cityId && this.state.game?.serverTime > event.payload.serverTime) return;
      this.#set({ game: event.payload, switching: false });
    }
    else if (event.type === 'map.snapshot' && (!this.selectedCityId || event.payload.cityId === this.selectedCityId)) {
      const selection = this.state.mapDetails, tile = selection?.terrain;
      const entity = tile ? event.payload.entities?.find(e => e.x === tile.x && e.y === tile.y) : null;
      this.#set({ map: event.payload, ...(tile ? { mapDetails: { ...selection, entity } } : {}) });
    }
    else if (event.type === 'map.changed' && this.state.map && event.payload.revision > this.state.map.revision) this.requestMap(this.state.map.viewport);
    else if (event.type === 'map.details' && (!this.selectedCityId || event.payload.cityId === this.selectedCityId)) this.#set({ mapDetails: event.payload });
    else if (event.type === 'building.preview' && (!this.selectedCityId || event.payload.cityId === this.selectedCityId)) this.#set({ demolition: event.payload });
    else if (event.type === 'command.error') { this.#pending.delete(event.requestId); this.#set({ error: event.payload.message }); }
    else if (event.type === 'command.ok') {
      this.#pending.delete(event.requestId);
      if (event.payload.loggedOut) { this.#rejectRequests('Sitzung beendet.'); this.#pending.clear(); this.storage?.removeItem('strategy.session'); this.#set({ authenticated: false, game: null, map: null, mapDetails: null, demolition: null }); }
      else this.#set({ message: event.payload.duplicate ? 'Auftrag war bereits bestätigt.' : 'Auftrag wurde gespeichert.', error: '' });
    } else if (event.type === 'construction.completed' && (!this.selectedCityId || event.payload.cityId === this.selectedCityId)) this.#set({ message: 'Ein Bauauftrag wurde abgeschlossen.' });
  }
  send(type, payload = {}, requestId = createRequestId()) {
    if (this.#socket?.readyState !== this.WebSocketImpl.OPEN) throw new Error('Keine Verbindung zum Spielserver.');
    if (this.selectedCityId && !['auth.register', 'auth.login', 'auth.resume', 'auth.logout', 'mail.send', 'mail.read'].includes(type)) payload = { cityId: this.selectedCityId, ...payload };
    this.#socket.send(JSON.stringify({ version: 1, type, requestId, payload })); return requestId;
  }
  mutate(type, payload) { const id = createRequestId(); this.#pending.set(id, { type, payload }); this.send(type, payload, id); return id; }
  request(type, payload) {
    const id = createRequestId();
    return new Promise((resolve, reject) => {
      this.#requests.set(id, { resolve, reject, cityId: this.selectedCityId });
      try { this.send(type, payload, id); }
      catch (error) { this.#requests.delete(id); reject(error); }
    });
  }
  login(payload, register = false) { return this.send(register ? 'auth.register' : 'auth.login', payload); }
  logout() { return this.send('auth.logout'); }
  selectCity(id) {
    this.selectedCityId = id; this.tabStorage?.setItem('strategy.city', id);
    this.#rejectRequests('Stadt wurde gewechselt.');
    this.#set({ switching: true, demolition: null, mapDetails: null, map: null }); this.sync(); this.requestMap({});
  }
  sync() { return this.send('city.sync'); }
  requestMap(viewport) { return this.send('map.viewport', viewport); }
  details(id) { return this.send('map.details', { id }); }
  clearDemolition() { this.#set({ demolition: null }); }
  setMapDetails(details) { this.#set({ mapDetails: details }); }
  setMessage(message) { this.#set({ message, error: '' }); }
  hasPending() { return this.#pending.size > 0; }
}

export const gameTransport = new GameTransport();
