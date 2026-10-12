import { chromium } from '../work/browser/node_modules/playwright/index.mjs';
import { createGameServer } from '../apps/server/server.js';
import { parseConfiguration } from '../apps/server/config.js';
import { enqueueConstruction } from '../packages/game-core/index.js';
import { researchQuote, startResearch } from '../packages/game-core/research.js';
import { missionQuote, startLogisticsMission } from '../packages/game-core/logistics.js';
import { canonicalJSON, foundedCity, exposeCity } from '../packages/game-core/multicity.js';
import { randomFreeLocation } from '../packages/game-core/world.js';
import { rm, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir = new URL('../work/sidebar-world/', import.meta.url).pathname; await rm(dir,{recursive:true,force:true}); await mkdir(dir,{recursive:true});
let now=0;
const config=parseConfiguration({ WORLD_WIDTH:'8',WORLD_HEIGHT:'8',WORLD_NPC_COUNT:'1',UPKEEP_INFANTRY_PER_HOUR:'0',UPKEEP_SCOUT_PER_HOUR:'0' });
const server=createGameServer({worldDir:dir,worldName:'sidebar',clock:()=>now,config});await server.ready;await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:process.env.BROWSER_MOBILE?{width:390,height:844}:{width:1440,height:1000}}), errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByLabel('Kommandantenname').fill('SidebarTester');await page.getByLabel('Passwort',{exact:true}).fill('sidebar-test-password');await page.getByLabel('Stadtname (nur Registrierung)').fill('Hafenstadt');await page.getByRole('button',{name:'Registrieren',exact:true}).click();await page.getByRole('heading',{name:'Hafenstadt',level:1,exact:true}).waitFor();
 const id=server.storage.accounts.accounts[0].playerId;now=1000;await server.storage.exclusive(()=>server.storage.advanceWorld(now));let p=await server.storage.loadPlayer(id);
 p.city.resources={wood:2000,stone:2000,food:2000,oil:2000};p.military.units={infantry:30,scout:5,truck:0};Object.assign(p.city.buildingSlots[3],{building:'university',buildingId:'sidebar-university',level:1});
 p.city=enqueueConstruction(p.city,{id:'sidebar-build',slotId:'plot-1',building:'sawmill'},now);
 const rq=researchQuote(p.city,{technology:'forestry',targetLevel:1,universityId:'sidebar-university',rulesetVersion:p.city.research.ruleset},{military:p.military,officerRules:config.officers});
 p.city=startResearch(p.city,{...rq,id:'sidebar-research',expectedUniversityLevel:1},now,{military:p.military,officerRules:config.officers});
 const origin=server.storage.world.map.entities.find(e=>e.id===p.cityId),target=server.storage.world.map.entities.find(e=>e.kind==='npc'),command={id:'sidebar-scout',type:'scout',generalId:p.military.generals[0].id,scouts:1};
 p=startLogisticsMission(p,{...command,preview:missionQuote(p,command,origin,target,config.logistics,now)},now,origin,target,config.logistics);
 p=canonicalJSON(p);const city=foundedCity('sidebar-second','Bergstadt',now);p.cities.push(city);const coords=randomFreeLocation(server.storage.world.map,()=>0);server.storage.world.map.entities.push({id:city.id,kind:'player',playerId:id,commanderName:p.commanderName,name:city.name,...coords});server.storage.world.map.revision++;exposeCity(p,origin.id);await server.storage.commitPlayers([p],true);await page.waitForTimeout(1300);
 const panel=page.locator('.persistent-sidebar .city-activity'),tabs=page.getByRole('navigation',{name:'Spielansicht'});
 await page.evaluate(()=>window.activityElement=document.querySelector('.city-activity'));
 for(const view of ['Stadt','Militär','Weltkarte','Forschung','Postbox']) {
   now+=100; await tabs.getByRole('button',{name:view==='Postbox'?/^Postbox,/:view,exact:view!=='Postbox'}).click();
   if(view==='Forschung') { await page.locator('.workspace-content .research-grid .card').first().getByRole('button',{name:/^Technologie auswählen/}).click(); assert.match(await page.locator('.sidebar-actions .research-selection').innerText(),/Forstwirtschaft/); }
   assert.equal(await panel.count(),1);assert.match(await panel.innerText(),/Freie Stadt 1/);assert.match(await panel.innerText(),/Sägewerk · Stufe 2/);assert.match(await panel.innerText(),/Forstwirtschaft · Stufe 1/);assert.ok(await page.evaluate(()=>window.activityElement===document.querySelector('.city-activity')));
   assert.ok(await page.evaluate(()=>Boolean(document.querySelector('.city-activity').compareDocumentPosition(document.querySelector('.sidebar-actions'))&Node.DOCUMENT_POSITION_FOLLOWING)));
 }
 await tabs.getByRole('button',{name:'Stadt',exact:true}).click();await page.locator('.workspace-content .plot').first().click();assert.match(await page.locator('.sidebar-actions').innerText(),/bereits ein Auftrag/);
 now+=100; await page.getByRole('button',{name:'Stadt wechseln',exact:true}).click();await page.locator('dialog[open] .city-choice').filter({hasText:'Bergstadt'}).click();await page.getByRole('heading',{name:'Bergstadt',level:1,exact:true}).waitFor();
 assert.match(await panel.innerText(),/Keine Truppen unterwegs/);assert.match(await panel.innerText(),/Keine Bauaufträge/);assert.match(await panel.innerText(),/Spielerweit · Hafenstadt/);
 await page.getByRole('button',{name:'Stadt wechseln',exact:true}).focus();await page.keyboard.press('Enter');await page.keyboard.press('Escape');assert.ok(await page.getByRole('button',{name:'Stadt wechseln',exact:true}).evaluate(el=>el===document.activeElement));
 await page.reload();await page.getByRole('heading',{name:'Bergstadt',level:1,exact:true}).waitFor();
 now+=100; await page.getByRole('button',{name:'Stadt wechseln',exact:true}).click();await page.locator('dialog[open] .city-choice').filter({hasText:'Hafenstadt'}).click();await page.getByRole('heading',{name:'Hafenstadt',level:1,exact:true}).waitFor();
 await page.screenshot({path:new URL(`../work/sidebar-${process.env.BROWSER_MOBILE?'mobile':'desktop'}.png`,import.meta.url).pathname,fullPage:true});
 for(const width of [390,320]) {await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await panel.count(),1);}
 assert.deepEqual(errors,[]);console.log('Sidebar UI passed: active movement/build/research in every view, actions below, city isolation, keyboard, reload, mobile widths');
} finally {await browser.close();await new Promise(r=>server.close(r));}
