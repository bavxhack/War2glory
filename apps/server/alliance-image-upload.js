import { fork } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { ALLIANCE_IMAGE_LIMITS as L, requireAllianceImageAdmin, checkAllianceImageAttempt, reserveAllianceImageAttempt } from '../../packages/game-core/alliance-images.js';
import { allianceRequest } from './alliances.js';
import { stableJSON } from '../../packages/game-core/city-logistics.js';
export const imageFingerprint = message => createHash('sha256').update(stableJSON([message.type,message.payload])).digest('hex');
export function sanitizeAllianceImage(buffer, mime, signal, { timeoutMs = 5000 } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12 || buffer.length > L.maxBytes || !['image/png','image/jpeg','image/webp'].includes(mime)) return Promise.reject(new Error('PNG, JPEG oder WebP bis 2 MiB erwartet.'));
  return new Promise((resolve,reject)=>{
    const child=fork(new URL('./alliance-image-worker.js',import.meta.url),[],{serialization:'advanced',execArgv:['--max-old-space-size=64'],stdio:['ignore','ignore','ignore','ipc'],env:{PATH:process.env.PATH,LANG:'C.UTF-8'}});
    let finished=false;
    const done=(error,value)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);child.kill('SIGKILL');error?reject(error):resolve(value);};
    const abort=()=>done(new Error('Bildverarbeitung abgebrochen.'));
    const timer=setTimeout(()=>done(new Error('Bildverarbeitung hat das Zeitlimit überschritten.')),timeoutMs);
    child.once('error',()=>done(new Error('Bildverarbeitung nicht verfügbar.')));
    child.once('exit',()=>done(new Error('Bild konnte nicht sicher verarbeitet werden.')));
    child.once('message',result=>{
      if(!result?.ok || !Buffer.isBuffer(result.buffer) || result.buffer.length>L.maxOutputBytes)return done(new Error('Ungültiges Bild. Nur statische PNG-, JPEG- oder WebP-Bilder bis 2048 × 2048 Pixel erlaubt.'));
      const output=result.buffer;
      done(null,{hash:createHash('sha256').update(output).digest('hex'),data:output.toString('base64'),type:'image/webp',width:L.side,height:L.side});
    });
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)return abort();
    child.send({buffer,mime},error=>{if(error)done(new Error('Bildverarbeitung nicht verfügbar.'));});
  });
}
export class AllianceImageUploads {
  types=new Set(['alliance.image.begin','alliance.image.chunk','alliance.image.finish','alliance.image.cancel']);
  sessions=new Map(); traffic=new WeakMap(); reservedBytes=0; processing=0;
  constructor(storage,clock,{sanitize=sanitizeAllianceImage}={}){this.sanitize=sanitize;this.storage=storage;this.clock=clock;this.timer=setInterval(()=>this.prune(),10000);this.timer.unref();}
  drop(s){if(!s || !this.sessions.has(s.id))return;this.sessions.delete(s.id);this.reservedBytes-=s.size;s.abort.abort();s.buffer=null;}
  prune(){for(const s of this.sessions.values())if(this.clock()>=s.expiresAt)this.drop(s);}
  forget(peer){for(const s of this.sessions.values())if(s.peer===peer)this.drop(s);}
  close(){clearInterval(this.timer);for(const s of this.sessions.values())this.drop(s);}
  current(peer,p){
    const s=this.sessions.get(p.uploadId);
    if(!s || s.peer!==peer || s.playerId!==peer.playerId)throw new Error('Upload nicht gefunden. Datei bitte erneut auswählen.');
    try { if(this.clock()>=s.expiresAt)throw new Error('Upload abgelaufen.');requireAllianceImageAdmin(this.storage.world,peer.playerId,s.context); }
    catch(error){this.drop(s);throw error;}
    return s;
  }
  async handle(peer,message){
    const now=this.clock(),traffic=this.traffic.get(peer);
    if(!traffic||now-traffic.since>=1000)this.traffic.set(peer,{since:now,count:1});
    else if(++traffic.count>600){this.forget(peer);throw new Error('Zu viele Uploadanfragen. Bitte kurz warten.');}
    if(message.type==='alliance.image.finish')return this.finish(peer,message);
    return this.storage.exclusive(async()=>{
      if(this.storage.needsRecovery)await this.storage.advanceWorld(this.clock());this.prune();const p=message.payload;
      if(message.type==='alliance.image.begin'){
        requireAllianceImageAdmin(this.storage.world,peer.playerId,p);
        const fingerprint=imageFingerprint(message);
        const duplicate=[...this.sessions.values()].find(s=>s.peer===peer&&s.requestId===message.requestId);
        if(duplicate){if(duplicate.fingerprint!==fingerprint)throw new Error('Diese Befehls-ID wurde bereits mit anderem Inhalt verwendet.');return {uploadId:duplicate.id,received:duplicate.received};}
        if(!Number.isSafeInteger(p.size)||p.size<12||p.size>L.maxBytes||!['image/png','image/jpeg','image/webp'].includes(p.mime))throw new Error('PNG, JPEG oder WebP bis 2 MiB erwartet.');
        if([...this.sessions.values()].some(s=>s.playerId===peer.playerId))throw new Error('Es läuft bereits ein Bild-Upload für diesen Kommandanten.');
        if(this.sessions.size>=L.maxSessions || this.reservedBytes+p.size>L.maxReservedBytes)throw new Error('Uploadverarbeitung ausgelastet. Bitte später versuchen.');
        checkAllianceImageAttempt(this.storage.world,peer.playerId,p,this.clock());
        await this.storage.advanceWorld(this.clock());
        const previous=this.storage.world,next=structuredClone(previous);
        reserveAllianceImageAttempt(next,peer.playerId,p,this.clock());this.storage.world=next;
        try{await this.storage.commitPlayers([],true);}catch(error){this.storage.world=previous;throw error;}
        const s={id:randomUUID(),peer,playerId:peer.playerId,context:{allianceId:p.allianceId,membershipId:p.membershipId,imageVersion:p.imageVersion},size:p.size,mime:p.mime,requestId:message.requestId,fingerprint,received:0,expiresAt:this.clock()+L.ttlMs,buffer:Buffer.alloc(p.size),abort:new AbortController()};
        this.sessions.set(s.id,s);this.reservedBytes+=p.size;return {uploadId:s.id,chunkBytes:L.chunkBytes,received:0};
      }
      const s=this.current(peer,p);
      if(message.type==='alliance.image.cancel'){this.drop(s);return {cancelled:true};}
      if(s.finishing)throw new Error('Das Bild wird bereits geprüft.');
      try{
        if(!Number.isSafeInteger(p.offset)||p.offset<0||typeof p.data!=='string'||p.data.length>Math.ceil(L.chunkBytes/3)*4||!p.data.length||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(p.data))throw new Error('Ungültiger Uploadblock.');
        const part=Buffer.from(p.data,'base64');
        if(!part.length||part.length>L.chunkBytes||part.toString('base64')!==p.data||p.offset+part.length>s.size)throw new Error('Uploadgröße überschritten.');
        if(p.offset<s.received && p.offset+part.length<=s.received && s.buffer.subarray(p.offset,p.offset+part.length).equals(part))return {received:s.received,duplicate:true};
        if(p.offset!==s.received)throw new Error('Uploadblöcke außerhalb der Reihenfolge.');
        part.copy(s.buffer,p.offset);s.received+=part.length;return {received:s.received};
      }catch(error){this.drop(s);throw error;}
    });
  }
  async finish(peer,message){
    let session;
    const replay=await this.storage.exclusive(async()=>{
      if(this.storage.needsRecovery)await this.storage.advanceWorld(this.clock());
      const existing=this.storage.world.alliances.receipts.find(r=>r.playerId===peer.playerId&&r.id===message.requestId);
      if(existing){if(existing.fingerprint!==imageFingerprint(message))throw new Error('Diese Befehls-ID wurde bereits mit anderem Inhalt verwendet.');return {duplicate:true};}
      const s=this.current(peer,message.payload);
      if(s.finishing)throw new Error('Das Bild wird bereits geprüft.');
      if(s.received!==s.size){this.drop(s);throw new Error('Upload unvollständig.');}
      if(this.processing>=1)throw new Error('Bildverarbeitung ausgelastet. Bitte kurz warten.');
      s.finishing=true;session=s;this.processing++;return null;
    });
    if(replay)return replay;
    try{
      const image=await this.sanitize(session.buffer,session.mime,session.abort.signal);
      return await this.storage.exclusive(async()=>{
        await this.storage.advanceWorld(this.clock());this.current(peer,{uploadId:session.id});
        // The server-owned context, never user-supplied image metadata, is authoritative.
        if(stableJSON(message.payload)!==stableJSON({...session.context,uploadId:session.id,...(message.payload.cityId?{cityId:message.payload.cityId}:{})}))throw new Error('Uploadkontext geändert.');
        return allianceRequest(this.storage,peer,message,this.clock(),{image,context:session.context});
      });
    }finally{this.processing--;this.drop(session);}
  }
}
