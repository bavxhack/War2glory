import { useState, useEffect } from 'react';
import { SidebarActions } from './SidebarActions.jsx';
import { resourceLabels, formatDuration } from './ui.jsx';

export function LogisticsView({state,transport,onDraftChange,connected}) {
  const [mode,setMode] = useState('delivery'), [targetId,setTarget] = useState(''), [units,setUnits] = useState({infantry:0,scout:0,truck:1});
  const [cargo,setCargo] = useState({wood:0,stone:0,food:0,oil:0}), [generalId,setGeneral] = useState(''), [generalIds,setGenerals] = useState([]);
  const [preview,setPreview] = useState(null), [busy,setBusy] = useState(false), [error,setError] = useState(''), [filter,setFilter] = useState('city'), [typeFilter,setTypeFilter] = useState('all'), [dirty,setDirty] = useState(false);
  useEffect(() => { onDraftChange(dirty); return () => onDraftChange(false); },[dirty,onDraftChange]);
  const edit = action => value => { action(value); setPreview(null); setDirty(true); setError(''); };
  const targets = (state.logisticsTargets ?? []).filter(t => t.id !== state.cityId && (mode === 'delivery' || t.own));
  const target = targets.find(t => t.id === targetId), generals = state.military.generals.filter(g => g.status === 'idle' && g.cityId === state.cityId);
  const command = { originCityId:state.cityId,targetCityId:targetId,instanceId:state.world.instanceId,
    units:mode === 'delivery' ? {truck:units.truck} : units, ...(mode === 'delivery' ? {cargo,generalId:generalId || null} : {generalIds}) };
  async function perform(start) {
    setBusy(true); setError('');
    try {
      if (start) { await transport.request(`${mode}.start`, {...command,preview}); setPreview(null); setDirty(false); }
      else setPreview(await transport.request(`${mode}.preview`,command));
    } catch(e) { setError(e.message); setPreview(null); } finally { setBusy(false); }
  }
  const modes = [['delivery','Ressourcen liefern'],['transfer','Truppen & Generäle verlegen']];
  const movements = [...(state.transports ?? []).filter(m => m.status !== 'completed'), ...(state.incomingTransports ?? [])]
    .filter(m => (filter === 'all' || m.originCityId === state.cityId || m.targetCityId === state.cityId) && (typeFilter === 'all' || m.type === typeFilter));
  return <section className="logistics-view"><h2>Logistik · {state.city.name}</h2>
    <nav className="view-tabs" aria-label="Logistikmodus">{modes.map(([key,label]) => <button key={key} aria-pressed={mode===key} className={mode===key?'active':''} onClick={() => {setMode(key);setTarget('');setUnits({infantry:0,scout:0,truck:key==='delivery'?1:0});setPreview(null);setDirty(false);setGenerals([]);setGeneral('');}}>{label}</button>)}</nav>
    <form className="card logistics-form" onSubmit={e => {e.preventDefault();void perform(false);}}>
      <h3>1. Ziel</h3><p>Ausgangsstadt: <strong>{state.city.name}</strong></p>
      <label>Zielstadt<select aria-label="Zielstadt" required value={targetId} disabled={busy} onChange={e => edit(setTarget)(e.target.value)}><option value="">Ziel auswählen</option>{targets.map(t => <option key={t.id} value={t.id}>{t.name} ({t.x}, {t.y}) · {t.own?'Eigene Stadt':t.commanderName}</option>)}</select></label>
      <p>{mode==='delivery' ? `LKWs kehren nach der Lieferung nach ${state.city.name} zurück. General optional.` : `Die ausgewählten Einheiten und Generäle sind nach Ankunft in ${target?.name ?? 'der Zielstadt'} stationiert. Keine Rückfahrt.`}</p>
      <h3>2. Auswahl</h3><div className="logistics-inputs">{(mode==='delivery'?['truck']:['infantry','scout','truck']).map(k => <label key={k}>{state.units[k].label} ({state.military.units[k]} stationiert)<input type="number" min="0" max={state.military.units[k]} step="1" disabled={busy} value={units[k]} onChange={e => edit(setUnits)({...units,[k]:Number(e.target.value)})}/></label>)}</div>
      {mode==='delivery' ? <><div className="logistics-inputs">{Object.entries(resourceLabels).map(([k,label]) => <label key={k}>{label} laden<input type="number" min="0" step="1" disabled={busy} value={cargo[k]} onChange={e => edit(setCargo)({...cargo,[k]:Number(e.target.value)})}/></label>)}</div>
        <label>General (optional)<select aria-label="General (optional)" value={generalId} disabled={busy} onChange={e => edit(setGeneral)(e.target.value)}><option value="">Ohne General</option>{generals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      </> : <fieldset><legend>Generäle verlegen (optional, Mehrfachwahl)</legend>{generals.map(g => <label className="check-label" key={g.id}><input type="checkbox" disabled={busy} checked={generalIds.includes(g.id)} onChange={e => edit(setGenerals)(e.target.checked?[...generalIds,g.id]:generalIds.filter(id=>id!==g.id))}/>{g.name}</label>)}{!generals.length && <p>Keine freien Generäle in dieser Stadt. Eine Truppenverlegung bleibt möglich.</p>}</fieldset>}
      <h3>3. Prüfung</h3><p>Mit „Transport prüfen“ im Aktionenpanel Angebot abrufen und bestätigen.</p>
      {preview && <div className="notice" aria-live="polite"><p>{preview.originName} → {preview.targetName} · Hinreise {formatDuration(preview.travelMs)}{mode==='delivery' && ` · Rückreise ${formatDuration(preview.travelMs)}`}</p>
        <p>Betriebsöl: {preview.totalOil} · {preview.distanceFields} Felder · Traglast {preview.capacity} · Unterhalt in Quelle −{preview.upkeepPerHour.toFixed(2)} Nahrung/h</p>
        {preview.targetSupply && <p>Eigene Zielstadt: {Math.floor(preview.targetSupply.food)} Nahrung · Nettobilanz jetzt {preview.targetSupply.netPerHour.toFixed(2)}/h, nach Ankunft {preview.targetSupply.netAfterPerHour.toFixed(2)}/h{preview.targetSupply.netAfterPerHour<0 && ' · Achtung: negative Versorgung'}</p>}
        {mode==='transfer' && <p>Zielunterhalt steigt ab Ankunft. Prüfe die Zielversorgung; eine schlechte Bilanz verhindert die Stationierung nicht.</p>}
        {mode==='delivery' && <p>Freie Zielkapazität wird bei Ankunft geprüft. Nicht passende Güter fahren zurück.</p>}
      </div>}{error && <p role="alert">{error}</p>}
    </form>
    <SidebarActions><section className="card"><h3>{mode==='delivery'?'Lieferung starten':'Dauerhaft verlegen'}</h3><p>{state.city.name} → {target?.name ?? 'Ziel auswählen'}</p><button disabled={busy||!target||!connected} onClick={() => void perform(false)}>Transport prüfen</button><button disabled={!preview||busy||!connected} onClick={() => void perform(true)}>{mode==='delivery'?'Lieferung starten':'Verlegung starten'}</button><p>{preview?'Aktuelle Servervorschau geprüft.':'Ziel und Auswahl im Formular prüfen.'}</p></section></SidebarActions>
    <section className="card"><h3>Laufende Transporte</h3><div className="logistics-inputs"><label>Stadtfilter<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="city">Gewählte Stadt</option><option value="all">Alle Städte</option></select></label><label>Typfilter<select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">Alle Reisen</option><option value="delivery">Lieferungen</option><option value="transfer">Verlegungen</option></select></label></div>
      {movements.length?movements.map(m => <article key={m.id} className="transport-row"><strong>{m.type==='delivery'?'Lieferung':'Verlegung'} · {m.originName} → {m.targetName}</strong><p>{m.senderName && `Absender ${m.senderName} · `}{m.status==='returning'?'Rückfahrt':'Hinreise'} · noch {formatDuration((m.status==='returning'?m.returnsAt:m.arrivesAt)-state.serverTime)}</p>{m.load && <p>Ladung: {Object.entries(m.load).map(([k,n])=>`${n} ${resourceLabels[k]}`).join(' · ')}</p>}</article>):<p>Keine Transporte.</p>}
    </section>
  </section>;
}
