import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TECHNOLOGIES, RESEARCH_RULES, RESEARCH_EFFECT_RULES, newResearch, researchQuote, researchOffers, startResearch, finishResearch, validateTechnologyCatalog, workQuote, loadingRules } from '../packages/game-core/research.js';
import { advanceSupply } from '../packages/game-core/supply.js';
import { newCity, constructionQuote, enqueueConstruction, advanceCity } from '../packages/game-core/index.js';
import { newMilitary, enqueueTraining, UNITS } from '../packages/game-core/military.js';
import { missionQuote, startLogisticsMission, cargoCapacity } from '../packages/game-core/logistics.js';
import { resolveCargoArrival } from '../packages/game-core/cargo.js';
import { canonicalJSON, exposeCity, foundedCity, playerScore } from '../packages/game-core/multicity.js';
import { cityTransportQuote } from '../packages/game-core/city-logistics.js';
import { WorldStorage } from '../apps/server/storage.js';
import { parseConfiguration } from '../apps/server/config.js';
import { start, close, websocket, authenticate } from './support/socket.js';

function city() {
  const c = newCity(0); c.resources = { wood: 2000, stone: 2000, food: 2000, oil: 2000 };
  Object.assign(c.buildingSlots[3], { building: 'university', buildingId: 'uni', level: 5 });
  Object.assign(c.militarySlots[0], { building: 'barracks', buildingId: 'b', level: 3 });
  Object.assign(c.militarySlots[1], { building: 'vehicleFactory', buildingId: 'v', level: 2 });
  return c;
}
const researchCommand = (technology, c) => ({ id: technology, technology, targetLevel: c.research.levels[technology] + 1, universityId: 'uni', expectedUniversityLevel: 5, rulesetVersion: RESEARCH_RULES.version });

test('versioned nine-entry catalog, legacy values, DAG and all structured blockers', () => {
  assert.equal(Object.keys(TECHNOLOGIES).length, 9);
  for (const id of ['forestry','masonry','agriculture','logistics']) { assert.equal(TECHNOLOGIES[id].baseCost,100); assert.equal(TECHNOLOGIES[id].baseSeconds,60); assert.equal(TECHNOLOGIES[id].maxLevel,5); }
  assert.deepEqual(TECHNOLOGIES.motorization.prerequisites,{oilProcessing:1,logistics:1});
  assert.equal(TECHNOLOGIES.motorization.baseCost,500); assert.equal(TECHNOLOGIES.oilProcessing.baseCost,300);
  assert.equal(validateTechnologyCatalog(),true);
  assert.throws(()=>validateTechnologyCatalog({a:{maxLevel:1,baseCost:1,baseSeconds:1,prerequisites:{b:1}}}));
  assert.throws(()=>validateTechnologyCatalog({a:{maxLevel:1,baseCost:1,baseSeconds:1,prerequisites:{a:1}}}),/Zyklus/);
  const c=city(); c.buildingSlots[3].level=1;c.resources.wood=0;c.resources.stone=0;c.research.active={};
  const offer=researchOffers(c).find(o=>o.technology==='constructionEngineering');
  assert.deepEqual(offer.reasons.map(r=>r.code),['active','university','prerequisite','resources','resources']);
  assert.throws(()=>researchQuote(c,researchCommand('constructionEngineering',c)));
  c.research.active=null;c.buildingSlots[3].level=5;c.resources.wood=2000;c.resources.stone=2000;
  assert.throws(()=>researchQuote(c,researchCommand('constructionEngineering',c)),/Steinverarbeitung/);
  c.research.levels.masonry=1;const q=researchQuote(c,researchCommand('constructionEngineering',c));
  assert.deepEqual(q.cost,{wood:150,stone:150});assert.equal(q.durationMs,65000);
  assert.throws(()=>researchQuote(c,{...researchCommand('constructionEngineering',c),targetLevel:2}));
});

for (const level of [0,1,5]) test(`speed snapshots level ${level}, all buildings and units, existing factors and frozen queue`,()=>{
 const c=city();c.research.levels.constructionEngineering=level;c.research.levels.trainingTechniques=level;c.research.levels.motorization=1;
 assert.equal(workQuote(60000,c,'constructionEngineering').durationMs, Math.ceil(60000*10000/(10000+500*level)));
 for(const [slotId,building] of [['plot-5','warehouse'],['military-plot-3','barracks'],['military-plot-4','vehicleFactory']]) {
  const q=enqueueConstruction(c,{id:slotId,slotId,building},0).constructionQueue[0];
  assert.equal(q.durationMs,Math.ceil(5000*10000/(10000+500*level)));assert.equal(q.researchEffect.level,level);
 }
 const upgraded=enqueueConstruction(c,{id:'up',slotId:'plot-1',building:'sawmill'},0).constructionQueue[0];assert.equal(upgraded.durationMs,Math.ceil(10000*10000/(10000+500*level)));
 for(const [unit,d]of Object.entries(UNITS)) {
  const slot=c.militarySlots.find(s=>s.building===d.building),m=newMilitary('p');
  const result=enqueueTraining(m,c,{id:unit,unit,amount:2,trainingSlotId:slot.id},0),q=result.military.trainingQueue[0];
  assert.equal(q.durationMs,Math.ceil(Math.ceil(d.baseDurationMs*2/slot.level)*10000/(10000+500*level)));
  assert.equal(q.researchEffect.durationWithoutResearchMs,Math.ceil(d.baseDurationMs*2/slot.level));
  const waiting=enqueueTraining(result.military,result.city,{id:'waiting',unit,amount:1,trainingSlotId:slot.id},0);
  const saved=structuredClone(waiting.military.trainingQueue);waiting.city.research.levels.trainingTechniques=5;
  assert.deepEqual(waiting.military.trainingQueue,saved);
 }
 const old=enqueueConstruction(c,{id:'old',slotId:'plot-5',building:'warehouse'},0);const saved=structuredClone(old.constructionQueue);old.research.levels.constructionEngineering=5;assert.deepEqual(old.constructionQueue,saved);
 assert.throws(()=>enqueueConstruction(c,{id:'stale',slotId:'plot-5',building:'warehouse',researchEffect:{...constructionQuote(1,c).researchEffect,level:99}},0),/Bauvorschau/);
});

test('loading uses per-type rational floor, configured bases and exact 1500/1125/1102/802 cargo example',()=>{
 const c=city(),base=parseConfiguration().logistics;
 for(const [level,i,t]of [[0,20,200],[1,21,210],[5,25,250]]) {c.research.levels.loadingTechniques=level;const r=loadingRules(base,c);assert.equal(r.cargoPerUnit.infantry,i);assert.equal(r.cargoPerUnit.truck,t);assert.equal(r.cargoPerUnit.scout,0);assert.equal(r.scoutFuelCapacity,base.scoutFuelCapacity);}
 const custom=loadingRules({...base,cargoPerUnit:{infantry:23,scout:0,truck:201}},c);assert.equal(custom.cargoPerUnit.infantry,28);assert.equal(custom.cargoPerUnit.truck,251);assert.equal(base.cargoPerUnit.truck,200);
 const m={city:c,military:newMilitary('p')};m.military.units={infantry:20,truck:4,scout:1};
 const command={type:'raid',generalId:m.military.generals[0].id,units:{infantry:20,truck:4},cargo:{wood:300}},origin={x:0,y:0},target={id:'npc',kind:'npc',x:5,y:0};
 const preview=missionQuote(m,command,origin,target,base,0);assert.equal(preview.capacity,1500);
 const sent=startLogisticsMission(m,{...command,id:'r',preview},0,origin,target,base),mission=sent.military.missions[0];
 mission.units={infantry:15,truck:3};const capacity=cargoCapacity(mission.units,mission.logistics.cargoPerUnit);assert.equal(capacity,1125);
 assert.deepEqual(resolveCargoArrival(mission,capacity),{goodsCapacity:1102,lootCapacity:802});assert.equal(mission.cargo.returnFuelMilli,'22500');
 sent.city.research.levels.loadingTechniques=0;assert.equal(mission.logistics.cargoPerUnit.truck,250);
 assert.throws(()=>missionQuote(m,{...command,cargo:{wood:1500}},origin,target,base,0),/schwer/);
 const scout=missionQuote(m,{type:'scout',generalId:command.generalId,scouts:1},origin,target,base,0);assert.equal(scout.capacity,0);assert.equal(scout.tankCapacity,20);
});

for(const raw of [undefined,'0','2000']) test(`ENV research bonuses ${raw??'default'}`,()=>{
 const env=Object.fromEntries(['CONSTRUCTION','TRAINING','LOADING'].map(k=>[`RESEARCH_${k}_BONUS_BPS`,raw]).filter(([,v])=>v!==undefined));const r=parseConfiguration(env).research;
 for(const key of ['constructionBonusBps','trainingBonusBps','loadingBonusBps'])assert.equal(r[key],raw===undefined?500:Number(raw));
});
test('invalid research ENV is rejected before mutation',()=>{for(const raw of ['','-1','2001','1.5','NaN','500bps'])for(const kind of ['CONSTRUCTION','TRAINING','LOADING'])assert.throws(()=>parseConfiguration({[`RESEARCH_${kind}_BONUS_BPS`]:raw}),/Ganzzahl/);});

async function fixture(t) {
 const dir=await mkdtemp(join(tmpdir(),'research-expansion-'));t.after(()=>rm(dir,{recursive:true,force:true}));let now=0;
 const config=parseConfiguration({UPKEEP_INFANTRY_PER_HOUR:'0',UPKEEP_SCOUT_PER_HOUR:'0',UPKEEP_TRUCK_PER_HOUR:'0'});
 const storage=await new WorldStorage(dir,'test',()=>now,config).initialize();const a=await storage.register('Research','password-long-test');
 const p=canonicalJSON(a.player);for(let i=1;i<5;i++)p.cities.push(foundedCity(`city-${i}`,`City ${i}`,0));
 for(const c of p.cities){const ready=city();Object.assign(c,{resources:ready.resources,buildingSlots:ready.buildingSlots,militarySlots:ready.militarySlots});c.military.units={infantry:20,truck:4,scout:5};}
 p.research.levels.masonry=1;p.research.levels.logistics=1;p.research.levels.motorization=1;
 await storage.commitPlayers([p],true);
 return {dir,storage,config,id:p.playerId,session:a.sessionToken,setTime:t=>now=t,get now(){return now;}};
}

test('five cities, all three completions and transport capacity after restart; saved activation and legacy versions',async t=>{
 const f=await fixture(t);let p=await f.storage.loadPlayer(f.id);
 const targetId=p.cities[1].id,sourceId=p.cityId;
 const transport={type:'transfer',originCityId:sourceId,targetCityId:targetId,units:{truck:4}};
 // A world entity is needed only for transport validation.
 f.storage.world.map.entities.push({id:targetId,kind:'player',playerId:f.id,x:5,y:0});Object.assign(f.storage.world.map.entities.find(e=>e.id===sourceId),{x:0,y:0});
 assert.equal(cityTransportQuote(p,transport,f.storage.world,f.config.logistics).capacity,800);
 await f.storage.commitPlayers([p],true);
 for(const technology of ['constructionEngineering','trainingTechniques','loadingTechniques']) {
  p=await f.storage.loadPlayer(f.id);const before=playerScore(p).research;
  p.city=startResearch(p.city,researchCommand(technology,p.city),f.now);p.research.active={...p.city.research.active,cityId:sourceId};
  const end=p.city.research.active.finishesAt;await f.storage.savePlayer(p);f.setTime(end);await f.storage.advanceWorld(end);
  p=await f.storage.loadPlayer(f.id);assert.equal(p.research.levels[technology],1);assert.equal(playerScore(p).research,before+10);
  for(const c of p.cities){exposeCity(p,c.id);assert.equal(p.city.research.levels[technology],1);}
  exposeCity(p,sourceId);
 }
 const restarted=await new WorldStorage(f.dir,'test',()=>f.now,f.config).initialize();p=await restarted.loadPlayer(f.id);assert.equal(playerScore(p).research,60);
 assert.equal(cityTransportQuote(p,transport,restarted.world,f.config.logistics).capacity,840);
 const changed=parseConfiguration({RESEARCH_CONSTRUCTION_BONUS_BPS:'0',RESEARCH_LOADING_BONUS_BPS:'2000',UPKEEP_INFANTRY_PER_HOUR:'0',UPKEEP_SCOUT_PER_HOUR:'0',UPKEEP_TRUCK_PER_HOUR:'0'});
 const again=await new WorldStorage(f.dir,'test',()=>f.now+1,changed).initialize();assert.equal(again.world.researchRuleHistory.length,2);assert.equal(again.world.researchRuleHistory[1].effectiveAt,f.now+1);
 for(const version of ['research-1-provisional','research-2-leadership-provisional','research-3-logistics-provisional']){const c=city();c.research.active={technology:'forestry',targetLevel:1,ruleset:version,finishesAt:1};assert.equal(finishResearch(c,1),true);assert.equal(c.research.levels.forestry,1);assert.equal(finishResearch(c,1),false);}
});

test('new research offline one step equals many, unknown active rules fail visibly',()=>{
 const c=city();c.research.levels.masonry=1;const begun=startResearch(c,researchCommand('constructionEngineering',c),0);const end=begun.research.active.finishesAt;
 let stepped=begun;for(let at=1000;at<end+3000;at+=1000)stepped=advanceCity(stepped,at);
 stepped=advanceCity(stepped,end+3000);const single=advanceCity(begun,end+3000);for(const k of Object.keys(single.resources)) { assert.ok(Math.abs(single.resources[k]-stepped.resources[k]) < 1e-8); stepped.resources[k]=single.resources[k]; } assert.deepEqual(stepped,single);
 const invalid=structuredClone(begun);invalid.research.active.ruleset='unknown';assert.throws(()=>advanceCity(invalid,end),/Inkonsistenter/);assert.equal(invalid.research.active.ruleset,'unknown');
});


test('WebSocket stale quotes, simultaneous sessions, shared queue, permanent receipts and private state',async t=>{
 const f=await fixture(t);const running=await start(f.dir,()=>f.now,'test',f.config);const clients=[];t.after(async()=>{clients.forEach(c=>c.close());await close(running.server);});
 for(let i=0;i<2;i++){const c=await websocket(running.port);clients.push(c);await authenticate(c,'login','Research','password-long-test');}
 const [a,b]=clients;
 async function request(client,type,payload={},id=`${type}-${Math.random()}`,answer='command.ok') {id=id.padEnd(12,'-');const next=client.next(answer,id);client.send(type,payload,id);return(await next).payload;}
 let snap=await request(a,'city.sync',{},'sync','city.snapshot'),cityId=snap.cityId;
 const old=snap.offers.build.warehouse.researchEffect;
 let p=await running.server.storage.loadPlayer(f.id);p.research.levels.constructionEngineering=1;await running.server.storage.savePlayer(p);
 const wood=p.city.resources.wood;
 const error=await request(a,'construction.enqueue',{slotId:'plot-5',building:'warehouse',researchEffect:old},'stale','command.error');assert.match(error.message,/Bauvorschau/);assert.equal((await running.server.storage.loadPlayer(f.id)).city.resources.wood,wood);
 snap=await request(a,'city.sync',{},'sync2','city.snapshot');const payload={slotId:'plot-5',building:'warehouse',researchEffect:snap.offers.build.warehouse.researchEffect};
 const results=await Promise.all([request(a,'construction.enqueue',payload,'same'),request(b,'construction.enqueue',payload,'same')]);assert.equal(results.filter(r=>r.duplicate).length,1);
 p=await running.server.storage.loadPlayer(f.id);assert.equal(p.city.constructionQueue.length,1);assert.equal(p.city.resources.wood,wood-40);
 const training=await request(a,'training.preview',{trainingSlotId:'military-plot-1',unit:'infantry',amount:1},'train-quote','training.preview');
 p.research.levels.trainingTechniques=1;await running.server.storage.savePlayer(p);
 assert.match((await request(a,'training.enqueue',{trainingSlotId:'military-plot-1',unit:'infantry',amount:1,researchEffect:training.researchEffect},'train-stale','command.error')).message,/Ausbildungsvorschau/);
 const research=await request(a,'research.preview',{...researchCommand('loadingTechniques',p.city)},'research-q','research.preview');
 await request(a,'research.start',research,'research-once');
 assert.match((await request(b,'research.preview',{...researchCommand('trainingTechniques',p.city),cityId:p.cities[1].id},'other-city','command.error')).message,/spielerweite/);
 f.setTime(31*24*3600000);await request(a,'city.sync',{},'offline','city.snapshot');
 assert.equal((await request(b,'research.start',research,'research-once')).duplicate,true);
 const stranger=await websocket(running.port);clients.push(stranger);const other=await authenticate(stranger,'register','Stranger');assert.equal(other.snapshot.city.research.levels.loadingTechniques,0);assert.equal(other.snapshot.city.research.active,null);
});

test('researched training keeps paid remaining work through hunger and knowledge changes',()=>{
 const c=city();c.research.levels.trainingTechniques=1;
 const m=newMilitary('p');m.units.infantry=100;
 const result=enqueueTraining(m,c,{id:'paused',unit:'infantry',amount:10,trainingSlotId:'military-plot-1'},0);
 result.city.resources.food=0;const job=structuredClone(result.military.trainingQueue[0]);
 const paused=advanceSupply({...result,playerId:'p'},10000,0);
 assert.equal(paused.military.trainingQueue[0].finishesAt,job.finishesAt+10000);
 assert.deepEqual(paused.military.trainingQueue[0].researchEffect,job.researchEffect);
 paused.city.research.levels.trainingTechniques=5;paused.city.resources.food=2000;
 const resumed=advanceSupply(paused,11000,0);
 assert.equal(resumed.military.trainingQueue[0].finishesAt,job.finishesAt+10000);
 assert.equal(resumed.military.trainingQueue[0].durationMs,job.durationMs);
});

test('active and waiting historical work are not recomputed at engineering completion',()=>{
 let c=city();c.research.levels.masonry=1;
 c.constructionQueue=[{id:'historical-active',type:'upgrade',slotId:'plot-1',building:'sawmill',buildingId:c.buildingSlots[0].buildingId,level:2,paidCost:{wood:80,stone:60},startsAt:0,finishesAt:100000},{id:'historical-waiting',type:'upgrade',slotId:'plot-2',building:'quarry',buildingId:c.buildingSlots[1].buildingId,level:2,paidCost:{wood:80,stone:60},startsAt:100000,finishesAt:200000}];
 const saved=structuredClone(c.constructionQueue);c=startResearch(c,researchCommand('constructionEngineering',c),0);c=advanceCity(c,c.research.active.finishesAt);
 assert.deepEqual(c.constructionQueue,saved);
 const after=enqueueConstruction(c,{id:'new',slotId:'plot-5',building:'warehouse'},c.updatedAt);assert.equal(after.constructionQueue.at(-1).startsAt,200000);assert.equal(after.constructionQueue.at(-1).durationMs,4762);
 const zero={...RESEARCH_EFFECT_RULES,constructionBonusBps:0,trainingBonusBps:0,loadingBonusBps:0};c.research.levels.constructionEngineering=5;c.research.levels.loadingTechniques=5;
 assert.equal(workQuote(60000,c,'constructionEngineering',zero).durationMs,60000);assert.equal(loadingRules(parseConfiguration().logistics,c,zero).cargoPerUnit.truck,200);
});

test('schema 17 normalization adds only zero levels; unknown research preserves original JSON',async t=>{
 const f=await fixture(t);let p=canonicalJSON(await f.storage.loadPlayer(f.id));
 for(const id of ['constructionEngineering','trainingTechniques','loadingTechniques'])delete p.research.levels[id];
 p.research.ruleset='research-3-logistics-provisional';
 p.research.active={id:'historical-research',technology:'forestry',targetLevel:1,ruleset:'research-3-logistics-provisional',cityId:p.cities[0].id,universityId:'uni',startsAt:0,finishesAt:100000,durationMs:100000,paidCost:{wood:100,stone:100}};
 await f.storage.advanceWorld(0);{const advanced=canonicalJSON(await f.storage.loadPlayer(f.id));p.military.candidatePool=advanced.military.candidatePool;p.tasks=advanced.tasks;for(let i=0;i<p.cities.length;i++)p.cities[i].supply=advanced.cities[i].supply;}const original=structuredClone(p),file=join(f.dir,'players',`${f.id}.json`);await writeFile(file,JSON.stringify(p));
 const reopened=await new WorldStorage(f.dir,'test',()=>0,f.config).initialize();p=canonicalJSON(await reopened.loadPlayer(f.id));
 for(const id of ['constructionEngineering','trainingTechniques','loadingTechniques']) {assert.equal(p.research.levels[id],0);delete p.research.levels[id];}
 assert.deepEqual(p,original);
 p.research.levels.unknownFutureTechnology=3;const invalid=JSON.stringify(p);await writeFile(file,invalid);
 await assert.rejects(()=>new WorldStorage(f.dir,'test',()=>1,f.config).initialize(),/Unbekannte gespeicherte Technologie/);
 assert.equal(await readFile(file,'utf8'),invalid);
});
