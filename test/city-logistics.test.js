import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WorldStorage} from '../apps/server/storage.js';
import {parseConfiguration} from '../apps/server/config.js';
import {canonicalJSON,exposeCity,foundedCity,playerScore} from '../packages/game-core/multicity.js';
import {cityTransportQuote,startCityTransport,migrateGeneralLocations,transportFuel} from '../packages/game-core/city-logistics.js';
import {normalizeGeneral} from '../packages/game-core/military.js';
import {start,close,websocket,authenticate} from './support/socket.js';

async function fixture(t,env={}) {
 const dir=await mkdtemp(join(tmpdir(),'city-logistics-'));t.after(()=>rm(dir,{recursive:true,force:true}));let now=0;
 const config=parseConfiguration({WORLD_WIDTH:'16',WORLD_HEIGHT:'16',WORLD_NPC_COUNT:'0',UPKEEP_INFANTRY_PER_HOUR:'0',UPKEEP_SCOUT_PER_HOUR:'0',UPKEEP_TRUCK_PER_HOUR:'0',...env});
 const storage=await new WorldStorage(dir,'test',()=>now,config,{warn(){}}).initialize();
 const a=await storage.register('Sender','test-password-long'),b=await storage.register('Receiver','test-password-long');
 let player=canonicalJSON(a.player),recipient=canonicalJSON(b.player);const origin=player.cities[0],target=foundedCity('second-city','Hafen',0);
 player.cities.push(target);storage.world.map.entities=storage.world.map.entities.filter(e=>e.kind!=='npc');
 Object.assign(storage.world.map.entities.find(e=>e.id===origin.id),{x:0,y:0});Object.assign(storage.world.map.entities.find(e=>e.playerId===recipient.playerId),{x:10,y:0});
 storage.world.map.entities.push({id:target.id,kind:'player',playerId:player.playerId,name:target.name,commanderName:player.commanderName,x:5,y:0});
 for(const city of [origin,target,recipient.cities[0]]) {city.resources={wood:1000,stone:1000,food:1000,oil:2000};city.buildingSlots.forEach(s=>{s.level=0;s.building=null;});}
 origin.military.units={infantry:100,scout:10,truck:10};
 player.military.generals.push(normalizeGeneral({...player.military.generals[0],id:'second-general',name:'Zweiter',cityId:origin.id}));player.military.acquiredCount=2;
 await storage.commitPlayers([player,recipient],true);
 let serial=0;
 async function send(type,extra={}) {const p=await storage.loadPlayer(player.playerId),command={type,id:`transport-${++serial}`,originCityId:origin.id,targetCityId:type==='delivery'?recipient.cities[0].id:target.id,units:type==='delivery'?{truck:5}:{infantry:10},...extra};const preview=cityTransportQuote(p,command,storage.world,config.logistics,config.cityLogistics,now);const sent=startCityTransport(p,{...command,preview},storage.world,config.logistics,config.cityLogistics,now);sent.military.missions.at(-1).eventSequence=storage.world.nextEventSequence++;await storage.commitPlayers([sent],true);return sent.military.missions.at(-1);}
 async function advance(at){now=at;await storage.advanceWorld(now);return storage.loadPlayer(player.playerId);}
 return {dir,storage,config,origin:origin.id,target:target.id,recipientId:recipient.playerId,recipientCity:recipient.cities[0].id,senderId:player.playerId,send,advance,get now(){return now;}};
}

for (const accept of [0,250,2000]) test(`general-free delivery: target room ${accept}, all four cargo ledgers and fuel`,async t=>{
 const f=await fixture(t);let recipient=await f.storage.loadPlayer(f.recipientId);recipient.city.resources={wood:2000-accept,stone:2000-accept,food:2000-accept,oil:2000-accept};await f.storage.savePlayer(recipient);
 let sender=await f.storage.loadPlayer(f.senderId);for(const g of sender.military.generals) {g.status='mayor';sender.cities[g===sender.military.generals[0]?0:1].military.mayorGeneralId=g.id;g.cityId=sender.cities[g===sender.military.generals[0]?0:1].id;}exposeCity(sender);await f.storage.savePlayer(sender);
 const cargo={wood:300,stone:200,food:200,oil:100},m=await f.send('delivery',{cargo});assert.equal(m.paidOil,100);assert.equal(m.generals.length,0);
 const p=await f.advance(m.returnsAt),r=await f.storage.loadPlayer(f.recipientId),report=p.military.reports.at(-1);
 for(const key of Object.keys(cargo)) {assert.equal(report.delivered[key],Math.min(cargo[key],accept));assert.equal(report.loaded[key],report.delivered[key]+report.returnedCargo[key]+report.homeOverflow[key]);assert.equal(r.city.resources[key],2000-accept+report.delivered[key]);}
 assert.equal(report.operatingFuel.remaining,0);assert.equal(report.operatingFuel.burned,100);assert.equal(p.military.units.truck,10);assert.equal(p.military.generals[0].status,'mayor');assert.equal(p.military.combatScore,0);assert.equal(r.military.reports.length,1);assert.equal(r.military.reports[0].generals,undefined);assert.equal(r.military.reports[0].units,undefined);
 await f.advance(m.returnsAt);assert.equal((await f.storage.loadPlayer(f.recipientId)).military.reports.length,1);
});

test('delivery example and optional general reserve/return; home overflow is reported',async t=>{
 const f=await fixture(t),p=await f.storage.loadPlayer(f.senderId),gid=p.military.generals[0].id;
 const r=await f.storage.loadPlayer(f.recipientId);r.city.resources.wood=1750;r.city.resources.food=1800;await f.storage.savePlayer(r);
 const m=await f.send('delivery',{generalId:gid,cargo:{wood:600,food:300}});assert.equal(m.capacity,1000);assert.equal(m.paidOil,100);
 let current=await f.advance(m.arrivesAt);const live=current.military.missions.at(-1);assert.equal(live.delivered.wood,250);assert.equal(live.delivered.food,200);assert.equal(live.remainingCargo.wood,350);assert.equal(current.military.generals[0].status,'delivering');
 current.city.resources.wood=2000;await f.storage.savePlayer(current);current=await f.advance(m.returnsAt);const report=current.military.reports.at(-1);assert.equal(report.homeOverflow.wood,350);assert.equal(report.returnedCargo.food,100);assert.equal(current.military.generals[0].status,'idle');assert.equal(current.military.generals[0].cityId,f.origin);
 assert.equal(transportFuel(live,m.arrivesAt).remaining,50);
});

test('own delivery uses one canonical copy; arrival never overwrites source or duplicates own report',async t=>{
 const f=await fixture(t),m=await f.send('delivery',{targetCityId:f.target,cargo:{wood:600}});const p=await f.advance(m.returnsAt);
 assert.equal(p.cities[0].resources.wood,400);assert.equal(p.cities[1].resources.wood,1600);assert.equal(p.military.reports.length,1);assert.equal(p.military.units.truck,10);
});

for(const [name,units,generals] of [['infantry',{infantry:10},false],['scouts',{scout:5},false],['mixed',{infantry:7,scout:3,truck:2},true],['generals',{},true]]) test(`permanent ${name} transfer survives restart, one-way fuel, no XP or duplication`,async t=>{
 const f=await fixture(t);let p=await f.storage.loadPlayer(f.senderId);const ids=generals?p.military.generals.map(g=>g.id):[];const score=playerScore(p);const expectedOil=name==='infantry'?5:name==='scouts'?5:name==='generals'?1:17;
 const m=await f.send('transfer',{units,generalIds:ids});assert.equal(m.paidOil,expectedOil);assert.equal(m.returnsAt,null);
 p=await f.storage.loadPlayer(f.senderId);for(const [k,n]of Object.entries(units))assert.equal(p.cities[0].military.units[k],{infantry:100,scout:10,truck:10}[k]-n);
 const restart=await new WorldStorage(f.dir,'test',()=>m.arrivesAt,f.config,{warn(){}}).initialize();p=await restart.loadPlayer(f.senderId);const destination=p.cities.find(c=>c.id===f.target);
 for(const [k,n]of Object.entries(units))assert.equal(destination.military.units[k],n);
 for(const g of p.military.generals) {assert.equal(g.experience,0);if(ids.includes(g.id)){assert.equal(g.cityId,f.target);assert.equal(g.status,'idle');assert.equal(g.transitMissionId,undefined);}}
 assert.equal(p.military.reports.at(-1).stationedAt,m.arrivesAt);assert.equal(p.military.reports.at(-1).returnedAt,undefined);assert.deepEqual(playerScore(p),score);
 const before=canonicalJSON(p);await restart.advanceWorld(m.arrivesAt);assert.deepEqual(canonicalJSON(await restart.loadPlayer(f.senderId)),before);
});

test('invalid destinations, delay, cargo, generals, forged previews and fuel boundaries rejected without charges',async t=>{
 const f=await fixture(t),p=await f.storage.loadPlayer(f.senderId);const base={type:'transfer',originCityId:f.origin,targetCityId:f.target,units:{infantry:10}};
 const quote=c=>cityTransportQuote(p,{...base,...c},f.storage.world,f.config.logistics,f.config.cityLogistics,f.now);
 for(const c of [{originCityId:'forged'},{targetCityId:f.origin},{targetCityId:f.recipientCity},{targetCityId:'missing'},{instanceId:'foreign-world'},{delayMinutes:null},{delayMinutes:1},{cargo:{wood:1}},{units:{scout:-1}},{generalIds:['foreign']},{generalIds:[p.military.generals[0].id,p.military.generals[0].id]}]) assert.throws(()=>quote(c));
 p.military.generals[0].cityId=f.target;assert.throws(()=>quote({generalIds:[p.military.generals[0].id]}),/stationiert/);
 const preview=quote({});assert.throws(()=>startCityTransport(p,{...base,id:'forged-preview',preview:{...preview,totalOil:0}},f.storage.world,f.config.logistics,f.config.cityLogistics,0),/vorschau/);
 assert.throws(()=>cityTransportQuote(p,{...base,units:{scout:1}},f.storage.world,{...f.config.logistics,scoutFuelCapacity:1,oilMilliPerField:{...f.config.logistics.oilMilliPerField,scout:201}},f.config.cityLogistics,0),/Tanks|Frachtraum/);
 assert.throws(()=>cityTransportQuote(p,{...base,units:{},generalIds:[p.military.generals[1].id]},f.storage.world,f.config.logistics,{...f.config.cityLogistics,generalOilMilliPerField:1000,generalFuelCapacity:1},0),/Tanks/);
 assert.throws(()=>quote({units:{scout:10001}}));
});

test('general migration locates roles and historical missions once; ambiguous leadership is visibly released',async t=>{
 const f=await fixture(t),p=canonicalJSON(await f.storage.loadPlayer(f.senderId));p.schemaVersion=16;for(const g of p.military.generals)delete g.cityId;
 p.military.generals[0].status='mayor';p.cities[1].military.mayorGeneralId=p.military.generals[0].id;p.military.generals[1].status='researcher';p.military.researcherGeneralId=p.military.generals[1].id;
 migrateGeneralLocations(p);assert.equal(p.military.generals[0].cityId,f.target);assert.equal(p.military.generals[1].cityId,f.origin);assert.equal(p.military.researcherGeneralId,null);assert.equal(p.migrationNotices.length,1);const before=structuredClone(p);migrateGeneralLocations(p);assert.deepEqual(p,before);
 const old=structuredClone(before);old.schemaVersion=16;old.military.generals[0].status='scouting';old.cities[1].military.mayorGeneralId=null;old.military.missions=[{id:'old',status:'outbound',type:'scout',generalId:old.military.generals[0].id,originCityId:f.target,arrivesAt:5000,returnsAt:10000,paidOil:7}];const mission=structuredClone(old.military.missions[0]);migrateGeneralLocations(old);assert.equal(old.military.generals[0].cityId,f.target);assert.deepEqual(old.military.missions[0],mission);
});

for(const boundary of ['journal','sender','receiver','commit']) test(`foreign delivery crash at ${boundary} recovers ledgers exactly once`,async t=>{
 const f=await fixture(t),m=await f.send('delivery',{cargo:{wood:300}});
 const file=boundary==='journal'?f.storage.journalFile:boundary==='sender'?f.storage.playerFile(f.senderId):boundary==='receiver'?f.storage.playerFile(f.recipientId):null;
 let saved;if(file){try{saved=await readFile(file);}catch{}await rm(file,{force:true});await mkdir(file);}
 if(boundary==='commit') {
  const beforeSender=await readFile(f.storage.playerFile(f.senderId)),beforeReceiver=await readFile(f.storage.playerFile(f.recipientId));
  await f.advance(m.arrivesAt);
  const sender=canonicalJSON(await f.storage.loadPlayer(f.senderId)),receiver=canonicalJSON(await f.storage.loadPlayer(f.recipientId));
  await writeFile(f.storage.journalFile,JSON.stringify({world:null,players:[sender,receiver]}));
  // Crash after journal commit with both player files still at the old state.
  await writeFile(f.storage.playerFile(f.senderId),beforeSender); await writeFile(f.storage.playerFile(f.recipientId),beforeReceiver);
 }else await assert.rejects(f.storage.advanceWorld(m.arrivesAt));
 if(file){await rm(file,{recursive:true});if(saved)await writeFile(file,saved);}
 const restart=await new WorldStorage(f.dir,'test',()=>m.returnsAt,f.config,{warn(){}}).initialize();const p=await restart.loadPlayer(f.senderId),r=await restart.loadPlayer(f.recipientId);
 assert.equal(p.military.reports.length,1);assert.equal(r.military.reports.length,1);assert.equal(r.military.reports[0].generals,undefined);assert.equal(r.military.reports[0].units,undefined);assert.equal(r.city.resources.wood,1300);assert.equal(p.city.resources.wood,700);assert.equal(p.military.units.truck,10);
 const before=canonicalJSON(r);await restart.advanceWorld(m.returnsAt);assert.deepEqual(canonicalJSON(await restart.loadPlayer(f.recipientId)),before);
});

test('incoming transport projection is private and request IDs deduplicate persistently across tabs/restart',async t=>{
 const f=await fixture(t),running=await start(f.dir,()=>f.now,'test',f.config);t.after(()=>close(running.server));const a=await websocket(running.port),b=await websocket(running.port),r=await websocket(running.port);t.after(()=>{a.close();b.close();r.close();});await authenticate(a,'login','Sender','test-password-long');await authenticate(b,'login','Sender','test-password-long');await authenticate(r,'login','Receiver','test-password-long');
 const command={originCityId:f.origin,targetCityId:f.recipientCity,units:{truck:5},cargo:{wood:600,food:300},generalId:null};const qid=a.send('delivery.preview',command),preview=(await a.next('delivery.preview',qid)).payload;
 assert.equal(preview.targetSupply,undefined);assert.equal(preview.generalId,undefined);const payload={...command,preview},id='delivery-duplicate';a.send('delivery.start',payload,id);await a.next('command.ok',id);b.send('delivery.start',payload,id);assert.equal((await b.next('command.ok',id)).payload.duplicate,true);
 b.send('delivery.start',{...payload,cargo:{wood:1}},id);assert.match((await b.next('command.error',id)).payload.message,/anderem Inhalt/);
 const sync=r.send('city.sync');const state=(await r.next('city.snapshot',sync)).payload;assert.equal(state.incomingTransports.length,1);const incoming=state.incomingTransports[0];assert.equal(incoming.senderName,'Sender');assert.equal(incoming.load.wood,600);assert.equal(incoming.generals,undefined);assert.equal(incoming.logistics,undefined);assert.equal(state.transports.length,0);
 a.send('transfer.preview',{originCityId:f.origin,targetCityId:f.recipientCity,units:{infantry:1}});assert.match((await a.next('command.error')).payload.message,/eigene/);
});

test('new ENV values reject zero, unsafe precision and invalid tank sizes',()=>{
 for(const env of [{GENERAL_TRANSFER_OIL_PER_FIELD:'0'},{GENERAL_TRANSFER_OIL_PER_FIELD:'0.0001'},{GENERAL_TRANSFER_FUEL_CAPACITY:'1.5'},{GENERAL_TRANSFER_FUEL_CAPACITY:'0'}])assert.throws(()=>parseConfiguration(env));
 assert.equal(parseConfiguration().cityLogistics.generalOilMilliPerField,100);
});

test('offline food arrival precedes later hunger; large step equals fine steps with the same stored account identities',async t=>{
 const f=await fixture(t,{UPKEEP_INFANTRY_PER_HOUR:'3600',SUPPLY_GRACE_SECONDS:'10',SUPPLY_LOSS_INTERVAL_SECONDS:'10'});
 let r=await f.storage.loadPlayer(f.recipientId);r.military.units.infantry=1;r.city.resources.food=0;await f.storage.savePlayer(r);
 const m=await f.send('delivery',{cargo:{food:100}});
 const backup=join(f.dir,'backup');await mkdir(backup);const {cp}=await import('node:fs/promises');await cp(f.storage.playersDirectory,join(backup,'players'),{recursive:true});await cp(f.storage.worldFile,join(backup,'world.json'));await cp(f.storage.accountsFile,join(backup,'accounts.json'));
 const end=m.returnsAt+20000;await f.advance(end);const large=canonicalJSON(await f.storage.loadPlayer(f.recipientId));
 const fine=await new WorldStorage(backup,'test',()=>0,f.config,{warn(){}}).initialize();for(let at=1000;at<=end;at+=1000)await fine.advanceWorld(at);await fine.advanceWorld(end);
 assert.deepEqual(canonicalJSON(await fine.loadPlayer(f.recipientId)),large);
 // Food arriving at 50s cannot undo the hunger wave at 10s.
 assert.equal(large.city,undefined);assert.equal(large.cities[0].military.units.infantry,0);assert.ok(large.cities[0].resources.food>0);assert.equal(large.cities[0].supply.events.length,1);
});

test('transfer starts target upkeep only at arrival; source consumption continues independently',async t=>{
 const f=await fixture(t,{UPKEEP_INFANTRY_PER_HOUR:'3600',SUPPLY_GRACE_SECONDS:'10'});
 const p=canonicalJSON(await f.storage.loadPlayer(f.senderId));p.cities[1].resources.food=100;p.cities[0].resources.food=1000;await f.storage.savePlayer(p);
 const m=await f.send('transfer',{units:{infantry:1}});let done=await f.advance(m.arrivesAt+5000);
 assert.equal(done.cities[1].resources.food,95);assert.equal(done.cities[1].military.units.infantry,1);
 assert.equal(done.cities[0].resources.food,0); // source's remaining troops consume it before arrival
 assert.equal(done.military.missions.at(-1).status,'completed');
});

test('two concurrent deliveries serialize target capacity and protect parallel source city changes',async t=>{
 const f=await fixture(t),r=await f.storage.loadPlayer(f.recipientId);r.city.resources.wood=1700;await f.storage.savePlayer(r);
 const first=await f.send('delivery',{cargo:{wood:300},units:{truck:2}}),second=await f.send('delivery',{cargo:{wood:300},units:{truck:2}});
 const p=await f.advance(first.arrivesAt);const live=p.military.missions.filter(m=>m.type==='delivery');assert.equal(live.reduce((sum,m)=>sum+m.delivered.wood,0),300);assert.equal((await f.storage.loadPlayer(f.recipientId)).city.resources.wood,2000);
 const finish=await f.advance(second.returnsAt);assert.equal(finish.city.resources.wood,700);assert.equal(finish.military.units.truck,10);assert.equal(finish.military.reports.length,2);
});

for(const phase of ['arrival','return']) test(`own delivery ${phase} failure restores both cities from one canonical journal`,async t=>{
 const f=await fixture(t),m=await f.send('delivery',{targetCityId:f.target,cargo:{wood:600}});if(phase==='return')await f.advance(m.arrivesAt);
 const file=f.storage.playerFile(f.senderId),saved=await readFile(file);await rm(file);await mkdir(file);await assert.rejects(f.storage.advanceWorld(phase==='arrival'?m.arrivesAt:m.returnsAt));await rm(file,{recursive:true});await writeFile(file,saved);
 const restart=await new WorldStorage(f.dir,'test',()=>m.returnsAt,f.config,{warn(){}}).initialize(),p=await restart.loadPlayer(f.senderId);assert.equal(p.cities[0].resources.wood,400);assert.equal(p.cities[1].resources.wood,1600);assert.equal(p.military.units.truck,10);assert.equal(p.military.reports.length,1);
});

test('missing transfer target halts recovery instead of destroying or teleporting units; delivery returns cargo',async t=>{
 const f=await fixture(t),m=await f.send('transfer');f.storage.world.map.entities=f.storage.world.map.entities.filter(e=>e.id!==f.target);await f.storage.saveWorld();await assert.rejects(f.storage.advanceWorld(m.arrivesAt),/Wiederherstellung/);
 const p=await f.storage.loadPlayer(f.senderId);assert.equal(p.military.missions[0].status,'outbound');assert.equal(p.cities[1].military.units.infantry,0);
 const g=await fixture(t),d=await g.send('delivery',{cargo:{wood:300}});g.storage.world.map.entities=g.storage.world.map.entities.filter(e=>e.id!==g.recipientCity);await g.storage.saveWorld();const returned=await g.advance(d.returnsAt);assert.equal(returned.city.resources.wood,1000);assert.equal(returned.military.reports.at(-1).targetUnavailable,true);assert.equal(returned.military.reports.at(-1).delivered.wood,0);
});

test('food delivered exactly at a hunger boundary prevents that loss, without retroactive supply',async t=>{
 const f=await fixture(t,{UPKEEP_INFANTRY_PER_HOUR:'3600',SUPPLY_GRACE_SECONDS:'50'});const r=await f.storage.loadPlayer(f.recipientId);r.city.resources.food=0;r.military.units.infantry=1;await f.storage.savePlayer(r);
 const m=await f.send('delivery',{cargo:{food:100}});assert.equal(m.arrivesAt,50000);await f.advance(m.arrivesAt);const received=await f.storage.loadPlayer(f.recipientId);assert.equal(received.military.units.infantry,1);assert.equal(received.city.resources.food,100);assert.equal(received.supply.events.length,0);
});

for(const kind of ['troops','general']) test(`transfer ${kind} crash recovers stationing exactly once`,async t=>{
 const f=await fixture(t),p=await f.storage.loadPlayer(f.senderId),ids=kind==='general'?p.military.generals.map(g=>g.id):[];
 const m=await f.send('transfer',{units:kind==='troops'?{scout:3,infantry:4}:{},generalIds:ids}),file=f.storage.playerFile(f.senderId),saved=await readFile(file);await rm(file);await mkdir(file);await assert.rejects(f.storage.advanceWorld(m.arrivesAt));await rm(file,{recursive:true});await writeFile(file,saved);
 const restart=await new WorldStorage(f.dir,'test',()=>m.arrivesAt,f.config,{warn(){}}).initialize(),done=await restart.loadPlayer(f.senderId);assert.equal(done.military.reports.length,1);
 if(kind==='troops'){assert.equal(done.cities[1].military.units.scout,3);assert.equal(done.cities[1].military.units.infantry,4);}else for(const g of done.military.generals){assert.equal(g.cityId,f.target);assert.equal(g.status,'idle');}
 const before=canonicalJSON(done);await restart.advanceWorld(m.arrivesAt);assert.deepEqual(canonicalJSON(await restart.loadPlayer(f.senderId)),before);
});

test('mixed fractional fuel rounds once and carries each exact type share in the correct space',async t=>{
 const f=await fixture(t),p=await f.storage.loadPlayer(f.senderId),rates={...f.config.logistics,oilMilliPerField:{infantry:1,scout:1,truck:1}};
 const quote=cityTransportQuote(p,{type:'transfer',originCityId:f.origin,targetCityId:f.target,units:{infantry:1,scout:1}},f.storage.world,rates,f.config.cityLogistics,0);
 assert.equal(quote.totalOil,1);assert.equal(quote.fuelBudgets.scouts,0.005);assert.equal(quote.fuelBudgets.normal,0.995);assert.equal(quote.fuelBudgets.scouts+quote.fuelBudgets.normal,1);
});

test('arrival accepts whole cargo units; home unloading preserves existing fractional-capacity rules',async t=>{
 const f=await fixture(t),r=await f.storage.loadPlayer(f.recipientId);r.city.resources.wood=1999.5;await f.storage.savePlayer(r);const m=await f.send('delivery',{cargo:{wood:1}});let p=await f.advance(m.arrivesAt);assert.equal(p.military.missions.at(-1).delivered.wood,0);p.city.resources.wood=1999.5;await f.storage.savePlayer(p);p=await f.advance(m.returnsAt);assert.equal(p.military.reports.at(-1).returnedCargo.wood,0.5);assert.equal(p.military.reports.at(-1).homeOverflow.wood,0.5);assert.equal(p.city.resources.wood,2000);
});

test('fast tab city sync includes its map even when a separate viewport would be throttled',async t=>{
 const f=await fixture(t),running=await start(f.dir,()=>f.now,'test',f.config);t.after(()=>close(running.server));const a=await websocket(running.port);t.after(()=>a.close());await authenticate(a,'login','Sender','test-password-long');
 let counter=0;for(const cityId of [f.target,f.origin,f.target]){const id=`sync-${cityId}-${counter++}`,snapshot=a.next('city.snapshot',id),map=a.next('map.snapshot',id);a.send('city.sync',{cityId},id);assert.equal((await snapshot).payload.cityId,cityId);const result=(await map).payload;assert.equal(result.cityId,cityId);assert.ok(result.terrain.length>0);assert.equal(result.ownCity.id,cityId);}
});
