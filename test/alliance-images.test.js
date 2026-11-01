import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { mkdtemp, rm, readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { WorldStorage } from '../apps/server/storage.js';
import { parseConfiguration } from '../apps/server/config.js';
import { allianceRequest } from '../apps/server/alliances.js';
import { sanitizeAllianceImage, AllianceImageUploads } from '../apps/server/alliance-image-upload.js';
import { ALLIANCE_IMAGE_LIMITS as L, allianceImage } from '../packages/game-core/alliance-images.js';
import { membership } from '../packages/game-core/alliances.js';
import { start, close, websocket, authenticate } from './support/socket.js';

const png=()=>sharp({create:{width:48,height:32,channels:4,background:'#657d42'}}).png().toBuffer();
const message=(type,payload,id=randomUUID())=>({type:`alliance.${type}`,payload,requestId:id});
async function fixture(t,{sanitize}={}){
  const dir=await mkdtemp(join(tmpdir(),'alliance-images-'));let now=100000000;
  const config=parseConfiguration({ALLIANCE_CREATE_WOOD:'0',ALLIANCE_CREATE_STONE:'0'});
  let storage=await new WorldStorage(dir,'images',()=>now,config).initialize();const peers={};
  for(const name of ['Alpha','Bravo','Charlie']){const r=await storage.register(name,'password-long',name);peers[name]={playerId:r.player.playerId,account:r.account,cityId:r.player.cities[0].id};}
  let manager=new AllianceImageUploads(storage,()=>now,{sanitize});
  t.after(async()=>{manager.close();await rm(dir,{recursive:true,force:true});});
  const call=(name,type,p={},id)=>storage.exclusive(()=>allianceRequest(storage,peers[name],message(type,{cityId:peers[name].cityId,...p},id),now));
  const context=name=>{const o=membership(storage.world,peers[name].playerId);return {allianceId:o.alliance.id,membershipId:o.member.membershipId,imageVersion:o.alliance.imageVersion??0};};
  const admin=name=>({...context(name),adminVersion:membership(storage.world,peers[name].playerId).alliance.adminVersion});
  const q=await call('Alpha','create.preview',{name:'Image League',tag:'IMG'});await call('Alpha','create',q);
  await call('Alpha','invite',{...admin('Alpha'),recipientName:'Bravo'});const invitation=(await call('Bravo','invitations')).items[0];await call('Bravo','invitation.respond',{invitationId:invitation.id,response:'accept'});
  const send=(name,type,p={},id)=>manager.handle(peers[name],message(`image.${type}`,{cityId:peers[name].cityId,...p},id));
  const begin=async(name,bytes,mime='image/png')=>{const ctx=context(name);const reply=await send(name,'begin',{...ctx,size:bytes.length,mime});return {...ctx,uploadId:reply.uploadId};};
  const chunks=async(name,ctx,bytes)=>{for(let offset=0;offset<bytes.length;offset+=L.chunkBytes)await send(name,'chunk',{uploadId:ctx.uploadId,offset,data:bytes.subarray(offset,offset+L.chunkBytes).toString('base64')});};
  const upload=async(name,bytes,mime='image/png',id)=>{const ctx=await begin(name,bytes,mime);await chunks(name,ctx,bytes);await send(name,'finish',ctx,id);return ctx;};
  return {dir,peers,call,send,context,admin,begin,chunks,upload,setNow:n=>now=n,now:()=>now,storage:()=>storage,manager:()=>manager,restart:async()=>{manager.close();storage=await new WorldStorage(dir,'images',()=>now,config).initialize();manager=new AllianceImageUploads(storage,()=>now,{sanitize});}};
}
test('Decoder: PNG/JPEG/WebP werden neu kodiert, quadratisch zugeschnitten und von Metadaten befreit',async()=>{
  for(const format of ['png','jpeg','webp']){
    const input=await sharp({create:{width:40,height:20,channels:3,background:'#c39c61'}}).withMetadata({exif:{IFD0:{Artist:'secret author',ImageDescription:'private metadata'}}})[format]().toBuffer();
    const image=await sanitizeAllianceImage(input,`image/${format}`),output=Buffer.from(image.data,'base64'),m=await sharp(output).metadata();
    assert.equal(m.format,'webp');assert.equal(m.width,256);assert.equal(m.height,256);assert.equal(m.exif,undefined);assert.equal(m.icc,undefined);assert.ok(output.length<=L.maxOutputBytes);assert.equal(output.includes(Buffer.from('private metadata')),false);
  }
});
test('Decoder: SVG/HTML/Skripte, falsche MIME-Typen, kaputte/trunkierte Bilder und Byte-/Pixellimits',async()=>{
  const valid=await png();
  for(const input of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),Buffer.from('<html><script>alert(1)</script></html>'),valid.subarray(0,30),Buffer.alloc(40)])await assert.rejects(sanitizeAllianceImage(input,'image/png'));
  await assert.rejects(sanitizeAllianceImage(valid,'image/jpeg'));await assert.rejects(sanitizeAllianceImage(valid,'image/svg+xml'));await assert.rejects(sanitizeAllianceImage(Buffer.alloc(L.maxBytes+1),'image/png'));
  const oversized=await sharp({create:{width:2049,height:2,channels:3,background:'red'}}).png().toBuffer();await assert.rejects(sanitizeAllianceImage(oversized,'image/png'));
  const pixels=await sharp({create:{width:2048,height:2049,channels:3,background:'red'}}).png().toBuffer();await assert.rejects(sanitizeAllianceImage(pixels,'image/png'));
});
test('Decoder: APNG und komprimierte Metadatenbomben werden vor der Verarbeitung abgewiesen; Abbruch beendet Worker',async()=>{
  const valid=await png(),chunk=(tag,body)=>{const b=Buffer.alloc(body.length+12);b.writeUInt32BE(body.length);b.write(tag,4);body.copy(b,8);return b;};
  const apng=Buffer.concat([valid.subarray(0,33),chunk('acTL',Buffer.alloc(8)),valid.subarray(33)]);await assert.rejects(sanitizeAllianceImage(apng,'image/png'));
  const bomb=Buffer.concat([Buffer.from('profile\0\0'),deflateSync(Buffer.alloc(1000000))]);
  const iccp=Buffer.concat([valid.subarray(0,33),chunk('iCCP',bomb),valid.subarray(33)]);await assert.rejects(sanitizeAllianceImage(iccp,'image/png'));
  const animation=await sharp(Buffer.from([0,0,0,255,255,255]),{raw:{width:1,height:2,channels:3,pageHeight:1}}).webp({delay:[100,100],loop:0}).toBuffer();assert.equal((await sharp(animation).metadata()).pages,2);await assert.rejects(sanitizeAllianceImage(animation,'image/webp'));
  const abort=new AbortController();const processing=sanitizeAllianceImage(valid,'image/png',abort.signal);abort.abort();await assert.rejects(processing,/abgebrochen/);
  await assert.rejects(sanitizeAllianceImage(valid,'image/png',undefined,{timeoutMs:1}),/Zeitlimit/);
});
test('Upload: Rechteprüfung pro Block und Commit, keine frei gesetzten Bilddaten, Versionen verhindern Überschreiben',async t=>{
  const f=await fixture(t),bytes=await png();
  await assert.rejects(f.begin('Bravo',bytes),/Anführer/);await assert.rejects(f.send('Charlie','begin',{...f.context('Alpha'),size:bytes.length,mime:'image/png'}),/Anführer/);
  await assert.rejects(f.call('Alpha','image.finish',{...f.context('Alpha'),image:{data:'fake'}}),/geprüfter/);
  await f.call('Alpha','role.change',{...f.admin('Alpha'),targetMembershipId:f.context('Bravo').membershipId,role:'officer'});
  const stale=await f.begin('Bravo',bytes);await f.chunks('Bravo',stale,bytes);await f.upload('Alpha',bytes);
  await assert.rejects(f.send('Bravo','finish',stale),/inzwischen/);assert.equal(f.storage().world.alliances.items[0].imageVersion,1);
  const pending=await f.begin('Bravo',bytes);await f.call('Alpha','role.change',{...f.admin('Alpha'),targetMembershipId:f.context('Bravo').membershipId,role:'member'});
  await assert.rejects(f.send('Bravo','chunk',{uploadId:pending.uploadId,offset:0,data:bytes.toString('base64')}),/Anführer/);assert.equal(f.manager().sessions.size,0);
});
test('Upload: Chunkgrößen, Reihenfolge, Wiederholung, Besitzerbindung, TTL, Disconnect und Abbruch',async t=>{
  const f=await fixture(t),bytes=await png();let ctx=await f.begin('Alpha',bytes);
  await f.chunks('Alpha',ctx,bytes);assert.equal((await f.send('Alpha','chunk',{uploadId:ctx.uploadId,offset:0,data:bytes.toString('base64')})).duplicate,true);
  await assert.rejects(f.send('Bravo','cancel',{uploadId:ctx.uploadId}),/nicht gefunden/);await f.send('Alpha','cancel',{uploadId:ctx.uploadId});assert.equal(f.manager().reservedBytes,0);
  ctx=await f.begin('Alpha',bytes);await assert.rejects(f.send('Alpha','chunk',{uploadId:ctx.uploadId,offset:1,data:bytes.toString('base64')}),/Reihenfolge|überschritten/);assert.equal(f.manager().sessions.size,0);
  ctx=await f.begin('Alpha',bytes);await assert.rejects(f.send('Alpha','chunk',{uploadId:ctx.uploadId,offset:0,data:'!!!!'}),/Uploadblock/);
  ctx=await f.begin('Alpha',bytes);f.setNow(f.now()+L.ttlMs);await assert.rejects(f.send('Alpha','finish',ctx),/abgelaufen/);assert.equal(f.manager().reservedBytes,0);
  ctx=await f.begin('Alpha',bytes);f.manager().forget(f.peers.Alpha);assert.equal(f.manager().reservedBytes,0);await assert.rejects(f.send('Alpha','finish',ctx),/nicht gefunden/);
  ctx=await f.begin('Alpha',Buffer.alloc(L.chunkBytes+1));await assert.rejects(f.send('Alpha','chunk',{uploadId:ctx.uploadId,offset:0,data:Buffer.alloc(L.chunkBytes+1).toString('base64')}),/Uploadgröße/);assert.equal(f.manager().reservedBytes,0);
});
test('Upload: dauerhafte Versuchsgrenze und begin-Deduplizierung über Tabs; In-Memory-Grenzen',async t=>{
  const f=await fixture(t),bytes=await png(),p={...f.context('Alpha'),size:bytes.length,mime:'image/png'},id=randomUUID();
  const first=await f.send('Alpha','begin',p,id);assert.equal((await f.send('Alpha','begin',p,id)).uploadId,first.uploadId);await assert.rejects(f.send('Alpha','begin',{...p,size:p.size+1},id),/anderem Inhalt/);
  await assert.rejects(f.send('Alpha','begin',p),/bereits/);await f.send('Alpha','cancel',{uploadId:first.uploadId});
  for(let n=1;n<L.attemptsPerPlayer;n++){const ctx=await f.begin('Alpha',bytes);await f.send('Alpha','cancel',{uploadId:ctx.uploadId});}
  await f.restart();await assert.rejects(f.begin('Alpha',bytes),/Uploadlimit/);f.setNow(f.now()+3600000);const ctx=await f.begin('Alpha',bytes);await f.send('Alpha','cancel',{uploadId:ctx.uploadId});
  f.manager().reservedBytes=L.maxReservedBytes;await assert.rejects(f.begin('Alpha',bytes),/ausgelastet/);f.manager().reservedBytes=0;
});
test('Commit: Aufnahme nur nach kompletter Prüfung, ungültiger Ersatz lässt altes Bild intakt, Replay und Neustart',async t=>{
  const f=await fixture(t),bytes=await png(),id=randomUUID(),ctx=await f.upload('Alpha',bytes,'image/png',id),image=structuredClone(f.storage().world.alliances.items[0].image);
  assert.equal(f.storage().world.alliances.items[0].imageVersion,1);const pub=await f.call('Charlie','get',{allianceId:ctx.allianceId});assert.equal(pub.image.url,allianceImage(f.storage().world.alliances.items[0]).url);assert.equal(pub.image.data,undefined);
  const bad=Buffer.from('<svg><script>BAD</script></svg>'),invalid=await f.begin('Alpha',bad);await f.chunks('Alpha',invalid,bad);await assert.rejects(f.send('Alpha','finish',invalid));assert.deepEqual(f.storage().world.alliances.items[0].image,image);
  await f.restart();assert.equal((await f.send('Alpha','finish',ctx,id)).duplicate,true);await assert.rejects(f.send('Alpha','finish',{...ctx,imageVersion:99},id),/anderem Inhalt/);
  assert.deepEqual(f.storage().world.alliances.items[0].image,image);assert.equal(JSON.stringify(f.storage().world.alliances.receipts).includes(image.data),false);
  await f.call('Alpha','image.remove',f.context('Alpha'));assert.equal(f.storage().world.alliances.items[0].image,null);assert.equal(f.storage().world.alliances.items[0].imageVersion,2);
});
test('Rechteentzug während Decoder läuft verhindert Commit; andere Weltaktionen werden nicht blockiert',async t=>{
  let release,started;const barrier=new Promise(r=>started=r),wait=new Promise(r=>release=r);const safe=await sanitizeAllianceImage(await png(),'image/png');
  const f=await fixture(t,{sanitize:async()=>{started();await wait;return safe;}}),bytes=await png();const ctx=await f.begin('Alpha',bytes);await f.chunks('Alpha',ctx,bytes);const pending=f.send('Alpha','finish',ctx);await barrier;
  const second=await f.call('Alpha','get');assert.equal(second.name,'Image League');await f.call('Alpha','leadership.transfer',{...f.admin('Alpha'),targetMembershipId:f.context('Bravo').membershipId});await f.call('Bravo','role.change',{...f.admin('Bravo'),targetMembershipId:f.context('Alpha').membershipId,role:'member'});release();await assert.rejects(pending,/Anführer/);assert.equal(f.storage().world.alliances.items[0].image,undefined);assert.equal(f.manager().processing,0);
});
test('Recovery: Bild und Beleg werden gemeinsam nach Weltwritefehler wiederhergestellt; beschädigte Datei abgelehnt',async t=>{
  const f=await fixture(t),s=f.storage(),bytes=await png(),ctx=await f.begin('Alpha',bytes),id=randomUUID();await f.chunks('Alpha',ctx,bytes);
  const original=s.commitPlayers.bind(s);s.commitPlayers=async(...args)=>{await rename(s.worldFile,`${s.worldFile}.saved`);await mkdir(s.worldFile);return original(...args);};
  await assert.rejects(f.send('Alpha','finish',ctx,id));assert.equal(s.world.alliances.items[0].image,undefined);assert.equal(s.needsRecovery,true);
  await rm(s.worldFile,{recursive:true});await rename(`${s.worldFile}.saved`,s.worldFile);s.commitPlayers=original;assert.equal((await f.send('Alpha','finish',ctx,id)).duplicate,true);assert.equal(s.world.alliances.items[0].imageVersion,1);
  await f.restart();const world=structuredClone(f.storage().world);world.alliances.items[0].image.hash='0'.repeat(64);await writeFile(f.storage().worldFile,JSON.stringify(world));await assert.rejects(f.restart(),/gespeichertes Bündnisbild/);
});
test('WebSocket und HTTP: echter Upload, sichere Bildheaders, kein Path-/HTML-Durchgriff, Live-Projektionen und Entfernung',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'images-ws-'));const running=await start(dir,Date.now,'images',parseConfiguration({ALLIANCE_CREATE_WOOD:'0',ALLIANCE_CREATE_STONE:'0'}));const clients=[];
  t.after(async()=>{clients.forEach(c=>c.close());await close(running.server);await rm(dir,{recursive:true,force:true});});
  const a=await websocket(running.port),b=await websocket(running.port);clients.push(a,b);await authenticate(a,'register','ImageOwner');await authenticate(b,'register','ImageViewer');
  const req=async(client,type,p={},response='command.ok',id)=>{const rid=client.send(`alliance.${type}`,p,id);return (await client.next(response,rid)).payload;};
  const q=await req(a,'create.preview',{name:'Image Guard',tag:'GUARD'},'alliance.create.preview');await req(a,'create',q);const profile=await req(a,'get',{},'alliance.get'),ctx={allianceId:profile.id,membershipId:profile.membershipId,imageVersion:profile.imageVersion};
  const bytes=await png(),upload=await req(a,'image.begin',{...ctx,size:bytes.length,mime:'image/png'});await req(a,'image.chunk',{uploadId:upload.uploadId,offset:0,data:bytes.toString('base64')});
  const update=b.next('alliance.changed');await req(a,'image.finish',{...ctx,uploadId:upload.uploadId});await update;
  const publicProfile=await req(b,'get',{allianceId:profile.id},'alliance.get');assert.ok(publicProfile.image.url);assert.equal(publicProfile.image.data,undefined);
  const response=await fetch(running.url+publicProfile.image.url);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('cross-origin-resource-policy'),'same-origin');assert.match(response.headers.get('content-security-policy'),/sandbox/);assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width,256);
  assert.equal((await fetch(running.url+'/alliance-images/invalid/../../etc/passwd')).status,404);
  const error=await req(b,'image.begin',{...ctx,size:bytes.length,mime:'image/png'},'command.error');assert.match(error.message,/Anführer/);
  await req(a,'image.remove',{...ctx,imageVersion:1});assert.equal((await fetch(running.url+publicProfile.image.url)).status,404);
});

test('Globale Grenzen: höchstens acht Uploads und acht MiB reservierter Speicher, vollständige Freigabe',async t=>{
  const f=await fixture(t),names=['Alpha','Bravo','Charlie'];
  for(let i=0;i<6;i++){const name=`Uploader${i}`,r=await f.storage().register(name,'password-long',name);f.peers[name]={playerId:r.player.playerId,account:r.account,cityId:r.player.cities[0].id};names.push(name);}
  for(const name of names.slice(1)){
    if(name!=='Bravo'){await f.call('Alpha','invite',{...f.admin('Alpha'),recipientName:name});const i=(await f.call(name,'invitations')).items[0];await f.call(name,'invitation.respond',{invitationId:i.id,response:'accept'});}
    await f.call('Alpha','role.change',{...f.admin('Alpha'),targetMembershipId:f.context(name).membershipId,role:'officer'});
  }
  const contexts=[];for(const name of names.slice(0,8))contexts.push([name,await f.begin(name,Buffer.alloc(12))]);
  await assert.rejects(f.begin(names[8],Buffer.alloc(12)),/ausgelastet/);assert.equal(f.manager().sessions.size,8);
  for(const [name,ctx]of contexts)await f.send(name,'cancel',{uploadId:ctx.uploadId});assert.equal(f.manager().reservedBytes,0);
  const large=[];for(const name of names.slice(0,4))large.push([name,await f.begin(name,Buffer.alloc(L.maxBytes))]);
  assert.equal(f.manager().reservedBytes,L.maxReservedBytes);await assert.rejects(f.begin(names[4],Buffer.alloc(12)),/ausgelastet/);
  for(const[name,ctx]of large)await f.send(name,'cancel',{uploadId:ctx.uploadId});assert.equal(f.manager().reservedBytes,0);
});

test('Abgewiesene Uploadanfragen lösen keine Weltabrechnung aus; ausgeschöpftes Kontingent wird günstig abgelehnt',async t=>{
  const f=await fixture(t),s=f.storage(),original=s.advanceWorld.bind(s);let calls=0;
  s.advanceWorld=async(...args)=>{calls++;return original(...args);};
  await assert.rejects(f.send('Alpha','begin',{...f.context('Alpha'),size:L.maxBytes+1,mime:'image/png'}),/2 MiB/);
  await assert.rejects(f.send('Alpha','finish',{...f.context('Alpha'),uploadId:randomUUID()}),/nicht gefunden/);
  assert.equal(calls,0);
  s.world.alliances.imageRates={[f.peers.Alpha.playerId]:Array(6).fill(f.now())};
  await assert.rejects(f.send('Alpha','begin',{...f.context('Alpha'),size:128,mime:'image/png'}),/Uploadlimit/);assert.equal(calls,0);
});
