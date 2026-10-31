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
  return <section className="alliance-view"><h2>Bündnis</h2>
    {!connected && <p role="status">Offline · Stand veraltet. Nach Wiederverbindung gespeicherten Stand prüfen.</p>}
    {error && <p role="alert">{error}</p>}{success && <p role="status">{success}</p>}
    {confirmation && <section className="panel" aria-label="Aktion bestätigen"><p>{confirmation.label}</p><button disabled={busy||!connected} onClick={()=>mutate(confirmation.type,confirmation.p,confirmation.done)}>Ausdrücklich bestätigen</button><button onClick={()=>setConfirmation(null)}>Abbrechen</button></section>}
    <section><h3>Einladungen ({state.alliance?.invitations ?? 0})</h3>
      {invitations.items.map(i=><article className="panel" key={i.id}><strong>[{i.tag}] {i.allianceName}</strong><p>Für {i.recipientName} · gültig bis {new Date(i.expiresAt).toLocaleString('de-DE')}</p>
        {i.recipientId===state.player.id ? <><button disabled={busy||!connected} onClick={()=>mutate('alliance.invitation.respond',{invitationId:i.id,response:'accept'})}>Annehmen</button><button disabled={busy||!connected} onClick={()=>mutate('alliance.invitation.respond',{invitationId:i.id,response:'decline'})}>Ablehnen</button></> : admin && <button disabled={busy||!connected} onClick={()=>action('alliance.invitation.revoke',{invitationId:i.id})}>Widerrufen</button>}
      </article>)}
      {invitations.nextCursor && <button onClick={()=>more('alliance.invitations',invitations,setInvitations,{})}>Weitere Einladungen</button>}
    </section>
    {!state.alliance?.allianceId && <section className="panel"><h3>Bündnis gründen</h3>
      <label>Name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
      <label>Kürzel<input value={form.tag} onChange={e=>setForm({...form,tag:e.target.value})}/></label>
      <label>Öffentliche Beschreibung<textarea aria-label="Öffentliche Beschreibung" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      <label>Zahlende eigene Stadt<select value={form.cityId} onChange={e=>setForm({...form,cityId:e.target.value})}>{state.cities.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <p>{status}</p>{preview && <p>{preview.cost.wood} Holz · {preview.cost.stone} Stein · 0 Nahrung/Öl · {preview.maxMembers} Mitglieder. Keine Rückzahlung. Eine Gründung je 24 Stunden.</p>}
      <button disabled={!preview||busy||!connected} onClick={()=>action('alliance.create',{...form,rulesVersion:preview.rulesVersion},`„${preview.name}“ aus ${state.cities.find(c=>c.id===form.cityId)?.name} für ${preview.cost.wood} Holz und ${preview.cost.stone} Stein gründen?`)}>Kostenpflichtig gründen</button>
    </section>}
    <section><h3>Verzeichnis</h3><label>Bündnis suchen<input value={query} onChange={e=>setQuery(e.target.value)}/></label>
      {state.alliance?.allianceId && <button onClick={()=>setSelected(state.alliance.allianceId)}>Mein Bündnis</button>}
      {directory.items.map(a=><button key={a.id} onClick={()=>setSelected(a.id)}>[{a.tag}] {a.name} ({a.memberCount}/{a.maxMembers})</button>)}
      {directory.nextCursor && <button onClick={()=>more('alliance.list',directory,setDirectory,{query})}>Weitere Bündnisse</button>}
    </section>
    {profile && <section className="panel"><h3>[{profile.tag}] {profile.name}</h3><p>{profile.description}</p><p>Gegründet am {new Date(profile.createdAt).toLocaleString("de-DE")}</p><p>{profile.memberCount}/{profile.maxMembers} Mitglieder{member && ` · Deine Rolle: ${roles[profile.role]}`}</p>
      {member && <><h4>Angeheftete interne Mitteilung</h4><p className="alliance-text">{profile.notice.text||'Keine Mitteilung.'}</p>{profile.notice.authorName && <small>{profile.notice.authorName} · {new Date(profile.notice.updatedAt).toLocaleString('de-DE')}</small>}</>}
      <h4>Mitglieder und öffentliche Städte</h4>
      {profile.members.map(m=><article key={m.playerId}><strong>{m.name} · {roles[m.role]}</strong>
        <button onClick={()=>onMessage(m.name)}>Nachricht</button>
        {m.cities.map(c=><div key={c.id}>{c.name} ({c.x}|{c.y}) <button onClick={()=>onMap(c)}>Auf Karte zeigen</button><button onClick={()=>onDelivery(c)}>Ressourcen liefern</button></div>)}
        {member && m.playerId!==state.player.id && <>
          {leader && <><button disabled={busy||!connected} onClick={()=>action('alliance.role.change',{targetMembershipId:m.membershipId,role:m.role==='officer'?'member':'officer'})}>{m.role==='officer'?'Degradieren':'Befördern'}</button><button disabled={busy||!connected} onClick={()=>action('alliance.leadership.transfer',{targetMembershipId:m.membershipId},`Führung von ${state.player.commanderName ?? state.player.name} an ${m.name} übertragen? Du wirst Offizier.`)}>Führung übertragen</button></>}
          {admin && m.role!=='leader' && (leader||m.role==='member') && <button disabled={busy||!connected} onClick={()=>action('alliance.member.remove',{targetMembershipId:m.membershipId},`${m.name} ausschließen? Der interne Zugang endet sofort.`)}>Ausschließen</button>}
        </>}
      </article>)}
      {profile.nextMemberCursor && <button onClick={async()=>{try{const next=await transport.request('alliance.get',{allianceId:profile.id,memberCursor:profile.nextMemberCursor});setProfile(current=>({...next,members:[...current.members,...next.members]}));}catch(e){setError(e.message);}}}>Weitere Mitglieder</button>}
      {member && <><section ref={visibleChat}><h4>Interner Chat</h4><p>Neue Mitglieder können den gespeicherten Verlauf lesen. Letzte 200 Beiträge einschließlich entfernter Beiträge.</p>
        {chat.items.map(c=><article key={c.id}><strong>#{c.sequence} · {c.senderName}</strong><small> · {new Date(c.at).toLocaleString("de-DE")}</small><p className="alliance-text">{c.removed?'Beitrag entfernt (moderiert)':c.text}</p>{!c.removed&&(admin||c.senderId===state.player.id)&&<button disabled={busy||!connected} onClick={()=>action('alliance.chat.remove',{messageId:c.id})}>Beitrag entfernen</button>}
          {c.sequence>profile.lastReadSequence && <button disabled={busy||!connected} onClick={()=>action('alliance.chat.read',{sequence:c.sequence})}>Bis hier gelesen</button>}</article>)}
        {chat.nextCursor && <button onClick={()=>more('alliance.chat.list',chat,setChat,context())}>Weitere Beiträge</button>}
        <form onSubmit={e=>{e.preventDefault();action('alliance.chat.send',{text},null,()=>setText(''));}}><label>Chatnachricht<textarea aria-label="Chatnachricht" value={text} onChange={e=>setText(e.target.value)}/></label><button disabled={!text.trim()||busy||!connected}>Nachricht senden</button></form>
      </section>
      {admin && <section><h4>Verwaltung</h4><form onSubmit={e=>{e.preventDefault();action('alliance.invite',{recipientName:recipient},null,()=>setRecipient(''));}}><label>Kommandant einladen<input value={recipient} onChange={e=>setRecipient(e.target.value)}/></label><button disabled={!recipient||busy||!connected}>Einladen</button></form>
        <label>Interne Mitteilung<textarea aria-label="Interne Mitteilung" value={notice?.text??profile.notice.text} onChange={e=>setNotice({text:e.target.value,version:notice?.version??profile.notice.version})}/></label><button disabled={notice===null||busy||!connected} onClick={()=>action('alliance.notice.update',{text:notice?.text,noticeVersion:notice?.version},null,()=>setNotice(null))}>Mitteilung speichern</button>{notice!==null && <button disabled={busy} onClick={()=>setNotice(null)}>Mitteilungsentwurf verwerfen</button>}
        <label>Öffentliche Beschreibung<textarea aria-label="Öffentliche Beschreibung" value={description?.text??profile.description} onChange={e=>setDescription({text:e.target.value,version:description?.version??profile.adminVersion})}/></label><button disabled={description===null||busy||!connected} onClick={()=>action('alliance.description.update',{text:description?.text,adminVersion:description?.version},null,()=>setDescription(null))}>Beschreibung speichern</button>{description!==null && <button disabled={busy} onClick={()=>setDescription(null)}>Beschreibungsentwurf verwerfen</button>}
      </section>}
      <details><summary>Verwaltungsprotokoll (letzte 100)</summary>{events.items.map(e=><p key={e.sequence}>{e.actorName}: {eventNames[e.type] ?? e.type}{e.targetName ? ` · ${e.targetName}` : ""} · {new Date(e.at).toLocaleString('de-DE')}</p>)}{events.nextCursor&&<button onClick={()=>more('alliance.events.list',events,setEvents,context())}>Weitere Ereignisse</button>}</details>
      {profile.role==='leader'?<button disabled={profile.memberCount!==1||busy||!connected} onClick={()=>action('alliance.dissolve',{},'Bündnis endgültig auflösen? Name und Kürzel werden frei. Keine Rückzahlung.')}>Bündnis auflösen</button>:<button disabled={busy||!connected} onClick={()=>action('alliance.leave',{},'Bündnis verlassen? Der interne Zugang endet sofort.')}>Austreten</button>}
      </>}
    </section>}
  </section>;
}
