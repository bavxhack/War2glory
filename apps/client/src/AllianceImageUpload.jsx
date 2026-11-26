import { useEffect, useRef, useState } from 'react';
import { useDraft } from './Drafts.jsx';
import { AllianceEmblem } from './AllianceEmblem.jsx';
import { ALLIANCE_IMAGE_LIMITS as L } from '../../../packages/game-core/alliance-images.js';
export function AllianceImageUpload({ profile, transport, connected, onSaved, onDirty }) {
  const [file,setFile]=useState(null),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(''),[success,setSuccess]=useState('');
  const input=useRef(null),selectedContext=useRef(null),pending=useRef(false),generation=useRef(0),cancelled=useRef(false),uploadId=useRef(null),alive=useRef(true);
  useDraft(!!file);
  useEffect(()=>{onDirty?.(!!file);return()=>onDirty?.(false);},[file,onDirty]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;cancelled.current=true;if(uploadId.current)transport.request('alliance.image.cancel',{uploadId:uploadId.current}).catch(()=>{});};},[transport]);
  const context=()=>({allianceId:profile.id,membershipId:profile.membershipId,imageVersion:profile.imageVersion});
  const choose=e=>{setError('');setSuccess('');const candidate=e.target.files?.[0];if(!candidate){setFile(null);return;}if(!['image/png','image/jpeg','image/webp'].includes(candidate.type)||candidate.size>L.maxBytes||candidate.size<12){setFile(null);e.target.value='';setError('Bitte ein PNG-, JPEG- oder WebP-Bild bis 2 MiB auswählen.');return;}selectedContext.current=context();setFile(candidate);};
  const cancel=()=>{cancelled.current=true;if(uploadId.current)transport.request('alliance.image.cancel',{uploadId:uploadId.current}).catch(()=>{});};
  const upload=async e=>{
    e.preventDefault();if(pending.current||!file||!connected)return;
    pending.current=true;cancelled.current=false;setBusy(true);setError('');setSuccess('');setProgress(0);const ctx=selectedContext.current??context(),ticket=++generation.current;
    try{
      const started=await transport.request('alliance.image.begin',{...ctx,mime:file.type,size:file.size});uploadId.current=started.uploadId;
      for(let offset=0;offset<file.size;offset+=L.chunkBytes){
        if(cancelled.current||!alive.current)throw new Error('Upload abgebrochen.');
        const bytes=new Uint8Array(await file.slice(offset,offset+L.chunkBytes).arrayBuffer());let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
        await transport.request('alliance.image.chunk',{uploadId:started.uploadId,offset,data:btoa(binary)});
        if(alive.current)setProgress(Math.round(Math.min(file.size,offset+bytes.length)/file.size*100));
      }
      if(cancelled.current||!alive.current)throw new Error('Upload abgebrochen.');
      await transport.request('alliance.image.finish',{...ctx,uploadId:started.uploadId});
      if(alive.current&&ticket===generation.current){setFile(null);if(input.current)input.current.value='';setSuccess('Bündnisbild gespeichert.');onSaved();}
    }catch(cause){if(alive.current)setError(cause.message);if(uploadId.current)transport.request('alliance.image.cancel',{uploadId:uploadId.current}).catch(()=>{});}
    finally{uploadId.current=null;pending.current=false;if(alive.current)setBusy(false);}
  };
  const remove=async()=>{
    if(pending.current||!connected)return;pending.current=true;setBusy(true);setError('');setSuccess('');
    try{await transport.request('alliance.image.remove',context());if(alive.current){setSuccess('Bündnisbild entfernt.');onSaved();}}
    catch(cause){if(alive.current)setError(cause.message);}finally{pending.current=false;if(alive.current)setBusy(false);}
  };
  return <form className="alliance-card alliance-image-upload" onSubmit={upload}>
    <h5>Euer Bündnisbild</h5><p className="alliance-help">Sichtbar im Profil, Verzeichnis, bei Einladungen und an euren Städten auf der Karte.</p>
    <div className="alliance-image-current"><AllianceEmblem image={profile.image} tag={profile.tag} label="Aktuelles Bündnisbild"/><p>Quadratischer Ausschnitt<br/><small>PNG, JPEG oder WebP · max. 2 MiB<br/>Max. 2048 × 2048 Pixel · keine Animation</small></p></div>
    <label>Neues Bündnisbild<input ref={input} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy||!connected} onChange={choose}/></label>
    {file && <p className="alliance-help">{file.name} · {Math.ceil(file.size/1024)} KiB</p>}
    {busy && <div role="status"><progress max="100" value={progress} aria-label="Bild-Upload"/><p>{progress<100?`Wird hochgeladen … ${progress} %`:'Bild wird geprüft und sicher aufbereitet …'}</p></div>}
    {error && <p className="alliance-feedback alliance-feedback--error" role="alert">{error}</p>}{success && <p role="status">{success}</p>}
    <div className="alliance-actions"><button className="alliance-primary" disabled={!file||busy||!connected}>Bild hochladen</button>{busy && <button type="button" onClick={cancel}>Upload abbrechen</button>}{!busy&&file&&<button type="button" onClick={()=>{setFile(null);if(input.current)input.current.value='';}}>Dateiauswahl verwerfen</button>}{profile.image && <button type="button" disabled={busy||!connected} onClick={remove}>Bild entfernen</button>}</div>
  </form>;
}
