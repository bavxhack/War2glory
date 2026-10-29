import { useState, useCallback, useRef } from 'react';
import { Dialog, resourceLabels } from './ui.jsx';
const number = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
const rewardText = (r) =>
  Object.entries(r)
    .map(([k, n]) => `${n} ${resourceLabels[k]}`)
    .join(' · ');
export function TasksView({ state, transport, connected, onAction }) {
  const [claim, setClaim] = useState(null),
    [cityId, setCity] = useState(state.cityId),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const close = useCallback(() => {
    if (!busy) {
      setClaim(null);
      setError('');
    }
  }, [busy]);
  const city = state.cityOverview.cities.find((c) => c.id === cityId),
    task = state.tasks.list.find((t) => t.id === claim);
  const sending=useRef(false);
  async function collect(task) {
    if(sending.current)return;sending.current=true;setBusy(true);
    setError('');
    try {
      await transport.request('tasks.claim', { taskId: task.id, cityId });
      setClaim(null);
    } catch (e) {
      setError(e.message);
    } finally {
      sending.current=false;setBusy(false);
    }
  }
  function card(t) {
    return (
      <article key={t.id} className="card task-card">
        <h3>{t.title}</h3>
        <strong>
          {
            {
              locked: '🔒 Gesperrt',
              available: '○ Verfügbar',
              completed: '✓ Erfüllt · Belohnung abholbar',
              claimed: '✓ Abgeholt',
            }[t.status]
          }
        </strong>
        <p>{t.explanation}</p>
        <p>
          Fortschritt: {t.progress} / {t.target}
          {t.reached && t.status === 'locked' ? ' · Ziel bereits belegt' : ''}
        </p>
        {t.prerequisites.length > 0 && (
          <p>
            Voraussetzungen:{' '}
            {t.prerequisites
              .map(
                (id) =>
                  `${state.tasks.list.find((x) => x.id === id).title}${['completed', 'claimed'].includes(state.tasks.list.find((x) => x.id === id).status) ? ' ✓' : ' (fehlt)'}`,
              )
              .join(' · ')}
          </p>
        )}
        <p>Belohnung: {rewardText(t.reward)}</p>{t.status==='completed'&&city&&Object.entries(t.reward).filter(([k,n])=>n>0&&city.resources[k]+n>city.capacities[k]).map(([k,n])=><p key={k} className="notice">{number(city.resources[k]+n-city.capacities[k])} Lagerplatz für {resourceLabels[k]} fehlt in {city.name}.</p>)}
        {t.status === 'completed' ? (
          <button
            disabled={!connected||busy}
            onClick={() => void collect(t)}
          >
            Belohnung abholen · {t.title}
          </button>
        ) : t.status === 'claimed' ? (
          <p>
            Abgeholt in{' '}
            {state.cities.find((c) => c.id === t.claim.cityId)?.name ??
              t.claim.cityId}{' '}
            · {new Date(t.claim.claimedAt).toLocaleString('de-DE')}
          </p>
        ) : (
          <button onClick={() => onAction(t)}>
            Zur Spielaktion · {t.title}
          </button>
        )}
      </article>
    );
  }
  return (
    <section>
      <h2>Aufgaben</h2>
      <p>
        {state.tasks.introComplete
          ? 'Einführung abgeschlossen.'
          : 'Neun einmalige Einführungsaufgaben; danach freiwilliger Ausbau.'}{' '}
        Belohnungen ausdrücklich in einer eigenen Stadt abholen.
      </p>
      <p>{state.tasks.migrationNote}</p>
      <p>Alle Belohnungen sind vorläufige eigene Projektwerte.</p>
      <label>Belohnungszielstadt<select aria-label="Belohnungszielstadt" value={cityId} onChange={e=>setCity(e.target.value)}>{state.cities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><p>Alles oder nichts: Der Server prüft den gesamten Platz vor Auszahlung.</p>{error&&<p role="alert">{error}</p>}
      <div className="task-grid">
        {state.tasks.list.filter((t) => t.status !== 'claimed').map(card)}
      </div>
      <details>
        <summary>
          Abgeholte Aufgaben (
          {state.tasks.list.filter((t) => t.status === 'claimed').length})
        </summary>
        {state.tasks.list.filter((t) => t.status === 'claimed').map(card)}
      </details>

    </section>
  );
}
const statuses = {
  balanced: '● Ausgeglichen / Überschuss',
  declining: '↘ Lager sinkt',
  grace: '⚠ Mangel mit Schonfrist',
  losses: '⚠ Hungerverluste',
  recovery: '↗ Erholung',
};
export function CitiesView({ state, onOpen, onHelp }) {
  return (
    <section>
      <h2>Alle Städte</h2>
      <p>
        Stand: {new Date(state.cityOverview.asOf).toLocaleString('de-DE')}.
        Getrennte Stadtlager: Überschüsse versorgen andere Städte nicht
        automatisch.
      </p>
      <p>
        Prognosen gelten bei unveränderten Raten. Ausbildung, Rückkehr,
        Forschung und Rollenwechsel können sie ändern.
      </p>
      <div
        className="city-overview"
        role="table"
        aria-label="Versorgung aller Städte"
      >
        {state.cityOverview.cities.map((c) => (
          <article className="card overview-row" role="row" key={c.id}>
            <div role="cell">
              <h3>
                {c.name} ({c.x}, {c.y})
                {c.id === state.cityId ? ' · Aktuell ausgewählt' : ''}
              </h3>
              <button onClick={() => onOpen(c.id)}>
                Stadt öffnen · {c.name}
              </button>
            </div>
            <div role="cell">
              <strong>{statuses[c.status]}</strong>
              <p>
                Nahrung {number(c.resources.food)} / {c.capacities.food}
              </p>
              <p>
                Bruttoproduktion {number(c.productionPerHour)}/h ·
                Truppenunterhalt {number(c.upkeepPerHour)}/h · Nettobilanz{' '}
                {number(c.netPerHour)}/h
              </p>
              {c.secondsUntilEmpty > 0 && (
                <p>
                  Leer in ca. {Math.ceil(c.secondsUntilEmpty / 60)} Minuten bei
                  unveränderten Raten.
                </p>
              )}
              {c.graceRemainingMs !== null && (
                <p>
                  Schonfrist: noch {Math.ceil(c.graceRemainingMs / 60000)}{' '}
                  Minuten
                </p>
              )}
              {c.nextLossAt !== null && (
                <p>
                  Nächste geplante Verlustwelle:{' '}
                  {new Date(c.nextLossAt).toLocaleString('de-DE')}
                </p>
              )}
              {c.recoveryEndsAt !== null && (
                <p>
                  Erholung bis{' '}
                  {new Date(c.recoveryEndsAt).toLocaleString('de-DE')}
                </p>
              )}
              <p>
                {c.stationedUnits} stationierte Einheiten · {c.deployedUnits}{' '}
                unterwegs
                {c.trainingPaused
                  ? ' · Ausbildung pausiert wegen Nahrungsmangel'
                  : ''}
              </p>
            </div>
            <div role="cell">
              <details>
                <summary>Übrige Ressourcen / Lagerplatz</summary>
                {['wood', 'stone', 'oil'].map((k) => (
                  <p key={k}>
                    {resourceLabels[k]} {number(c.resources[k])} /{' '}
                    {c.capacities[k]}
                  </p>
                ))}
              </details>
              <div className="overview-actions">
                <button onClick={() => onHelp('delivery', c.id)}>
                  Nahrung hierher liefern
                </button>
                <button onClick={() => onHelp('generals', c.id)}>
                  Bürgermeister verwalten
                </button>
                <button onClick={() => onHelp('city', c.id)}>
                  Bauernhof ausbauen
                </button>
                <button onClick={() => onHelp('transfer', c.id)}>
                  Truppen von hier verlegen
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
