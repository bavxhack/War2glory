import { createRequestId } from './request-id.js';
import { dragToPan } from './map-navigation.js';

const resourceLabels = { wood: 'Holz', stone: 'Stein', food: 'Nahrung' };
const resourceIcons = { wood: '▰', stone: '◆', food: '●' };
const authRoot = document.querySelector('#auth');
const gameRoot = document.querySelector('#game');
const form = document.querySelector('#auth-form');
const gridRoot = document.querySelector('#city-grid');
const resourcesRoot = document.querySelector('#resources');
const selectionRoot = document.querySelector('#selection');
const queueRoot = document.querySelector('#queue-list');
const messageRoot = document.querySelector('#message');
let socket;
let reconnectTimer;
let reconnectAttempt = 0;
let selectedSlotId;
let selectedMilitarySlotId;
let currentState;
let mapState;
let selectedMapId;
let mapCenter = { x: 7, y: 7 };
let mapSize = 11;
let latestMapRequest;
let mapDrag;
let suppressMapClick = false;
let scoutingTarget;
let demolitionState;
const pending = new Map();
const trainingAmounts = new Map([['scout', 1], ['infantry', 1]]);

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
    else if (event.type === 'map.snapshot' && (!latestMapRequest || !event.requestId || event.requestId === latestMapRequest)) renderMap(event.payload);
    else if (event.type === 'map.changed') { if (mapState && event.payload.revision > mapState.revision) requestMap(); }
    else if (event.type === 'map.details') renderMapDetails(event.payload);
    else if (event.type === 'building.preview') openDemolitionDialog(event.payload);
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
  const activeResources = new Set(Object.keys(state.city.resources));
  for (const card of resourcesRoot.querySelectorAll('[data-resource]')) {
    if (!activeResources.has(card.dataset.resource)) card.remove();
  }

  for (const [key, amount] of Object.entries(state.city.resources)) {
    let card = resourcesRoot.querySelector(`[data-resource="${key}"]`);
    if (!card) {
      card = element('div', '', 'resource');
      card.dataset.resource = key;
      const copy = element('div');
      const amountNode = element('strong'); amountNode.dataset.role = 'amount';
      const statusNode = element('small'); statusNode.dataset.role = 'status';
      const details = element('details', '', 'capacity-details');
      const breakdownNode = element('small'); breakdownNode.dataset.role = 'breakdown';
      details.append(element('summary', 'Lagerdetails'), breakdownNode);
      copy.append(element('span', resourceLabels[key]), amountNode, statusNode, details);
      card.append(element('span', resourceIcons[key], 'resource-icon'), copy);
      resourcesRoot.append(card);
    }

    const capacity = state.capacities[key]; const rate = state.productionRates[key];
    const breakdown = state.capacityBreakdown[key];
    card.querySelector('[data-role="amount"]').textContent = Math.floor(amount).toLocaleString('de-DE');
    card.querySelector('[data-role="status"]').textContent = ` / ${capacity} · +${rate}/s${amount >= capacity ? ' · Produktion pausiert' : ''}`;
    card.querySelector('[data-role="breakdown"]').textContent = `Grundkapazität ${breakdown.base}${breakdown.contributions.map(item => ` · ${state.buildings[item.building].label} Stufe ${item.level}: +${item.amount}`).join('')}`;
    card.classList.toggle('overstock', amount > capacity);
  }
}

function buildingArt(type) {
  const art = element('span', '', `building-art ${type}`);
  if (type === 'sawmill') art.innerHTML = '<i class="house"></i><i class="logs"></i>';
  if (type === 'quarry') art.innerHTML = '<i></i><i></i><i></i>';
  if (type === 'farm') art.innerHTML = '<i class="barn"></i><i class="field"></i>';
  if (type === 'warehouse') art.innerHTML = '<i class="warehouse-box"></i><i class="warehouse-door"></i>';
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

function unitTrainingForm(state, unit, definition, barracks) {
  const form = element('form', '', 'training-form');
  const label = element('label', `Anzahl ${definition.label}`);
  const input = document.createElement('input');
  input.type = 'number'; input.name = 'amount'; input.min = '1'; input.max = String(state.militaryRules.maxTrainingAmount);
  input.step = '1'; input.required = true; input.inputMode = 'numeric'; input.value = String(trainingAmounts.get(unit) ?? 1);
  label.append(input);
  const summary = element('small', '', 'training-summary');
  const submit = element('button', `${definition.label} in Auftrag geben`); submit.type = 'submit';
  const refresh = () => {
    const amount = Number(input.value); const valid = Number.isInteger(amount) && amount >= 1 && amount <= state.militaryRules.maxTrainingAmount;
    const costs = Object.fromEntries(Object.entries(definition.cost).map(([resource, cost]) => [resource, cost * amount]));
    const affordable = valid && Object.entries(costs).every(([resource, cost]) => state.city.resources[resource] >= cost);
    const duration = valid ? Math.ceil(definition.baseDurationMs * amount / barracks.level) : 0;
    summary.textContent = valid ? `${costs.wood} Holz · ${costs.stone} Stein · ${costs.food} Nahrung · ${formatDuration(duration)}` : `Bitte 1–${state.militaryRules.maxTrainingAmount} eingeben.`;
    const queueLength = state.military.trainingQueue.filter(job => job.barracksSlotId === barracks.id).length;
    submit.disabled = !valid || !affordable || queueLength >= state.militaryRules.trainingQueueLength;
  };
  input.addEventListener('input', () => { trainingAmounts.set(unit, Number(input.value)); refresh(); });
  form.addEventListener('submit', event => {
    event.preventDefault(); const amount = Number(input.value); trainingAmounts.set(unit, amount);
    send('training.enqueue', { barracksSlotId: barracks.id, unit, amount });
  });
  refresh(); form.append(label, summary, submit); return form;
}
function submitConstruction(slotId, building) {
  const id = createRequestId(); pending.set(id, { slotId, building });
  try { send('construction.enqueue', { slotId, building }, id); render(currentState); }
  catch (error) { pending.delete(id); messageRoot.textContent = error.message; }
}
function requestDemolition(slot) { send('building.preview', { slotId: slot.id }); }
function capacitySummary(capacities) { return Object.entries(capacities).map(([resource, value]) => `${resourceLabels[resource]} ${value}`).join(' · '); }
function openDemolitionDialog(preview) {
  demolitionState = preview;
  document.querySelector('#demolition-title').textContent = `${currentState.buildings[preview.building].label} · Stufe ${preview.level} abreißen?`;
  document.querySelector('#demolition-preview').replaceChildren(
    element('p', 'Das Gebäude wird sofort vollständig entfernt. Der Bauplatz wird frei.'),
    element('strong', `Rückerstattung: ${preview.refund.wood} Holz · ${preview.refund.stone} Stein · ${preview.refund.food} Nahrung`),
    element('p', preview.investmentComplete ? 'Berechnet aus allen nachgewiesenen bezahlten Investitionen (10 %, abgerundet).' : 'Frühere Baukosten sind nicht vollständig dokumentiert; erstattet werden nur nachgewiesene Investitionen.', preview.investmentComplete ? '' : 'notice'),
    element('p', `Lager danach: ${capacitySummary(preview.capacityAfter)}. Vorhandene Überbestände bleiben erhalten.`),
    element('p', `${preview.productionLoss ? `Produktionsverlust: ${resourceLabels[preview.productionLoss.resource]} −${preview.productionLoss.amount}/s. ` : ''}Kommandantenpunkte: ${preview.scoreBefore} → ${preview.scoreAfter}.`),
  );
  document.querySelector('#demolition-dialog').showModal();
}
function renderSelection(state) {
  const slot = state.city.buildingSlots.find(candidate => candidate.id === selectedSlotId);
  if (!slot) return selectionRoot.replaceChildren(element('p', 'Wähle ein Grundstück in der Stadt, um zu bauen oder auszubauen.'));
  const queued = state.city.constructionQueue.some(job => job.slotId === slot.id);
  const content = [element('span', `GRUNDSTÜCK ${slot.id.split('-')[1]}`, 'kicker'), element('h2', slot.building ? state.buildings[slot.building].label : 'Freies Grundstück')];
  if (queued) content.push(element('p', 'Für dieses Grundstück ist bereits ein Auftrag eingeplant.', 'notice'));
  else if (slot.building) {
    const resource = state.buildings[slot.building].resource;
    content.push(element('p', resource ? `Stufe ${slot.level} · ${slot.level} ${resourceLabels[resource]} pro Sekunde` : `Stufe ${slot.level} · erhöht alle Lagerkapazitäten`));
    const quote = state.offers.upgrade[slot.id];
    if (quote) content.push(actionButton(`Auf Stufe ${quote.level} ausbauen`, `${quoteText(quote)} · Lager danach: ${capacitySummary(quote.capacityAfter)}`, pending.size > 0 || !canAfford(state, quote), () => submitConstruction(slot.id, slot.building)));
    else content.push(element('p', 'Maximale Stufe erreicht.', 'notice'));
    content.push(actionButton('Gebäude abreißen', 'Vorschau mit Rückerstattung und Folgen öffnen', pending.size > 0, () => requestDemolition(slot)));
  } else {
    const actions = element('div', '', 'actions');
    for (const [key, building] of Object.entries(state.buildings).filter(([, building]) => building.area === 'civil')) { const quote = state.offers.build[key]; actions.append(actionButton(building.label, quoteText(quote), pending.size > 0 || !canAfford(state, quote), () => submitConstruction(slot.id, key))); }
    content.push(element('p', 'Errichte ein Produktions- oder Lagergebäude.'), actions);
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
  renderResources(state); renderGrid(state); renderSelection(state); renderQueue(state); renderMilitary(state);
  document.querySelector('#score').textContent = `Kommandantenpunkte: ${state.score.total} · Gebäude ${state.score.buildings} · Forschung: noch nicht verfügbar · Kampf/Niederlagen: noch nicht verfügbar`;
}

function renderMilitary(state) {
  const root = document.querySelector('#military-grid');
  root.replaceChildren(...state.city.militarySlots.map((slot, index) => {
    const job = state.city.constructionQueue.find(item => item.slotId === slot.id); const button = element('button', '', `plot ${slot.building ?? 'empty'}${slot.id === selectedMilitarySlotId ? ' selected' : ''}`);
    button.append(element('span', String(index + 1), 'plot-number'), element('strong', slot.building ? `${state.buildings[slot.building].label} · Stufe ${slot.level}` : 'Freier Militärbauplatz'));
    if (job) button.append(element('span', 'Eingeplant', 'queued-badge'));
    if (slot.building === 'barracks') {
      const queue = state.military.trainingQueue.filter(training => training.barracksSlotId === slot.id);
      const queueSlots = element('span', '', 'plot-training-queue');
      for (let position = 0; position < state.militaryRules.trainingQueueLength; position += 1) {
        const training = queue[position];
        queueSlots.append(element('i', training ? `${training.amount}` : '–', training ? (position === 0 ? 'active' : 'waiting') : 'free'));
      }
      button.append(queueSlots, element('small', queue.length ? `${queue.length}/3 Ausbildungsslots` : 'Ausbildung frei'));
    }
    button.addEventListener('click', () => { selectedMilitarySlotId = slot.id; renderMilitary(state); }); return button;
  }));
  const selected = state.city.militarySlots.find(slot => slot.id === selectedMilitarySlotId);
  const selection = document.querySelector('#military-selection');
  if (!selected) selection.replaceChildren(element('p', 'Wähle einen der getrennten Militärbauplätze.'));
  else if (!selected.building) selection.replaceChildren(element('h2', 'Freier Militärbauplatz'), actionButton('Kaserne bauen', quoteText(state.offers.build.barracks), !canAfford(state, state.offers.build.barracks), () => submitConstruction(selected.id, 'barracks')));
  else {
    const barracksQueue = state.military.trainingQueue.filter(job => job.barracksSlotId === selected.id);
    const content = [element('h2', `Kaserne · Stufe ${selected.level}`)]; const quote = state.offers.upgrade[selected.id];
    content.push(element('p', `Ausbildungswarteschlange dieser Kaserne: ${barracksQueue.length} / ${state.militaryRules.trainingQueueLength}`, 'barracks-capacity'));
    if (quote) content.push(actionButton('Kaserne ausbauen', barracksQueue.length ? 'Während der Ausbildung gesperrt' : quoteText(quote), barracksQueue.length > 0 || !canAfford(state, quote), () => submitConstruction(selected.id, 'barracks')));
    content.push(actionButton('Kaserne abreißen', barracksQueue.length ? 'Während der Ausbildung gesperrt' : 'Vorschau öffnen; Truppen und Generäle bleiben erhalten', barracksQueue.length > 0, () => requestDemolition(selected)));
    content.push(element('p', 'Gib eine Truppenmenge ein. Die gesamte Gruppe wird am Ende des Auftrags fertig und blockiert die Kaserne entsprechend lange.', 'notice'));
    for (const [unit, definition] of Object.entries(state.units)) content.push(unitTrainingForm(state, unit, definition, selected));
    selection.replaceChildren(...content);
  }
  const military = state.military; const general = military.generals[0];
  const unitCards = element('div', '', 'unit-visuals');
  for (const [unit, definition] of Object.entries(state.units)) {
    const card = element('article', '', 'unit-card'); const picture = document.createElement('img');
    picture.src = unit === 'scout' ? '/assets/scout-aircraft.svg' : '/assets/infantry.svg'; picture.alt = unit === 'scout' ? 'Aufklärungsflugzeug im Einsatz' : 'Infanterie in Stellung';
    card.append(picture, element('strong', definition.label), element('span', `${military.units[unit]} stationiert`)); unitCards.append(card);
  }
  const trainingList = element('ol', '', 'training-list');
  if (!military.trainingQueue.length) trainingList.append(element('li', 'Keine Streitkräfte in Ausbildung.', 'empty-queue'));
  else military.trainingQueue.toSorted((a, b) => a.finishesAt - b.finishesAt).forEach(job => {
    const barracksJobs = military.trainingQueue.filter(candidate => candidate.barracksSlotId === job.barracksSlotId).toSorted((a, b) => a.startsAt - b.startsAt);
    const position = barracksJobs.findIndex(candidate => candidate.id === job.id);
    const item = element('li'); const status = position === 0 ? `aktiv · noch ${formatDuration(job.finishesAt - state.serverTime)}` : `wartet · Start in ${formatDuration(job.startsAt - state.serverTime)}`;
    item.append(element('span', String(position + 1), 'queue-position'), element('strong', `${job.amount} ${state.units[job.unit].label}`), element('span', `Kaserne ${job.barracksSlotId.split('-').at(-1)} · ${status}`)); trainingList.append(item);
  });
  const trainingTotal = military.trainingQueue.reduce((total, job) => total + job.amount, 0);
  const deployedScouts = military.missions.filter(mission => mission.status !== 'completed').reduce((total, mission) => total + mission.scouts, 0);
  document.querySelector('#forces').replaceChildren(element('h2', 'Streitkräfte'), unitCards, element('p', `Unterwegs gebunden: ${deployedScouts} Aufklärungsflugzeuge`, 'deployed-forces'), element('h3', `In Ausbildung: ${trainingTotal}`), trainingList, element('p', `${general.name}: Level ${general.level}, ${general.experience} EP, Führung ${general.leadership}, ${general.status === 'idle' ? 'bereit' : 'unterwegs und nicht verfügbar'}`));
  document.querySelector('#missions').replaceChildren(element('h2', 'Einsätze'), ...military.missions.filter(item => item.status !== 'completed').map(item => element('p', `${item.targetName} (${item.coordinates.x},${item.coordinates.y}) · ${item.status === 'outbound' ? 'Hinmarsch' : 'Rückmarsch'} · ${formatDuration((item.status === 'outbound' ? item.arrivesAt : item.returnsAt) - state.serverTime)}`)), ...(military.missions.every(item => item.status === 'completed') ? [element('p', 'Keine aktiven Einsätze.')] : []));
  document.querySelector('#reports').replaceChildren(element('h2', 'Aufklärungsberichte'), ...military.reports.map(report => element('p', `${report.targetName}: Nahrung ${report.intelligence.food?.amount ?? '?'} / ${report.intelligence.food?.capacity ?? '?'}; Garnison noch nicht modelliert.`)), ...(military.reports.length ? [] : [element('p', 'Berichte werden erst nach der Rückkehr sichtbar.') ]));
}

function setView(view) {
  document.querySelector('#city-view').hidden = view !== 'city'; document.querySelector('#military-view').hidden = view !== 'military'; document.querySelector('#world-view').hidden = view !== 'world';
  document.querySelector('#resources').hidden = view === 'world'; document.querySelector('#score').hidden = view === 'world';
  for (const id of ['city', 'military', 'world']) { const active = view === id; const button = document.querySelector(`#show-${id}`); button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); }
  if (view === 'world' && mapState) document.querySelector('#world-map').focus();
}
document.querySelector('#show-city').addEventListener('click', () => setView('city'));
document.querySelector('#show-military').addEventListener('click', () => setView('military'));
document.querySelector('#show-world').addEventListener('click', () => { setView('world'); if (!mapState) requestMap(); });

function requestMap(center = mapCenter) {
  if (!currentState && !mapState) return;
  const bounds = mapState?.bounds ?? { width: 24, height: 24 }; const size = Math.min(mapSize, bounds.width, bounds.height);
  const x = Math.max(0, Math.min(bounds.width - size, Math.round(center.x - size / 2)));
  const y = Math.max(0, Math.min(bounds.height - size, Math.round(center.y - size / 2)));
  mapCenter = { x: x + size / 2, y: y + size / 2 };
  latestMapRequest = send('map.viewport', { x, y, width: size, height: size });
}

function renderMap(data) {
  mapState = data;
  const root = document.querySelector('#world-map'); const entityByPosition = new Map(data.entities.map(entity => [`${entity.x}:${entity.y}`, entity]));
  root.style.setProperty('--map-columns', data.viewport.width); root.replaceChildren(...data.terrain.map(terrain => {
    const entity = entityByPosition.get(`${terrain.x}:${terrain.y}`); const button = element('button', '', `world-tile ${terrain.type}${entity ? ` has-city ${entity.type}` : ''}`);
    button.type = 'button'; button.dataset.x = terrain.x; button.dataset.y = terrain.y; button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-label', entity ? `${entity.name}, ${terrain.x}, ${terrain.y}` : `${terrain.type}, ${terrain.x}, ${terrain.y}`);
    button.append(element('span', `${terrain.x},${terrain.y}`, 'coordinates'));
    if (entity) {
      button.append(element('span', entity.type === 'npc' ? '♜' : '◆', 'city-marker'), element('strong', entity.name));
      button.addEventListener('click', () => selectMapEntity(entity, terrain));
    }
    else button.addEventListener('click', () => renderMapDetails({ terrain, entity: null }));
    if (entity?.id === selectedMapId) button.classList.add('selected'); return button;
  }));
}
function selectMapEntity(entity, terrain) {
  selectedMapId = entity.id;
  renderMapDetails({ entity, terrain });
  send('map.details', { id: entity.id });
}
function renderMapDetails({ entity, terrain }) {
  const detailsRoot = document.querySelector('#map-details');
  const content = [element('span', `KOORDINATE ${terrain.x}, ${terrain.y}`, 'kicker'), element('h2', entity?.name ?? 'Unbebautes Feld'), element('p', `Gelände: ${{ plains: 'Ebene', forest: 'Wald', hills: 'Hügel', water: 'Wasser' }[terrain.type]}`)];
  if (entity) {
    const distance = Number.isFinite(entity.distance) ? entity.distance : 0;
    content.push(element('p', entity.type === 'npc' ? `NPC-Stadt · Schwierigkeit ${entity.difficulty}` : `${entity.type === 'own-city' ? 'Eigene Stadt' : 'Spielerstadt'} · ${entity.commanderName}`), element('p', `Entfernung: ${distance.toFixed(2)} Felder Luftlinie`));
    if (entity.type !== 'own-city') content.push(element('p', 'Ressourcen, Garnison und Verteidigung: Aufklärung erforderlich.', 'notice'));
    if (entity.type === 'npc' && currentState) {
      const general = currentState.military.generals.find(item => item.status === 'idle'); const scouts = currentState.military.units.scout;
      const reason = !general ? 'Kein freier General' : scouts < 1 ? 'Zuerst Aufklärungsflugzeuge ausbilden' : `Hinweg ca. ${Math.max(5, Math.ceil(distance) * 5)} s`;
      content.push(actionButton('Stadt ausspähen', reason, !general || scouts < 1, () => openScoutingDialog(entity)));
    }
    if (entity.type === 'player-city') content.push(element('p', 'Spielerstädte können in diesem Prototyp noch nicht ausgespäht werden.', 'notice'));
  }
  detailsRoot.replaceChildren(...content); detailsRoot.classList.add('has-selection'); detailsRoot.focus({ preventScroll: true });
  if (matchMedia('(max-width: 900px)').matches) detailsRoot.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateScoutingPreview() {
  const preview = document.querySelector('#scouting-preview'); const countInput = document.querySelector('#scouting-count'); const generalSelect = document.querySelector('#scouting-general');
  const general = currentState?.military.generals.find(item => item.id === generalSelect.value); const scouts = Number(countInput.value);
  const distance = Number.isFinite(scoutingTarget?.distance) ? scoutingTarget.distance : 0; const oneWaySeconds = Math.max(5, Math.ceil(distance) * 5);
  const valid = general && Number.isInteger(scouts) && scouts >= 1 && scouts <= currentState.military.units.scout && scouts <= general.leadership;
  preview.replaceChildren(element('strong', `${oneWaySeconds} s Hinweg · ${oneWaySeconds} s Rückweg`), element('span', general ? `Führungskapazität: ${general.leadership} · stationiert: ${currentState.military.units.scout}` : 'Bitte einen freien General auswählen.'));
  document.querySelector('#confirm-scouting').disabled = !valid;
}

function openScoutingDialog(entity) {
  scoutingTarget = entity;
  document.querySelector('#scouting-target').textContent = `${entity.name} · Koordinate ${entity.x}, ${entity.y} · Entfernung ${entity.distance.toFixed(2)}`;
  const generals = currentState.military.generals; const select = document.querySelector('#scouting-general');
  select.replaceChildren(...generals.map(general => {
    const option = element('option', `${general.name} · Level ${general.level} · Führung ${general.leadership}${general.status === 'idle' ? '' : ' · nicht verfügbar'}`);
    option.value = general.id; option.disabled = general.status !== 'idle'; return option;
  }));
  select.value = generals.find(general => general.status === 'idle')?.id ?? '';
  const count = document.querySelector('#scouting-count'); count.max = String(currentState.military.units.scout); count.value = String(Math.min(currentState.military.units.scout, generals.find(general => general.id === select.value)?.leadership ?? 1));
  updateScoutingPreview(); document.querySelector('#scouting-dialog').showModal(); count.focus(); count.select();
}

document.querySelector('#scouting-count').addEventListener('input', updateScoutingPreview);
document.querySelector('#scouting-general').addEventListener('change', updateScoutingPreview);
for (const id of ['close-scouting', 'cancel-scouting']) document.querySelector(`#${id}`).addEventListener('click', () => document.querySelector('#scouting-dialog').close());
document.querySelector('#scouting-form').addEventListener('submit', event => {
  event.preventDefault();
  const generalId = document.querySelector('#scouting-general').value; const scouts = Number(document.querySelector('#scouting-count').value);
  if (!scoutingTarget || !generalId || !Number.isInteger(scouts)) return;
  send('scouting.start', { targetId: scoutingTarget.id, generalId, scouts });
  document.querySelector('#scouting-dialog').close(); messageRoot.textContent = `${scouts} Aufklärungsflugzeuge wurden mit dem ausgewählten General entsandt.`;
});
for (const id of ['close-demolition', 'cancel-demolition']) document.querySelector(`#${id}`).addEventListener('click', () => document.querySelector('#demolition-dialog').close());
document.querySelector('#demolition-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!demolitionState) return;
  send('building.demolish', { slotId: demolitionState.slotId, buildingId: demolitionState.buildingId, version: demolitionState.version });
  document.querySelector('#demolition-dialog').close(); demolitionState = null;
});
document.querySelector('#coordinate-search').addEventListener('submit', event => { event.preventDefault(); const match = document.querySelector('#coordinate').value.match(/^\s*(\d+)\s*[,; ]\s*(\d+)\s*$/); if (!match) return messageRoot.textContent = 'Koordinate als x, y eingeben.'; requestMap({ x: Number(match[1]), y: Number(match[2]) }); });
document.querySelector('#own-city').addEventListener('click', () => { if (mapState?.ownCity) requestMap(mapState.ownCity); });
document.querySelector('#zoom-in').addEventListener('click', () => { mapSize = Math.max(5, mapSize - 2); document.querySelector('#zoom-label').value = `${Math.round(1100 / mapSize)} %`; requestMap(); });
document.querySelector('#zoom-out').addEventListener('click', () => { mapSize = Math.min(15, mapSize + 2); document.querySelector('#zoom-label').value = `${Math.round(1100 / mapSize)} %`; requestMap(); });
function panMap(x, y) { requestMap({ x: mapCenter.x + x, y: mapCenter.y + y }); }
const panOffsets = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
document.querySelectorAll('[data-pan]').forEach(button => button.addEventListener('click', () => panMap(...panOffsets[button.dataset.pan])));
const worldMap = document.querySelector('#world-map');
worldMap.addEventListener('keydown', event => { const offsets = { ArrowLeft: panOffsets.left, ArrowRight: panOffsets.right, ArrowUp: panOffsets.up, ArrowDown: panOffsets.down }; if (!offsets[event.key]) return; event.preventDefault(); panMap(...offsets[event.key]); });
worldMap.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !event.isPrimary) return;
  const tile = event.target.closest('.world-tile');
  mapDrag = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, tile };
  worldMap.setPointerCapture(event.pointerId); worldMap.classList.add('dragging');
});
worldMap.addEventListener('pointerup', event => {
  if (mapDrag?.pointerId !== event.pointerId) return;
  const tile = worldMap.querySelector('.world-tile');
  const offset = dragToPan(mapDrag.start, { x: event.clientX, y: event.clientY }, tile?.getBoundingClientRect().width || 46);
  const clickedTile = mapDrag.tile;
  mapDrag = null; worldMap.classList.remove('dragging'); worldMap.releasePointerCapture(event.pointerId);
  suppressMapClick = true;
  if (offset.x || offset.y) panMap(offset.x, offset.y);
  else if (clickedTile) {
    const terrain = mapState?.terrain.find(item => item.x === Number(clickedTile.dataset.x) && item.y === Number(clickedTile.dataset.y));
    const entity = mapState?.entities.find(item => item.x === Number(clickedTile.dataset.x) && item.y === Number(clickedTile.dataset.y));
    if (terrain) entity ? selectMapEntity(entity, terrain) : renderMapDetails({ entity: null, terrain });
  }
});
worldMap.addEventListener('pointercancel', event => { if (mapDrag?.pointerId === event.pointerId) { mapDrag = null; worldMap.classList.remove('dragging'); } });
worldMap.addEventListener('click', event => { if (!suppressMapClick) return; event.preventDefault(); event.stopPropagation(); suppressMapClick = false; }, true);
connect();
