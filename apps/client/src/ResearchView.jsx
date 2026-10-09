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
      await transport.request('research.start', { universityId: preview.universityId, technology: preview.technology, targetLevel: preview.targetLevel, expectedUniversityLevel: preview.expectedUniversityLevel, rulesetVersion: preview.rulesetVersion, researcher: preview.researcher });
      setPreview(null);
    } catch (cause) { setPreview(null); setError(`${cause.message} Bitte das aktuelle Angebot erneut prüfen.`); }
    finally { setLoading(false); }
  };
  return <section className="research-view" aria-labelledby="research-heading">
    <h2 id="research-heading" className="research-title">Forschung</h2>
    <section className="card"><h3>Forschungsleitung</h3><p>{state.researcher.generalName ?? 'Keine Forschungsleitung'} · Führung {state.researcher.leadership} · Geschwindigkeit +{state.researcher.bonusPercent} %</p>
      <label>General<select aria-label="General" value={state.military.researcherGeneralId ?? ''} disabled={Boolean(active) || loading || !universities.length} onChange={async e => {
        const generalId = e.target.value || null; setLoading(true); setError('');
        try { await transport.request('general.researcher', { generalId, expectedRoleVersion: state.military.roleVersion }); setPreview(null); }
        catch (cause) { setError(cause.message); } finally { setLoading(false); }
      }}><option value="">Ohne Forschungsleitung</option>{state.military.generals.filter(g => g.status === 'idle' || g.id === state.military.researcherGeneralId).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      {active && <p>Während der Forschung ist das Amt gesperrt. Gespeichert: {active.researcher?.generalName ?? 'ohne General'} · Geschwindigkeit +{active.researcher?.bonusPercent ?? 0} %. Nach Abschluss bleibt die Leitung im Amt.</p>}
    </section>
    <section className="card research-controls">
      <BuildingArt type="university" level={selected?.level ?? 1}/>
      <div className="research-university">
      {universities.length ? <label>Universität<select value={selected.buildingId} onChange={event => { setUniversityId(event.target.value); setPreview(null); }}>{universities.map(slot => <option key={slot.buildingId} value={slot.buildingId}>Grundstück {slot.id.split('-').at(-1)} · Universität Stufe {slot.level}</option>)}</select></label> : <p className="notice">Errichte zuerst eine Universität auf einem freien Stadtgrundstück.</p>}
      </div>
      <details className="research-help"><summary>Forschungsregeln</summary><p>Abgeschlossene Erkenntnisse wirken dauerhaft in dieser Stadt, auch nach einem Universitätsabriss. Wirtschafts- und Lagerforschung geben je Stufe +5 %. Ölverarbeitung und Motorisierung schalten Inhalte frei. Eine Forschung gleichzeitig; keine Warteschlange und kein Abbruch.</p></details>
      {active && <div className="mission-preview" role="status"><strong>{state.technologies[active.technology].label} · Stufe {active.targetLevel}</strong><progress aria-label="Forschungsfortschritt" max={active.durationMs} value={Math.min(active.durationMs, Math.max(0, state.serverTime - active.startsAt))}/><span>Noch {formatDuration(active.finishesAt - state.serverTime)} · läuft auch bei Nahrungsmangel weiter.</span></div>}
    </section>
    <div className="research-grid">{state.researchOffers.map(offer => {
      const university = offer.universities.find(item => item.universityId === selected?.buildingId);
      const reason = offer.nextLevel == null ? 'Maximale Stufe erreicht.' : university?.reason ?? offer.reason;
      return <section className="card" key={offer.technology}><span className="kicker">{offer.kind === 'unlock' ? 'FREISCHALTUNG' : offer.kind === 'capacity' ? 'LAGERKAPAZITÄT' : 'PRODUKTION'}</span><h3>{offer.label}</h3><strong>Stufe {offer.level} / {offer.maxLevel}{offer.kind !== 'unlock' && ` · +${offer.level * 5} %`}</strong>
        {offer.nextLevel != null && <><p>{offer.kind === 'unlock' ? `Schaltet ${offer.unlocks.map(key => state.buildings[key]?.label ?? state.units[key]?.label).join(', ')} frei. Universität ${offer.universityLevel}; ${Object.entries(offer.prerequisites).map(([key, value]) => `${state.technologies[key].label} ${value}`).join(', ')}` : `Nächste Stufe ${offer.nextLevel}: +${offer.nextLevel * 5} % insgesamt · Universität mindestens Stufe ${offer.nextLevel}.`}</p><p>{offer.nextCost.wood} Holz · {offer.nextCost.stone} Stein{university?.quote && ` · ${formatDuration(university.quote.durationMs)}`}</p></>}
        <ActionButton label="Forschung prüfen" detail={reason ?? 'Angebot prüfen und anschließend bestätigen'} disabled={loading || !selected || Boolean(reason)} onClick={() => check(offer)}/>
      </section>;
    })}</div>
    {error && <p className="notice" role="alert">{error}</p>}
    {preview && <Dialog open kicker="FORSCHUNG BESTÄTIGEN" title={`${state.technologies[preview.technology].label} · Stufe ${preview.targetLevel}`} onClose={close} actions={<button disabled={loading} onClick={confirm}>{loading ? 'Wird gespeichert …' : 'Kosten bezahlen und starten'}</button>}>
      <p>{quoteText(preview)} · Universität Stufe {preview.expectedUniversityLevel}</p><p>{state.technologies[preview.technology].kind === 'unlock' ? 'Neue Gebäude/Einheiten ab Abschluss freigeschaltet.' : 'Wirtschaftsbonus ab Abschluss.'}</p>{state.technologies[preview.technology].kind !== 'unlock' && <p>Bonus: +{Math.round((preview.factorBefore - 1) * 100)} % → +{Math.round((preview.factorAfter - 1) * 100)} %.</p>}<p>Forschung füllt keine Vorräte auf. Kein Abbruch oder Rückerstattung.</p>
      <p>{preview.researcher.generalName ?? 'Ohne General'} · Führung {preview.researcher.leadership} · Geschwindigkeit +{preview.researcher.bonusPercent} %. Ohne General {formatDuration(preview.durationWithoutGeneralMs)}, tatsächlich {formatDuration(preview.durationMs)}.</p>
    </Dialog>}
  </section>;
}
