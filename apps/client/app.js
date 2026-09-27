const labels = { wood: 'Holz', stone: 'Stein', food: 'Nahrung' };
const resourceRoot = document.querySelector('#resources');
const buildingRoot = document.querySelector('#buildings');
const message = document.querySelector('#message');
const cards = new Map();
let pending = false;

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function render(state) {
  document.querySelector('#world').textContent = `Spielwelt ${state.world.name}`;
  resourceRoot.replaceChildren(...Object.entries(state.city.resources).map(([key, amount]) => {
    const card = element('div', '', 'resource');
    card.append(element('span', labels[key]), element('strong', Math.floor(amount).toLocaleString('de-DE')),
      element('small', `Kapazität ${state.capacity}`));
    return card;
  }));
  for (const [key, building] of Object.entries(state.buildings)) {
    if (!cards.has(key)) {
      const card = element('article', '', 'building');
      const title = element('h3', building.label);
      const description = element('p', '');
      const button = element('button', '');
      button.type = 'button';
      button.addEventListener('click', () => upgrade(key));
      card.append(title, description, button);
      buildingRoot.append(card);
      cards.set(key, { title, description, button });
    }
    const { title, description, button } = cards.get(key);
    const level = state.city.buildings[key];
    title.textContent = `${building.label} · Stufe ${level}`;
    description.textContent = `Produziert ${level} ${labels[building.resource]} pro Sekunde.`;
    const next = level + 1;
    button.textContent = level >= state.maxLevel ? 'Voll ausgebaut' : `Ausbauen · ${40 * next} Holz + ${30 * next} Stein · ${5 * next} s`;
    button.disabled = pending || Boolean(state.city.construction) || level >= state.maxLevel
      || state.city.resources.wood < 40 * next || state.city.resources.stone < 30 * next;
  }
  const construction = state.city.construction;
  document.querySelector('#queue').textContent = construction
    ? `${state.buildings[construction.building].label} → Stufe ${construction.level}: noch ${Math.max(0, Math.ceil((construction.finishesAt - state.serverTime) / 1000))} s`
    : 'Bauplatz frei. Wähle ein Gebäude zum Ausbauen.';
}

async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Anfrage fehlgeschlagen.');
  return data;
}

async function upgrade(building) {
  pending = true;
  for (const { button } of cards.values()) button.disabled = true;
  try {
    const state = await request('/api/upgrade', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ building }),
    });
    message.textContent = 'Bauauftrag gestartet.';
    pending = false;
    render(state);
  } catch (error) { message.textContent = error.message; }
  finally { pending = false; }
}

async function poll() {
  if (!pending) {
    try {
      const state = await request('/api/state');
      if (!pending) render(state);
    } catch (error) { message.textContent = `Verbindung unterbrochen: ${error.message}`; }
  }
  setTimeout(poll, 1000);
}
poll();
