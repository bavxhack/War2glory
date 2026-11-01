import { useEffect, useRef, useState } from 'react';
import { usePreview } from './usePreview.js';
import { useDraft } from './Drafts.jsx';
const eventNames = { created:'Gründung', joined:'Beitritt', 'alliance.leave':'Austritt', 'alliance.member.remove':'Ausschluss', 'alliance.role.change':'Rollenänderung', 'alliance.leadership.transfer':'Führungsübergabe', notice:'Mitteilung geändert', moderation:'Chatbeitrag entfernt' };
const roles = { leader: 'Anführer', officer: 'Offizier', member: 'Mitglied' };

export function AllianceView({ state, transport, connected, revision, onDelivery, onMessage, onMap }) {
  const membershipId = state.alliance?.membershipId;
  // Destroy private views and drafts immediately on membership change, including re-entry.
  return <AllianceContent key={`${state.player.id}:${membershipId ?? 'none'}`} {...{state,transport,connected,revision,onDelivery,onMessage,onMap}} />;
}
function AllianceContent({ state, transport, connected, revision, onDelivery, onMessage, onMap }) {
  const [directory,setDirectory] = useState({items:[]}), [invitations,setInvitations] = useState({items:[]}), [profile,setProfile] = useState(null),
    [chat,setChat] = useState({items:[]}), [events,setEvents] = useState({items:[]}), [query,setQuery] = useState(''), [selected,setSelected] = useState(state.alliance?.allianceId),
    [form,setForm] = useState({name:'',tag:'',description:'',cityId:state.cityId}), [text,setText] = useState(''), [recipient,setRecipient] = useState(''),
    [notice,setNotice] = useState(null), [description,setDescription] = useState(null), [error,setError] = useState(''), [success,setSuccess] = useState(''), [busy,setBusy] = useState(false), [refresh,setRefresh] = useState(0), [confirmation,setConfirmation] = useState(null);
  const pending = useRef(false), generation = useRef(0), visibleChat = useRef(null);
  const member = profile?.membershipId === state.alliance?.membershipId && !!profile?.membershipId;
  const admin = member && profile.role !== 'member', leader = member && profile.role === 'leader';
  const dirty = !!(text || recipient || notice !== null || description !== null || form.name || form.tag || form.description);
  useDraft(dirty);
  useEffect(() => { const before = e => { if (dirty) {e.preventDefault();e.returnValue='';} }; window.addEventListener('beforeunload',before); return () => window.removeEventListener('beforeunload',before); },[dirty]);
  const {preview,status,invalidate} = usePreview(transport,'alliance.create.preview',form,state.alliance?.allianceId,!state.alliance?.allianceId && !!form.name && !!form.tag);
  const context = () => ({allianceId:profile?.id,membershipId:profile?.membershipId,adminVersion:profile?.adminVersion});
  useEffect(() => {
    const ticket=++generation.current; let active=true;
    if (!connected) return;
    const load=async()=>{
      try {
        const [list,inv] = await Promise.all([transport.request('alliance.list',{query}),transport.request('alliance.invitations',{})]);
        if (!active || ticket!==generation.current) return;
        setDirectory(list);setInvitations(inv);
        const id=selected ?? state.alliance?.allianceId;
        if (id) {
          const p=await transport.request('alliance.get',{allianceId:id});
          if (!active || ticket!==generation.current) return;
          setProfile(p);
          if(p.membershipId) {
            const ctx={allianceId:p.id,membershipId:p.membershipId};
            const [c,e]=await Promise.all([transport.request('alliance.chat.list',ctx),transport.request('alliance.events.list',ctx)]);
            if(active && ticket===generation.current){setChat(c);setEvents(e);}
          } else {setChat({items:[]});setEvents({items:[]});}
        }
      } catch(e) {if(active) setError(e.message);}
    };load();return()=>{active=false;};
  },[connected,revision,refresh,query,selected,state.alliance?.allianceId,transport]);
  useEffect(() => {setConfirmation(null);},[profile?.adminVersion, state.alliance?.membershipId, form.name, form.tag, form.description, form.cityId]);
  const mutate = async(type,p,done) => {
    if(pending.current || !connected) return; pending.current=true;setBusy(true);setError('');setSuccess('');
    try { await transport.request(type,p);done?.();setSuccess('Gespeichert.');setRefresh(n=>n+1);setConfirmation(null);invalidate(); }
    catch(e){setError(e.message);setRefresh(n=>n+1);invalidate();}
    finally{pending.current=false;setBusy(false);}
  };
  const action = (type,extra={},label=null,done=null) => {
    const p={...context(),...extra};
    if(label) setConfirmation({type,p,label,done});else mutate(type,p,done);
  };
  const more=async(type,page,setPage,payload)=>{try{const next=await transport.request(type,{...payload,cursor:page.nextCursor});setPage(current=>({...next,items:[...current.items,...next.items]}));}catch(e){setError(e.message);}};
  return <section className="alliance-view">
    <header className="alliance-heading">
      <div><span className="alliance-eyebrow">GEMEINSAM STÄRKER</span><h2>Bündnis</h2><p>Deine Gemeinschaft. Eure nächsten Schritte.</p></div>
      {state.alliance?.tag && <span className="alliance-tag">[{state.alliance.tag}]</span>}
    </header>
    {!connected && <p className="alliance-feedback alliance-feedback--warning" role="status">Offline · Stand veraltet. Nach Wiederverbindung gespeicherten Stand prüfen.</p>}
    {error && <p className="alliance-feedback alliance-feedback--error" role="alert">{error}</p>}
    {success && <p className="alliance-feedback" role="status">{success}</p>}
    {confirmation && <section className="alliance-confirmation" aria-label="Aktion bestätigen"><strong>Bitte bestätige deine Entscheidung</strong><p>{confirmation.label}</p><div className="alliance-actions"><button className="alliance-primary" disabled={busy||!connected} onClick={()=>mutate(confirmation.type,confirmation.p,confirmation.done)}>Ausdrücklich bestätigen</button><button onClick={()=>setConfirmation(null)}>Abbrechen</button></div></section>}

    {(invitations.items.length>0 || !state.alliance?.allianceId) && <section className="alliance-card alliance-invitations">
      <div className="alliance-section-heading"><div><span className="alliance-eyebrow">DEIN EINGANG</span><h3>Einladungen ({state.alliance?.invitations ?? 0})</h3></div><span className="alliance-count">{invitations.items.length}</span></div>
      {!invitations.items.length && <p className="alliance-empty">Noch keine offenen Einladungen. Entdecke ein Bündnis oder gründe deine eigene Gemeinschaft.</p>}
      <div className="alliance-invitation-list">{invitations.items.map(i=><article className="alliance-invitation" key={i.id}>
        <div><strong>[{i.tag}] {i.allianceName}</strong><p>Für {i.recipientName}</p><small>Gültig bis {new Date(i.expiresAt).toLocaleString('de-DE')}</small></div>
        <div className="alliance-actions">{i.recipientId===state.player.id ? <><button className="alliance-primary" disabled={busy||!connected} onClick={()=>mutate('alliance.invitation.respond',{invitationId:i.id,response:'accept'})}>Annehmen</button><button disabled={busy||!connected} onClick={()=>mutate('alliance.invitation.respond',{invitationId:i.id,response:'decline'})}>Ablehnen</button></> : admin && <button disabled={busy||!connected} onClick={()=>action('alliance.invitation.revoke',{invitationId:i.id})}>Widerrufen</button>}</div>
      </article>)}</div>
      {invitations.nextCursor && <button onClick={()=>more('alliance.invitations',invitations,setInvitations,{})}>Weitere Einladungen</button>}
    </section>}

    {profile && <section className="alliance-profile">
      <header className="alliance-banner">
        <div className="alliance-crest" aria-hidden="true"><span>⚑</span><strong>{profile.tag}</strong></div>
        <div className="alliance-identity"><span className="alliance-eyebrow">{member?'DEIN BÜNDNIS':'ÖFFENTLICHES PROFIL'}</span><h3>[{profile.tag}] {profile.name}</h3><p>{profile.description||'Eine Gemeinschaft von Kommandanten dieser Welt.'}</p><small>Gegründet am {new Date(profile.createdAt).toLocaleDateString('de-DE')}</small></div>
        <dl className="alliance-facts"><div><dt>Mitglieder</dt><dd>{profile.memberCount}<span> / {profile.maxMembers}</span></dd></div>{member && <div><dt>Deine Rolle</dt><dd className="alliance-role">{roles[profile.role]}</dd></div>}</dl>
      </header>
      {member && <aside className="alliance-notice"><span className="alliance-notice-icon" aria-hidden="true">⚑</span><div><h4>Angeheftete interne Mitteilung</h4><p className="alliance-text">{profile.notice.text||'Noch keine Mitteilung. Hier ist Platz für eure gemeinsamen Pläne.'}</p>{profile.notice.authorName && <small>{profile.notice.authorName} · {new Date(profile.notice.updatedAt).toLocaleString('de-DE')}</small>}</div></aside>}
      <div className={`alliance-community${member?'':' alliance-community--public'}`}>
        <section className="alliance-card alliance-members" aria-labelledby="alliance-members-title">
          <div className="alliance-section-heading"><div><span className="alliance-eyebrow">KOMMANDANTEN & STÄDTE</span><h4 id="alliance-members-title">Mitglieder und öffentliche Städte</h4></div><span className="alliance-count">{profile.memberCount}</span></div>
          <div className="alliance-member-list">{profile.members.map(m=><article className="alliance-member" key={m.playerId}>
            <div className="alliance-member-heading"><span className="alliance-avatar" aria-hidden="true">{[...m.name][0]}</span><strong>{m.name} · {roles[m.role]}</strong><button className="alliance-quiet" onClick={()=>onMessage(m.name)}>Nachricht</button></div>
            <div className="alliance-cities">{m.cities.map(c=><div className="alliance-city" key={c.id}><div><strong>{c.name}</strong><small>Koordinaten {c.x} | {c.y}</small></div><div className="alliance-actions"><button className="alliance-quiet" onClick={()=>onMap(c)}>Auf Karte zeigen</button><button onClick={()=>onDelivery(c)}>Ressourcen liefern</button></div></div>)}</div>
            {member && m.playerId!==state.player.id && <div className="alliance-member-management">
              {leader && <><button disabled={busy||!connected} onClick={()=>action('alliance.role.change',{targetMembershipId:m.membershipId,role:m.role==='officer'?'member':'officer'})}>{m.role==='officer'?'Degradieren':'Befördern'}</button><button disabled={busy||!connected} onClick={()=>action('alliance.leadership.transfer',{targetMembershipId:m.membershipId},`Führung von ${state.player.commanderName ?? state.player.name} an ${m.name} übertragen? Du wirst Offizier.`)}>Führung übertragen</button></>}
              {admin && m.role!=='leader' && (leader||m.role==='member') && <button className="alliance-danger" disabled={busy||!connected} onClick={()=>action('alliance.member.remove',{targetMembershipId:m.membershipId},`${m.name} ausschließen? Der interne Zugang endet sofort.`)}>Ausschließen</button>}
            </div>}
          </article>)}</div>
          {profile.nextMemberCursor && <button onClick={async()=>{try{const next=await transport.request('alliance.get',{allianceId:profile.id,memberCursor:profile.nextMemberCursor});setProfile(current=>({...next,members:[...current.members,...next.members]}));}catch(e){setError(e.message);}}}>Weitere Mitglieder</button>}
        </section>
        {member && <section className="alliance-card alliance-chat" ref={visibleChat} aria-labelledby="alliance-chat-title">
          <div className="alliance-section-heading"><div><span className="alliance-eyebrow">NUR FÜR EUCH</span><h4 id="alliance-chat-title">Interner Chat</h4></div><span className="alliance-chat-indicator">Bündniskanal</span></div>
          <p className="alliance-help">Neue Mitglieder können den gespeicherten Verlauf lesen. Letzte 200 Beiträge einschließlich entfernter Beiträge.</p>
          <div className="alliance-chat-history">
            {!chat.items.length && <div className="alliance-empty"><span aria-hidden="true">✉</span><strong>Hier beginnt euer Austausch</strong><p>Begrüße dein Bündnis mit der ersten Nachricht.</p></div>}
            {chat.items.map(c=><article className={`alliance-chat-post${c.senderId===state.player.id?' is-own':''}${c.removed?' is-removed':''}`} key={c.id}>
              <div className="alliance-post-heading"><strong>{c.senderName}</strong><time dateTime={new Date(c.at).toISOString()}>{new Date(c.at).toLocaleString('de-DE')}</time><span>#{c.sequence}</span></div>
              <p className="alliance-text">{c.removed?'Beitrag entfernt (moderiert)':c.text}</p>
              <div className="alliance-actions">{!c.removed&&(admin||c.senderId===state.player.id)&&<button className="alliance-quiet" disabled={busy||!connected} onClick={()=>action('alliance.chat.remove',{messageId:c.id})}>Beitrag entfernen</button>}{c.sequence>profile.lastReadSequence && <button className="alliance-quiet" disabled={busy||!connected} onClick={()=>action('alliance.chat.read',{sequence:c.sequence})}>Bis hier gelesen</button>}</div>
            </article>)}
            {chat.nextCursor && <button onClick={()=>more('alliance.chat.list',chat,setChat,context())}>Weitere Beiträge</button>}
          </div>
          <form className="alliance-compose" onSubmit={e=>{e.preventDefault();action('alliance.chat.send',{text},null,()=>setText(''));}}>
            <label>Chatnachricht<textarea aria-label="Chatnachricht" rows={3} placeholder="Was möchtest du deinem Bündnis mitteilen?" value={text} onChange={e=>setText(e.target.value)}/></label>
            <div className="alliance-form-footer"><small>Nur für aktuelle Mitglieder sichtbar.</small><button className="alliance-primary" disabled={!text.trim()||busy||!connected}>Nachricht senden</button></div>
          </form>
        </section>}
      </div>
      {admin && <section className="alliance-administration" aria-labelledby="alliance-admin-title">
        <div className="alliance-section-heading"><div><span className="alliance-eyebrow">GEMEINSCHAFT GESTALTEN</span><h4 id="alliance-admin-title">Verwaltung</h4></div></div>
        <div className="alliance-admin-grid">
          <form className="alliance-card" onSubmit={e=>{e.preventDefault();action('alliance.invite',{recipientName:recipient},null,()=>setRecipient(''));}}><h5>Neue Mitstreiter</h5><p className="alliance-help">Lade einen Kommandanten aus dieser Welt in euer Bündnis ein.</p><label>Kommandant einladen<input placeholder="Kommandantenname" value={recipient} onChange={e=>setRecipient(e.target.value)}/></label><button className="alliance-primary" disabled={!recipient||busy||!connected}>Einladen</button></form>
          <section className="alliance-card"><h5>Eure interne Mitteilung</h5><p className="alliance-help">Gemeinsame Ziele und Absprachen, oben für alle Mitglieder angeheftet.</p><label>Interne Mitteilung<textarea aria-label="Interne Mitteilung" rows={5} placeholder="Ziele, Absprachen und Neuigkeiten …" value={notice?.text??profile.notice.text} onChange={e=>setNotice({text:e.target.value,version:notice?.version??profile.notice.version})}/></label><div className="alliance-actions"><button className="alliance-primary" disabled={notice===null||busy||!connected} onClick={()=>action('alliance.notice.update',{text:notice?.text,noticeVersion:notice?.version},null,()=>setNotice(null))}>Mitteilung speichern</button>{notice!==null && <button className="alliance-quiet" disabled={busy} onClick={()=>setNotice(null)}>Mitteilungsentwurf verwerfen</button>}</div></section>
          <section className="alliance-card"><h5>Euer öffentlicher Auftritt</h5><p className="alliance-help">Diese Beschreibung können alle Kommandanten der Welt lesen.</p><label>Öffentliche Beschreibung<textarea aria-label="Öffentliche Beschreibung" rows={5} placeholder="Wofür steht euer Bündnis?" value={description?.text??profile.description} onChange={e=>setDescription({text:e.target.value,version:description?.version??profile.adminVersion})}/></label><div className="alliance-actions"><button className="alliance-primary" disabled={description===null||busy||!connected} onClick={()=>action('alliance.description.update',{text:description?.text,adminVersion:description?.version},null,()=>setDescription(null))}>Beschreibung speichern</button>{description!==null && <button className="alliance-quiet" disabled={busy} onClick={()=>setDescription(null)}>Beschreibungsentwurf verwerfen</button>}</div></section>
        </div>
      </section>}
      {member && <footer className="alliance-membership-footer">
        <details className="alliance-card alliance-log"><summary>Verwaltungsprotokoll (letzte 100)</summary>{!events.items.length && <p className="alliance-help">Noch keine Ereignisse.</p>}{events.items.map(e=><p key={e.sequence}><strong>{e.actorName}</strong>: {eventNames[e.type] ?? e.type}{e.targetName ? ` · ${e.targetName}` : ''}<small>{new Date(e.at).toLocaleString('de-DE')}</small></p>)}{events.nextCursor&&<button onClick={()=>more('alliance.events.list',events,setEvents,context())}>Weitere Ereignisse</button>}</details>
        <div className="alliance-exit"><div><strong>Mitgliedschaft</strong><p>{leader&&profile.memberCount>1?'Übertrage die Führung, bevor du das Bündnis verlässt.':'Städte und laufende Lieferungen bleiben erhalten.'}</p></div>{leader?<button className="alliance-danger" disabled={profile.memberCount!==1||busy||!connected} onClick={()=>action('alliance.dissolve',{},'Bündnis endgültig auflösen? Name und Kürzel werden frei. Keine Rückzahlung.')}>Bündnis auflösen</button>:<button className="alliance-danger" disabled={busy||!connected} onClick={()=>action('alliance.leave',{},'Bündnis verlassen? Der interne Zugang endet sofort.')}>Austreten</button>}</div>
      </footer>}
    </section>}

    <div className={`alliance-discovery${state.alliance?.allianceId?' alliance-discovery--member':''}`}>
      {!state.alliance?.allianceId && <section className="alliance-card alliance-founding"><span className="alliance-eyebrow">DEINE EIGENE GEMEINSCHAFT</span><h3>Bündnis gründen</h3><p className="alliance-help">Gib eurem Bündnis einen Namen und ein unverwechselbares Kürzel.</p>
        <div className="alliance-name-fields"><label>Name<input placeholder="Name deines Bündnisses" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Kürzel<input className="alliance-tag-input" placeholder="TEAM" value={form.tag} onChange={e=>setForm({...form,tag:e.target.value})}/></label></div>
        <label>Öffentliche Beschreibung<textarea aria-label="Öffentliche Beschreibung" rows={4} placeholder="Erzähle anderen Kommandanten von eurem Bündnis …" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
        <label>Zahlende eigene Stadt<select value={form.cityId} onChange={e=>setForm({...form,cityId:e.target.value})}>{state.cities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="alliance-quote"><span className="alliance-eyebrow">GRÜNDUNGSKOSTEN</span><p className="alliance-help">{status}</p>{preview && <><div className="alliance-prices"><span><strong>{preview.cost.wood.toLocaleString('de-DE')}</strong> Holz</span><span><strong>{preview.cost.stone.toLocaleString('de-DE')}</strong> Stein</span><span><strong>{preview.maxMembers}</strong> Mitglieder</span></div><small>0 Nahrung / Öl · Keine Rückzahlung · Eine Gründung je 24 Stunden.</small></>}</div>
        <button className="alliance-primary" disabled={!preview||busy||!connected} onClick={()=>action('alliance.create',{...form,rulesVersion:preview.rulesVersion},`„${preview.name}“ aus ${state.cities.find(c=>c.id===form.cityId)?.name} für ${preview.cost.wood} Holz und ${preview.cost.stone} Stein gründen?`)}>Kostenpflichtig gründen</button>
      </section>}
      <section className="alliance-card alliance-directory"><div className="alliance-section-heading"><div><span className="alliance-eyebrow">GEMEINSCHAFTEN DIESER WELT</span><h3>Verzeichnis</h3></div>{state.alliance?.allianceId && <button className="alliance-quiet" onClick={()=>setSelected(state.alliance.allianceId)}>Mein Bündnis</button>}</div>
        <label>Bündnis suchen<input type="search" placeholder="Nach Name oder Kürzel suchen …" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <div className="alliance-directory-list">{directory.items.map(a=><button className="alliance-directory-entry" key={a.id} aria-pressed={profile?.id===a.id} onClick={()=>setSelected(a.id)}><span className="alliance-directory-tag">{a.tag}</span><span><strong>{a.name}</strong><small>{a.memberCount} / {a.maxMembers} Mitglieder</small></span><span className="alliance-directory-arrow" aria-hidden="true">↗</span></button>)}</div>
        {!directory.items.length && <p className="alliance-empty">{query?'Kein Bündnis zu dieser Suche gefunden.':'Noch keine Bündnisse in dieser Welt.'}</p>}
        {directory.nextCursor && <button onClick={()=>more('alliance.list',directory,setDirectory,{query})}>Weitere Bündnisse</button>}
      </section>
    </div>
  </section>;
}
