import { chromium } from '../work/browser/node_modules/playwright/index.mjs';
import { createGameServer } from '../apps/server/server.js';
import { parseConfiguration } from '../apps/server/config.js';
import { terrainAt } from '../packages/game-core/world.js';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir = new URL('../work/browser-world/', import.meta.url).pathname; await rm(dir,{recursive:true,force:true}); await mkdir(dir,{recursive:true});
let now = 0;
const server = createGameServer({ worldDir: dir, worldName: 'browser', clock: () => now, config: parseConfiguration({ WORLD_WIDTH:'8', WORLD_HEIGHT:'8', WORLD_NPC_COUNT:'0', UPKEEP_INFANTRY_PER_HOUR:'0', UPKEEP_SCOUT_PER_HOUR:'0', UPKEEP_TRUCK_PER_HOUR:'0' }) });
await server.ready; await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const context = await browser.newContext({viewport:process.env.BROWSER_MOBILE ? {width:390,height:844} : {width:1365,height:900}}), page = await context.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
async function waitUpdate() { await page.waitForTimeout(1200); }
async function advanceMission(phase) { await waitUpdate(); const p=await server.storage.loadPlayer(server.storage.accounts.accounts[0].playerId); now=p.military.missions.at(-1)[phase]; await server.storage.exclusive(()=>server.storage.advanceWorld(now)); await waitUpdate(); }
try {
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByLabel('Kommandantenname').fill('BrowserCity'); await page.getByLabel('Passwort',{exact:true}).fill('browser-test-password'); await page.getByRole('button',{name:'Registrieren',exact:true}).click();
 await page.getByRole('heading',{name:'BrowserCitys Stadt',level:1}).waitFor();
 const id=server.storage.accounts.accounts[0].playerId,p=await server.storage.loadPlayer(id);p.city.resources={wood:2000,stone:2000,food:2000,oil:2000};p.military.units={infantry:100,scout:10,truck:10}; await server.storage.savePlayer(p);now=1000; await waitUpdate();
 const world=server.storage.world,home=world.map.entities.find(e=>e.playerId===id); let target;
 for(let y=0;y<8;y++) for(let x=0;x<8;x++) if(!target && terrainAt(x,y,world.map.seed)!=='water' && !(x===home.x&&y===home.y)) target={x,y};
 await page.getByRole('button',{name:'Weltkarte',exact:true}).click();
 await page.locator(`[data-map-coordinate="${target.x}:${target.y}"]`).focus(); await page.keyboard.press("Enter");
 await page.getByRole('button',{name:/^Feld aufklären/}).click();
 await page.getByRole('button',{name:'Einsatz prüfen',exact:true}).click();
 await page.getByRole('button',{name:'Aufklärung starten',exact:true}).click();
 await advanceMission('returnsAt');
 assert.match(await page.locator('.map-sidebar').innerText(),/Infanterie-Verteidiger/);
 assert.equal(await page.locator('.map-sidebar input[type=number]').count(),0);
 const current = await server.storage.loadPlayer(id), defenders = current.military.reports.at(-1).intelligence.defenders;
 await page.getByRole('button',{name:/^Feld erobern/}).click();
 const modal = page.locator('dialog[open]');
 assert.equal(Number(await modal.getByLabel(/^Infanterie/).inputValue()),defenders+1);
 // Check both outcomes and preview invalidation; the one-unit army was the old default.
 await modal.getByLabel(/^Infanterie/).fill('1'); await modal.getByRole('button',{name:'Einsatz prüfen',exact:true}).click();
 await modal.getByText('Niederlage erwartet',{exact:true}).waitFor();
 assert.ok(await modal.getByRole('button',{name:'Trotz Risiko angreifen',exact:true}).isEnabled());
 await modal.getByLabel(/^Infanterie/).fill(String(defenders+1));
 assert.ok(await modal.getByRole('button',{name:'Eroberung starten',exact:true}).isDisabled());
 await page.keyboard.press('Escape'); assert.ok(await page.getByRole('button',{name:/^Feld erobern/}).evaluate(el => document.activeElement === el)); await page.getByRole('button',{name:/^Feld erobern/}).click();
 await modal.getByRole('button',{name:'Einsatz prüfen',exact:true}).click(); await modal.getByText('Sieg erwartet',{exact:true}).waitFor();
 await page.screenshot({path:new URL('../work/conquest-modal.png',import.meta.url).pathname,fullPage:false});
 assert.ok(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth));
 await modal.getByRole('button',{name:'Eroberung starten',exact:true}).click();
 await advanceMission('arrivesAt');
 await page.getByRole('button',{name:/^Stadt gründen/}).click();
 await page.getByLabel('Stadtname',{exact:true}).fill('Neue Hafenstadt');
 await page.getByRole('button',{name:'Gründungsgebühr prüfen',exact:true}).click();
 await page.getByRole('button',{name:'Gebühr bezahlen und gründen',exact:true}).click();
 await waitUpdate();
 async function switchCity(name) {
   await page.getByRole('button',{name:'Stadt wechseln',exact:true}).click();
   await page.locator('dialog[open]').getByRole('button',{name:new RegExp(`^${name} \\(`)}).click();
   await page.getByRole('heading',{name,exact:true,level:1}).waitFor();
 }
 const newId=(await server.storage.loadPlayer(id)).cities.find(c=>c.name==='Neue Hafenstadt').id;
 await switchCity('Neue Hafenstadt');
 await page.getByRole('button',{name:'Stadt',exact:true}).click();
 await page.screenshot({path:new URL('../work/desktop-multicity.png',import.meta.url).pathname,fullPage:true});
 assert.equal((await server.storage.loadPlayer(id)).cities.length,2);
 await page.getByRole('button',{name:'Stadt wechseln',exact:true}).focus(); await page.keyboard.press('Enter');
 await page.keyboard.press('Escape');
 assert.ok(await page.getByRole('button',{name:'Stadt wechseln',exact:true}).evaluate(el=>el===document.activeElement));
 await switchCity('BrowserCitys Stadt'); await switchCity('Neue Hafenstadt');
 await page.reload();await page.getByRole('heading',{name:'Neue Hafenstadt',exact:true,level:1}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Militär',exact:true}).click();
 await page.screenshot({path:new URL('../work/mobile-multicity.png',import.meta.url).pathname,fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await advanceMission('returnsAt');
 const done=await server.storage.loadPlayer(id);assert.equal(done.cities[1].military.units.infantry,0);assert.ok(done.cities[0].military.units.infantry>0);
 await page.getByRole('button',{name:/Postbox,/}).click();await page.getByRole('button',{name:/Angriffe/}).click();await page.locator('.mail-row').first().click();assert.match(await page.locator('.mail-detail').innerText(),/Sieg/);
 assert.deepEqual(errors,[]);
 await writeFile(new URL('../work/browser-result.json',import.meta.url),JSON.stringify({passed:true,cities:done.cities.map(c=>({id:c.id,name:c.name,units:c.military.units})),errors},null,2));
 console.log('Browser flow passed: scout -> report -> conquest -> claim -> founding -> city switch -> reload -> mobile -> return report');
} finally {await browser.close(); await new Promise(resolve=>server.close(resolve));}
