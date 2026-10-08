import { useState } from 'react';
import { Dialog, GameArt, formatDuration } from './ui.jsx';

export function Recruitment({ state, transport, onSelect }) {
  const [preview, setPreview] = useState(null), [name, setName] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pool = state.military.candidatePool, offer = state.recruitment;
  const check = async candidate => {
    setBusy(true); setError('');
    try { setPreview(await transport.request('general.recruit.preview', { candidateId: candidate.id })); setName(candidate.name); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const confirm = async () => {
    setBusy(true); setError('');
    try { const result = await transport.request('general.recruit', { ...preview, name }); setPreview(null); onSelect(result.generalId); }
    catch (e) { setError(e.message); setPreview(null); } finally { setBusy(false); }
  };
  return <section className="general-section" aria-label="Offiziersbewerber">
    <div className="heading"><h2>Offiziersbewerber</h2><span>{state.military.generals.length} / {state.officerRules.maxCount} Generäle</span></div>
    <p>Preisstufe {state.military.acquiredCount}: {offer.cost ? `${offer.cost.wood} Holz · ${offer.cost.stone} Stein` : 'Preis nicht verfügbar'}. Nächster Erwerb: {offer.nextCost ? `${offer.nextCost.wood} Holz · ${offer.nextCost.stone} Stein` : 'sicherer Zahlenbereich erreicht'}.</p>
    {offer.reason && <p className="notice">{offer.reason}</p>}
    {pool ? <><p>Nächste Auswahl in {formatDuration(pool.expiresAt - state.serverTime)}. {pool.state === 'consumed' && 'Diese Auswahl wurde bereits verbraucht.'}</p>
      <div className="general-grid">{pool.candidates.map(c => <article className="card" key={c.id}><GameArt type="general" label="Generalporträt"/><h3>{c.name} · {c.profile}</h3><p>Grundwerte: Führung {c.attributes.leadership} · Angriff {c.attributes.attack} · Verteidigung {c.attributes.defense}</p><p>Neue Farmzüge: Angriff +{Math.min(50, c.attributes.attack * 2)} %, Verluste −{Math.min(50, c.attributes.defense * 2)} %. Im Amt: Bürgermeister +{Math.min(50, c.attributes.leadership)} % Nahrung oder Forschungsleitung +{Math.min(state.officerRules.bonusCapPercent, c.attributes.leadership * state.officerRules.leadershipPercent)} % Geschwindigkeit.</p><button disabled={busy || Boolean(offer.reason) || pool.state !== 'open' || state.serverTime >= pool.expiresAt} onClick={() => check(c)}>Verpflichtung prüfen</button></article>)}</div>
    </> : <p>Eine fertige eigene Kaserne eröffnet die erste Auswahl.</p>}
    {error && <p role="alert">{error}</p>}
    {preview && <Dialog open title="General verpflichten" kicker="REKRUTIERUNG" onClose={() => !busy && setPreview(null)} actions={<button disabled={busy} onClick={confirm}>Für {preview.cost.wood} Holz und {preview.cost.stone} Stein verpflichten</button>}><label>Name<input value={name} maxLength={80} onChange={e => setName(e.target.value)}/></label><p>Genau dieser Bewerber wird eingestellt. Die übrige Auswahl verfällt bis zum nächsten Wechsel. Level 1, keine XP oder gekauften Skills.</p></Dialog>}
  </section>;
}
