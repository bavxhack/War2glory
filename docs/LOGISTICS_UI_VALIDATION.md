# Auftrag 16 – Logistik, Standorte und Bedienbarkeit

Geprüft am 12.10.2026 auf Basis von main `4532d10`, Node.js 24.19.0. Alle Balancewerte sind vorläufige Projektentscheidungen. Keine produktiven Spielstände, kein Merge oder Deployment.

## Ausgeführte Prüfungen

| Befehl | Ergebnis |
| --- | --- |
| `npm test` | 215 Tests bestanden, 0 fehlgeschlagen |
| `node --test --test-reporter=spec test/city-logistics.test.js` | 29 gezielte Logistik-/Migrations-/Journal-/Socketprüfungen bestanden |
| `npm run build` | Vite-Produktionsbuild bestanden |
| `node scripts/validate-logistics-ui.mjs` | Reale Chromium-Bedienwege mit WebSocket-Testserver bestanden; keine Browser-JavaScriptfehler |
| `git diff --check` | Keine Whitespacefehler |

Die Umgebung benötigt Netzwerk-/Socketfreigabe für Git, WebSocket-Integration und Chromium. Browserabhängigkeit wurde mit `npm install --prefix work/browser --cache /workspace/War2glory/work/npm-cache --no-audit --no-fund playwright` installiert. Die isolierte Testwelt, ursprüngliche Screenshots und `checks.json` liegen unter ignoriertem `work/logistics-ui/`; kein `data/`-Bestand wurde verwendet.

## Buchungen und Wiederherstellung

- Generalfreie Lieferung funktioniert auch bei anderweitig gebundenen Generälen. Optionaler General bleibt reserviert und wird erst zuhause frei. Nur LKWs reisen, keine XP/Punkte.
- Voll-, Teil- und Nullannahme aller vier Güter, freiwillige Ölladung getrennt von Betriebsöl. Das Beispiel 5 LKW/Distanz 10/600 Holz/300 Nahrung bezahlt 100 Öl, stellt 250 Holz/200 Nahrung zu und führt 350 Holz/100 Nahrung zurück. Heimatüberlauf wird separat ausgewiesen. Zielannahme ganzzahlig; zuhause bleiben die bisherigen auch gebrochenen Lagerplatzregeln erhalten.
- Eigene Lieferung verändert beide Städte aus derselben kanonischen Spielerkopie und erzeugt einen Bericht. Fremdlieferung erzeugt getrennte, auf Empfängerseite reduzierte Berichte. Ankündigungen enthalten nur Absender, Ziel, Ankunft und Ladung; keine Armee, Generalfähigkeiten oder fremden Lagerbestände.
- Permanente Infanterie-, Späher-, gemischte und General-only-Verlegung: Einwegöl einmalig, kein Rückweg, stationierter Zielbestand genau einmal. Mehrere Generäle bleiben dieselben IDs. Einweg-Rundung erfolgt einmal; exakte Typanteile in Milliöl bleiben im zugehörigen Frachtraum/Tank, Rundungsrest zuerst im normalen Raum, dann im Spähertank. Reine Generalreise nutzt ausschließlich die eigenen Diensttransport-Tanks.
- Ungültige Städte/Weltidentitäten, gleiche Quelle/Ziel, fremde Verlegeziele, fehlende Truppen, doppelte/fremde/anderswo stationierte Generäle, Zusatzverzögerung und manipulierte Vorschau werden abgewiesen. Persistierte requestId-Belege deduplizieren auch nach Abschluss; anderer Inhalt mit gleicher ID wird abgelehnt.
- Offline-Großschritt und feine Ereignisschritte liefern denselben Empfängerzustand. Vor Ankunft fällige Hungerwellen werden nicht rückwirkend verhindert; Nahrung exakt an der Hungergrenze wird vor der dortigen Verlustprüfung zugestellt. Zielunterhalt beginnt erst bei Stationierung.
- Zwei gleichzeitige Lieferungen teilen freie Zielkapazität ohne Überfüllung. Journal-, Senderdatei-, Empfängerdatei- und Commitzustände mit noch nicht übernommenen Spielerdateien wurden wiederhergestellt. Eigene Lieferung an Ankunft/Rückkehr sowie Truppen-/Generalstationierung nach fehlgeschlagenem Spielerdatei-Rename bleiben einmalig.
- Fehlendes Verlegeziel stoppt die Verarbeitung kontrolliert, ohne Gratisrückweg oder Vernichtung. Ungültiges Lieferziel führt die gesamte Ladung zurück. Technische Fehler bleiben Journal-Recoveryfälle.

## Migration und Regression

Spielerschema 16 → 17 ist idempotent. Bürgermeister folgt seiner Stadt; aktive Forschungsleitung folgt der Forschungsstadt; historische Missionsgeneräle folgen originCityId. Eine eindeutige Universität behält eine unbeschäftigte Forschungsleitung. Bei unklarer Zuordnung wird das Amt ohne Kosten/Verlust freigegeben und sichtbar neu zugewiesen. Widersprüchliche Rollen stoppen mit kontrollierter Migrationsmeldung.

Ältere Migrationsketten laufen weiter. Alte Missionsfracht, Termine und bezahltes Öl werden nicht neu berechnet. Städte, Queues, Forschung, Bewerberkosten, Porträts, Punkte, fünf-Städte-Grenze und Feldansprüche bleiben erhalten. Alte Schema-Assertions/Fixtures wurden auf 17 und tatsächliche Bürgermeisterstandorte angepasst; die vorhandenen NPC-/Eroberungs-/Versorgungs-/Forschungs-/Postbox-Tests bestehen.

## Reale Browserwege

Chromium unter `/usr/bin/chromium`, isolierter Server mit Testuhr. Die geprüften Wege verwenden die gerenderte Anwendung und echte Socketbefehle:

1. Stadt → Grundstück → Ausbau; Hauptnavigation und Aktionsstart ohne Dokument-Scroll bei 1366×768.
2. Fremdlieferung ohne General → Zustellung/Rückfahrt → Bericht.
3. Eigene Infanterie samt General verlegen → Zielbestand/Standort; keine Rückkehr.
4. Generäle → XP-Kauf → Escape mit Fokus zurück zur General-Karte.
5. Forschung → Technologie/Vorschau → bezahlen und starten.
6. Postbox → Logistikbericht → Stationierungszeit statt Rückkehr.
7. Ungesendeten Logistikentwurf beim Stadtwechsel bestätigen/verwerfen; neue Stadt erhält leeres Formular statt alter Vorschau.
8. Freies Feld → Aufklären → Rückkehrbericht → Erobern → Anspruch → Gebührenzahlung → dritte Stadt.
9. Bei 390×844, 320×844 und 683×384 alle sieben Seiten über das sichtbare Menü, Aktionen/Versorgung als Dialog, Escape/Fokusrückgabe, kein horizontaler Dokumentüberlauf. 683 CSS-Pixel mit CDP-Geräteskalierung 2 emulieren den verfügbaren Arbeitsbereich bei 200 % Zoom auf 1366 Pixeln; kein manueller Browserleisten-Zoom behauptet.
10. Langer Stadtname mobil; Navigation mit Enter, Tab im Aktionsdialog, Escape/Fokusrückgabe.
11. Bei 390 Pixeln eigene generalfreie Lieferung und reine Späherverlegung; bei 320 Pixeln General-only-Verlegung ohne LKW.
12. Zwei Tabs behalten unabhängige Stadtauswahl; Reload nimmt die gespeicherte Auswahl wieder auf.

Schneller Stadtwechsel deckte eine leere Karte durch gedrosselte separate viewport-Anfragen auf. city.sync liefert jetzt auch die passende map.snapshot; der Sockettest prüft wiederholte Wechsel bei derselben Testzeit. Lange Aktivitätslisten stehen in einem eigenen Tab, höchstens drei Einträge pro Kategorie plus fachliche Weiterleitung.

## Funktionszuordnung und Screenshots

| Funktion | Heimat |
| --- | --- |
| Ziviler Bau/Abriss und lokale Bauqueue | Stadt / Aktionen und Aktivitäten |
| Militärbauplätze, Ausbildung, Truppen | Militär |
| NPC-/Feldaufklärung, Raid, Eroberung, Gründung | Weltkarte / Feldaktionen und bisherige Modals |
| Lieferung und Verlegung | Logistik, getrennte Modi |
| Rekrutierung, Standort, Bürgermeister, Skills | Generäle / Eigenschaften und Rekrutierung |
| Forschung und Forschungsleitung | Forschung |
| Berichte, Lesestatus, Nachrichten | Postbox, neuer Logistikordner |
| Unterhalt/Hunger und Lagerdetails | Versorgungstab / Ressourcendialog; Hunger zusätzlich im Stadtkopf |

[Desktop Stadt](screenshots/task16/desktop-city.png) · [Desktop Logistik](screenshots/task16/desktop-logistics.png) · [Mobiler langer Stadtname](screenshots/task16/mobile-long-name.png) · [320-Pixel-Ansicht](screenshots/task16/mobile-320.png).

Grenzen: Der JSON-Prototyp bleibt ein einzelner Serverprozess je Welt. Kein echter Geräte-/Screenreader-Test und keine Android-/iOS-Bildschirmtastatur. Der Browserdurchlauf verwendet eine Testuhr und vorgefüllte Testbestände; Reiseereignisse, Buchungen und Bedienwege laufen durch dieselbe Anwendung wie im Normalbetrieb. Bündnisse, fremde Stationierung, Tauschhandel, Rückruf und Föderation bleiben Folgeaufträge.

## Nachprüfung: unabhängiges Scrollen und Kartensteuerung

Die Nutzerkorrektur wurde mit `node scripts/validate-workspace-scroll.mjs` im echten Browser reproduziert: Die alte Grid-Ausrichtung `align-items:start` ließ die Aktionsseite auf 764 px anwachsen, obwohl im Arbeitsbereich nur etwa 594 px verfügbar waren. So wurde Inhalt außerhalb des Rahmens abgeschnitten statt innerhalb der Seitenleiste gescrollt. Die bisherigen Browserprüfungen hatten diese tatsächliche Mausradbedienung nicht geprüft.

Der Arbeitsbereich hat jetzt eine begrenzte, gestreckte Grid-Zeile. Hauptinhalt und Seitenleiste können innerhalb dieser Höhe unabhängig scrollen. Die Karte besitzt `overflow:clip`, flexible Rasterzellen und eine zum verfügbaren Platz passende quadratische Größe; alte mobile Mindesthöhen und Mindestzellbreiten erzeugen keine Karten-Scrollfläche mehr. Kartenausschnitte werden über die Richtungsschaltflächen, Pfeiltasten und die bestehende Ziehsteuerung bewegt.

Nachweise: `npm run build` bestanden; `node scripts/validate-workspace-scroll.mjs` bestanden. Bei 1366×768 wurde tatsächliches Scrollen langer Aktionslisten und des Logistikformulars mit dem Mausrad geprüft, ohne die jeweils andere Spalte zu bewegen. Bei 1366, 390 und 320 px passt das gesamte Kartenraster in seine Fläche, Mausrad und direkte scrollTop/scrollLeft-Zuweisung scrollen die Karte nicht; die Richtungsschaltfläche verändert dagegen die sichtbaren Koordinaten. Kein horizontaler Dokumentüberlauf und keine Browser-JavaScriptfehler. Testwelt, Screenshots und Messwerte liegen unter `work/workspace-scroll/`.

Auch der vollständige Ablauf `node scripts/validate-logistics-ui.mjs` wurde nach der Layoutkorrektur erneut erfolgreich ausgeführt (Lieferung/Verlegung, Forschung/Skills/Postbox, Feldgründung, Mobilansichten, Tastatur und getrennte Tabs).
