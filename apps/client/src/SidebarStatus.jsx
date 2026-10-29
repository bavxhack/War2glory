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
