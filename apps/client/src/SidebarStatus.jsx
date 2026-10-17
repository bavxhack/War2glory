import { missionForces } from '../force-summary.js';
import { formatDuration } from './ui.jsx';

const perHour = value => (value * 3600).toLocaleString('de-DE', { maximumFractionDigits: 3 });

function timeUntilEmpty(food, netPerSecond) {
  if (netPerSecond >= 0 || food <= 0) return null;
  return formatDuration(food / -netPerSecond * 1000);
}

export function SupplyStatus({ state }) {
  const supply = state.supply;
  const remaining = timeUntilEmpty(state.city.resources.food, supply.net);

  return <section className="card supply-status" aria-labelledby="supply-heading">
    <div className="queue-title">
      <h2 id="supply-heading">Truppenunterhalt</h2>
      <strong className={supply.net < 0 ? 'negative-rate' : 'positive-rate'}>{supply.net >= 0 ? '+' : ''}{perHour(supply.net)}/h</strong>
    </div>
    <dl className="supply-breakdown">
      <div><dt>Grundproduktion</dt><dd>+{perHour(supply.baseProduction)}/h</dd></div>
      <div><dt>Forschung</dt><dd>+{perHour(supply.researchProduction)}/h</dd></div>
      <div><dt>Bürgermeister</dt><dd>+{perHour(supply.mayorProduction)}/h</dd></div>
      <div><dt>{supply.unitCounts.infantry} Infanteristen × {perHour(state.supplyRules.upkeepPerSecond.infantry)} Nahrung/h</dt><dd>−{perHour((state.supplyRules.upkeepPerSecond.infantry ?? 0) * supply.unitCounts.infantry)}/h</dd></div>
      <div><dt>{supply.unitCounts.scout} Späher × {perHour(state.supplyRules.upkeepPerSecond.scout)} Nahrung/h</dt><dd>−{perHour((state.supplyRules.upkeepPerSecond.scout ?? 0) * supply.unitCounts.scout)}/h</dd></div>
      <div><dt>{supply.unitCounts.truck ?? 0} LKW × {perHour(state.supplyRules.upkeepPerSecond.truck ?? 0)} Nahrung/h</dt><dd>−{perHour((state.supplyRules.upkeepPerSecond.truck ?? 0) * (supply.unitCounts.truck ?? 0))}/h</dd></div>
      <div className="supply-total"><dt>Gesamtunterhalt</dt><dd>−{perHour(supply.upkeep)}/h</dd></div>
    </dl>
    <p>Nur stationierte lebende Einheiten verbrauchen Nahrung. Unterwegs entfällt der Stadtunterhalt; Herstellung zählt erst nach Abschluss.</p>
    {remaining && <p className="notice">Der Nahrungsvorrat reicht bei unveränderter Bilanz noch etwa {remaining}.</p>}
    {supply.inShortage && <p className="notice">Nahrungsmangel: Ausbildung pausiert. Nächste Hungerwelle in {formatDuration(supply.nextLossAt - state.serverTime)}.</p>}
  </section>;
}

function TrainingQueue({ state }) {
  const queue = state.military.trainingQueue.toSorted((first, second) => first.finishesAt - second.finishesAt);
  return <section className="card queue" aria-labelledby="training-queue-heading">
    <div className="queue-title"><h2 id="training-queue-heading">Truppenwarteschlange</h2><span>{queue.length}</span></div>
    <ol>{queue.length ? queue.slice(0, 3).map(job => {
      const barracksQueue = state.military.trainingQueue.filter(item => (item.trainingSlotId ?? item.barracksSlotId) === (job.trainingSlotId ?? job.barracksSlotId)).toSorted((first, second) => first.startsAt - second.startsAt);
      const position = barracksQueue.findIndex(item => item.id === job.id);
      const status = job.pausedForSupply
        ? `Nahrungsmangel · Restzeit ${formatDuration(job.finishesAt - state.serverTime)}`
        : position === 0
          ? `noch ${formatDuration(job.finishesAt - state.serverTime)}`
          : `wartet · Start in ${formatDuration(job.startsAt - state.serverTime)}`;
      return <li key={job.id}>
        <span className="queue-position">{position + 1}</span>
        <strong>{job.amount} {state.units[job.unit].label}</strong>
        <span>Ausbildungsgebäude {(job.trainingSlotId ?? job.barracksSlotId).split('-').at(-1)} · {status}</span>
      </li>;
    }) : <li className="empty-queue">Keine Truppen in Ausbildung.</li>}</ol>
  </section>;
}

const missionLabels = { raid: 'Farmzug', scout: 'Aufklärung', 'field-scout': 'Feldaufklärung', conquest: 'Eroberung', delivery: 'Lieferung', transfer: 'Verlegung' };
const remaining = (at, now) => formatDuration(Math.max(0, at - now));
function ActivityProgress({ startsAt, finishesAt, now, label }) {
  const start = Number.isFinite(startsAt) ? startsAt : now;
  const end = Number.isFinite(finishesAt) ? finishesAt : now;
  const duration = Math.max(1, end - start);
  return <progress aria-label={label} max={duration} value={Math.max(0, Math.min(duration, now - start))}/>;
}
function Movements({ state }) {
  const missions = state.military.missions.filter(m => m.status !== 'completed' && (!m.originCityId || m.originCityId === state.cityId)).toSorted((a,b) => (a.status === 'outbound' ? a.arrivesAt : a.returnsAt) - (b.status === 'outbound' ? b.arrivesAt : b.returnsAt));
  return <section className="activity-section" aria-labelledby="movement-heading"><h3 id="movement-heading"><span aria-hidden="true">↗</span> Truppenbewegungen <span className="activity-count">{missions.length}</span></h3>
    {missions.length ? <ol className="activity-list">{missions.slice(0, 3).map(m => { const outbound = m.status === 'outbound', end = outbound ? m.arrivesAt : m.returnsAt; return <li key={m.id}><div className="activity-row"><strong>{missionLabels[m.type] ?? 'Einsatz'}</strong><time>{remaining(end, state.serverTime)}</time></div><span>{m.targetName} {m.coordinates && `(${m.coordinates.x}, ${m.coordinates.y})`}</span><small>{outbound ? 'Hinreise' : 'Rückreise'} · {Object.values(missionForces(m)).reduce((sum,n) => sum+n,0)} Einheiten · {m.generalName}</small><ActivityProgress startsAt={outbound ? m.startedAt : m.arrivesAt} finishesAt={end} now={state.serverTime} label={`${missionLabels[m.type] ?? 'Einsatz'} ${outbound ? 'Hinreise' : 'Rückreise'}`}/>{m.cargo && <details className="activity-cargo"><summary>Ladung und Betriebsöl</summary><small>Eigene Ladung {Object.values(m.cargo.retained).reduce((sum,n)=>sum+n,0)} · Beute {m.result?.loadedFood ?? 0} · Öl verbleibend {m.operatingFuel?.remaining?.toLocaleString('de-DE', {maximumFractionDigits:3}) ?? '–'} · verbrannt {m.operatingFuel?.burned?.toLocaleString('de-DE', {maximumFractionDigits:3}) ?? '–'} · verloren {m.operatingFuel?.lost?.toLocaleString('de-DE', {maximumFractionDigits:3}) ?? '–'}</small></details>}</li>; })}</ol> : <p className="activity-empty">Keine Truppen unterwegs.</p>}
  </section>;
}
function BuildingActivity({ state }) {
  return <section className="activity-section" aria-labelledby="building-activity-heading"><h3 id="building-activity-heading"><span aria-hidden="true">⌂</span> Baufortschritt <span className="activity-count">{state.city.constructionQueue.length}</span></h3>{state.city.constructionQueue.length ? <ol className="activity-list">{state.city.constructionQueue.slice(0, 3).map(job => <li key={job.id}><div className="activity-row"><strong>{state.buildings[job.building].label} · Stufe {job.level}</strong><time>{remaining(job.finishesAt, state.serverTime)}</time></div><small>{job.startsAt > state.serverTime ? `Wartet · Start in ${remaining(job.startsAt,state.serverTime)}` : 'Wird gebaut'}</small><ActivityProgress startsAt={job.startsAt} finishesAt={job.finishesAt} now={state.serverTime} label={`Baufortschritt ${state.buildings[job.building].label}`}/></li>)}</ol> : <p className="activity-empty">Keine Bauaufträge.</p>}</section>;
}
function ResearchActivity({ state }) {
  const job = state.city.research.active, city = state.cities?.find(c => c.id === job?.cityId);
  return <section className="activity-section" aria-labelledby="research-activity-heading"><h3 id="research-activity-heading"><span aria-hidden="true">◇</span> Forschung <span className="activity-count">{job ? 1 : 0}</span></h3>{job ? <div className="activity-list"><div className="activity-row"><strong>{state.technologies[job.technology].label} · Stufe {job.targetLevel}</strong><time>{remaining(job.finishesAt,state.serverTime)}</time></div><small>Spielerweit · {city?.name ?? state.city.name}</small><ActivityProgress startsAt={job.startsAt} finishesAt={job.finishesAt} now={state.serverTime} label="Forschungsfortschritt"/></div> : <p className="activity-empty">Keine laufende Forschung.</p>}</section>;
}
export function SidebarStatus({ state, onNavigate }) {
  return <section className="city-activity card" aria-label="Laufende Stadtaktivitäten"><div className="city-activity-heading"><span className="kicker">STADTÜBERSICHT</span><h2>{state.city.name}</h2><span className="activity-live">● Live</span></div><Movements state={state}/>{onNavigate&&<button onClick={()=>onNavigate("logistics")}>Alle Bewegungen anzeigen</button>}<BuildingActivity state={state}/>{onNavigate&&<button onClick={()=>onNavigate("city")}>Alle Bauaufträge anzeigen</button>}<ResearchActivity state={state}/>{onNavigate&&<button onClick={()=>onNavigate("research")}>Forschung anzeigen</button>}<details className="activity-training" open={state.military.trainingQueue.length > 0}><summary>Ausbildung <span>{state.military.trainingQueue.length}</span></summary><TrainingQueue state={state}/>{onNavigate&&<button onClick={()=>onNavigate("military")}>Alle Ausbildungen anzeigen</button>}</details></section>;
}
