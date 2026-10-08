import { useState } from 'react';
import { Dialog, GameArt } from './ui.jsx';

const emptyDraft = () => ({ leadership: 0, attack: 0, defense: 0 });
const labels = { leadership: 'Führung', attack: 'Angriff', defense: 'Verteidigung' };

export function GeneralDialog({ general, rules, supply, roleVersion, isMayor, transport, onClose }) {
  const [name, setName] = useState(general.name);
  const [draft, setDraft] = useState(emptyDraft);
  const [points, setPoints] = useState(1);
  const [baseVersion, setBaseVersion] = useState(general.version);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const allocations = general.skills.allocations;
  const allocated = Object.values(allocations).reduce((sum, value) => sum + value, 0);
  const free = general.skills.totalPoints - allocated;
  const proposedCount = Object.values(draft).reduce((sum, value) => sum + value, 0);
  const availableExperience = general.experience - general.skills.experienceSpent;
  const exhausted = Object.keys(labels).every(key => key === 'leadership'
    ? general.attributes.leadership + allocations.leadership >= rules.maxEffectiveLeadership
    : general.attributes[key] + allocations[key] >= rules.maxMilitaryPoints);
  const stale = general.version !== baseVersion || preview && preview.rulesetVersion !== rules.version;
  const validName = [...name.trim()].length >= 1 && [...name.trim()].length <= 40 && !/\p{Cc}/u.test(name);
  const command = { generalId: general.id, expectedVersion: baseVersion, rulesetVersion: rules.version };
  const nextCost = rules.xpPerPointIndex * (general.skills.totalPoints + 1);

  async function perform(action) {
    setBusy(true); setError('');
    try { await action(); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  function check(kind) {
    return perform(async () => {
      const result = await transport.request('general.preview', { ...command, ...(kind === 'convert' ? { points } : { changes: draft }) });
      setPreview({ ...result, kind });
    });
  }
  function save() {
    return perform(async () => {
      await transport.request(`general.${preview.kind}`, { ...command, ...(preview.kind === 'convert' ? { points: preview.conversion.points } : { changes: draft }) });
      setBaseVersion(baseVersion + 1); setPreview(null); setDraft(emptyDraft());
    });
  }
  function acceptCurrent() { setBaseVersion(general.version); setPreview(null); setDraft(emptyDraft()); setError(''); }
  const percent = value => `${(value * 100).toFixed(0)} %`;
  const proposedLeadership = general.attributes.leadership + allocations.leadership + draft.leadership;
  const proposedMayorBonus = Math.min(0.5, Math.max(0, proposedLeadership) * 0.01);

  return <Dialog open title={general.name} kicker="GENERAL-EIGENSCHAFTEN" onClose={onClose} actions={<>
    <button type="button" className="secondary" disabled={busy || !isMayor && general.status !== 'idle'} onClick={() => perform(async () => {
      await transport.request('general.mayor', { generalId: isMayor ? null : general.id, expectedRoleVersion: roleVersion });
      setBaseVersion(general.version + 1); setPreview(null);
    })}>{isMayor ? 'Als Bürgermeister abberufen' : 'Zum Bürgermeister ernennen'}</button>
    <button type="button" disabled={busy || !validName || name.trim() === general.name} onClick={() => perform(async () => {
      await transport.request('general.rename', { generalId: general.id, name, expectedVersion: general.version });
      setBaseVersion(general.version + 1); setPreview(null);
    })}>Namen speichern</button>
  </>}>
    <GameArt type="general" label="Generalporträt"/>
    <label>Name<input maxLength="80" value={name} onChange={event => setName(event.target.value)}/></label>
    <div className="general-facts">
      <span>Level <strong>{general.level}</strong></span><span>Gesamt-XP <strong>{general.experience}</strong></span>
      <span>Verfügbare XP <strong>{availableExperience}</strong></span><span>Verwendete XP <strong>{general.skills.experienceSpent}</strong></span>
      <span>Erworbene Punkte <strong>{general.skills.totalPoints}</strong></span><span>Freie Skillpunkte <strong>{free}</strong></span>
    </div>
    <p className="notice">Vorläufige Regeln: Punkt n kostet 10 × n XP. Gesamt-XP und Level bleiben erhalten. Ein Punkt erhöht eine Eigenschaft um eins. Gespeicherte Zuweisungen können nicht zurückgenommen werden.</p>
    {['scouting', 'raiding'].includes(general.status) && <p className="notice">Dieser General ist unterwegs. Neue Kampfpunkte wirken erst ab der nächsten Entsendung; der laufende Einsatz bleibt unverändert.</p>}
    {exhausted && <p role="status">Alle Eigenschaften sind ausgeschöpft. Gekaufte Punkte bleiben frei, können derzeit aber nicht eingesetzt werden.</p>}
    {stale && <p role="alert">Der General wurde inzwischen geändert. Dein Entwurf bleibt erhalten. Prüfe den aktuellen Stand und beginne die Vorschau erneut. <button type="button" disabled={busy} onClick={acceptCurrent}>Aktuellen Stand übernehmen und Entwurf verwerfen</button></p>}
    {error && <p role="alert">{error}</p>}
    {busy && <p role="status">Server prüft und speichert …</p>}
    <section aria-label="XP umwandeln">
      <h3>1. Skillpunkte kaufen</h3>
      <p>Nächster Punkt: {nextCost} XP. Bereits verteilte Punkte zählen beim Preis weiter.</p>
      <label>Neue Skillpunkte<input type="number" min="1" step="1" value={points} disabled={busy} onChange={event => { setPoints(Number(event.target.value)); setPreview(null); }}/></label>
      <button type="button" disabled={busy || stale || !Number.isSafeInteger(points) || points < 1} onClick={() => check('convert')}>Kauf prüfen</button>
      {preview?.kind === 'convert' && <div className="notice"><p>{preview.conversion.points} neue Punkte kosten zusammen {preview.conversion.cost} XP. Danach bleiben {preview.conversion.remainingExperience} XP verfügbar.</p><button type="button" disabled={busy || stale} onClick={save}>Kauf bestätigen</button></div>}
    </section>
    <section aria-label="Skillpunkte verteilen">
      <h3>2. Freie Punkte verteilen</h3>
      <div className="attribute-list">{Object.entries(labels).map(([key, label]) => {
        const base = general.attributes[key];
        const effective = base + allocations[key] + draft[key];
        const limit = key === 'leadership' ? Math.max(0, rules.maxEffectiveLeadership - base) : Math.max(0, rules.maxMilitaryPoints - base);
        const full = allocations[key] + draft[key] >= limit;
        return <div key={key}><span><strong>{label}</strong> · Grundwert {base} · zugewiesen {allocations[key]} · Entwurf +{draft[key]} · effektiv {effective}
          <small>{key === 'leadership' ? `Bürgermeisterbonus ${percent(Math.min(0.5, Math.max(0, effective) * 0.01))}; Grenze: effektive Führung 50`
            : `${key === 'attack' ? 'Angriffsstärke +' : 'Kampfverluste −'}${Math.min(50, effective * rules.militaryPercentPerPoint)} %; Grenze: 25 effektive Punkte (50 %), Grundwert plus Skills.`}{full && ' · ausgeschöpft'}</small>
        </span><span className="stepper"><button type="button" aria-label={`${label} im Entwurf verringern`} disabled={busy || draft[key] === 0} onClick={() => { setDraft({ ...draft, [key]: draft[key] - 1 }); setPreview(null); }}>−</button>
          <button type="button" aria-label={`${label} im Entwurf erhöhen`} disabled={busy || stale || full || proposedCount >= free} onClick={() => { setDraft({ ...draft, [key]: draft[key] + 1 }); setPreview(null); }}>+</button></span></div>;
      })}</div>
      <p>Entwurf: {proposedCount} Punkte; danach {free - proposedCount} frei. Kleine Boni retten wegen der Rundung nicht in jedem Kampf eine weitere Einheit. Niederlagen bleiben ohne Beute; Verteidigung kann Überlebende retten.</p>
      {isMayor && <p>Bürgermeister nach Speicherung: {percent(proposedMayorBonus)} Bonus auf {supply.baseProduction.toFixed(2)} Nahrung/s Grundproduktion → {(supply.baseProduction * (1 + proposedMayorBonus)).toFixed(2)} Nahrung/s. Der bisherige Ertrag wird bis zum Speicherzeitpunkt abgerechnet.</p>}
      {!isMayor && <p>Führung erhöht die Stadtproduktion erst bei Ernennung zum Bürgermeister.</p>}
      <button type="button" disabled={busy || stale || proposedCount < 1 || proposedCount > free} onClick={() => check('distribute')}>Verteilung prüfen</button>
      <button type="button" className="secondary" disabled={busy || proposedCount === 0} onClick={() => { setDraft(emptyDraft()); setPreview(null); }}>Entwurf verwerfen</button>
      {preview?.kind === 'distribute' && <div className="notice"><p>Bestätigte Vorschau: Führung {preview.effectiveAttributes.leadership}, Angriff +{preview.combatBonuses.attackPercent} %, Verteidigung −{preview.combatBonuses.defensePercent} %. {proposedCount} freie Punkte werden dauerhaft zugewiesen.</p><button type="button" disabled={busy || stale} onClick={save}>Verteilung speichern</button></div>}
    </section>
  </Dialog>;
}
