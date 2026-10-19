import { CitySwitcher } from './CitySwitcher.jsx';
import { LogisticsView } from './LogisticsView.jsx';
import { GeneralsView } from './GeneralsView.jsx';
import { SidebarStatus, SupplyStatus } from './SidebarStatus.jsx';
import { SidebarTarget } from './SidebarActions.jsx';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Mailbox } from './Mailbox.jsx';
import { ResearchView } from './ResearchView.jsx';
import { CityView } from './CityView.jsx';
import { MilitaryView } from './MilitaryView.jsx';
import { WorldView } from './WorldView.jsx';
import { Dialog, GameArt, BuildingArt, capacitySummary, resourceLabels } from './ui.jsx';

function Login({ transport, message }) { const [values, setValues] = useState({ username: '', password: '', cityName: '' }); const [error, setError] = useState(''); const submit = register => { setError(''); try { transport.login(values, register); } catch (cause) { setError(cause.message); } }; return <div className="auth-shell"><form className="auth-card" onSubmit={event => { event.preventDefault(); submit(event.nativeEvent.submitter?.value !== 'login'); }}><GameArt type="town" className="login-art"/><span className="kicker">WILLKOMMEN, KOMMANDANT</span><h1>Deine Stadt wartet.</h1><p>Registriere dich oder melde dich an. Jede Identität besitzt eine getrennte Stadt.</p><label>Kommandantenname<input autoComplete="username" minLength="3" maxLength="24" required value={values.username} onChange={event => setValues({ ...values, username: event.target.value })}/></label><label>Passwort<input type="password" autoComplete="current-password" minLength="10" maxLength="128" required value={values.password} onChange={event => setValues({ ...values, password: event.target.value })}/></label><label>Stadtname (nur Registrierung)<input minLength="3" maxLength="32" value={values.cityName} onChange={event => setValues({ ...values, cityName: event.target.value })}/></label><div className="auth-actions"><button value="register">Registrieren</button><button value="login" className="secondary">Anmelden</button></div><p className="auth-message" role="alert">{error || message}</p></form></div>; }
function formatSupplyDuration(seconds) {
  if (seconds < 60) return `${Math.ceil(seconds)} Sekunden`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} Minuten`;
  return `${Math.ceil(seconds / 3600)} Stunden`;
}

const hourly = value => (value * 3600).toLocaleString('de-DE', { maximumFractionDigits: 2 });
function Resources({ state }) {
  const [detail,setDetail] = useState(null), close=useCallback(()=>setDetail(null),[]);
  const icons = {wood:'▰',stone:'◆',food:'●',oil:'◉'};
  return <><section aria-label="Rohstoffe" className="resources">{Object.entries(state.city.resources).map(([key,amount])=>{
    const rate=key==='food'?state.supply.net:state.productionRates[key];
    return <button className="resource" key={key} onClick={()=>setDetail(key)}><span className="resource-icon">{icons[key]}</span><span><span>{resourceLabels[key]}</span><strong>{Math.floor(amount).toLocaleString('de-DE')} / {state.capacities[key]}</strong><small>{rate>=0?'+':''}{hourly(rate)}/h</small></span></button>;
  })}</section>{detail && <Dialog open title={resourceLabels[detail]} kicker="RESSOURCENDETAILS" onClose={close}><p>Vorrat {Math.floor(state.city.resources[detail])} / {state.capacities[detail]}</p><p>Gebäude +{hourly(state.buildingProductionRates[detail])}/h · Forschung +{hourly(state.productionRates[detail]-state.buildingProductionRates[detail])}/h</p><p>Grundkapazität {state.capacityBreakdown[detail].base}{state.capacityBreakdown[detail].contributions.map(item=>` · ${state.buildings[item.building].label} Stufe ${item.level}: +${item.amount}`).join('')} · Forschungsfaktor ×{state.capacityBreakdown[detail].researchFactor.toFixed(2)}</p>{detail==='food' && <SupplyStatus state={state}/>}</Dialog>}</>;
}
function DemolitionDialog({ preview, state, transport }) { const close = useCallback(() => transport.clearDemolition(), [transport]); if (!preview) return null; return <Dialog open danger kicker="ABRISS PRÜFEN" title={`${state.buildings[preview.building].label} · Stufe ${preview.level} abreißen?`} onClose={close} actions={<button className="danger" onClick={() => { transport.mutate('building.demolish', { slotId: preview.slotId, buildingId: preview.buildingId, version: preview.version }); close(); }}>Endgültig abreißen</button>}><div className="demolition-preview"><BuildingArt type={preview.building} level={preview.level}/><p>Das Gebäude wird sofort vollständig entfernt. Der Bauplatz wird frei.</p><strong>Rückerstattung: {preview.refund.wood} Holz · {preview.refund.stone} Stein · {preview.refund.food} Nahrung · {preview.refund.oil ?? 0} Öl</strong><p className={preview.investmentComplete ? '' : 'notice'}>{preview.investmentComplete ? 'Berechnet aus allen nachgewiesenen bezahlten Investitionen (10 %, abgerundet).' : 'Frühere Baukosten sind nicht vollständig dokumentiert; erstattet werden nur nachgewiesene Investitionen.'}</p><p>Lager danach: {capacitySummary(preview.capacityAfter)}. Vorhandene Überbestände bleiben erhalten.</p><p>{preview.productionLoss && `Produktionsverlust: ${resourceLabels[preview.productionLoss.resource]} −${preview.productionLoss.amount}/s. `}Kommandantenpunkte: {preview.scoreBefore} → {preview.scoreAfter}.</p></div></Dialog>; }
const pages = [['city','Stadt','⌂'],['world','Weltkarte','◎'],['military','Militär','⚑'],['logistics','Logistik','↗'],['generals','Generäle','★'],['research','Forschung','◇'],['mail','Postbox','✉']];
export function App({ transport }) {
  const snapshot = useSyncExternalStore(transport.subscribe, transport.getSnapshot);
  const [view,setView] = useState('city'), [actionTarget,setActionTarget] = useState(null), [panel,setPanel] = useState('actions');
  const [menu,setMenu] = useState(false), [actionsOpen,setActionsOpen] = useState(false), [resourcesOpen,setResourcesOpen] = useState(false);
  const [narrow,setNarrow] = useState(()=>window.innerWidth<1280), [dirty,setDirty] = useState(false), [pendingCity,setPendingCity] = useState(null);
  const closeMenu=useCallback(()=>setMenu(false),[]), closeActions=useCallback(()=>setActionsOpen(false),[]), closeResources=useCallback(()=>setResourcesOpen(false),[]), closeSwitch=useCallback(()=>setPendingCity(null),[]);
  useEffect(()=>{transport.start();return()=>transport.stop();},[transport]);
  useEffect(()=>{const media=window.matchMedia('(max-width:1279px)');const update=()=>setNarrow(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  if (!snapshot.authenticated || !snapshot.game) return <Login transport={transport} message={snapshot.error}/>;
  const state=snapshot.game, label=pages.find(p=>p[0]===view)[1];
  const navigate=key=>{setView(key);setPanel('actions');setMenu(false);setActionsOpen(false);setDirty(false);if(key==='world'&&!snapshot.map)transport.requestMap({});};
  const selectCity=id=>{if(dirty){setPendingCity(id);return;}transport.selectCity(id);setPanel('actions');setActionsOpen(false);};
  const preview=slot=>{try{transport.send('building.preview',{slotId:slot.id});}catch(e){transport.setMessage(e.message);}};
  const navigation=<nav aria-label="Hauptnavigation">{pages.map(([key,name,icon])=><button key={key} aria-label={key==='mail'?`Postbox, ${state.mailbox.unreadCount} ungelesene Einträge`:name} aria-current={view===key?'page':undefined} className={view===key?'active':''} onClick={()=>navigate(key)}><span aria-hidden="true">{icon}</span>{name}{key==='mail'&&state.mailbox.unreadCount>0&&<span className="mail-badge">{state.mailbox.unreadCount}</span>}</button>)}</nav>;
  const panelContent=<><div className="context-tabs" role="tablist" aria-label="Kontextpanel">{[['actions','Aktionen'],['activity','Aktivitäten'],['supply','Versorgung']].map(([key,name])=><button key={key} role="tab" aria-selected={panel===key} onClick={()=>setPanel(key)}>{name}</button>)}</div>
    <section hidden={panel!=='actions'} className="sidebar-actions" aria-label="Aktionen der Ansicht"><div ref={setActionTarget}/>{view==='mail'&&<p>Wähle einen Bericht oder schreibe eine Nachricht.</p>}</section>
    <section hidden={panel!=='activity'}><SidebarStatus state={state} onNavigate={navigate}/></section>
    <section hidden={panel!=='supply'}><SupplyStatus state={state}/></section></>;
  const warn=state.cities.filter(c=>c.inShortage), global=['generals','research','mail'].includes(view);
  return <div className="game-shell">
    {!narrow&&<aside className="main-navigation"><div><span className="kicker">FEDERATED STRATEGY</span><h2>Navigation</h2></div>{navigation}<div className="account-status"><strong>{state.player.commanderName}</strong><span>{state.score.total} Kommandantenpunkte</span><span>{snapshot.status==='connected'?'● Verbunden':'Verbindung unterbrochen'}</span><button onClick={()=>transport.logout()}>Abmelden</button></div></aside>}
    <main className="game-main"><header className="city-header"><div className="city-header-title">{narrow&&<button className="menu-toggle" onClick={()=>setMenu(true)}>Menü · {label}</button>}<h1 className="visually-hidden">{state.city.name}</h1><CitySwitcher state={state} transport={transport} onSelect={selectCity}/><button className="mobile-resource-button" onClick={()=>setResourcesOpen(true)}>Ressourcen</button></div><div className="header-resources"><Resources state={state}/></div>
      {snapshot.status!=='connected'&&<p className="notice" role="status">Verbindung unterbrochen · Starts pausieren bis zur Wiederverbindung.</p>}
      {state.supply.inShortage&&<p className="compact-warning" role="alert">{state.city.name}: Nahrungsmangel · Ausbildung pausiert · Hungerwelle in {Math.max(0,Math.ceil((state.supply.nextLossAt-state.serverTime)/60000))} Minuten.</p>}
      {warn.some(c=>c.id!==state.cityId)&&<details className="compact-warning"><summary>{warn.filter(c=>c.id!==state.cityId).length} weitere Städte mit Nahrungsmangel</summary>{warn.filter(c=>c.id!==state.cityId).map(c=><button key={c.id} onClick={()=>selectCity(c.id)}>{c.name}</button>)}</details>}
    </header>
    <div className="workspace-heading"><span>{label} · {global?'Alle Städte':state.city.name}</span>{narrow&&<button onClick={()=>{setPanel('actions');setActionsOpen(true);}}>{view==='city'?'Gebäude verwalten':view==='world'?'Feldaktionen':'Aktionen'}</button>}</div>
    {state.migrationNotices.map((text,i)=><p key={i} className="notice">{text}</p>)}
    <SidebarTarget.Provider value={actionTarget}><div className="workspace-layout"><div className={`workspace-content${view==='world'?' map-workspace':''}`} onInput={()=>setDirty(true)} onClickCapture={()=>setPanel('actions')}>
      {snapshot.switching?<p role="status">Stadt wird geladen …</p>:<>
      {view==='city'&&<CityView key={state.cityId} state={state} transport={transport} onPreview={preview} onResearch={()=>navigate('research')}/>}
      {view==='world'&&<WorldView key={state.cityId} state={state} map={snapshot.map} details={snapshot.mapDetails} transport={transport}/>}
      {view==='military'&&<MilitaryView key={state.cityId} state={state} transport={transport} onPreview={preview}/>}
      {view==='logistics'&&<LogisticsView key={state.cityId} state={state} transport={transport} connected={snapshot.status==='connected'} onDraftChange={setDirty}/>}
      {view==='generals'&&<GeneralsView state={state} transport={transport}/>}
      {view==='research'&&<ResearchView key={state.cityId} state={state} transport={transport}/>}
      {view==='mail'&&<Mailbox key={state.player.id} state={state} transport={transport}/>}
      </>}
    </div>{!narrow&&<aside className="persistent-sidebar" aria-label="Kontextpanel"><h2>Aktionen · {label}</h2>{panelContent}</aside>}</div></SidebarTarget.Provider>
    {narrow&&<Dialog open={actionsOpen} title={`Aktionen · ${label}`} kicker="KONTEXTPANEL" onClose={closeActions}>{panelContent}</Dialog>}
    <p className="message" role="status">{snapshot.error||snapshot.message}</p>
    <DemolitionDialog preview={snapshot.demolition} state={state} transport={transport}/>
    {menu&&<Dialog open title="Navigation" kicker="MENÜ" onClose={closeMenu}>{navigation}<p>{state.player.commanderName} · {state.score.total} Punkte · {snapshot.status==='connected'?'Verbunden':'Unterbrochen'}</p><button onClick={()=>transport.logout()}>Abmelden</button></Dialog>}
    {resourcesOpen&&<Dialog open title={`Ressourcen · ${state.city.name}`} kicker="RESSOURCEN" onClose={closeResources}><Resources state={state}/></Dialog>}
    {pendingCity&&<Dialog open title="Stadt wechseln?" kicker="ENTWURF" onClose={closeSwitch} actions={<button onClick={()=>{transport.selectCity(pendingCity);setPendingCity(null);setDirty(false);setActionsOpen(false);setPanel('actions');}}>Entwurf verwerfen und Stadt wechseln</button>}><p>Die ungesendete Auswahl gehört zu {state.city.name}. Sie wird beim Wechsel verworfen.</p></Dialog>}
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">{[['city','Stadt'],['world','Welt'],['logistics','Logistik']].map(([key,name])=><button key={key} aria-current={view===key?'page':undefined} onClick={()=>navigate(key)}>{name}</button>)}<button onClick={()=>setMenu(true)}>Mehr</button></nav>
    </main>
  </div>;
}
