import { enqueueConstruction } from "../packages/game-core/index.js";
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
const artifacts = new URL("../work/ux18a/", import.meta.url).pathname;
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
await context.addInitScript(() => {
  const Native = window.WebSocket;
  window.__sockets = [];
  window.__held = [];
  window.__commands = [];
  window.__holdPreviews = false;
  window.WebSocket = class extends Native {
    constructor(...args) {
      super(...args);
      window.__sockets.push(this);
    }
    send(raw) {
      const m = JSON.parse(raw);
      if (!m.type.startsWith("auth."))
        window.__commands.push({
          type: m.type,
          requestId: m.requestId,
          payload: m.payload,
        });
      return super.send(raw);
    }
    addEventListener(type, listener, options) {
      if (type !== "message")
        return super.addEventListener(type, listener, options);
      return super.addEventListener(
        type,
        (event) => {
          const m = JSON.parse(event.data),
            deliver = () => listener.call(this, event);
          if (window.__holdPreviews && m.type.endsWith(".preview"))
            window.__held.push({ type: m.type, deliver });
          else deliver();
        },
        options,
      );
    }
  };
});
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
  for (let i = 1; i < 5; i++) {
    const c = foundedCity(`ux-city-${i}`, `Stadt ${i} mit langem Namen`, now);
    p.cities.push(c);
    server.storage.world.map.entities.push({
      id: c.id,
      kind: "player",
      playerId: senderId,
      name: c.name,
      commanderName: p.commanderName,
      ...randomFreeLocation(server.storage.world.map, () => 0),
    });
  }
  secondId = p.cities[1].id;
  for (const c of p.cities)
    c.resources = { wood: 5000, stone: 5000, food: 5000, oil: 5000 };
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
  p.military.generals[0].experience = 100;
  p.military.generals.push(
    normalizeGeneral({
      ...p.military.generals[0],
      id: "ui-general-two",
      name: "General Zwei",
    }),
  );
  p.military.acquiredCount = 2;
  await server.storage.commitPlayers([p], true);
  await pause();
  const recipient = (
    await server.storage.register(
      "UIReceiver",
      "ui-test-password-long",
      "Empfängerhafen",
    )
  ).player;
  await pause();
  const first = page.locator(".building-card").first();
  await first
    .getByRole("button", { name: "Ausbauen · Stufe 2", exact: true })
    .click();
  await pause();
  assert.equal(
    (await server.storage.loadPlayer(senderId)).cities[0].constructionQueue
      .length,
    1,
  );
  checks.push("Ausbau: 1 Klick auf sichtbarer Kachel, Preis vorher sichtbar.");
  const empty = page.locator(".building-card.empty").first();
  await empty.getByRole("button", { name: "Bauen", exact: true }).click();
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: /Bauen · Lagerhaus/ })
    .click();
  await pause();
  assert.equal(
    (await server.storage.loadPlayer(senderId)).cities[0].constructionQueue
      .length,
    2,
  );
  checks.push("Neubau: 2 Klicks einschließlich Baukatalog.");
  await nav("Militär");
  await page
    .locator(".building-card.barracks")
    .getByRole("button", { name: "Ausbilden", exact: true })
    .click();
  await page.getByLabel("Einheit", { exact: true }).selectOption("infantry");
  await page.getByLabel("Anzahl", { exact: true }).fill("10");
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "Ausbilden", exact: true })
    .click();
  await pause();
  assert.equal(
    (await server.storage.loadPlayer(senderId)).cities[0].military
      .trainingQueue[0].amount,
    10,
  );
  checks.push(
    "Ausbildung: Kaserne → automatisches Angebot → Start, 2 Klicks plus Einheit/Menge.",
  );
  await page
    .locator(".building-card.barracks")
    .getByRole("button", { name: "Alle Aufträge", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Aktivitätsfilter").inputValue(),
    "training",
  );
  assert.equal(
    await page.getByLabel("Gebäudefilter").inputValue(),
    "military-plot-1",
  );
  await page.keyboard.press("Escape");
  checks.push(
    "Gebäude → Alle Aufträge öffnet die vollständige Liste mit richtigem Stadt-/Gebäudefilter.",
  );
  await nav("Forschung");
  await page
    .locator(".research-card")
    .filter({
      has: page.getByRole("heading", { name: "Forstwirtschaft", exact: true }),
    })
    .getByRole("button", { name: /^Forschen/ })
    .click();
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "Kosten bezahlen und starten", exact: true })
    .click();
  await pause();
  assert.ok((await server.storage.loadPlayer(senderId)).research.active);
  checks.push("Forschung: 2 Klicks, automatische Vorschau ohne Panel.");
  await nav("Logistik");
  await page.evaluate(() => (window.__holdPreviews = true));
  await page
    .getByLabel("Zielstadt", { exact: true })
    .selectOption(recipient.cityId);
  await page.getByLabel("Holz laden", { exact: true }).fill("10");
  await page.waitForFunction(() => window.__held.length === 1);
  await page.getByLabel("Holz laden", { exact: true }).fill("20");
  await page.waitForFunction(() => window.__held.length === 2);
  await page.evaluate(() => window.__held.shift().deliver());
  assert.equal(
    await page
      .getByRole("button", { name: "Lieferung starten", exact: true })
      .isDisabled(),
    true,
  );
  await page.evaluate(() => {
    window.__holdPreviews = false;
    window.__held.shift().deliver();
  });
  await page
    .getByRole("button", { name: "Lieferung starten", exact: true })
    .waitFor({ state: "visible" });
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent === "Lieferung starten",
      ).disabled,
  );
  checks.push(
    "Vertauschte Vorschauantworten: A gibt den geänderten Entwurf B nicht frei.",
  );
  await page.evaluate(() => (window.__holdPreviews = true));
  await page.getByLabel("Holz laden", { exact: true }).fill("30");
  await page.waitForFunction(() => window.__held.length === 1);
  await page.getByLabel("Holz laden", { exact: true }).fill("40");
  await page.waitForFunction(() => window.__held.length === 2);
  await page.evaluate(() => window.__held.pop().deliver());
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent === "Lieferung starten",
      ).disabled,
  );
  assert.ok(
    (await page.locator(".logistics-form .notice").innerText()).includes(
      "Eigene Ladung 40",
    ),
  );
  await page.evaluate(() => window.__held.shift().deliver());
  assert.ok(
    (await page.locator(".logistics-form .notice").innerText()).includes(
      "Eigene Ladung 40",
    ),
  );
  checks.push(
    "Tatsächlich umgekehrte Antwortreihenfolge D vor C: die späte C-Antwort überschreibt D nicht.",
  );
  await page.getByLabel("Holz laden", { exact: true }).fill("50");
  await page.waitForFunction(() => window.__held.length === 1);
  await page
    .getByLabel("Ausgangsstadt", { exact: true })
    .selectOption(secondId);
  await page.getByRole("button", { name: "Bleiben", exact: true }).click();
  assert.equal(
    await page.getByLabel("Ausgangsstadt", { exact: true }).inputValue(),
    p.cities[0].id,
  );
  checks.push(
    "Quellenwechsel mit Entwurf: vor dem Wechsel entscheiden; Bleiben erhält Quelle und Eingaben.",
  );
  await nav("Stadt");
  await page
    .getByRole("button", {
      name: "Entwurf verwerfen und wechseln",
      exact: true,
    })
    .click();
  await page.evaluate(() => {
    window.__holdPreviews = false;
    window.__held.shift().deliver();
  });
  assert.equal(await page.getByLabel("Holz laden", { exact: true }).count(), 0);
  checks.push(
    "Späte Antwort nach geschlossenem Formular öffnet es nicht erneut.",
  );
  await nav("Logistik");
  await page
    .getByLabel("Zielstadt", { exact: true })
    .selectOption(recipient.cityId);
  await page.getByLabel(/^LKW \(/).fill("5");
  await page.getByLabel("Holz laden", { exact: true }).fill("300");
  await page
    .getByRole("button", { name: "Lieferung starten", exact: true })
    .click();
  await finish("delivery", "returnsAt");
  let done = await server.storage.loadPlayer(senderId);
  assert.equal(done.military.reports.at(-1).delivered.wood, 300);
  checks.push(
    "Generalfreie Fremdlieferung: 1 Startklick nach automatischer Vorschau, Bericht und Rückfahrt.",
  );
  await page
    .getByRole("button", { name: "Truppen & Generäle verlegen", exact: true })
    .click();
  await page.getByLabel("Zielstadt", { exact: true }).selectOption(secondId);
  await page.getByLabel(/^Infanterie \(/).fill("10");
  await page
    .getByRole("checkbox", { name: "General Zwei", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Verlegung starten", exact: true })
    .click();
  await finish("transfer", "arrivesAt");
  done = await server.storage.loadPlayer(senderId);
  assert.equal(done.cities[1].military.units.infantry, 10);
  assert.equal(done.military.generals[1].cityId, secondId);
  checks.push(
    "Permanente Verlegung: 1 Startklick, richtige Stadt und Generalstandort.",
  );
  await nav("Generäle");
  await page
    .getByRole("button", { name: /^Entwickeln/ })
    .first()
    .click();
  await page.getByRole("button", { name: /^Für .* XP kaufen/ }).click();
  await pause();
  assert.equal(
    (await server.storage.loadPlayer(senderId)).military.generals[0].skills
      .totalPoints,
    1,
  );
  await page.getByLabel("Angriff verteilen", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Unwiderruflich verteilen", exact: true })
    .click();
  await pause();
  assert.equal(
    (await server.storage.loadPlayer(senderId)).military.generals[0].skills
      .allocations.attack,
    1,
  );
  await page.keyboard.press("Escape");
  checks.push(
    "XP-Kauf und getrennte irreversible Verteilung: automatische Angebote und direkte Eingabe.",
  );
  await nav("Postbox");
  await page
    .getByRole("button", { name: "Nachricht schreiben", exact: true })
    .click();
  await page.getByLabel("Empfänger (Kommandantenname)").fill("UIReceiver");
  await page.getByLabel("Betreff", { exact: true }).fill("Test");
  await page
    .getByLabel("Nachricht", { exact: true })
    .fill("Bewusste Nachricht");
  await nav("Stadt");
  await page.getByRole("button", { name: "Bleiben", exact: true }).click();
  assert.equal(
    await page.getByLabel("Nachricht", { exact: true }).inputValue(),
    "Bewusste Nachricht",
  );
  await page.getByRole("button", { name: "Senden", exact: true }).click();
  await pause();
  checks.push(
    "Nachrichtenentwurf bei Navigation geschützt, Bleiben erhält Text, explizites Senden.",
  );
  const activityPlayer = canonicalJSON(
    await server.storage.loadPlayer(senderId),
  );
  for (const c of activityPlayer.cities.slice(1)) {
    Object.assign(
      c,
      enqueueConstruction(
        c,
        {
          id: `activity-${c.id}`,
          slotId: c.buildingSlots[0].id,
          building: c.buildingSlots[0].building,
        },
        now,
        config.research,
      ),
    );
  }
  await server.storage.commitPlayers([activityPlayer], true);
  await pause();
  await page.getByRole("button", { name: "Aktivitäten", exact: true }).click();
  await page.getByLabel("Aktivitätsfilter").selectOption("build");
  assert.ok((await page.locator("dialog[open] article").count()) >= 4);
  await page.locator("dialog[open] article").nth(3).scrollIntoViewIfNeeded();
  assert.ok(await page.locator("dialog[open] article").nth(3).isVisible());
  await page.keyboard.press("Escape");
  checks.push(
    "Vier stadtübergreifende Bauaufträge: vierter Eintrag tatsächlich erreichbar, keine Dreierkürzung.",
  );
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const name of [
      "Stadt",
      "Militär",
      "Logistik",
      "Generäle",
      "Forschung",
      "Postbox",
      "Weltkarte",
    ]) {
      await nav(name);
      await page.waitForTimeout(120);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${name} ${viewport.width}`,
      );
    }
    await page.screenshot({ path: `${artifacts}/map-${viewport.width}.png` });
    await nav("Stadt");
    await page.screenshot({ path: `${artifacts}/city-${viewport.width}.png` });
    checks.push(
      `${viewport.width}×${viewport.height}: sieben Bereiche ohne horizontalen Dokumentüberlauf.`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await nav("Weltkarte");
  await page.locator(".iso-ground").first().focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  assert.ok(await page.getByLabel("Ausgewähltes Feld").isVisible());
  await page.getByRole("button", { name: "Aktivitäten", exact: true }).click();
  await page.getByLabel("Aktivitätsfilter").selectOption("travel");
  await page.keyboard.press("Escape");
  await nav("Postbox");
  await page.getByLabel("Suchen", { exact: true }).fill("Filter");
  await nav("Stadt");
  assert.equal(
    await page
      .getByRole("button", {
        name: "Entwurf verwerfen und wechseln",
        exact: true,
      })
      .count(),
    0,
  );
  checks.push(
    "Suche ist kein Spielentwurf und erzeugt keine Verwerfen-Warnung.",
  );
  await page.getByRole("button", { name: "Alle Städte", exact: true }).click();
  const hungry = page.locator(".overview-row").nth(1);
  await hungry
    .getByRole("button", { name: "Truppen von hier verlegen", exact: true })
    .click();
  await pause();
  assert.equal(
    await page.getByLabel("Ausgangsstadt", { exact: true }).inputValue(),
    secondId,
  );
  assert.equal(
    await page.getByLabel("Zielstadt", { exact: true }).inputValue(),
    "",
  );
  checks.push(
    "Versorgungshilfe setzt Verlegequelle auf die betroffene Stadt, kein automatischer Start.",
  );
  const beforeSocket = await page.evaluate(
    () => window.__commands.filter((c) => c.type.endsWith(".start")).length,
  );
  await page.evaluate(() => window.__sockets.at(-1).close());
  await page.getByText(/Stand veraltet vom/).waitFor();
  await page.waitForTimeout(2000);
  assert.equal(
    await page.evaluate(
      () => window.__commands.filter((c) => c.type.endsWith(".start")).length,
    ),
    beforeSocket,
  );
  checks.push(
    "Reconnect behält lesbare Oberfläche, kein blinder Neustart einer Mutation.",
  );
  const tab = await context.newPage();
  await tab.goto(`http://127.0.0.1:${server.address().port}`);
  await tab.getByRole("heading", { name: "Ausgangshafen", level: 1 }).waitFor();
  assert.ok(
    await page
      .getByRole("heading", { name: "Stadt 1 mit langem Namen", level: 1 })
      .isVisible(),
  );
  await tab.close();
  checks.push("Zwei Tabs behalten unabhängige Ausgangsstädte.");
  await page.setViewportSize({ width: 640, height: 400 });
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 640,
    height: 400,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await nav("Forschung");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.locator(".menu-toggle").focus();
  await page.keyboard.press("Enter");
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "Stadt", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Aktivitäten", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  assert.ok(
    await page
      .locator("dialog[open]")
      .evaluate((el) => el.contains(document.activeElement)),
  );
  await page.keyboard.press("Escape");
  checks.push(
    "200%-Arbeitsfläche (640 CSS-Pixel), Enter/Tab/Escape und Fokus im Dialog.",
  );
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  await page.setViewportSize({ width: 320, height: 844 });
  await nav("Weltkarte");
  await page.locator(".iso-ground").first().focus();
  await page.keyboard.press("Enter");
  const beforeCamera = await page
    .locator(".iso-map-frame")
    .getAttribute("data-camera-x");
  await page.screenshot({ path: `${artifacts}/map-selection-320.png` });
  const overlap = await page.evaluate(() => {
    const a = document.querySelector(".map-sidebar").getBoundingClientRect(),
      b = document.querySelector(".iso-compass").getBoundingClientRect();
    return (
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top
    );
  });
  assert.equal(overlap, false);
  await page
    .getByRole("button", { name: "Feldauswahl schließen", exact: true })
    .click();
  assert.equal(
    await page.locator(".iso-map-frame").getAttribute("data-camera-x"),
    beforeCamera,
  );
  await page.getByRole("button", { name: "Ressourcen", exact: true }).click();
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: /Holz/ })
    .click();
  assert.equal(await page.locator("dialog[open]").count(), 1);
  await page.keyboard.press("Escape");
  checks.push(
    "320px: Feldkarte und Windrose überlappen nicht; Schließen erhält Kamera. Ressourcendetails wechseln in einer Dialogebene.",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await nav("Stadt");
  await page.getByRole("button", { name: "Abmelden", exact: true }).click();
  await page.getByLabel("Kommandantenname").fill("UIReceiver");
  await page
    .getByLabel("Passwort", { exact: true })
    .fill("ui-test-password-long");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page
    .getByRole("heading", { name: "Empfängerhafen", level: 1, exact: true })
    .waitFor();
  await nav("Logistik");
  assert.equal(
    await page.getByLabel("Zielstadt", { exact: true }).inputValue(),
    "",
  );
  assert.equal(
    await page.getByLabel("Holz laden", { exact: true }).inputValue(),
    "0",
  );
  checks.push(
    "Abmelden/anderes Konto anmelden: private Ansichten und Entwürfe werden vollständig neu angelegt.",
  );
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
