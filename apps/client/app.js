import { createRequestId } from './request-id.js';

const resourceLabels = { wood: 'Holz', stone: 'Stein', food: 'Nahrung' };
const resourceIcons = { wood: '▰', stone: '◆', food: '●' };
const authRoot = document.querySelector('#auth');
const gameRoot = document.querySelector('#game');
const form = document.querySelector('#auth-form');
const gridRoot = document.querySelector('#city-grid');
const selectionRoot = document.querySelector('#selection');
const queueRoot = document.querySelector('#queue-list');
const messageRoot = document.querySelector('#message');
let socket;
let reconnectTimer;
let reconnectAttempt = 0;
let selectedSlotId;
let currentState;
const pending = new Map();

function element(tag, text = '', className = '') { const node = document.createElement(tag); node.textContent = text; node.className = className; return node; }
const formatDuration = milliseconds => `${Math.max(0, Math.ceil(milliseconds / 1000))} s`;
const quoteText = quote => `${quote.cost.wood} Holz · ${quote.cost.stone} Stein · ${formatDuration(quote.durationMs)}`;
const canAfford = (state, quote) => Object.entries(quote.cost).every(([resource, amount]) => state.city.resources[resource] >= amount);

function setConnection(text, connected = false) {
  document.querySelector('#connection').textContent = text;
  document.querySelector('#connection-dot').classList.toggle('online', connected);
}

function send(type, payload = {}, requestId = createRequestId()) {
  if (socket?.readyState !== WebSocket.OPEN) throw new Error('Keine Verbindung zum Spielserver.');
  socket.send(JSON.stringify({ version: 1, type, requestId, payload }));
  return requestId;
}

function connect() {
  clearTimeout(reconnectTimer);
  setConnection('Verbinde …');
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/game`);
  socket.addEventListener('open', () => {
    reconnectAttempt = 0;
    setConnection('Verbunden', true);
    const token = localStorage.getItem('strategy.session');
    if (token) send('auth.resume', { sessionToken: token });
  });
  socket.addEventListener('message', ({ data }) => {
    let event;
    try { event = JSON.parse(data); } catch { return; }
    if (event.type === 'auth.success') {
      if (event.payload.sessionToken) localStorage.setItem('strategy.session', event.payload.sessionToken);
      authRoot.hidden = true; gameRoot.hidden = false;
    } else if (event.type === 'auth.required' && !localStorage.getItem('strategy.session')) {
      authRoot.hidden = false; gameRoot.hidden = true;
    } else if (event.type === 'auth.required') {
      localStorage.removeItem('strategy.session'); authRoot.hidden = false; gameRoot.hidden = true;
      document.querySelector('#auth-message').textContent = event.payload.message;
    } else if (['city.snapshot', 'city.updated'].includes(event.type)) render(event.payload);
    else if (event.type === 'command.error') {
      (gameRoot.hidden ? document.querySelector('#auth-message') : messageRoot).textContent = event.payload.message;
      pending.delete(event.requestId); if (currentState) render(currentState);
    } else if (event.type === 'command.ok') {
      pending.delete(event.requestId);
      if (event.payload.loggedOut) { localStorage.removeItem('strategy.session'); authRoot.hidden = false; gameRoot.hidden = true; }
      else messageRoot.textContent = event.payload.duplicate ? 'Auftrag war bereits bestätigt.' : 'Auftrag wurde gespeichert.';
    } else if (event.type === 'construction.completed') messageRoot.textContent = 'Ein Bauauftrag wurde abgeschlossen.';
  });
  socket.addEventListener('close', () => {
    setConnection('Verbindung unterbrochen');
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(connect, Math.min(15_000, 500 * 2 ** reconnectAttempt));
  });
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  const mode = event.submitter?.value === 'login' ? 'login' : 'register';
  document.querySelector('#auth-message').textContent = '';
  try { send(`auth.${mode}`, { username: values.username, password: values.password, cityName: values.cityName }); }
  catch (error) { document.querySelector('#auth-message').textContent = error.message; }
});
document.querySelector('#logout').addEventListener('click', () => send('auth.logout'));

function renderResources(state) {
  document.querySelector('#resources').replaceChildren(...Object.entries(state.city.resources).map(([key, amount]) => {
    const card = element('div', '', 'resource');
    card.append(element('span', resourceIcons[key], 'resource-icon'));
    const copy = element('div'); copy.append(element('span', resourceLabels[key]), element('strong', Math.floor(amount).toLocaleString('de-DE')), element('small', ` / ${state.capacity}`)); card.append(copy); return card;
  }));
}

function buildingArt(type) {
  const art = element('span', '', `building-art ${type}`);
  if (type === 'sawmill') art.innerHTML = '<i class="house"></i><i class="logs"></i>';
  if (type === 'quarry') art.innerHTML = '<i></i><i></i><i></i>';
  if (type === 'farm') art.innerHTML = '<i class="barn"></i><i class="field"></i>';
  return art;
}

function renderGrid(state) {
  const focusId = document.activeElement?.dataset?.slotId;
  gridRoot.replaceChildren(...state.city.buildingSlots.map((slot, index) => {
    const job = state.city.constructionQueue.find(candidate => candidate.slotId === slot.id);
    const button = element('button', '', `plot ${slot.building ?? 'empty'}${slot.id === selectedSlotId ? ' selected' : ''}${job ? ' building' : ''}`);
    button.type = 'button'; button.dataset.slotId = slot.id; button.setAttribute('aria-pressed', String(slot.id === selectedSlotId));
    button.setAttribute('aria-label', slot.building ? `${state.buildings[slot.building].label}, Stufe ${slot.level}, Grundstück ${index + 1}` : `Freies Grundstück ${index + 1}`);
    button.append(element('span', String(index + 1), 'plot-number'));
    if (slot.building) button.append(buildingArt(slot.building), element('strong', state.buildings[slot.building].label), element('small', `Stufe ${slot.level}`));
    else button.append(element('span', '+', 'empty-mark'), element('strong', 'Freies Grundstück'));
    if (job) button.append(element('span', job === state.city.constructionQueue[0] ? 'Baustelle' : 'Eingeplant', 'queued-badge'));
    button.addEventListener('click', () => { selectedSlotId = slot.id; render(state); selectionRoot.querySelector('button:not(:disabled)')?.focus(); });
    return button;
  }));
  if (focusId) gridRoot.querySelector(`[data-slot-id="${focusId}"]`)?.focus({ preventScroll: true });
}

function actionButton(label, detail, disabled, action) {
  const button = element('button', '', 'action'); button.type = 'button'; button.disabled = disabled;
  button.append(element('strong', label), element('span', detail)); button.addEventListener('click', action); return button;
}
function submitConstruction(slotId, building) {
  const id = createRequestId(); pending.set(id, { slotId, building });
  try { send('construction.enqueue', { slotId, building }, id); render(currentState); }
  catch (error) { pending.delete(id); messageRoot.textContent = error.message; }
}
function renderSelection(state) {
  const slot = state.city.buildingSlots.find(candidate => candidate.id === selectedSlotId);
  if (!slot) return selectionRoot.replaceChildren(element('p', 'Wähle ein Grundstück in der Stadt, um zu bauen oder auszubauen.'));
  const queued = state.city.constructionQueue.some(job => job.slotId === slot.id);
  const content = [element('span', `GRUNDSTÜCK ${slot.id.split('-')[1]}`, 'kicker'), element('h2', slot.building ? state.buildings[slot.building].label : 'Freies Grundstück')];
  if (queued) content.push(element('p', 'Für dieses Grundstück ist bereits ein Auftrag eingeplant.', 'notice'));
  else if (slot.building) {
    content.push(element('p', `Stufe ${slot.level} · ${slot.level} ${resourceLabels[state.buildings[slot.building].resource]} pro Sekunde`));
    const quote = state.offers.upgrade[slot.id];
    if (quote) content.push(actionButton(`Auf Stufe ${quote.level} ausbauen`, quoteText(quote), pending.size > 0 || !canAfford(state, quote), () => submitConstruction(slot.id, slot.building)));
    else content.push(element('p', 'Maximale Stufe erreicht.', 'notice'));
  } else {
    const actions = element('div', '', 'actions');
    for (const [key, building] of Object.entries(state.buildings)) { const quote = state.offers.build[key]; actions.append(actionButton(building.label, quoteText(quote), pending.size > 0 || !canAfford(state, quote), () => submitConstruction(slot.id, key))); }
    content.push(element('p', 'Errichte ein Produktionsgebäude.'), actions);
  }
  selectionRoot.replaceChildren(...content);
}
function renderQueue(state) {
  document.querySelector('#queue-capacity').textContent = `${state.city.constructionQueue.length} / ${state.maxQueueLength}`;
  if (!state.city.constructionQueue.length) return queueRoot.replaceChildren(element('li', 'Keine Bauaufträge.', 'empty-queue'));
  queueRoot.replaceChildren(...state.city.constructionQueue.map((job, index) => { const item = element('li'); item.append(element('span', String(index + 1), 'queue-position'), element('strong', `${state.buildings[job.building].label} · Stufe ${job.level}`), element('span', index ? 'wartet' : `noch ${formatDuration(job.finishesAt - state.serverTime)}`)); return item; }));
}
function render(state) {
  currentState = state;
  document.querySelector('#world').textContent = state.world.name; document.querySelector('#city-name').textContent = state.city.name; document.querySelector('#commander').textContent = state.player.commanderName;
  renderResources(state); renderGrid(state); renderSelection(state); renderQueue(state);
}
connect();
