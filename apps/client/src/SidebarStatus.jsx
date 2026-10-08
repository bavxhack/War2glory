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
    <p>Lebende stationierte und unterwegs befindliche Einheiten zählen; Ausbildung wird erst nach Abschluss versorgt.</p>
    {remaining && <p className="notice">Der Nahrungsvorrat reicht bei unveränderter Bilanz noch etwa {remaining}.</p>}
    {supply.inShortage && <p className="notice">Nahrungsmangel: Ausbildung pausiert. Nächste Hungerwelle in {formatDuration(supply.nextLossAt - state.serverTime)}.</p>}
  </section>;
}

function ConstructionQueue({ state }) {
  const queue = state.city.constructionQueue;
  return <section className="card queue" aria-labelledby="construction-queue-heading">
    <div className="queue-title"><h2 id="construction-queue-heading">Bauwarteschlange</h2><span>{queue.length} / {state.maxQueueLength}</span></div>
    <ol>{queue.length ? queue.map((job, index) => <li key={job.id}>
      <span className="queue-position">{index + 1}</span>
      <strong>{state.buildings[job.building].label} · Stufe {job.level}</strong>
      <span>{index ? 'wartet' : `noch ${formatDuration(job.finishesAt - state.serverTime)}`}</span>
    </li>) : <li className="empty-queue">Keine Bauaufträge.</li>}</ol>
  </section>;
}

function TrainingQueue({ state }) {
  const queue = state.military.trainingQueue.toSorted((first, second) => first.finishesAt - second.finishesAt);
  return <section className="card queue" aria-labelledby="training-queue-heading">
    <div className="queue-title"><h2 id="training-queue-heading">Truppenwarteschlange</h2><span>{queue.length}</span></div>
    <ol>{queue.length ? queue.map(job => {
      const barracksQueue = state.military.trainingQueue.filter(item => item.barracksSlotId === job.barracksSlotId).toSorted((first, second) => first.startsAt - second.startsAt);
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

export function SidebarStatus({ state }) {
  return <>
    <SupplyStatus state={state}/>
    <ConstructionQueue state={state}/>
    <TrainingQueue state={state}/>
  </>;
}
