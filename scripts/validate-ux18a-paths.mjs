import { chromium } from "../work/browser/node_modules/playwright/index.mjs";
import { createGameServer } from "../apps/server/server.js";
import { parseConfiguration } from "../apps/server/config.js";
import {
  canonicalJSON,
  exposeCity,
  foundedCity,
} from "../packages/game-core/multicity.js";
import { randomFreeLocation, terrainAt } from "../packages/game-core/world.js";
import { normalizeGeneral } from "../packages/game-core/military.js";
import { mkdir, rm, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const artifacts = new URL("../work/ux18a-paths/", import.meta.url).pathname;
await rm(artifacts, { recursive: true, force: true });
await mkdir(artifacts, { recursive: true });
let now = 1000;
const config = parseConfiguration({
  WORLD_WIDTH: "8",
  WORLD_HEIGHT: "8",
  WORLD_NPC_COUNT: "1",
  UPKEEP_INFANTRY_PER_HOUR: "0",
  UPKEEP_SCOUT_PER_HOUR: "0",
  UPKEEP_TRUCK_PER_HOUR: "0",
  FIELD_DEFENDER_MIN: "5",
  FIELD_DEFENDER_MAX: "5",
});
const server = createGameServer({
  worldDir: `${artifacts}/world`,
  worldName: "ui-test",
  clock: () => now,
  config,
});
await server.ready;
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  }),
  page = await context.newPage();
const cdp = await context.newCDPSession(page);
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const pause = () => page.waitForTimeout(1150);
async function nav(name) {
  await page.waitForFunction(
    () =>
      Boolean(document.querySelector(".menu-toggle")) ===
      window.innerWidth < 1280,
  );
  if (await page.locator(".menu-toggle").isVisible()) {
    await page.locator(".menu-toggle").click();
    await page
      .locator("dialog[open]")
      .getByRole("button", { name: new RegExp("^" + name) })
      .click();
  } else
    await page
      .getByRole("navigation", { name: "Hauptnavigation" })
      .getByRole("button", { name: new RegExp("^" + name) })
      .click();
}
async function actions() {
  if (await page.locator(".workspace-heading button").isVisible())
    await page.locator(".workspace-heading button").click();
}
async function finish(type, phase) {
  await pause();
  const p = await server.storage.loadPlayer(senderId),
    m = p.military.missions.filter((m) => m.type === type).at(-1);
  assert.ok(m);
  now = m[phase];
  await server.storage.exclusive(() => server.storage.advanceWorld(now));
  await pause();
  return m;
}
async function switchCity(name) {
  await page
    .getByRole("button", { name: "Stadt wechseln", exact: true })
    .click();
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: new RegExp(`^${name} \\(`) })
    .click();
  if (
    await page
      .getByRole("button", { name: "Entwurf verwerfen und Stadt wechseln" })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Entwurf verwerfen und Stadt wechseln" })
      .click();
  await page.getByRole("heading", { name, level: 1, exact: true }).waitFor();
}
let senderId, secondId;
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByLabel("Kommandantenname").fill("UITester");
  await page
    .getByLabel("Passwort", { exact: true })
    .fill("ui-test-password-long");
  await page.getByLabel("Stadtname (nur Registrierung)").fill("Ausgangshafen");
  await page.getByRole("button", { name: "Registrieren", exact: true }).click();
  await page
    .getByRole("heading", { name: "Ausgangshafen", level: 1 })
    .waitFor();
  senderId = server.storage.accounts.accounts[0].playerId;
  let p = canonicalJSON(await server.storage.loadPlayer(senderId));
  const second = foundedCity("ui-second", "Zielhafen", now);
  secondId = second.id;
  p.cities.push(second);
  server.storage.world.map.entities.push({
    id: second.id,
    kind: "player",
    playerId: senderId,
    name: second.name,
    commanderName: p.commanderName,
    ...randomFreeLocation(server.storage.world.map, () => 0),
  });
  p.cities[0].resources = { wood: 5000, stone: 5000, food: 5000, oil: 5000 };
  second.resources = { wood: 0, stone: 0, food: 0, oil: 0 };
  p.cities[0].military.units = { infantry: 50, scout: 5, truck: 10 };
  Object.assign(p.cities[0].buildingSlots[3], {
    building: "university",
    buildingId: "ui-uni",
    level: 2,
  });
  Object.assign(p.cities[0].militarySlots[0], {
    building: "barracks",
    buildingId: "ui-barracks",
    level: 1,
  });
  p.cities[0].buildingSlots.find((s) => s.building === "farm").level = 2;
  await server.storage.commitPlayers([p], true);
  await pause();
  await page.getByRole("button", { name: "Aufgaben", exact: true }).click();
  await page.getByLabel("Belohnungszielstadt").selectOption(secondId);
  await page
    .getByRole("button", { name: /Belohnung abholen ·/ })
    .first()
    .click();
  await pause();
  let done = await server.storage.loadPlayer(senderId);
  assert.equal(done.cities[1].resources.food, 150);
  checks.push(
    "Aufgaben: sichtbare Zielstadt, ein Abholklick, einmalige volle Belohnung.",
  );
  await nav("Generäle");
  await page
    .getByRole("button", { name: /^Details ·/ })
    .first()
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Neue Führung");
  await page
    .getByRole("button", { name: "Namen speichern", exact: true })
    .click();
  await pause();
  assert.equal(
    (await server.storage.loadPlayer(senderId)).military.generals[0].name,
    "Neue Führung",
  );
  await page
    .getByRole("button", { name: "Rolle / Standort", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Zum Bürgermeister ernennen", exact: true })
    .click();
  await pause();
  assert.equal(
    (await server.storage.loadPlayer(senderId)).military.generals[0].status,
    "mayor",
  );
  await page
    .getByRole("button", { name: "Als Bürgermeister abberufen", exact: true })
    .click();
  await pause();
  await page
    .getByRole("button", { name: /^Als Forschungsleitung einsetzen/ })
    .click();
  await pause();
  assert.equal(
    (await server.storage.loadPlayer(senderId)).military.generals[0].status,
    "researcher",
  );
  await page
    .getByRole("button", { name: "Forschungsleitung freigeben", exact: true })
    .click();
  await pause();
  await page.keyboard.press("Escape");
  checks.push(
    "General: Umbenennen, Bürgermeister ernennen/abberufen, Forschungsleitung ernennen/freigeben.",
  );
  await page.getByRole("button", { name: "Rekrutieren", exact: true }).click();
  await page
    .getByRole("button", { name: /^Verpflichten ·/ })
    .first()
    .click();
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: /^Für.*Stein verpflichten/ })
    .click();
  await pause();
  assert.equal(
    (await server.storage.loadPlayer(senderId)).military.generals.length,
    2,
  );
  assert.equal(await page.locator("dialog[open]").count(), 0);
  checks.push(
    "Rekrutierung: Kandidat, automatischer Preis, ausdrücklicher Kauf, freiwilliger Generaldetail-Link.",
  );
  await nav("Stadt");
  await page.getByRole("button", { name: "Stadtansicht", exact: true }).click();
  const quarry = page.locator(".building-card.quarry");
  await quarry.getByText("Mehr", { exact: true }).click();
  await quarry.getByRole("button", { name: "Abreißen", exact: true }).click();
  await page
    .getByRole("button", { name: "Endgültig abreißen", exact: true })
    .click();
  await pause();
  assert.equal(
    (await server.storage.loadPlayer(senderId)).cities[0].buildingSlots.find(
      (s) => s.building === "quarry",
    ),
    undefined,
  );
  checks.push(
    "Abriss: Mehr → serverseitige Vorschau → eine endgültige Bestätigung.",
  );
  await nav("Weltkarte");
  const npc = server.storage.world.map.entities.find((e) => e.kind === "npc");
  await page.locator(".iso-tools > summary").click();
  await page
    .getByLabel("Koordinate", { exact: true })
    .fill(`${npc.x}, ${npc.y}`);
  await page.getByRole("button", { name: "Suchen", exact: true }).click();
  await page.waitForTimeout(700);
  await page
    .locator(`.iso-label[data-map-coordinate="${npc.x}:${npc.y}"]`)
    .focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /^Stadt ausspähen/ }).click();
  await page
    .getByRole("button", { name: "Öl bezahlen und starten", exact: true })
    .click();
  await finish("scout", "returnsAt");
  checks.push(
    "NPC-Aufklärung: Feld → planen → automatisch geprüft starten, drei Aktivierungen.",
  );
  await page.getByRole("button", { name: /^NPC angreifen/ }).click();
  await page.getByLabel("Infanterie", { exact: true }).fill("20");
  await page
    .getByRole("button", { name: "Öl bezahlen und starten", exact: true })
    .click();
  await finish("raid", "returnsAt");
  checks.push(
    "NPC-Farmzug: automatische Öl-/Kapazitätsvorschau, bewusster verlustträchtiger Start, Rückkehrbericht.",
  );
  let field;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      if (
        !field &&
        terrainAt(x, y, server.storage.world.map.seed) !== "water" &&
        !server.storage.world.map.entities.some((e) => e.x === x && e.y === y)
      )
        field = { x, y };
  await page
    .getByRole("button", { name: "Feldauswahl schließen", exact: true })
    .click();
  await page
    .getByLabel("Koordinate", { exact: true })
    .fill(`${field.x}, ${field.y}`);
  await page.getByRole("button", { name: "Suchen", exact: true }).click();
  await page.waitForTimeout(700);
  await page
    .locator(`.iso-ground[data-map-coordinate="${field.x}:${field.y}"]`)
    .focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /^Feld aufklären/ }).click();
  await page
    .getByRole("button", { name: "Aufklärung starten", exact: true })
    .click();
  await finish("field-scout", "returnsAt");
  await page.getByRole("button", { name: /^Feld erobern/ }).click();
  await page
    .getByRole("button", { name: "Eroberung starten", exact: true })
    .click();
  await finish("conquest", "arrivesAt");
  await page.getByRole("button", { name: /^Stadt gründen/ }).click();
  await page.getByLabel("Stadtname", { exact: true }).fill("Dritter Hafen");
  await page
    .getByRole("button", { name: "Gebühr bezahlen und gründen", exact: true })
    .click();
  await pause();
  assert.equal((await server.storage.loadPlayer(senderId)).cities.length, 3);
  checks.push(
    "Feldaufklärung → Rückkehr → Eroberung → Anspruch → Gründung, jeweils automatische Vorschau.",
  );
  await nav("Postbox");
  await page.getByRole("button", { name: /^Angriffe/ }).click();
  await page.locator(".mail-row").first().click();
  await page
    .getByRole("button", { name: "Auf Karte zeigen", exact: true })
    .click();
  await page.waitForTimeout(700);
  const camera = await page.locator(".iso-map-frame").evaluate((e) => ({
    x: Number(e.dataset.cameraX),
    y: Number(e.dataset.cameraY),
  }));
  const latest = (await server.storage.loadPlayer(senderId)).military.reports
    .filter((r) => ["raid", "conquest"].includes(r.type))
    .toSorted((a, b) => (b.returnedAt ?? 0) - (a.returnedAt ?? 0))[0];
  assert.deepEqual(camera, latest.coordinates);
  await nav("Postbox");
  assert.equal(
    await page
      .getByRole("button", { name: /^Angriffe/ })
      .getAttribute("aria-pressed"),
    "true",
  );
  checks.push("Bericht → aktuelles Ziel auf Karte, Koordinaten übernommen.");
  assert.deepEqual(errors, []);
  await writeFile(
    `${artifacts}/checks.json`,
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (e) {
  await page.screenshot({ path: `${artifacts}/failure.png`, fullPage: true });
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
