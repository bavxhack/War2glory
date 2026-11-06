const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? '../work/browser/node_modules/playwright/index.mjs');
import assert from 'node:assert/strict';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import {createGameServer} from '../apps/server/server.js';
import {parseConfiguration} from '../apps/server/config.js';
import {foundedCity,canonicalJSON} from '../packages/game-core/multicity.js';
import {randomFreeLocation} from '../packages/game-core/world.js';
const root=new URL('../work/build-catalog/world/',import.meta.url).pathname;
const artifacts=process.env.CATALOG_ARTIFACTS ?? new URL('../docs/screenshots/build-catalog/',import.meta.url).pathname;
await rm(root,{recursive:true,force:true});await mkdir(artifacts,{recursive:true});
let now=1000000;
const server=createGameServer({worldDir:root,worldName:'catalog',clock:()=>now,config:parseConfiguration()});await server.ready;
const r=await server.storage.register('CatalogTester','catalog-test-password','Ausgangsstadt');
const player=canonicalJSON(await server.storage.loadPlayer(r.player.playerId));
const second=foundedCity('catalog-city-2','Stadt 2',now);player.cities.push(second);
server.storage.world.map.entities.push({id:second.id,kind:'player',playerId:player.playerId,name:second.name,commanderName:player.commanderName,...randomFreeLocation(server.storage.world.map,()=>0)});
for(const c of player.cities)c.resources={wood:2000,stone:2000,food:2000,oil:0};
player.research.levels.constructionEngineering=1;
await server.storage.commitPlayers([player],true);
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();const errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const nav=async name=>{await page.waitForFunction(()=>Boolean(document.querySelector('.menu-toggle'))===(innerWidth<1280));if(await page.locator('.menu-toggle').isVisible()){await page.locator('.menu-toggle').click();await page.locator('dialog[open]').getByRole('button',{name:new RegExp('^'+name)}).click();}else await page.getByRole('navigation',{name:'Hauptnavigation'}).getByRole('button',{name:new RegExp('^'+name)}).click();};
const open=async plot=>{await page.getByRole('article',{name:`Freies Grundstück ${plot}`,exact:true}).getByRole('button',{name:'Bauen',exact:true}).click();await page.getByRole('dialog',{name:new RegExp('Bauen · Stadt 2')}).waitFor();};
const geometry=async()=>page.locator('dialog[open] .building-option').evaluateAll(options=>options.map(option=>{
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const art=option.querySelector('.building-art'),title=option.querySelector('h3'),button=option.querySelector('button');return {label:title.textContent,image:rect(art),title:rect(title),button:rect(button),option:rect(option),overflow:option.scrollWidth>option.clientWidth+1};
}));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByLabel('Kommandantenname',{exact:true}).fill('CatalogTester');await page.getByLabel('Passwort',{exact:true}).fill('catalog-test-password');await page.getByRole('button',{name:'Anmelden',exact:true}).click();await page.getByRole('button',{name:'Stadt wechseln',exact:true}).click();await page.getByRole('button',{name:/^Stadt 2 \(/}).click();await page.getByRole('heading',{name:'Stadt 2',exact:true,level:1}).waitFor();
 const results=[];
 for(const width of [1440,768,390,320,640]){
  await page.setViewportSize({width,height:width===768?1024:900});await open('plot-7');
  const dialog=page.getByRole('dialog'),items=await geometry();
  await page.screenshot({path:`${artifacts}/civil-${width}.png`});results.push({width,items});
  if(process.env.CATALOG_BASELINE!=='1')for(const item of items){
   assert.equal(item.overflow,false,`${width}: ${item.label} has horizontal overflow`);
   assert.ok(item.image.right<=item.title.x+1 || item.image.bottom<=item.title.y+1,`${width}: ${item.label} image overlaps heading`);
   assert.ok(item.image.width<=100,`${width}: image escapes catalog column`);
   assert.ok(item.button.height>=44 && item.button.height<=110,`${width}: button stretched to ${item.button.height}`);
   assert.ok(item.button.width>=180,`${width}: usable button width`);
  }
  assert.equal(await dialog.getByRole('button',{name:/Bauen · Kaserne/}).count(),0);
  if(process.env.CATALOG_BASELINE!=='1'){
   const last=dialog.locator('.building-option button').last();await last.scrollIntoViewIfNeeded();await last.focus();
   assert.equal(await last.evaluate(e=>e===document.activeElement),true);
   assert.equal(await last.evaluate(e=>e.getBoundingClientRect().bottom<=document.querySelector('dialog .dialog-actions').getBoundingClientRect().top+1),true,'Last catalog action must not be covered by footer');
  }
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 }
 await writeFile(`${artifacts}/geometry.json`,JSON.stringify(results,null,2));
 if(process.env.CATALOG_BASELINE==='1'){console.log('Baseline recorded');}
 else{
  checks.push('Zivilkatalog mit Forschung Stufe 1 bei 1440/768/390/320/640 CSS-Pixeln: keine Überlappung, kein horizontaler Überlauf, begrenzte Bild-/Buttonmaße; Escape schließt.');
  await page.setViewportSize({width:390,height:844});await open('plot-7');
  const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:/^Bauen · Sägewerk/}).click();await dialog.waitFor({state:'hidden'});
  const saved=await server.storage.loadPlayer(player.playerId),job=saved.cities.find(c=>c.id===second.id).constructionQueue.find(j=>j.slotId==='plot-7');assert.equal(job.building,'sawmill');assert.equal(job.paidCost.wood,40);assert.equal(job.paidCost.stone,30);assert.equal(saved.cities[0].constructionQueue.length,0);assert.equal(saved.cities.find(c=>c.id===second.id).resources.wood,1960);
  checks.push('Mobiler Bau aus Stadt 2: Sägewerk auf plot-7, einmalig 40 Holz/30 Stein; erste Stadt unverändert.');
  await nav('Militär');const free=page.locator('.building-card.empty').first();await free.getByRole('button',{name:'Bauen',exact:true}).click();await page.getByRole('dialog').waitFor();
  const military=await geometry();for(const item of military){assert.ok(item.image.right<=item.title.x+1);assert.ok(item.button.height<=110);}
  assert.equal(await page.getByRole('dialog').getByRole('button',{name:/Bauen · Sägewerk/}).count(),0);await page.screenshot({path:`${artifacts}/military-390.png`});await page.keyboard.press('Escape');checks.push('Militärkatalog verwendet dieselbe korrekte Anordnung und ausschließlich militärische Angebote.');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  saved.cities.find(c=>c.id===second.id).resources={wood:0,stone:0,food:0,oil:0};await server.storage.savePlayer(saved);
  await nav('Stadt');await open('plot-8');await page.getByRole('dialog').getByText(/40 Holz fehlen/).first().waitFor();
  assert.equal(await page.getByRole('dialog').getByRole('button',{name:/^Bauen · Sägewerk/}).isDisabled(),true);
  for(const item of await geometry()){assert.equal(item.overflow,false);assert.ok(item.button.height<=110);assert.ok(item.image.right<=item.title.x+1);}
  await page.screenshot({path:`${artifacts}/missing-resources-390.png`});await page.keyboard.press('Escape');checks.push('Fehlende Ressourcen: Sperrgründe bleiben lesbar, Bau gesperrt, kein Layoutüberlauf. Letzte Angebote per Scrollen/Tastatur erreichbar und nicht vom Dialogfuß verdeckt.');
  assert.deepEqual(errors,[]);await writeFile(`${artifacts}/checks.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
 }
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
