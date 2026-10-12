import { SidebarActions } from './SidebarActions.jsx';
import { useCallback, useRef, useState } from 'react';
import { finishMapPointer, mapSelectionCoordinate } from '../map-navigation.js';
import { ActionButton, GameArt, Dialog } from './ui.jsx';

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
    const next = Math.max(Math.min(5, map?.bounds.width ?? 5, map?.bounds.height ?? 5), Math.min(15, map?.bounds.width ?? 15, map?.bounds.height ?? 15, size + delta));
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
          aria-label="Weltkarte mit quadratischen Feldern"
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
              className={`world-tile ${terrain.type}${entity ? ` has-city ${entity.type}` : ''}${details?.terrain?.x === terrain.x && details?.terrain?.y === terrain.y ? ' selected' : ''}`}
              aria-label={entity ? `${entity.name}, ${terrain.x}, ${terrain.y}` : `${terrain.type}, ${terrain.x}, ${terrain.y}`}
            >
              <span className="coordinates">{terrain.x},{terrain.y}</span>
              {entity && <><GameArt type="town"/><strong>{entity.name}</strong></>}
            </button>;
          })}
        </div>
        <div className="pan-controls">
          {[['up','▲',0,-1],['left','◀',-1,0],['down','▼',0,1],['right','▶',1,0]].map(([key,label,x,y]) => <button key={key} aria-label={`Karte nach ${key}`} onClick={() => pan(x,y)}>{label}</button>)}
        </div>
        <p className="map-hint">Karte mit Maus oder Finger ziehen · Pfeiltasten funktionieren ebenfalls</p>
      </div>
      <SidebarActions><div className="map-sidebar">
        <MapDetails selection={details} state={state} onScout={setScouting} onRaid={setRaiding}/><FieldActions key={`${state.cityId}-${details?.terrain?.x}-${details?.terrain?.y}`} selection={details} state={state} transport={transport}/>
        <section className="card legend"><h3>Legende</h3><span><i className="marker own"/>Eigene Stadt</span><span><i className="marker player"/>Spielerstadt</span><span><i className="marker npc"/>NPC-Stadt</span><small>Entfernung: Luftlinie in Kartenfeldern.</small></section>
      </div></SidebarActions>
    </div>
    <ScoutingDialog key={scouting?.id ?? 'scout-closed'} target={scouting} state={state} transport={transport} onClose={() => setScouting(null)}/>
    <RaidDialog key={raiding?.id ?? 'raid-closed'} target={raiding} state={state} transport={transport} onClose={() => setRaiding(null)}/>
  </section>;
}
function MapDetails({ selection, state, onScout, onRaid }) { if (!selection) return <section className="card"><p>Wähle ein Feld oder eine Stadt.</p></section>; const { entity, terrain } = selection; const distance = Number.isFinite(entity?.distance) ? entity.distance : 0; const general = state.military.generals.find(item => item.status === 'idle'); const scouts = state.military.units.scout; return <section className="card has-selection" tabIndex="-1" aria-live="polite"><span className="kicker">KOORDINATE {terrain.x}, {terrain.y}</span>{entity && <GameArt type="town" label={entity.name}/>}<h2>{entity?.name ?? 'Unbebautes Feld'}</h2><p>Gelände: {terrainLabels[terrain.type]}</p>{entity && <>{<p>{entity.type === 'claim' ? 'Reserviertes Feld' : entity.type === 'npc' ? `NPC-Stadt · Schwierigkeit ${entity.difficulty}` : `${entity.type === 'own-city' ? 'Eigene Stadt' : 'Spielerstadt'} · ${entity.commanderName}`}</p>}<p>Entfernung: {distance.toFixed(2)} Felder Luftlinie</p>{entity.type !== 'own-city' && <p className="notice">Ressourcen, Garnison und Verteidigung: Aufklärung erforderlich.</p>}{entity.type === 'npc' && <ActionButton label="Stadt ausspähen" detail={!general ? 'Kein freier General' : scouts < 1 ? 'Zuerst Aufklärungsflugzeuge ausbilden' : `Hinweg ca. ${Math.max(5, Math.ceil(distance) * 5)} s`} disabled={!general || scouts < 1} onClick={() => onScout(entity)}/>} {entity.type === 'npc' && <ActionButton label="NPC angreifen" detail={!general ? 'Kein freier General' : state.military.units.infantry < 1 ? 'Zuerst Infanterie ausbilden' : 'Vorläufige PvE-Regeln · Verluste möglich'} disabled={!general || state.military.units.infantry < 1} onClick={() => onRaid(entity)}/>} {entity.type === 'player-city' && <p className="notice">Spielerstädte können noch nicht ausgespäht werden.</p>}</>}</section>; }
function ScoutingDialog(props) { return <MissionDialog {...props} type="scout"/>; }
function RaidDialog(props) { return <MissionDialog {...props} type="raid"/>; }
function MissionDialog({ target, state, transport, onClose, type }) {
  const [generalId, setGeneralId] = useState(state.military.generals.find(g => g.status === 'idle')?.id ?? '');
  const [infantry, setInfantry] = useState(1);
  const [trucks, setTrucks] = useState(0);
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [scouts, setScouts] = useState(1);
  const [cargo, setCargo] = useState({ wood: 0, stone: 0, food: 0, oil: 0 });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!target) return null;
  const payload = { targetId: target.id, generalId, ...(type === 'raid' ? { units: { infantry, truck: trucks }, delayMinutes, cargo } : { scouts }) };
  const check = async () => {
    setBusy(true); setError(''); setPreview(null);
    try { setPreview(await transport.request(type === 'raid' ? 'raid.preview' : 'scouting.preview', payload)); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    setBusy(true); setError('');
    try { await transport.request(type === 'raid' ? 'raid.start' : 'scouting.start', { ...payload, preview }); onClose(); }
    catch (cause) { setPreview(null); setError(`${cause.message} Bitte erneut prüfen.`); }
    finally { setBusy(false); }
  };
  const edit = setter => event => { setter(event.target.type === 'number' ? Number(event.target.value) : event.target.value); setPreview(null); };
  return <Dialog open title={type === 'raid' ? 'Gemischten Farmzug planen' : 'Aufklärung planen'} kicker="EINSATZ" onClose={() => { if (!busy) onClose(); }} actions={<><button disabled={busy} onClick={check}>Einsatz prüfen</button><button disabled={busy || !preview} onClick={confirm}>Öl bezahlen und starten</button></>}>
    <p>{target.name} · Koordinate {target.x}, {target.y}</p>
    <label>General<select disabled={busy} value={generalId} onChange={edit(setGeneralId)}>{state.military.generals.map(g => <option key={g.id} value={g.id} disabled={g.status !== 'idle'}>{g.name} · {g.status === 'idle' ? 'frei' : 'gebunden'}</option>)}</select></label>
    {type === 'raid' ? <><label>Infanterie<input disabled={busy} type="number" min="1" max={state.military.units.infantry} value={infantry} onChange={edit(setInfantry)}/></label><label>LKW<input disabled={busy} type="number" min="0" max={state.military.units.truck} value={trucks} onChange={edit(setTrucks)}/></label><label>Zusätzliche Ankunftsverzögerung (Minuten)<input disabled={busy} type="number" min="0" max={state.logisticsRules.maxAttackDelayMinutes} step="1" value={delayMinutes} onChange={edit(setDelayMinutes)}/></label><p>LKWs erhöhen die Traglast, geben keine Kampfkraft und können im Kampf verloren gehen. Starttraglast ist keine garantierte Beute. Infanterie begleitet den Angriff.</p></> : <label>Späher<input disabled={busy} type="number" min="1" max={state.military.units.scout} value={scouts} onChange={edit(setScouts)}/></label>}
    {type === 'raid' && <fieldset className="cargo-inputs"><legend>Eigene Ressourcenladung</legend>{Object.entries({ wood: 'Holz', stone: 'Stein', food: 'Nahrung', oil: 'Öl (freiwillige Ladung)' }).map(([key, label]) => <label key={key}>{label}<input disabled={busy} type="number" min="0" step="1" max={Math.floor(state.city.resources[key])} value={cargo[key]} onChange={event => { setCargo({ ...cargo, [key]: Number(event.target.value) }); setPreview(null); }}/></label>)}<p>Alle Güter wiegen je einen Platz. Eigene Ladung kehrt zurück; mitgenommene Nahrung wird unterwegs nicht verbraucht. Betriebsöl benötigt zusätzlich Platz und wird verbrannt.</p></fieldset>}
    {type === 'scout' && <p>Späher tragen keine Güter oder Beute. Ihre separaten Tanks fassen {state.logisticsRules.scoutFuelCapacity} Betriebsöl je Späher.</p>}
    <p>Maximal {state.militaryRules.maxMissionUnits} Einheiten insgesamt. Kein Führungslimit. Unterwegs verbrauchen Truppen keine Nahrung aus der Stadt. Sie verlassen die Stadt sofort, auch bei zusätzlicher Verzögerung. Öl für Hin- und Rückweg wird beim Start einmalig bezahlt. Bei Ölmangel zuerst Ölverarbeitung erforschen und eine Raffinerie bauen.</p>
    {preview && <div className="mission-preview"><strong>{type === 'raid' ? `Gemeinsame Traglast vor Verlusten: ${preview.capacity}` : `Tankkapazität: ${preview.tankCapacity}`}</strong><span>Eigene Ladung: {preview.ownCargoAmount} · Betriebsöl geladen: {preview.totalOil} · Startbelegung: {preview.startOccupancy} · freie Startplätze: {preview.freeStartCapacity}</span><span>Hinwegverbrauch einschließlich Rundungsrest: {preview.outboundConsumption} · Rückwegreserve: {preview.returnReserve}</span>{type === 'raid' && <span>Prognose ohne Kampfverluste: maximal {preview.projectedLootCapacity} zusätzliche Nahrung am Ziel. Eigene Ladung und Rückwegöl haben Vorrang; tatsächliche Beute hängt auch vom NPC-Bestand ab.</span>}<span>{preview.travelMs / 1000} s Grundhinreise + {preview.delayMinutes} zusätzliche Minuten = {preview.outboundTravelMs / 1000} s gesamte Hinreise · {preview.travelMs / 1000} s Rückweg · {preview.distanceFields} Felder</span><span>Öl: {preview.baseOil} Grundbedarf ({preview.normalOneWayOil} je Richtung) + {preview.delayOil} Verzögerungszuschlag · verlängerter Hinweg {preview.outboundOil}, Rückweg {preview.returnOil} · einmalig aufgerundet {preview.totalOil}</span><span>Stadtunterhalt: {preview.upkeepBeforePerHour.toLocaleString('de-DE')} → {preview.upkeepAfterPerHour.toLocaleString('de-DE')} Nahrung/h</span><span>Voraussichtliche Ankunft: {new Date(preview.arrivesAt).toLocaleString('de-DE')} · Rückkehr: {new Date(preview.returnsAt).toLocaleString('de-DE')}. Termine verschieben sich mit dem tatsächlichen Start.</span>{type === 'raid' && <span>Gespeicherte Boni aus Grundwerten und Skills: Angriff +{preview.combatBonuses.attackPercent} % · Verteidigung −{preview.combatBonuses.defensePercent} %</span>}</div>}
    {error && <p role="alert">{error}</p>}
  </Dialog>;
}

function FieldActions({ selection, state, transport }) {
  const [dialog, setDialog] = useState(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const terrain = selection?.terrain;
  if (!terrain || terrain.type === 'water') return null;
  const sameField = item => item.coordinates?.x === terrain.x && item.coordinates?.y === terrain.y;
  const claim = state.claims?.find(c => c.x === terrain.x && c.y === terrain.y);
  if (selection.entity && !claim) return null;
  const report = [...state.military.reports].reverse().find(r => r.type === 'field-scout' && sameField(r) && r.intelligence);
  const mission = state.fieldMissions?.find(sameField);
  const reservation = state.claims?.length || state.fieldMissions?.some(m => m.type === 'conquest' && m.status === 'outbound');
  const general = state.military.generals.some(g => g.status === 'idle');
  const stale = report?.fieldCurrent === false;
  const limit = (state.cities?.length ?? 1) >= 5;
  const scoutReason = !general ? 'Kein freier General in deinem Generalstab.' : state.military.units.scout < 1 ? 'In der Ausgangsstadt fehlen Späher.' : null;
  const conquestReason = limit ? 'Du besitzt bereits fünf Städte.' : reservation && !claim ? 'Ein Eroberungszug oder Anspruch reserviert bereits deinen Stadtplatz.' : !report ? 'Zuerst aufklären und die Rückkehr des Berichts abwarten.' : stale ? 'Das Feld hat sich verändert. Erneut aufklären.' : !general ? 'Kein freier General verfügbar.' : state.military.units.infantry < 1 ? 'In der Ausgangsstadt fehlt Infanterie.' : null;
  return <section className="card field-actions" aria-label="Feldaktionen">
    <ol className="field-steps" aria-label="Weg zur neuen Stadt"><li className={report ? 'done' : 'active'}>1 · Aufklären</li><li className={claim ? 'done' : report ? 'active' : ''}>2 · Erobern</li><li className={claim ? 'active' : ''}>3 · Gründen</li></ol>
    {claim ? <><h3>Das Feld gehört dir</h3><p>Gründe hier deine nächste Stadt. Bezahlt wird aus <strong>{state.cities.find(c => c.id === claim.originCityId)?.name}</strong>.</p><p className="field-status">Noch {Math.max(0, Math.ceil((claim.expiresAt - state.serverTime) / 60000))} Minuten Zeit.</p><ActionButton label="Stadt gründen" detail="Name wählen und Gründungsgebühr prüfen" onClick={() => setDialog('found')}/></> : <>
      <h3>{report ? 'Aufgeklärtes Feld' : 'Unbekannte Verteidigung'}</h3>
      {report ? <div className={`field-intelligence${stale ? ' stale' : ''}`}><strong>{report.intelligence.defenders} Infanterie-Verteidiger</strong><span>Beobachtung vom {new Date(report.intelligence.capturedAt ?? report.returnedAt).toLocaleString('de-DE')}</span><small>{stale ? 'Bericht veraltet · neue Aufklärung erforderlich' : 'Aufklärung abgeschlossen · bereit zur Einsatzplanung'}</small></div> : <p>Schicke Späher. Nach ihrer Rückkehr kennst du die Verteidigung und kannst deine Armee planen.</p>}
      {mission && <div className="field-status" role="status"><strong>{mission.type === 'conquest' ? 'Eroberungszug' : 'Aufklärung'} · {mission.status === 'outbound' ? 'Hinreise' : 'Rückreise'}</strong><span>{mission.status === 'outbound' ? 'Ankunft' : 'Rückkehr'} in {Math.max(0, Math.ceil(((mission.status === 'outbound' ? mission.arrivesAt : mission.returnsAt) - state.serverTime) / 1000))} s</span>{mission.type === 'field-scout' && <small>Der Bericht wird erst bei Rückkehr freigegeben.</small>}{mission.result && <small>{mission.result.cancelled ? mission.result.reason : mission.result.victory ? 'Sieg · dein Anspruch ist bereit zur Gründung.' : 'Niederlage · Armee kehrt zurück. Erkunde die verbliebene Verteidigung erneut.'}</small>}</div>}
      <ActionButton label={stale ? 'Erneut aufklären' : 'Feld aufklären'} detail={scoutReason ?? 'Späher und General wählen · Öl und Reisezeit prüfen'} disabled={Boolean(scoutReason)} onClick={() => setDialog('scout')}/>
      <ActionButton label="Feld erobern" detail={conquestReason ?? 'Armee zusammenstellen und Kampfprognose prüfen'} disabled={Boolean(conquestReason)} onClick={() => setDialog('conquest')}/>
    </>}
    <p className="field-footnote">{state.cities?.length ?? 1}/5 Städte · Die Armee kehrt zur Ausgangsstadt zurück.</p>
    {dialog && (dialog !== 'found' || claim) && <FieldDialog key={`${dialog}-${terrain.x}-${terrain.y}`} kind={dialog} terrain={terrain} report={report} claim={claim} state={state} transport={transport} onClose={closeDialog}/>}
  </section>;
}

function FieldDialog({ kind, terrain, report, claim, state, transport, onClose }) {
  const conquest = kind === 'conquest', founding = kind === 'found';
  const [generalId, setGeneralId] = useState(state.military.generals.find(g => g.status === 'idle')?.id ?? '');
  const [infantry, setInfantry] = useState(Math.min(state.military.units.infantry, Math.max(1, (report?.intelligence.defenders ?? 0) + 1)));
  const [trucks, setTrucks] = useState(0), [scouts, setScouts] = useState(1), [delayMinutes, setDelayMinutes] = useState(0);
  const [cargo, setCargo] = useState({ wood: 0, stone: 0, food: 0, oil: 0 }), [name, setName] = useState('Neue Stadt');
  const [preview, setPreview] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  const payload = founding ? { claimId: claim?.id, name } : { x: terrain.x, y: terrain.y, generalId, ...(conquest ? { units: { infantry, truck: trucks }, delayMinutes, cargo, reportId: report?.id } : { scouts }) };
  const check = async () => {
    setBusy(true); setError(''); setPreview(null);
    try { setPreview(await transport.request(founding ? 'city.found.preview' : `field.${kind}.preview`, payload)); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  };
  const confirm = async () => {
    setBusy(true); setError('');
    try { await transport.request(founding ? 'city.found' : `field.${kind}.start`, { ...payload, preview }); onClose(); }
    catch (cause) { setPreview(null); setError(`${cause.message} Bitte erneut prüfen.`); } finally { setBusy(false); }
  };
  const edit = setter => event => { setter(event.target.type === 'number' ? Number(event.target.value) : event.target.value); setPreview(null); };
  const origin = state.cities?.find(c => c.id === (founding ? claim?.originCityId : state.cityId));
  const title = founding ? 'Neue Stadt gründen' : conquest ? 'Feld erobern' : 'Feld aufklären';
  const valid = founding ? Boolean(name.trim()) : Boolean(generalId) && (conquest ? Number.isSafeInteger(infantry) && infantry > 0 && infantry <= state.military.units.infantry && Number.isSafeInteger(trucks) && trucks >= 0 && trucks <= state.military.units.truck : Number.isSafeInteger(scouts) && scouts > 0 && scouts <= state.military.units.scout);
  const feeAvailable = !founding || !preview || Object.entries(preview.cost).every(([key, amount]) => origin?.resources[key] >= amount);
  return <Dialog open className="field-dialog" kicker={founding ? 'STADTGRÜNDUNG' : 'FELDEINSATZ'} title={title} onClose={close} actions={<><button disabled={busy || !valid} onClick={check}>{founding ? 'Gründungsgebühr prüfen' : 'Einsatz prüfen'}</button><button disabled={busy || !preview || !feeAvailable} onClick={confirm}>{founding ? 'Gebühr bezahlen und gründen' : conquest ? preview?.combatForecast?.victory === false ? 'Trotz Risiko angreifen' : 'Eroberung starten' : 'Aufklärung starten'}</button></>}>
    <div className="field-dialog-target"><GameArt type={founding ? 'town' : conquest ? 'infantry' : 'scout'}/><div><strong>Feld {terrain.x}, {terrain.y}</strong><span>{terrainLabels[terrain.type]} · Ausgangsstadt {origin?.name ?? state.city.name}</span>{conquest && <span>{report.intelligence.defenders} beobachtete Verteidiger</span>}</div></div>
    {founding ? <><label>Stadtname<input disabled={busy} value={name} onChange={edit(setName)}/></label><p>Die neue Stadt beginnt mit Sägewerk, Steinbruch und Bauernhof. Deine Armee kehrt weiterhin zur Ausgangsstadt zurück.</p></> : <>
      <label>General<select disabled={busy} value={generalId} onChange={edit(setGeneralId)}><option value="" disabled>Freien General auswählen</option>{state.military.generals.map(g => <option key={g.id} value={g.id} disabled={g.status !== 'idle'}>{g.name} · {g.status === 'idle' ? 'frei' : 'gebunden'}</option>)}</select></label>
      {conquest ? <><div className="field-unit-inputs"><label>Infanterie · {state.military.units.infantry} verfügbar<input type="number" disabled={busy} min="1" max={state.military.units.infantry} step="1" value={infantry} onChange={edit(setInfantry)}/></label><label>LKW · {state.military.units.truck} verfügbar<input type="number" disabled={busy} min="0" max={state.military.units.truck} step="1" value={trucks} onChange={edit(setTrucks)}/></label></div><p>Infanterie kämpft, LKWs transportieren. Keine Ressourcenbeute.</p><details className="field-options"><summary>Zusätzliche Verzögerung und eigene Ladung</summary><label>Zusätzliche Verzögerung (Minuten)<input disabled={busy} type="number" min="0" max={state.logisticsRules.maxAttackDelayMinutes} step="1" value={delayMinutes} onChange={edit(setDelayMinutes)}/></label><fieldset className="cargo-inputs"><legend>Eigene Ressourcenladung · kehrt zurück</legend>{Object.entries({ wood: 'Holz', stone: 'Stein', food: 'Nahrung', oil: 'Freiwilliges Öl' }).map(([key,label]) => <label key={key}>{label}<input disabled={busy} type="number" min="0" max={Math.floor(state.city.resources[key])} step="1" value={cargo[key]} onChange={e => { setCargo({ ...cargo, [key]: Number(e.target.value) }); setPreview(null); }}/></label>)}</fieldset></details></> : <><label>Späher · {state.military.units.scout} verfügbar<input disabled={busy} type="number" min="1" max={state.military.units.scout} step="1" value={scouts} onChange={edit(setScouts)}/></label><p>Der Bericht erscheint nach der Rückkehr. Späher benötigen Betriebsöl und tragen keine Ressourcen.</p></>}
    </>}
    {preview && <section className="field-preview" aria-label="Verbindliche Einsatzvorschau">
      {founding ? <><h3>Gründungsgebühr</h3><div className="field-preview-facts">{Object.entries(preview.cost).map(([key, amount]) => <div key={key}><span>{{wood:'Holz',stone:'Stein',food:'Nahrung'}[key]}</span><strong>{amount}</strong></div>)}</div><p>Zahlung aus {origin?.name}. Dein Anspruch bleibt bei fehlenden Rohstoffen bestehen.</p>{!feeAvailable && <p className="notice" role="alert">In der Ausgangsstadt fehlen Rohstoffe für die Gebühr.</p>}</> : <>
        {preview.combatForecast && <div className={`field-combat ${preview.combatForecast.victory ? 'victory' : 'defeat'}`} role="status"><strong>{preview.combatForecast.victory ? 'Sieg erwartet' : 'Niederlage erwartet'}</strong><span>Voraussichtlich {preview.combatForecast.survivors} überlebende Infanteristen · {preview.combatForecast.attackerLosses} Infanterieverluste.</span><small>Prognose aus deiner Aufklärung. Andere Spieler können das Feld bis zur Ankunft verändern.</small></div>}
        <div className="field-preview-facts"><div><span>Betriebsöl · einmalig</span><strong>{preview.totalOil}</strong></div><div><span>Hinreise</span><strong>{Math.ceil(preview.outboundTravelMs / 1000)} s</strong></div><div><span>Rückreise</span><strong>{Math.ceil(preview.travelMs / 1000)} s</strong></div></div>
        <p>Hinwegverbrauch {preview.outboundConsumption} Öl · Rückwegreserve {preview.returnReserve} Öl.</p>
        {conquest ? <><progress aria-label="Transportbelegung" max={preview.capacity} value={preview.startOccupancy}/><p>Belegung {preview.startOccupancy}/{preview.capacity} · eigene Ladung {preview.ownCargoAmount} · freier Platz {preview.freeStartCapacity}.</p><p>Bei einem Sieg reservierst du das Feld. Danach gründest du gegen Gebühr eine Stadt.</p></> : <p>Betriebsöltanks: {preview.totalOil}/{preview.tankCapacity} belegt.</p>}
      </>}
    </section>}
    {error && <p className="notice" role="alert">{error}</p>}
  </Dialog>;
}
