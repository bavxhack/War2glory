import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WorldStorage } from '../apps/server/storage.js';
import { allianceRequest } from '../apps/server/alliances.js';
import { membership } from '../packages/game-core/alliances.js';
import { parseConfiguration } from '../apps/server/config.js';
import { start, close, websocket, authenticate } from './support/socket.js';

async function fixture(t, env={}) {
  const dir=await mkdtemp(join(tmpdir(),'alliances-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  let now=100000000;const clock=()=>now;const config=parseConfiguration({ALLIANCE_MAX_MEMBERS:'2',...env});
  let storage=await new WorldStorage(dir,'test',clock,config).initialize();
  const peers={};
  for(const name of ['Alpha','Bravo','Charlie','Delta']) {const r=await storage.register(name,'password-1234',`${name}burg`);peers[name]={playerId:r.player.playerId,account:r.account,cityId:r.player.cities[0].id};}
  const call=(name,type,p={},id=randomUUID())=>storage.exclusive(()=>allianceRequest(storage,peers[name],{type:`alliance.${type}`,payload:{cityId:peers[name].cityId,...p},requestId:id},now));
  const ctx=name=>{const o=membership(storage.world,peers[name].playerId);return {allianceId:o.alliance.id,membershipId:o.member.membershipId,adminVersion:o.alliance.adminVersion};};
  const create=async(name,tag=name.slice(0,3),id=randomUUID())=>{const p={name:`${name} league`,tag};const q=await call(name,'create.preview',p);await call(name,'create',{...p,rulesVersion:q.rulesVersion},id);return {...p,rulesVersion:q.rulesVersion};};
  const invite=async(from,to)=>{await call(from,'invite',{...ctx(from),recipientName:to});return (await call(to,'invitations')).items.find(i=>i.allianceId===ctx(from).allianceId);};
  return {dir,config,clock,peers,call,ctx,create,invite,setNow:n=>now=n,storage:()=>storage,restart:async()=>storage=await new WorldStorage(dir,'test',clock,config).initialize()};
}
test('Speicher: konkurrierende Gründung, einmalige Stadtzahlung, dauerhafter Beleg nach Auflösung/Pruning/Neustart',async t=>{
  const f=await fixture(t,{ALLIANCE_CREATE_WOOD:'100',ALLIANCE_CREATE_STONE:'100'}), s=f.storage();
  const before=await s.loadPlayer(f.peers.Alpha.playerId), wood=before.cities[0].resources.wood;
  const quote=await f.call('Alpha','create.preview',{name:'Shared Name',tag:'SHR'}), id='durable-create';
  const payload={name:'Shared Name',tag:'SHR',rulesVersion:quote.rulesVersion};
  const results=await Promise.allSettled([f.call('Alpha','create',payload,id),f.call('Bravo','create',payload)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(s.world.alliances.items.length,1);
  assert.equal((await s.loadPlayer(f.peers.Alpha.playerId)).cities[0].resources.wood,wood-100);
  assert.equal((await s.loadPlayer(f.peers.Bravo.playerId)).cities[0].resources.wood,wood);
  assert.equal((await f.call('Alpha','create',payload,id)).duplicate,true);
  await assert.rejects(f.call('Alpha','create',{...payload,name:'different'},id),/anderem Inhalt/);
  await f.call('Alpha','dissolve',f.ctx('Alpha'));f.setNow(f.clock()+31*86400000);await f.restart();
  assert.equal((await f.call('Alpha','create',payload,id)).duplicate,true);assert.equal(f.storage().world.alliances.items.length,0);
  await assert.rejects(f.call('Alpha','create.preview',{name:'Foreign City',tag:'FOR',cityId:f.peers.Bravo.cityId}),/eigene|gehört|Stadt|fremde/i);
  await assert.rejects(f.call('Alpha','create.preview',{name:'Poor City',tag:'POR'}).then(q=>f.call('Alpha','create',{name:q.name,tag:q.tag,rulesVersion:'old'})),/regeln/i);
});
test('Konkurrenz: letzter Platz und zwei Bündnisse für denselben Empfänger, Offline-Login und private Projektionen',async t=>{
  const f=await fixture(t,{ALLIANCE_CREATE_WOOD:'0',ALLIANCE_CREATE_STONE:'0'});await f.create('Alpha');await f.create('Bravo');
  const one=await f.invite('Alpha','Charlie'),two=await f.invite('Bravo','Charlie'),last=await f.invite('Alpha','Delta');
  const login=await f.storage().login('Charlie','password-1234');assert.equal(login.player.playerId,f.peers.Charlie.playerId);assert.equal((await f.call('Charlie','invitations')).items.length,2);
  const joined=await Promise.allSettled([f.call('Charlie','invitation.respond',{invitationId:one.id,response:'accept'}),f.call('Delta','invitation.respond',{invitationId:last.id,response:'accept'}),f.call('Charlie','invitation.respond',{invitationId:two.id,response:'accept'})]);
  assert.equal(joined.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(f.storage().world.alliances.items.reduce((n,a)=>n+a.members.filter(m=>m.playerId===f.peers.Charlie.playerId).length,0),1);
  const pub=await f.call('Bravo','get',{allianceId:f.ctx('Alpha').allianceId});assert.equal(pub.notice,undefined);assert.equal(pub.membershipId,undefined);assert.equal(pub.members[0].membershipId,undefined);
  await assert.rejects(f.call('Bravo','chat.list',{...f.ctx('Alpha')}),/Mitgliedschaft/);
});
test('Recovery: Journal-/Welt-/Spielerwrite-Fehler, keine Phantomgründung, nach Recovery genau einmal bezahlt',async t=>{
  for(const stage of ['journal','world','player']) {
    const f=await fixture(t,{ALLIANCE_CREATE_WOOD:'10',ALLIANCE_CREATE_STONE:'10'}),s=f.storage();
    const before=(await s.loadPlayer(f.peers.Alpha.playerId)).cities[0].resources.wood;
    const q=await f.call('Alpha','create.preview',{name:'Recovery League',tag:'REC'}),p={name:q.name,tag:q.tag,rulesVersion:q.rulesVersion},id=`failure-${stage}`;
    const path=stage==='journal'?s.journalFile:stage==='world'?s.worldFile:s.playerFile(f.peers.Alpha.playerId);
    // For a player-write failure, inject only after advanceWorld/loadPlayer have run.
    const original=s.commitPlayers.bind(s);
    s.commitPlayers=async(...args)=>{if(stage!=='journal')await rename(path,`${path}.saved`);await mkdir(path);return original(...args);};
    await assert.rejects(f.call('Alpha','create',p,id));assert.equal(s.world.alliances.items.length,0);assert.equal(s.needsRecovery,true);
    await rm(path,{recursive:true,force:true});if(stage!=='journal')await rename(`${path}.saved`,path);s.commitPlayers=original;
    const retry=await f.call('Alpha','create',p,id);
    assert.equal(s.world.alliances.items.length,1);assert.equal((await s.loadPlayer(f.peers.Alpha.playerId)).cities[0].resources.wood,before-10);
    assert.equal(!!retry.duplicate,stage!=='journal');await f.restart();assert.equal(f.storage().world.alliances.items.length,1);
  }
});
test('Migration 4→5 bewahrt Karte, Spieler und Missionen; beschädigte Rollen werden abgelehnt',async t=>{
  const f=await fixture(t,{ALLIANCE_CREATE_WOOD:'0',ALLIANCE_CREATE_STONE:'0'});await f.storage().advanceWorld(f.clock());const world=structuredClone(f.storage().world),players=await Promise.all(Object.values(f.peers).map(p=>readFile(f.storage().playerFile(p.playerId),'utf8')));
  world.schemaVersion=4;delete world.alliances;await writeFile(f.storage().worldFile,JSON.stringify(world));await f.restart();assert.equal(f.storage().world.schemaVersion,5);assert.deepEqual(f.storage().world.map,world.map);
  assert.deepEqual(await Promise.all(Object.values(f.peers).map(p=>readFile(f.storage().playerFile(p.playerId),'utf8'))),players);
  await f.create('Alpha');const bad=structuredClone(f.storage().world);bad.alliances.items[0].members[0].role='member';await writeFile(f.storage().worldFile,JSON.stringify(bad));await assert.rejects(f.restart(),/Bündnisbestand/);
});

test('WebSocket: Live-Chat, mehrere Tabs, Moderation, Rechteentzug ohne private Pushes und Replay nach Kick',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'alliance-ws-'));const config=parseConfiguration({ALLIANCE_CREATE_WOOD:'0',ALLIANCE_CREATE_STONE:'0'});let running=await start(dir,()=>100000000,'alpha',config);const clients=[];
  t.after(async()=>{clients.forEach(c=>c.close());await close(running.server);await rm(dir,{recursive:true,force:true});});
  const a=await websocket(running.port),b=await websocket(running.port),c=await websocket(running.port),tab=await websocket(running.port);clients.push(a,b,c,tab);
  const aa=await authenticate(a,'register','Alpha'),bb=await authenticate(b,'register','Bravo');await authenticate(c,'register','Charlie');await authenticate(tab,'login','Bravo');
  const req=async(client,type,p={},result='command.ok',id)=>{const rid=client.send(`alliance.${type}`,p,id);return (await client.next(result,rid)).payload;};
  const quote=await req(a,'create.preview',{name:'Live League',tag:'LIV'},'alliance.create.preview');await req(a,'create',{...quote});
  const ctx=async(client)=>{const p=await req(client,'get',{},'alliance.get');return {allianceId:p.id,membershipId:p.membershipId,adminVersion:p.adminVersion};};
  await req(a,'invite',{...await ctx(a),recipientName:'Bravo'});const inv=(await req(b,'invitations',{},'alliance.invitations')).items[0];await req(b,'invitation.respond',{invitationId:inv.id,response:'accept'});
  const bc=await ctx(b),ac=await ctx(a);const pushed=tab.next('alliance.changed');await req(b,'chat.send',{...bc,text:'<script>no execution</script>'},'command.ok','chat-replay');assert.equal((await pushed).payload.allianceId,ac.allianceId);
  const messages=await req(tab,'chat.list',bc,'alliance.chat.list');assert.equal(messages.items[0].text,'<script>no execution</script>');
  await req(a,'chat.remove',{...ac,messageId:messages.items[0].id});assert.equal((await req(b,'chat.list',bc,'alliance.chat.list')).items[0].text,undefined);
  const profile=await req(a,'get',{},'alliance.get');const target=profile.members.find(m=>m.playerId===bb.snapshot.player.id);
  const removal=tab.next('alliance.changed');await req(a,'member.remove',{...await ctx(a),targetMembershipId:target.membershipId});assert.equal((await removal).payload.membershipId,null);
  await req(b,'chat.list',bc,'command.error');assert.equal((await req(b,'chat.send',{...bc,text:'<script>no execution</script>'},'command.ok','chat-replay')).duplicate,true);
  assert.equal((await req(c,'get',{allianceId:ac.allianceId},'alliance.get')).notice,undefined);
  clients.forEach(x=>x.close());await close(running.server);running=await start(dir,()=>100000000,'alpha',config);const resume=await websocket(running.port);clients.push(resume);await authenticate(resume,'login','Alpha');const saved=await req(resume,'chat.list',await ctx(resume),'alliance.chat.list');assert.equal(saved.items[0].removed,true);assert.equal(saved.items[0].text,undefined);
});
test('ENV-Wechsel: alte Angebote ungültig, bestehendes Limit/Einladung unverändert, Ratelimits nach Neustart',async t=>{
  const f=await fixture(t,{ALLIANCE_CREATE_WOOD:'0',ALLIANCE_CREATE_STONE:'0'});await f.create('Alpha');const invitation=await f.invite('Alpha','Bravo');
  const oldQuote=await f.call('Charlie','create.preview',{name:'Future League',tag:'FUT'});
  f.storage().config.alliances=parseConfiguration({ALLIANCE_CREATE_WOOD:'1',ALLIANCE_MAX_MEMBERS:'30',ALLIANCE_INVITE_TTL_HOURS:'1'}).alliances;
  await assert.rejects(f.call('Charlie','create',{name:oldQuote.name,tag:oldQuote.tag,rulesVersion:oldQuote.rulesVersion}),/regeln/);
  assert.equal(membership(f.storage().world,f.peers.Alpha.playerId).alliance.maxMembers,2);
  assert.equal((await f.call('Bravo','invitations')).items[0].expiresAt,invitation.expiresAt);
  await f.call('Alpha','chat.send',{...f.ctx('Alpha'),text:'saved'});await f.restart();assert.equal(f.storage().world.alliances.chatRates[f.peers.Alpha.playerId].length,1);
  const ctx=f.ctx('Alpha');for(let n=0;n<4;n++)await f.call('Alpha','chat.send',{...ctx,text:'more'});await assert.rejects(f.call('Alpha','chat.send',{...ctx,text:'six'}),/limit/);
});
test('Unzureichende Ressourcen, zukünftige Lesemarke und deduplizierter Chat nach Retention/Neustart',async t=>{
  const poor=await fixture(t);await assert.rejects(poor.create('Alpha'),/genügend/);assert.equal(poor.storage().world.alliances.items.length,0);
  const f=await fixture(t,{ALLIANCE_CREATE_WOOD:'0',ALLIANCE_CREATE_STONE:'0'});await f.create('Alpha');let ctx=f.ctx('Alpha');const old={...ctx,text:'original'};await f.call('Alpha','chat.send',old,'retained-replay');
  for(let n=0;n<201;n++){f.setNow(f.clock()+60001);await f.call('Alpha','chat.send',{...ctx,text:'new'});}
  assert.equal(membership(f.storage().world,f.peers.Alpha.playerId).alliance.chat.some(c=>c.text==='original'),false);await f.restart();assert.equal((await f.call('Alpha','chat.send',old,'retained-replay')).duplicate,true);assert.equal(membership(f.storage().world,f.peers.Alpha.playerId).alliance.sequence,202);
  ctx=f.ctx('Alpha');await assert.rejects(f.call('Alpha','chat.read',{...ctx,sequence:202}),/Lesemarke/);const page=await f.call('Alpha','chat.list',ctx);assert.ok(Buffer.byteLength(JSON.stringify(page))<16384);await f.call('Alpha','chat.read',{...ctx,sequence:page.items[0].sequence});
});
test('Alte Weltschemata 1/2/3 erreichen 5; Migration wird beim zweiten Start nicht wiederholt',async t=>{
  for(const version of [1,2,3]){
    const f=await fixture(t),world=structuredClone(f.storage().world);world.schemaVersion=version;delete world.alliances;
    if(version===1)delete world.map;await writeFile(f.storage().worldFile,JSON.stringify(world));await f.restart();assert.equal(f.storage().world.schemaVersion,5);assert.deepEqual(f.storage().world.alliances.items,[]);const map=structuredClone(f.storage().world.map);await f.restart();assert.deepEqual(f.storage().world.map,map);
  }
});
