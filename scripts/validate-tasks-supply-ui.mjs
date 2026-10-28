const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ??
    '../work/browser/node_modules/playwright/index.mjs'
);
import { createGameServer } from '../apps/server/server.js';
import { canonicalJSON, foundedCity } from '../packages/game-core/multicity.js';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir = new URL('../work/tasks-ui/', import.meta.url).pathname;
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });
let now = 1000000;
const server = createGameServer({
  worldDir: dir + 'world',
  worldName: 'tasks-ui',
  clock: () => now,
});
await server.ready;
const { player } = await server.storage.register(
  'TaskBrowser',
  'browser-test-password',
);
const p = canonicalJSON(player),
  source = p.cities[0],
  target = foundedCity('hungry-harbor', 'Hungerhafen', now);
p.cities.push(target);
source.name = 'Versorgungsstadt';
source.resources = { wood: 1200, stone: 1200, food: 1000, oil: 1000 };
source.military.units.truck = 2;
Object.assign(source.buildingSlots[3], {
  building: 'warehouse',
  level: 1,
  buildingId: 'warehouse-ui',
});
target.resources = { wood: 2000, stone: 2000, food: 0, oil: 0 };
target.military.units.infantry = 30;
target.buildingSlots.forEach((s) => {
  s.building = null;
  s.level = 0;
});
Object.assign(
  server.storage.world.map.entities.find((e) => e.id === source.id),
  { name: source.name, x: 0, y: 0 },
);
server.storage.world.map.entities.push({
  id: target.id,
  kind: 'player',
  playerId: p.playerId,
  name: target.name,
  commanderName: p.commanderName,
  x: 1,
  y: 0,
});
await server.storage.commitPlayers([p], true);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
await context.addInitScript(() => {
  const Native = window.WebSocket;
  window.__sockets = [];
  window.WebSocket = class extends Native {
    constructor(...args) {
      super(...args);
      window.__sockets.push(this);
    }
  };
});
const page = await context.newPage(),
  errors = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
async function login(pg) {
  await pg.goto(`http://127.0.0.1:${server.address().port}`);
  await pg.getByLabel('Kommandantenname').fill('TaskBrowser');
  await pg
    .getByLabel('Passwort', { exact: true })
    .fill('browser-test-password');
  await pg.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await pg
    .getByRole('button', { name: 'Stadt wechseln', exact: true })
    .waitFor();
}
async function nav(label) {
  await page.waitForFunction(
    () => Boolean(document.querySelector('.menu-toggle')) === innerWidth < 1280,
  );
  if (await page.locator('.menu-toggle').isVisible())
    await page.locator('.menu-toggle').click();
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('button', { name: label, exact: true })
    .click();
}
async function tab(name) {
  await page
    .getByRole('navigation', { name: 'Stadtansichten' })
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .click();
}
try {
  await login(page);
  assert.equal(
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('button')
      .count(),
    7,
  );
  await page.locator('.plot.farm').click();
  await page.getByRole('button', { name: /^Auf Stufe 2 ausbauen/ }).click();
  await page.locator('.plot.farm.building').waitFor();
  let current = await server.storage.loadPlayer(p.playerId);
  now = current.city.constructionQueue[0].finishesAt;
  await server.storage.exclusive(() => server.storage.advanceWorld(now));
  await tab('Aufgaben');
  await page
    .getByRole('button', {
      name: 'Belohnung abholen · Bauernhof Stufe 2',
      exact: true,
    })
    .waitFor();
  await page.screenshot({ path: dir + 'desktop-tasks.png', fullPage: true });
  const second = await context.newPage();
  await second.goto(`http://127.0.0.1:${server.address().port}`);
  await second
    .getByRole('button', { name: 'Stadt wechseln', exact: true })
    .waitFor();
  await second
    .getByRole('navigation', { name: 'Stadtansichten' })
    .getByRole('button', { name: /^Aufgaben/ })
    .click();
  await page
    .getByRole('button', {
      name: 'Belohnung abholen · Bauernhof Stufe 2',
      exact: true,
    })
    .click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Zielstadt').selectOption(target.id);
  await dialog
    .getByRole('button', { name: 'Vollständige Belohnung abholen' })
    .click();
  await dialog.getByRole('alert').filter({ hasText: 'Lagerplatz' }).waitFor();
  assert.equal(
    (await server.storage.loadPlayer(p.playerId)).tasks.completed['intro.farm']
      .claim,
    undefined,
  );
  await dialog.getByLabel('Zielstadt').selectOption(source.id);
  await dialog
    .getByRole('button', { name: 'Vollständige Belohnung abholen' })
    .click();
  await dialog.waitFor({ state: 'detached' });
  await second.getByText('Abgeholte Aufgaben (1)', { exact: true }).waitFor();
  await page.getByText('Abgeholte Aufgaben (1)', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByText(/Abgeholt in Versorgungsstadt/).waitFor();
  checks.push(
    'Desktop: Bauernhof über vorhandene UI ausgebaut, Aufgabe durch Serverabschluss erfüllt; volle Zielstadt lehnt vollständig ab, andere eigene Stadt erhält Belohnung; zweiter Tab übernimmt Abholung.',
  );
  await tab('Alle Städte');
  await page
    .getByRole('row')
    .filter({ hasText: 'Versorgungsstadt' })
    .getByRole('button', { name: 'Bauernhof ausbauen', exact: true })
    .click();
  await page.getByRole('button', { name: /^Auf Stufe 3 ausbauen/ }).waitFor();
  assert.equal(
    (await server.storage.loadPlayer(p.playerId)).city.constructionQueue.length,
    0,
  );
  checks.push(
    'Bauernhofhilfe öffnet die vorhandene Ausbauaktion in der richtigen Stadt, ohne einen Bauauftrag abzusenden.',
  );
  await tab('Alle Städte');
  const hungry = page.getByRole('row').filter({ hasText: 'Hungerhafen' });
  await hungry.getByText('⚠ Mangel mit Schonfrist', { exact: true }).waitFor();
  await page.screenshot({ path: dir + 'desktop-overview.png', fullPage: true });
  await hungry
    .getByRole('button', { name: 'Nahrung liefern', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Andere eigene Ausgangsstadt')
    .selectOption(source.id);
  await dialog
    .getByRole('button', { name: 'Vorhandenes Formular öffnen' })
    .click();
  await page.getByLabel('Zielstadt', { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel('Zielstadt', { exact: true }).inputValue(),
    target.id,
  );
  assert.equal(
    await page.getByLabel('Nahrung laden', { exact: true }).inputValue(),
    '0',
  );
  assert.equal(await page.getByLabel(/LKW \(/).inputValue(), '0');
  assert.equal(
    (await server.storage.loadPlayer(p.playerId)).military.missions.length,
    0,
  );
  checks.push(
    'Gefährdete Stadt bleibt trotz Überschuss der Quelle im Mangel; Lieferhilfe verlangt ausdrückliche andere Quelle, setzt nur Ziel und wählt keine Güter/Truppen oder Sendung.',
  );
  await page.getByLabel('Nahrung laden', { exact: true }).fill('10');
  await page
    .getByRole('button', { name: 'Stadt wechseln', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Hungerhafen \(/ })
    .click();
  await page
    .getByRole('button', {
      name: 'Entwurf verwerfen und Stadt wechseln',
      exact: true,
    })
    .click();
  await page.getByRole('heading', { name: 'Logistik · Hungerhafen' }).waitFor();
  assert.equal(
    await page.getByLabel('Zielstadt', { exact: true }).inputValue(),
    '',
  );
  await nav('Stadt');
  await tab('Alle Städte');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(180);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: dir + `mobile-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole('row')
      .filter({ hasText: 'Hungerhafen' })
      .getByRole('button', { name: 'Nahrung liefern', exact: true })
      .click();
    dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent),
      'Nahrung liefern',
    );
    await tab('Aufgaben');
    await page
      .getByRole('button', {
        name: 'Belohnung abholen · Lagerhaus errichten',
        exact: true,
      })
      .click();
    dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert.equal(await dialog.getByLabel('Zielstadt').inputValue(), target.id);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    await tab('Alle Städte');
  }
  checks.push(
    '390 und 320 px: lesbare Versorgungskarten ohne horizontalen Überlauf; Aufgaben-Abholdialog startet in aktuell gewählter Stadt; Escape und Fokusrückgabe geprüft. Ungesendete Eingaben werden beim Stadtwechsel verworfen.',
  );
  await context.setOffline(true);
  await page.evaluate(() => window.__sockets.at(-1).close());
  await page.getByText(/Stand veraltet vom/).waitFor();
  await tab('Aufgaben');
  assert.equal(
    await page
      .getByRole('button', {
        name: 'Belohnung abholen · Lagerhaus errichten',
        exact: true,
      })
      .isDisabled(),
    true,
  );
  await context.setOffline(false);
  await page
    .getByText(/Stand veraltet vom/)
    .waitFor({ state: 'detached', timeout: 20000 });
  await page.reload();
  await page
    .getByRole('button', { name: 'Stadt wechseln', exact: true })
    .waitFor();
  await tab('Aufgaben');
  await page.getByText('Abgeholte Aufgaben (1)', { exact: true }).waitFor();
  checks.push(
    'Verbindungsabbruch zeigt Zeitstempel und sperrt Auszahlung; Resume/Reload übernimmt gespeicherten Aufgabenstand, ohne neue Auszahlung.',
  );
  await nav('Weltkarte');
  await page.locator('.iso-map-frame').waitFor();
  await page
    .getByRole('button', { name: 'Karte nach Süden', exact: true })
    .click();
  await page.screenshot({ path: dir + 'mobile-map.png', fullPage: true });
  checks.push(
    'Weltkarte und Windrose bleiben unabhängig von Stadt-Unteransichten bedienbar.',
  );
  assert.deepEqual(errors, []);
  await writeFile(
    dir + 'checks.json',
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (e) {
  await page.screenshot({ path: dir + 'failure.png', fullPage: true });
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
