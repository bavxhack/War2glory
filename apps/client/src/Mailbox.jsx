import { useState } from 'react';

const folders = [['inbox', 'Nachrichten'], ['scout', 'Aufklärung'], ['raid', 'Angriffe'], ['sent', 'Gesendet']];
const date = value => Number.isFinite(value) ? new Date(value).toLocaleString('de-DE') : 'Zeitpunkt unbekannt';

function Report({ report }) {
  return <><h2>{report.targetName}</h2><p>Ausgangsstadt: {report.originCityId ?? 'Historische Ausgangsstadt'}</p>{report.reason && <p>{report.reason}</p>}<p>{report.generalName ?? 'General'} · {report.coordinates && `(${report.coordinates.x}, ${report.coordinates.y})`} · Rückkehr: {date(report.returnedAt)}</p>{['raid', 'conquest'].includes(report.type) ? <>
    {report.cargo && <CargoReport report={report}/>}<h3>{report.cancelled ? 'Angriff ausgefallen' : report.victory ? 'Sieg' : 'Niederlage'}</h3>{report.initialUnits && <LogisticsReport report={report}/>}<dl className="mail-facts">
      <dt>Angreifer</dt><dd>{report.initialUnits?.infantry ?? report.infantry} Infanteristen</dd>
      <dt>Eigene Verluste</dt><dd>{report.attackerLosses}</dd><dt>NPC-Verluste</dt><dd>{report.defenderLosses}</dd>
      <dt>Nahrung ursprünglich geladen</dt><dd>{report.originalLoadedFood ?? report.loadedFood}</dd><dt>Unterwegs verloren</dt><dd>{report.foodLostInTransit ?? 0}</dd><dt>Am Lager angekommen</dt><dd>{report.loadedFood}</dd><dt>Eingelagert</dt><dd>{report.storedFood}</dd><dt>Verfallen</dt><dd>{report.overflowFood}</dd>
      <dt>General-Erfahrung</dt><dd>{report.generalExperience} EP</dd><dt>Kampfpunkte</dt><dd>{report.combatScore}</dd>
    </dl>{!report.initialUnits && <p>Historische Mission: Ölbuchung nicht erhoben.</p>}{report.combatBonuses && <p>Angewandte Boni: Angriff +{report.combatBonuses.attackPercent}% · Verteidigung −{report.combatBonuses.defensePercent}%</p>}</> : <>
    {report.cargo && <CargoReport report={report}/>} {report.initialUnits && <LogisticsReport report={report}/>}<h3>Aufklärung vom {date(report.capturedAt)}</h3><dl className="mail-facts">
      {report.type === 'field-scout' && <><dt>Feldverteidiger</dt><dd>{report.intelligence?.defenders ?? 'Aufklärung nicht möglich'}</dd><dt>Revision</dt><dd>{report.intelligence?.fieldRevision ?? '–'}</dd></>}{report.type !== 'field-scout' && <><dt>Nahrung</dt><dd>{Math.floor(report.intelligence?.food?.amount ?? 0)} / {report.intelligence?.food?.capacity ?? '?'}</dd><dt>Garnison</dt><dd>{report.intelligence?.garrison?.amount ?? 'Damals nicht modelliert'}{report.intelligence?.garrison?.capacity != null && ` / ${report.intelligence.garrison.capacity}`}</dd></>}
    </dl><p>Die Angaben zeigen den Zustand zum Zeitpunkt der Aufklärung.</p></>}</>;
}

function LogisticsReport({ report }) {
  return <><p>Start: {date(report.startedAt)} · Ankunft: {date(report.arrivedAt)} · Rückkehr: {date(report.returnedAt)}</p>{report.travelMs != null && <p>Grundhinreise {report.travelMs / 1000} s + {report.delayMinutes ?? 0} Zusatzminuten · Rückweg {report.travelMs / 1000} s</p>}{report.baseOil != null && <p>{report.cargo ? 'Rechnerischer Bedarf vor Zahlungsrundung: Grundöl ' : 'Grundöl '}{report.baseOil} + Zuschlag {report.delayOil} · Hinweg {report.outboundOil}, Rückweg {report.returnOil}</p>}<p>Öl bezahlt für Hin- und Rückweg: {report.paidOil} · {report.distanceFields} Felder</p><div className="logistics-table" tabIndex="0" role="region" aria-label="Truppenbilanz, horizontal scrollbar"><table><thead><tr><th>Typ</th><th>Start</th><th>Kampfverlust</th><th>Historischer Reise-Hungerverlust</th><th>Rückkehr</th></tr></thead><tbody>{Object.entries(report.initialUnits).map(([unit, amount]) => <tr key={unit}><th>{{ infantry: 'Infanterie', truck: 'LKW', scout: 'Späher' }[unit]}</th><td>{amount}</td><td>{report.combatLossesByUnit?.[unit] ?? 0}</td><td>{report.hungerLossesByUnit?.[unit] ?? 0}</td><td>{report.returnedUnits?.[unit] ?? 0}</td></tr>)}</tbody></table></div>{report.finalCapacity != null && <p>Traglast nach Kampf: {report.capacity} · bei Rückkehr: {report.finalCapacity}</p>}</>;
}
function CargoReport({ report }) {
  const cargo = report.cargo, fuel = report.operatingFuel;
  return <><h3>Ladung und Betriebsöl</h3><p>Betriebsöl geladen {fuel.loaded} · verbrannt {fuel.burned} · im Kampf verloren {fuel.lost} · verbleibend {fuel.remaining}. Freiwillige Ölladung ist separat.</p>
    {['raid', 'conquest'].includes(report.type) && <><p>Beute: {report.loadedFood} Nahrung · Güterplätze nach Kampf: {report.goodsCapacity}</p><div className="logistics-table" tabIndex="0" role="region" aria-label="Ressourcenbilanz, horizontal scrollbar"><table><thead><tr><th>Ressource</th><th>Eigene Startladung</th><th>Ladungsverlust</th><th>Eigene Rückfracht</th><th>Eingelagert</th><th>Eigener Überlauf</th><th>Beute eingelagert</th><th>Beuteüberlauf</th></tr></thead><tbody>{Object.entries({ wood: 'Holz', stone: 'Stein', food: 'Nahrung', oil: 'Öl' }).map(([key, label]) => <tr key={key}><th>{label}</th><td>{cargo.initial[key]}</td><td>{cargo.lost[key]}</td><td>{cargo.retained[key]}</td><td>{cargo.delivery.storedOwn[key]}</td><td>{cargo.delivery.overflowOwn[key]}</td><td>{cargo.delivery.storedLoot[key]}</td><td>{cargo.delivery.overflowLoot[key]}</td></tr>)}</tbody></table></div></>}
  </>;
}
export function Mailbox({ state, transport }) {
  const [folder, setFolder] = useState('inbox');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [compose, setCompose] = useState(false);
  const [draft, setDraft] = useState({ recipient: '', subject: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const readReports = new Set(state.mailbox.readReportIds);
  const entries = state.mailbox.messages.map(message => ({ id: message.id, kind: 'message', folder: message.senderId === state.player.id ? 'sent' : 'inbox', title: message.subject,
    who: message.senderId === state.player.id ? message.recipientName : message.senderName, time: message.sentAt, unread: message.recipientId === state.player.id && message.readAt == null, data: message }))
    .concat(state.military.reports.map(report => ({ id: report.id, kind: 'report', folder: ['raid', 'conquest'].includes(report.type) ? 'raid' : 'scout', title: `${report.targetName}${['raid', 'conquest'].includes(report.type) ? report.victory ? ' · Sieg' : ' · Niederlage' : ''}`,
      who: report.generalName ?? 'General', time: report.returnedAt, unread: !readReports.has(report.id), data: report })));
  const filtered = entries.filter(entry => entry.folder === folder && (!unreadOnly || entry.unread) && `${entry.title} ${entry.who}`.toLocaleLowerCase('de-DE').includes(query.toLocaleLowerCase('de-DE')))
    .sort((a, b) => (b.time ?? 0) - (a.time ?? 0) || a.id.localeCompare(b.id));
  const lastPage = Math.max(0, Math.ceil(filtered.length / 10) - 1);
  const currentPage = Math.min(page, lastPage);
  const detail = entries.find(entry => entry.id === selected?.id && entry.kind === selected?.kind);
  const open = async entry => {
    setSelected(entry); setCompose(false); setStatus('');
    if (entry.unread) try { await transport.request('mail.read', { kind: entry.kind, id: entry.id }); } catch (error) { setStatus(error.message); }
  };
  const submit = async event => {
    event.preventDefault(); setBusy(true); setStatus('');
    try { await transport.request('mail.send', draft); setDraft({ recipient: '', subject: '', body: '' }); setCompose(false); setFolder('sent'); setPage(0); setQuery(''); setUnreadOnly(false); setStatus('Nachricht wurde gesendet.'); }
    catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  };
  return <section className="mailbox" aria-labelledby="mailbox-heading"><div className="heading"><div><span className="kicker">POSTBOX</span><h2 id="mailbox-heading">Berichte &amp; Nachrichten</h2></div><button onClick={() => { setCompose(true); setSelected(null); setStatus(''); }}>Nachricht schreiben</button></div>
    <nav className="view-tabs" aria-label="Postbox-Bereiche">{folders.map(([key, label]) => <button key={key} aria-pressed={folder === key} className={folder === key ? 'active' : ''} onClick={() => { setFolder(key); setPage(0); setSelected(null); setCompose(false); }}>{label} <span>({entries.filter(entry => entry.folder === key && entry.unread).length})</span></button>)}</nav>
    <div className="mail-layout"><section className="card mail-list"><label>Suchen<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }}/></label><label className="mail-unread-filter"><input type="checkbox" checked={unreadOnly} onChange={event => { setUnreadOnly(event.target.checked); setPage(0); }}/>Nur ungelesene Einträge</label>
      {filtered.slice(currentPage * 10, currentPage * 10 + 10).map(entry => <button className={`mail-row${entry.unread ? ' unread' : ''}${detail?.id === entry.id ? ' selected' : ''}`} key={entry.id} onClick={() => void open(entry)} aria-pressed={detail?.id === entry.id}><strong>{entry.unread && <span className="mail-dot" aria-label="Ungelesen"/>}{entry.title}</strong><span>{entry.who}</span><time>{date(entry.time)}</time></button>)}
      {!filtered.length && <p>Keine Einträge in diesem Bereich.</p>}<div className="mail-pagination"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Zurück</button><span>Seite {currentPage + 1} / {lastPage + 1} · {filtered.length} Einträge</span><button disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Weiter</button></div>
    </section><section className="card mail-detail" aria-label="Postbox-Detail">{compose ? <form onSubmit={submit}><h2>Neue Nachricht</h2><label>Empfänger (Kommandantenname)<input required maxLength={24} value={draft.recipient} onChange={event => setDraft({ ...draft, recipient: event.target.value })}/></label><label>Betreff<input required maxLength={100} value={draft.subject} onChange={event => setDraft({ ...draft, subject: event.target.value })}/></label><label>Nachricht<textarea required maxLength={4000} rows={10} value={draft.body} onChange={event => setDraft({ ...draft, body: event.target.value })}/></label><p>{draft.body.length} / 4000 Zeichen</p><button disabled={busy}>{busy ? 'Wird gesendet …' : 'Senden'}</button><button type="button" className="secondary" disabled={busy} onClick={() => setCompose(false)}>Abbrechen</button></form> : detail ? detail.kind === 'report' ? <Report report={detail.data}/> : <><h2>{detail.data.subject}</h2><p>Von {detail.data.senderName} an {detail.data.recipientName}</p><time>{date(detail.data.sentAt)}</time><p className="mail-body">{detail.data.body}</p>{detail.folder === 'inbox' && <button onClick={() => { setDraft({ recipient: detail.data.senderName, subject: `Re: ${detail.data.subject}`.slice(0, 100), body: '' }); setCompose(true); }}>Antworten</button>}</> : <p>Wähle einen Eintrag aus, um ihn zu lesen. Neue Berichte erscheinen nach der Rückkehr deiner Truppen.</p>}</section></div><p role="status">{status}</p>
  </section>;
}
