import { useRef, useState } from 'react';
import { finishMapPointer, mapSelectionCoordinate } from '../map-navigation.js';
import { ActionButton, Dialog } from './ui.jsx';

const terrainLabels = { plains: 'Ebene', forest: 'Wald', hills: 'Hügel', water: 'Wasser' };
export function WorldView({ state, map, details, transport }) {
  const [size, setSize] = useState(11);
  const [center, setCenter] = useState(map?.ownCity ?? { x: 7, y: 7 });
  const [coordinate, setCoordinate] = useState('');
  const [scouting, setScouting] = useState(null);
  const [raiding, setRaiding] = useState(null);
  const [drag, setDrag] = useState(null);
  const root = useRef(null);
  const suppressClick = useRef(false);
  const pressedCoordinate = useRef(null);

  const request = (nextCenter = center, nextSize = size) => {
    const bounds = map?.bounds ?? { width: 24, height: 24 };
    const actual = Math.min(nextSize, bounds.width, bounds.height);
    const x = Math.max(0, Math.min(bounds.width - actual, Math.round(nextCenter.x - actual / 2)));
    const y = Math.max(0, Math.min(bounds.height - actual, Math.round(nextCenter.y - actual / 2)));
    setCenter({ x: x + actual / 2, y: y + actual / 2 });
    transport.requestMap({ x, y, width: actual, height: actual });
  };
  const pan = (x, y) => request({ x: center.x + x, y: center.y + y });
  const zoom = delta => {
    const next = Math.max(5, Math.min(15, size + delta));
    setSize(next);
    request(center, next);
  };
  const entityByPosition = new Map((map?.entities ?? []).map(entity => [`${entity.x}:${entity.y}`, entity]));
  const terrainByPosition = new Map((map?.terrain ?? []).map(terrain => [`${terrain.x}:${terrain.y}`, terrain]));
  const select = (entity, terrain) => {
    transport.setMapDetails({ entity, terrain });
    if (entity) transport.details(entity.id);
  };
  const selectTileFromEvent = event => {
    const tile = event.target.closest('[data-map-coordinate]');
    const key = mapSelectionCoordinate({
      clickedCoordinate: tile && event.currentTarget.contains(tile) ? tile.dataset.mapCoordinate : null,
      pressedCoordinate: pressedCoordinate.current,
      suppressClick: suppressClick.current,
    });
    suppressClick.current = false;
    pressedCoordinate.current = null;
    if (!key) return;
    select(entityByPosition.get(key), terrainByPosition.get(key));
  };

  return <section aria-labelledby="world-heading">
    <div className="world-toolbar">
      <div><span className="kicker">GEMEINSAME WELT</span><h2 id="world-heading">Weltkarte</h2></div>
      <form onSubmit={event => {
        event.preventDefault();
        const match = coordinate.match(/^\s*(\d+)\s*[,; ]\s*(\d+)\s*$/);
        if (!match) return transport.setMessage('Koordinate als x, y eingeben.');
        request({ x: Number(match[1]), y: Number(match[2]) });
      }}>
        <label>Koordinate <input value={coordinate} onChange={event => setCoordinate(event.target.value)} placeholder="z. B. 12, 8" inputMode="numeric"/></label>
        <button>Suchen</button>
      </form>
      <div className="zoom">
        <button onClick={() => zoom(2)} aria-label="Verkleinern">−</button>
        <output>{Math.round(1100 / size)} %</output>
        <button onClick={() => zoom(-2)} aria-label="Vergrößern">+</button>
        <button onClick={() => map?.ownCity && request(map.ownCity)}>Zur eigenen Stadt</button>
      </div>
    </div>
    <div className="world-layout">
      <div className="map-stage">
        <div
          ref={root}
          className={`world-map${drag ? ' dragging' : ''}`}
          style={{ '--map-columns': map?.viewport.width ?? size }}
          role="grid"
          tabIndex="0"
          aria-label="Quadratische Weltkarte"
          onClick={selectTileFromEvent}
          onKeyDown={event => {
            const offsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
            if (offsets[event.key]) { event.preventDefault(); pan(...offsets[event.key]); }
          }}
          onPointerDown={event => {
            if (event.button !== 0 || !event.isPrimary) return;
            suppressClick.current = false;
            pressedCoordinate.current = event.target.closest('[data-map-coordinate]')?.dataset.mapCoordinate ?? null;
            root.current.setPointerCapture(event.pointerId);
            setDrag({ id: event.pointerId, start: { x: event.clientX, y: event.clientY } });
          }}
          onPointerCancel={() => { suppressClick.current = true; pressedCoordinate.current = null; setDrag(null); }}
          onPointerUp={event => {
            if (drag?.id !== event.pointerId) return;
            const tileSize = root.current.querySelector('.world-tile')?.getBoundingClientRect().width || 46;
            const release = finishMapPointer(drag.start, { x: event.clientX, y: event.clientY }, tileSize);
            suppressClick.current = release.suppressClick;
            setDrag(null);
            if (release.suppressClick) pan(release.offset.x, release.offset.y);
          }}
        >
          {map?.terrain.map(terrain => {
            const key = `${terrain.x}:${terrain.y}`;
            const entity = entityByPosition.get(key);
            return <button
              type="button"
              role="gridcell"
              key={key}
              data-map-coordinate={key}
              className={`world-tile ${terrain.type}${entity ? ` has-city ${entity.type}` : ''}${details?.entity?.id === entity?.id ? ' selected' : ''}`}
              aria-label={entity ? `${entity.name}, ${terrain.x}, ${terrain.y}` : `${terrain.type}, ${terrain.x}, ${terrain.y}`}
            >
              <span className="coordinates">{terrain.x},{terrain.y}</span>
              {entity && <><span className="city-marker">{entity.type === 'npc' ? '♜' : '◆'}</span><strong>{entity.name}</strong></>}
            </button>;
          })}
        </div>
        <div className="pan-controls">
          {[['up','▲',0,-1],['left','◀',-1,0],['down','▼',0,1],['right','▶',1,0]].map(([key,label,x,y]) => <button key={key} aria-label={`Karte nach ${key}`} onClick={() => pan(x,y)}>{label}</button>)}
        </div>
        <p className="map-hint">Karte mit Maus oder Finger ziehen · Pfeiltasten funktionieren ebenfalls</p>
      </div>
      <aside className="map-sidebar">
        <MapDetails selection={details} state={state} onScout={setScouting} onRaid={setRaiding}/>
        <section className="card legend"><h3>Legende</h3><span><i className="marker own"/>Eigene Stadt</span><span><i className="marker player"/>Spielerstadt</span><span><i className="marker npc"/>NPC-Stadt</span><small>Entfernung: Luftlinie in Kartenfeldern.</small></section>
      </aside>
    </div>
    <ScoutingDialog target={scouting} state={state} transport={transport} onClose={() => setScouting(null)}/>
    <RaidDialog target={raiding} state={state} transport={transport} onClose={() => setRaiding(null)}/>
  </section>;
}
function MapDetails({ selection, state, onScout, onRaid }) { if (!selection) return <section className="card"><p>Wähle ein Feld oder eine Stadt.</p></section>; const { entity, terrain } = selection; const distance = Number.isFinite(entity?.distance) ? entity.distance : 0; const general = state.military.generals.find(item => item.status === 'idle'); const scouts = state.military.units.scout; return <section className="card has-selection" tabIndex="-1" aria-live="polite"><span className="kicker">KOORDINATE {terrain.x}, {terrain.y}</span><h2>{entity?.name ?? 'Unbebautes Feld'}</h2><p>Gelände: {terrainLabels[terrain.type]}</p>{entity && <>{<p>{entity.type === 'npc' ? `NPC-Stadt · Schwierigkeit ${entity.difficulty}` : `${entity.type === 'own-city' ? 'Eigene Stadt' : 'Spielerstadt'} · ${entity.commanderName}`}</p>}<p>Entfernung: {distance.toFixed(2)} Felder Luftlinie</p>{entity.type !== 'own-city' && <p className="notice">Ressourcen, Garnison und Verteidigung: Aufklärung erforderlich.</p>}{entity.type === 'npc' && <ActionButton label="Stadt ausspähen" detail={!general ? 'Kein freier General' : scouts < 1 ? 'Zuerst Aufklärungsflugzeuge ausbilden' : `Hinweg ca. ${Math.max(5, Math.ceil(distance) * 5)} s`} disabled={!general || scouts < 1} onClick={() => onScout(entity)}/>} {entity.type === 'npc' && <ActionButton label="NPC angreifen" detail={!general ? 'Kein freier General' : state.military.units.infantry < 1 ? 'Zuerst Infanterie ausbilden' : 'Vorläufige PvE-Regeln · Verluste möglich'} disabled={!general || state.military.units.infantry < 1} onClick={() => onRaid(entity)}/>} {entity.type === 'player-city' && <p className="notice">Spielerstädte können noch nicht ausgespäht werden.</p>}</>}</section>; }
function ScoutingDialog({ target, state, transport, onClose }) { const idle = state.military.generals.find(item => item.status === 'idle'); const [generalId, setGeneralId] = useState(idle?.id ?? ''); const [scouts, setScouts] = useState(1); if (!target) return null; const general = state.military.generals.find(item => item.id === generalId); const valid = general && Number.isInteger(scouts) && scouts >= 1 && scouts <= state.military.units.scout && scouts <= general.leadership; const seconds = Math.max(5, Math.ceil(target.distance ?? 0) * 5); return <Dialog open title="Stadt ausspähen" kicker="EINSATZ PLANEN" onClose={onClose} actions={<button disabled={!valid} onClick={() => { transport.mutate('scouting.start', { targetId: target.id, generalId, scouts }); transport.setMessage(`${scouts} Aufklärungsflugzeuge wurden entsandt.`); onClose(); }}>Einsatz starten</button>}><p>{target.name} · Koordinate {target.x}, {target.y} · Entfernung {target.distance.toFixed(2)}</p><label>General<select value={generalId} onChange={event => setGeneralId(event.target.value)}>{state.military.generals.map(item => <option key={item.id} value={item.id} disabled={item.status !== 'idle'}>{item.name} · Level {item.level} · Führung {item.leadership}{item.status !== 'idle' && ' · nicht verfügbar'}</option>)}</select></label><label>Anzahl Aufklärungsflugzeuge<input type="number" min="1" max={state.military.units.scout} value={scouts} onChange={event => setScouts(Number(event.target.value))}/></label><div className="mission-preview"><strong>{seconds} s Hinweg · {seconds} s Rückweg</strong><span>Führungskapazität: {general?.leadership ?? 0} · stationiert: {state.military.units.scout}</span></div></Dialog>; }

function RaidDialog({ target, state, transport, onClose }) {
  const idle = state.military.generals.find(item => item.status === 'idle');
  const [generalId, setGeneralId] = useState(idle?.id ?? '');
  const [infantry, setInfantry] = useState(1);
  if (!target) return null;
  const general = state.military.generals.find(item => item.id === generalId);
  const valid = general && Number.isInteger(infantry) && infantry >= 1 && infantry <= state.military.units.infantry && infantry <= general.leadership;
  const seconds = Math.max(5, Math.ceil(target.distance ?? 0) * 5);
  const freeFood = Math.max(0, state.capacities.food - state.city.resources.food);
  return <Dialog open title="NPC-Stadt angreifen" kicker="VORLÄUFIGER FARMZUG" onClose={onClose} actions={<button disabled={!valid} onClick={() => { transport.mutate('raid.start', { targetId: target.id, generalId, infantry }); transport.setMessage(`${infantry} Infanteristen wurden entsandt.`); onClose(); }}>Angriff starten</button>}>
    <p>{target.name} · {seconds} s Hinweg · {seconds} s Rückweg</p>
    <p className="notice">Prototypregel: Infanterie kämpft deterministisch und trägt je Überlebendem 20 Nahrung. Der General überlebt; bei Niederlage fällt die gesamte Angriffstruppe. Gegner und Beute können sich bis zur Ankunft ändern.</p>
    <label>General<select value={generalId} onChange={event => setGeneralId(event.target.value)}>{state.military.generals.map(item => <option key={item.id} value={item.id} disabled={item.status !== 'idle'}>{item.name} · Führung {item.leadership}{item.status !== 'idle' && ' · gebunden'}</option>)}</select></label>
    <label>Infanterie<input type="number" min="1" max={Math.min(state.military.units.infantry, general?.leadership ?? 0)} value={infantry} onChange={event => setInfantry(Number(event.target.value))}/></label>
    <div className="mission-preview"><strong>Maximale Traglast vor Verlusten: {Number.isInteger(infantry) ? infantry * 20 : 0} Nahrung</strong><span>Aktuell freier Lagerplatz: {Math.floor(freeFood)} (bei Rückkehr neu berechnet)</span></div>
  </Dialog>;
}
