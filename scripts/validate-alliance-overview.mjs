const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? '../work/browser/node_modules/playwright/index.mjs');
import assert from 'node:assert/strict';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createGameServer} from '../apps/server/server.js';
import {parseConfiguration} from '../apps/server/config.js';
import {allianceRequest} from '../apps/server/alliances.js';
import {membership} from '../packages/game-core/alliances.js';
const root=new URL('../work/alliance-overview/',import.meta.url).pathname,artifacts=new URL('../docs/screenshots/alliance-modern/',import.meta.url).pathname;
await rm(root,{recursive:true,force:true});await mkdir(root,{recursive:true});await mkdir(artifacts,{recursive:true});
const server=createGameServer({worldDir:root,worldName:'overview',clock:Date.now,config:parseConfiguration({ALLIANCE_CREATE_WOOD:'0',ALLIANCE_CREATE_STONE:'0'})});await server.ready;
const people=[];for(const name of ['ModernOwner','MitgliedZwei','MitgliedDrei','MitgliedVier','MitgliedFuenf','MitgliedSechs']){const r=await server.storage.register(name,'overview-test-password',`${name}stadt`);people.push({playerId:r.player.playerId,account:r.account,cityId:r.player.cities[0].id});}
const call=(peer,type,p)=>server.storage.exclusive(()=>allianceRequest(server.storage,peer,{type:`alliance.${type}`,payload:{cityId:peer.cityId,...p},requestId:randomUUID()},Date.now()));
const q=await call(people[0],'create.preview',{name:'Nordlicht',tag:'NORD'});await call(people[0],'create',q);
for(const peer of people.slice(1)){const own=membership(server.storage.world,people[0].playerId);await call(people[0],'invite',{allianceId:own.alliance.id,membershipId:own.member.membershipId,adminVersion:own.alliance.adminVersion,recipientName:peer.account.displayName});const inv=(await call(peer,'invitations',{})).items[0];await call(peer,'invitation.respond',{invitationId:inv.id,response:'accept'});}
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:900},locale:'de-DE',timezoneId:'Europe/Berlin'});const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
const area=async name=>page.getByRole('navigation',{name:'Bündnisbereiche'}).getByRole('button',{name:new RegExp('^'+name)}).click();
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByLabel('Kommandantenname',{exact:true}).fill('ModernOwner');await page.getByLabel('Passwort',{exact:true}).fill('overview-test-password');await page.getByRole('button',{name:'Anmelden',exact:true}).click();await page.getByRole('navigation',{name:'Hauptnavigation'}).getByRole('button',{name:/^Bündnis/}).click();await page.getByRole('heading',{name:'[NORD] Nordlicht',exact:true}).waitFor();
 assert.equal(await page.locator('.alliance-member').count(),3);await page.getByRole('button',{name:'Alle Mitglieder (6)',exact:true}).click();assert.equal(await page.locator('.alliance-member').count(),6);await page.getByText('MitgliedSechs · Mitglied',{exact:true}).waitFor();checks.push('Sechs echte Mitglieder: Übersicht zeigt kompakt drei; Alle Mitglieder öffnet vollständige Liste einschließlich sechstem Mitglied.');
 await area('Verwaltung');await page.getByLabel('Interne Mitteilung',{exact:true}).fill('Entwurf bleibt erhalten');await area('Chat');await area('Verwaltung');assert.equal(await page.getByLabel('Interne Mitteilung',{exact:true}).inputValue(),'Entwurf bleibt erhalten');await page.getByRole('button',{name:'Mitteilungsentwurf verwerfen',exact:true}).click();checks.push('Verwaltungsentwurf bleibt beim Bereichswechsel erhalten.');
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:900});for(const section of ['Übersicht','Mitglieder','Chat','Verwaltung','Entdecken']){await area(section);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width} ${section} overflow`);assert.equal(await page.getByRole('dialog').count(),0);}
 await area('Übersicht');await page.locator('.alliance-heading').scrollIntoViewIfNeeded();await page.screenshot({path:`${artifacts}/overview-${width}.png`});checks.push(`${width}px: alle fünf Bereiche ohne horizontalen Dokumentüberlauf und ohne unnötigen Dialog.`);}
 await area('Entdecken');await page.getByLabel('Bündnis suchen',{exact:true}).fill('Nordlicht');await page.locator('.alliance-directory-entry').click();assert.equal(await page.getByRole('navigation',{name:'Bündnisbereiche'}).getByRole('button',{name:'Übersicht',exact:true}).getAttribute('aria-pressed'),'true');checks.push('Eigenes bereits ausgewähltes Verzeichnisprofil öffnet wieder die Übersicht.');
 assert.deepEqual(errors,[]);await writeFile(`${artifacts}/overview-checks.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
