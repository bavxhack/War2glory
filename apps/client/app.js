const resourceLabels = { wood: 'Holz', stone: 'Stein', food: 'Nahrung' };
const resourceIcons = { wood: '◫', stone: '◆', food: '●' };
const resourceRoot = document.querySelector('#resources');
const gridRoot = document.querySelector('#city-grid');
const selectionRoot = document.querySelector('#selection');
const queueRoot = document.querySelector('#queue-list');
const messageRoot = document.querySelector('#message');
let selectedSlotId = null;
let currentState = null;
let pending = false;

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function formatDuration(milliseconds) {
  return `${Math.ceil(milliseconds / 1000)} s`;
}

function quoteText(quote) {
  return `${quote.cost.wood} Holz · ${quote.cost.stone} Stein · ${formatDuration(quote.durationMs)}`;
}

function canAfford(state, quote) {
  return Object.entries(quote.cost).every(([resource, amount]) => state.city.resources[resource] >= amount);
}

function renderResources(state) {
  resourceRoot.replaceChildren(...Object.entries(state.city.resources).map(([key, amount]) => {
    const card = element('div', '', 'resource');
    const icon = element('span', resourceIcons[key], 'resource-icon');
    icon.setAttribute('aria-hidden', 'true');
    const copy = element('div', '');
    copy.append(element('span', resourceLabels[key]), element('strong', Math.floor(amount).toLocaleString('de-DE')),
      element('small', `von ${state.capacity}`));
    card.append(icon, copy);
    return card;
  }));
}

function renderGrid(state) {
  const queuedSlots = new Set(state.city.constructionQueue.map(job => job.slotId));
  gridRoot.replaceChildren(...state.city.buildingSlots.map((slot, index) => {
    const button = element('button', '', `plot${slot.building ? ' occupied' : ' empty'}`);
    if (slot.id === selectedSlotId) button.classList.add('selected');
    button.type = 'button';
    button.dataset.slotId = slot.id;
    button.setAttribute('aria-pressed', String(slot.id === selectedSlotId));
    const position = element('span', String(index + 1).padStart(2, '0'), 'plot-number');
    if (slot.building) {
      const building = state.buildings[slot.building];
      button.setAttribute('aria-label', `${building.label}, Stufe ${slot.level}, Bauplatz ${index + 1}`);
      button.append(position, element('span', building.label.slice(0, 1), 'building-mark'),
        element('strong', building.label), element('small', `Stufe ${slot.level}`));
    } else {
      button.setAttribute('aria-label', `Freier Bauplatz ${index + 1}`);
      button.append(position, element('span', '+', 'building-mark'), element('strong', 'Freier Platz'), element('small', 'Gebäude errichten'));
    }
    if (queuedSlots.has(slot.id)) button.append(element('span', 'Eingeplant', 'queued-badge'));
    button.addEventListener('click', () => {
      selectedSlotId = slot.id;
      render(state);
      selectionRoot.querySelector('button:not(:disabled)')?.focus();
    });
    return button;
  }));
}

function actionButton(label, detail, disabled, action) {
  const button = element('button', '', 'action');
  button.type = 'button';
  button.disabled = disabled;
  button.append(element('strong', label), element('span', detail));
  button.addEventListener('click', action);
  return button;
}

function renderSelection(state) {
  const slot = state.city.buildingSlots.find(candidate => candidate.id === selectedSlotId);
  if (!slot) {
    selectionRoot.replaceChildren(element('p', 'Wähle einen Bauplatz auf der Karte, um dort zu bauen oder ein Gebäude auszubauen.'));
    return;
  }
  const queuedJob = state.city.constructionQueue.find(job => job.slotId === slot.id);
  const heading = element('h3', slot.building ? state.buildings[slot.building].label : 'Freier Bauplatz');
  const intro = element('p', slot.building
    ? `Stufe ${slot.level} · Produktion ${slot.level} ${resourceLabels[state.buildings[slot.building].resource]} pro Sekunde`
    : 'Errichte hier eines der verfügbaren Produktionsgebäude.');
  const content = [heading, intro];

  if (queuedJob) {
    content.push(element('p', `Bereits eingeplant: ${queuedJob.type === 'build' ? 'Neubau' : 'Ausbau'} auf Stufe ${queuedJob.level}.`, 'notice'));
  } else if (slot.building) {
    const quote = state.offers.upgrade[slot.id];
    if (quote) content.push(actionButton(`Auf Stufe ${quote.level} ausbauen`, quoteText(quote),
      pending || state.city.constructionQueue.length >= state.maxQueueLength || !canAfford(state, quote),
      () => submitConstruction(slot.id, slot.building)));
    else content.push(element('p', slot.level >= state.maxLevel ? 'Maximale Stufe erreicht.' : 'Kein Ausbau verfügbar.', 'notice'));
  } else {
    const actions = element('div', '', 'actions');
    for (const [buildingKey, building] of Object.entries(state.buildings)) {
      const quote = state.offers.build[buildingKey];
      actions.append(actionButton(building.label, quoteText(quote),
        pending || state.city.constructionQueue.length >= state.maxQueueLength || !canAfford(state, quote),
        () => submitConstruction(slot.id, buildingKey)));
    }
    content.push(actions);
  }
  selectionRoot.replaceChildren(...content);
}

function renderQueue(state) {
  document.querySelector('#queue-capacity').textContent = `${state.city.constructionQueue.length} / ${state.maxQueueLength} belegt`;
  if (state.city.constructionQueue.length === 0) {
    queueRoot.replaceChildren(element('li', 'Noch keine Bauaufträge. Wähle einen Platz auf der Stadtkarte.', 'empty-queue'));
    return;
  }
  queueRoot.replaceChildren(...state.city.constructionQueue.map((job, index) => {
    const remaining = Math.max(0, job.finishesAt - state.serverTime);
    const item = element('li', '');
    item.append(element('span', String(index + 1), 'queue-position'),
      element('strong', `${state.buildings[job.building].label} · Stufe ${job.level}`),
      element('span', index === 0 ? `noch ${formatDuration(remaining)}` : `danach · ${formatDuration(job.finishesAt - job.startsAt)}`));
    return item;
  }));
}

function render(state) {
  currentState = state;
  document.querySelector('#world').textContent = `Spielwelt ${state.world.name}`;
  renderResources(state);
  renderGrid(state);
  renderSelection(state);
  renderQueue(state);
}

async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Anfrage fehlgeschlagen.');
  return data;
}

async function submitConstruction(slotId, building) {
  pending = true;
  render(currentState);
  try {
    const state = await request('/api/construction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: crypto.randomUUID(), slotId, building }),
    });
    messageRoot.textContent = 'Bauauftrag wurde in die Warteschlange aufgenommen.';
    currentState = state;
  } catch (error) {
    messageRoot.textContent = error.message;
  } finally {
    pending = false;
    render(currentState);
  }
}

async function poll() {
  if (!pending) {
    try {
      const state = await request('/api/state');
      if (!pending) render(state);
    } catch (error) {
      messageRoot.textContent = `Verbindung unterbrochen: ${error.message}`;
    }
  }
  setTimeout(poll, 1000);
}

poll();
