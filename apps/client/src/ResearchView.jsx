import { useCallback, useState } from 'react';
import { ActionButton, BuildingArt, Dialog, formatDuration, quoteText } from './ui.jsx';

export function ResearchView({ state, transport }) {
  const [universityId, setUniversityId] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const universities = state.city.buildingSlots.filter(slot => slot.building === 'university' && slot.level > 0);
  const selected = universities.find(slot => slot.buildingId === universityId) ?? universities[0];
  const active = state.city.research.active;
  const close = useCallback(() => { if (!loading) setPreview(null); }, [loading]);
  const check = async offer => {
    setLoading(true); setError('');
    try {
      const result = await transport.request('research.preview', { universityId: selected.buildingId, technology: offer.technology, targetLevel: offer.nextLevel, rulesetVersion: state.researchRules.version });
      setPreview(result);
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  };
  const confirm = async () => {
    setLoading(true); setError('');
    try {
      await transport.request('research.start', { universityId: preview.universityId, technology: preview.technology, targetLevel: preview.targetLevel, expectedUniversityLevel: preview.expectedUniversityLevel, rulesetVersion: preview.rulesetVersion });
      setPreview(null);
    } catch (cause) { setPreview(null); setError(`${cause.message} Bitte das aktuelle Angebot erneut prüfen.`); }
    finally { setLoading(false); }
  };
  return <section className="research-view" aria-labelledby="research-heading">
    <div className="heading"><div><span className="kicker">WISSEN FÜR DEINE STADT</span><h2 id="research-heading">Universität und Forschung</h2></div></div>
    <section className="card"><BuildingArt type="university"/><p>Abgeschlossene Erkenntnisse wirken dauerhaft in dieser Stadt, auch nach einem Universitätsabriss. Je Stufe +5 % Produktion beziehungsweise Lagerkapazität. Eine Forschung gleichzeitig; keine Warteschlange und kein Abbruch.</p>
      {universities.length ? <label>Universität<select value={selected.buildingId} onChange={event => { setUniversityId(event.target.value); setPreview(null); }}>{universities.map(slot => <option key={slot.buildingId} value={slot.buildingId}>Grundstück {slot.id.split('-').at(-1)} · Universität Stufe {slot.level}</option>)}</select></label> : <p className="notice">Errichte zuerst eine Universität auf einem freien Stadtgrundstück.</p>}
      {active && <div className="mission-preview" role="status"><strong>{state.technologies[active.technology].label} · Stufe {active.targetLevel}</strong><progress aria-label="Forschungsfortschritt" max={active.durationMs} value={Math.min(active.durationMs, Math.max(0, state.serverTime - active.startsAt))}/><span>Noch {formatDuration(active.finishesAt - state.serverTime)} · läuft auch bei Nahrungsmangel weiter.</span></div>}
    </section>
    <div className="research-grid">{state.researchOffers.map(offer => {
      const university = offer.universities.find(item => item.universityId === selected?.buildingId);
      const reason = offer.nextLevel == null ? 'Maximale Stufe erreicht.' : university?.reason ?? offer.reason;
      return <section className="card" key={offer.technology}><span className="kicker">{offer.kind === 'capacity' ? 'LAGERKAPAZITÄT' : 'PRODUKTION'}</span><h3>{offer.label}</h3><strong>Stufe {offer.level} / {state.researchRules.maxLevel} · +{offer.level * 5} %</strong>
        {offer.nextLevel != null && <><p>Nächste Stufe {offer.nextLevel}: +{offer.nextLevel * 5} % insgesamt · Universität mindestens Stufe {offer.nextLevel}.</p><p>{offer.nextCost.wood} Holz · {offer.nextCost.stone} Stein{university?.quote && ` · ${formatDuration(university.quote.durationMs)}`}</p></>}
        <ActionButton label="Forschung prüfen" detail={reason ?? 'Angebot prüfen und anschließend bestätigen'} disabled={loading || !selected || Boolean(reason)} onClick={() => check(offer)}/>
      </section>;
    })}</div>
    {error && <p className="notice" role="alert">{error}</p>}
    {preview && <Dialog open kicker="FORSCHUNG BESTÄTIGEN" title={`${state.technologies[preview.technology].label} · Stufe ${preview.targetLevel}`} onClose={close} actions={<button disabled={loading} onClick={confirm}>{loading ? 'Wird gespeichert …' : 'Kosten bezahlen und starten'}</button>}>
      <p>{quoteText(preview)} · Universität Stufe {preview.expectedUniversityLevel}</p><p>Wirkung ab Abschluss: +{Math.round((preview.factorBefore - 1) * 100)} % → +{Math.round((preview.factorAfter - 1) * 100)} %. Forschung füllt keine Vorräte auf. Kein Abbruch oder Rückerstattung.</p>
    </Dialog>}
  </section>;
}
