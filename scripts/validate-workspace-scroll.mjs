import {chromium} from '../work/browser/node_modules/playwright/index.mjs';
import {createGameServer} from '../apps/server/server.js';
import {parseConfiguration} from '../apps/server/config.js';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const artifacts=new URL('../work/workspace-scroll/',import.meta.url).pathname;
await rm(artifacts,{recursive:true,force:true});await mkdir(artifacts,{recursive:true});
const server=createGameServer({worldDir:`${artifacts}/world`,worldName:'scroll',config:parseConfiguration({WORLD_WIDTH:'24',WORLD_HEIGHT:'24',WORLD_NPC_COUNT:'0'})});
await server.ready;await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
const metrics=selector=>page.locator(selector).evaluate(el=>({height:el.clientHeight,scrollHeight:el.scrollHeight,top:el.scrollTop,overflow:getComputedStyle(el).overflowY}));
async function nav(name){await page.waitForFunction(()=>Boolean(document.querySelector('.menu-toggle'))===(window.innerWidth<1280));if(await page.locator('.menu-toggle').isVisible()){await page.locator('.menu-toggle').click();await page.locator('dialog[open]').getByRole('button',{name:new RegExp(`^${name}`)}).click();}else await page.getByRole('navigation',{name:'Hauptnavigation'}).getByRole('button',{name:new RegExp(`^${name}`)}).click();}
async function wheel(selector,dy){const box=await page.locator(selector).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+Math.min(180,box.height/2));await page.mouse.wheel(0,dy);await page.waitForTimeout(250);}
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByLabel('Kommandantenname').fill('ScrollTester');await page.getByLabel('Passwort',{exact:true}).fill('scroll-test-password');await page.getByRole('button',{name:'Registrieren',exact:true}).click();await page.locator('.workspace-content .plot').nth(3).click();
 const initial={main:await metrics('.workspace-content'),sidebar:await metrics('.persistent-sidebar')};console.log(JSON.stringify(initial));
 assert.ok(initial.sidebar.scrollHeight>initial.sidebar.height,'Long building selection must overflow the bounded sidebar');
 await wheel('.persistent-sidebar',700);assert.ok((await metrics('.persistent-sidebar')).top>0,'Sidebar must actually scroll by mouse wheel');assert.equal((await metrics('.workspace-content')).top,0,'Sidebar scrolling must not move main content');
 await nav('Logistik');const sidebarBefore=(await metrics('.persistent-sidebar')).top;const main=await metrics('.workspace-content');assert.ok(main.scrollHeight>main.height,'Long logistics form must overflow bounded main area');await wheel('.workspace-content',600);assert.ok((await metrics('.workspace-content')).top>0,'Main area must actually scroll by mouse wheel');assert.equal((await metrics('.persistent-sidebar')).top,sidebarBefore,'Main scroll must not move sidebar');checks.push('1366×768: main and sidebar have bounded height and independent real wheel scrolling');
 for(const viewport of [{width:1366,height:768},{width:390,height:844},{width:320,height:844}]){
  await page.setViewportSize(viewport);await nav('Weltkarte');await page.getByLabel('Koordinate').fill('12, 12');await page.getByRole('button',{name:'Suchen',exact:true}).click();await page.waitForTimeout(100);
  const map=page.locator('.world-map');await map.waitFor();const before=await map.locator('[data-map-coordinate]').first().getAttribute('data-map-coordinate');
  const sizes=await map.evaluate(el=>({clientWidth:el.clientWidth,clientHeight:el.clientHeight,scrollWidth:el.scrollWidth,scrollHeight:el.scrollHeight,overflow:getComputedStyle(el).overflow}));assert.equal(sizes.overflow,'clip');assert.ok(sizes.scrollWidth<=sizes.clientWidth+1,`Map horizontal overflow at ${viewport.width}`);assert.ok(sizes.scrollHeight<=sizes.clientHeight+1,`Map vertical overflow at ${viewport.width}`);
  await map.evaluate(el=>{el.scrollTop=100;el.scrollLeft=100;});await wheel('.world-map',500);assert.deepEqual(await map.evaluate(el=>({top:el.scrollTop,left:el.scrollLeft})),{top:0,left:0});assert.equal(await map.locator('[data-map-coordinate]').first().getAttribute('data-map-coordinate'),before,'Wheel must not pan the map');
  await page.getByRole('button',{name:'Karte nach right',exact:true}).click();await page.waitForFunction(previous=>document.querySelector('[data-map-coordinate]')?.dataset.mapCoordinate!==previous,before);const after=await map.locator('[data-map-coordinate]').first().getAttribute('data-map-coordinate');assert.notEqual(after,before,'Map direction button must pan visible coordinates');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${artifacts}/map-${viewport.width}.png`});checks.push(`${viewport.width}px: complete map grid fits, no wheel/programmatic map scrolling, direction buttons pan coordinates`);
 }
 assert.deepEqual(errors,[]);await writeFile(`${artifacts}/checks.json`,JSON.stringify({checks,errors},null,2));console.log(checks.join('\n'));
}catch(e){await page.screenshot({path:`${artifacts}/failure.png`});console.error(e);process.exitCode=1;}finally{await browser.close();await new Promise(r=>server.close(r));}
