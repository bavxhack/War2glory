# Entwicklung mit Codex und Git

## Vorgeschlagener Ablauf

Ein gemeinsames GitHub-Repository enthält Quellcode, Regeln, Tests und Projektplan. Jede größere Funktion wird auf einem eigenen Branch entwickelt und als Pull Request überprüft. Änderungen werden mit einem nachvollziehbaren Commit gespeichert. Aufgaben und Abnahmekriterien gehören in Issues; fertig geprüfte Stände erhalten später Versionsmarkierungen.

Codex Cloud unterstützt die Verbindung mit GitHub, eine Umgebung für ein ausgewähltes Repository und die Erstellung von Pull Requests aus abgeschlossener Arbeit. Die Auswahl des Repositories und dessen Berechtigungen gehören zur Einrichtung. Offizielle Anleitung, geprüft am 27.09.2026: https://learn.chatgpt.com/docs/cloud.

## Übergabe dieses Projekts

1. Gewähltes Zielrepository: https://github.com/bavxhack/War2glory, Eigentümer bavxhack.
2. Der Projektstand liegt in der Repository-Wurzel, einschließlich LICENSE, AGENTS.md, CODEX_PROMPT.md und docs/.
3. Das Repository für Codex freigeben und eine Umgebung mit Node.js 24 oder neuer konfigurieren.
4. Mit `npm ci` die festgeschriebenen React-/Vite-Abhängigkeiten installieren, `npm run build` ausführen und anschließend mit `npm test` prüfen.
5. Der Auftrag aus `CODEX_PROMPT.md` umfasst Stadtansicht, Konten, WebSocket und getrennte JSON-Spielstände. Danach gemäß docs/PROJECT.md weiterarbeiten.

Geheimnisse und lokale Spielstände gehören nicht ins Repository. Öffentliches Hosting und produktiver Betrieb sind noch nicht konfiguriert. Die CI prüft Tests und Container-Builds; lokale Änderungen müssen vor einem Pull Request erneut mit `npm test` geprüft werden.


## Frontend-Entwicklung

Der produktive Node-Server liefert `apps/client/dist` aus. Für schnelles Arbeiten kann parallel zu `npm start` der Vite-Entwicklungsserver mit `npm run dev` gestartet werden; er läuft auf Port 5173 und leitet ausschließlich `/game` an `ws://127.0.0.1:3000` weiter. Soll der Spielserver WebSocket-Verbindungen dieses Entwicklungsursprungs unmittelbar akzeptieren, starte ihn explizit mit `npm start -- --origins http://localhost:5173`. Die Origin-Prüfung wird nicht global abgeschaltet.

React-Komponenten liegen in `apps/client/src`. `transport.js` besitzt als einzige Schicht den WebSocket, Sitzungswiederaufnahme, offene Anfragen und den serverbestätigten Zustand. Komponenten senden benannte Aktionen; Spielregeln verbleiben in `packages/game-core` und dem Server.

## Serverkonfiguration (Auftrag 11)

Optional `.env.example` nach `.env` kopieren. `node apps/server/index.js` und alle npm-Startskripte laden diese Datei über denselben validierten Konfigurationseinstieg, ohne zusätzliche Pakete. Unterstützt sind einzeilige `NAME=WERT`-Zuweisungen, optional `export`, Kommentare und einzeilig zitierte Werte. Keine Variablenexpansion oder mehrzeiligen Werte. Fehlende Datei ist erlaubt; fehlerhafte Zuweisungen/Werte stoppen vor Spielstandänderungen. Prozessvariablen überschreiben Dateiwerte, explizite CLI-Optionen überschreiben die jeweiligen Betriebsoptionen. `start:alpha`/`start:beta` setzen Welt/Port ausdrücklich.

Kartendimensionen 2–64 je Achse, NPC-Zahl 0–4095 mit mindestens einem freien bebaubaren Feld. Kleine/rechteckige Karten sowie 64×64 werden getestet; größere Karten benötigen weitere Prüfungen. Gespeicherte Karten behalten ihre Dimensionen/Positionen. Unterhalt 0–3.600.000 Nahrung/Einheit/Stunde; Dezimalpunkt, keine Exponential-/Einheitenangaben. Sekundenintervalle 0,001–31.536.000; Verlustanteil 0,000001–100 Prozent. Standards und Einheiten stehen in `.env.example`.

Compose reicht dieselben neun Spielvariablen als `environment` an den Node-Prozess weiter. Ein expliziter leerer Wert bleibt leer und wird abgewiesen. Compose-Betriebsoptionen setzen intern Port 3000/Host 0.0.0.0; `PORT` steuert den lokalen veröffentlichten Port. Regeln brauchen keinen Frontend-Rebuild. Ein Neustart rechnet alte Offlineintervalle zuerst mit gespeicherten Regeln ab und speichert dann den Wechsel mit dem Journal. Aktive Mangelzyklen behalten ihre bisherigen Fristen/Verlustwerte bis zur Erholung. Backups müssen die vollständige Welt samt Regelhistorie enthalten.

## Betreiberregeln für Offiziere (Auftrag 12)

Derselbe Konfigurationseinstieg lädt sieben zusätzliche Variablen. `GENERAL_MAX_COUNT` 1–100 (Standard 3), `GENERAL_RECRUIT_WOOD`/`GENERAL_RECRUIT_STONE` je 1–1000000 (500), `GENERAL_RECRUIT_COST_EXPONENT` 1–3 (2): jeweils Ganzzahlen. `GENERAL_CANDIDATE_REFRESH_HOURS` endliche Dezimalstunden 1/60–8760 (24), einmal auf ganze Millisekunden gerundet. `RESEARCH_LEADERSHIP_PERCENT` 0–10 (1) und `RESEARCH_BONUS_CAP_PERCENT` 0–100 (50) erlauben Null. Leere/exponentielle/negative Werte werden vor Änderungen verworfen. Kosten werden mit BigInt geprüft, ehe Ressourcen abgezogen werden.

Compose reicht die Werte tatsächlich an den Container weiter; natives Laden und Prozess-/Dateivorrang bleiben identisch. Regelkennung bindet Kauf- und Forschungsvorschauen. Änderungen brauchen keinen Clientbuild. Limitabsenkung entfernt keine Generäle. Preise/Boni gelten nur für neue Vorgänge; Grundwerte, Erwerbsnachweise, Forschungszeiten und bezahlte Kosten bleiben erhalten. `world.officerIntervalHistory` speichert Aktivierung und Intervall, unabhängig von der Versorgungshistorie. Bestehende Poolendzeit ist verbindlich, neuer Rhythmus gilt ab der ersten Grenze nach Aktivierung. Lange Abwesenheit wird arithmetisch übersprungen; es entsteht nur ein aktueller Pool.

Spielerschema 10 ergänzt Rollen-/Roster-Konfliktversion, Forschungsleiterreferenz, Erwerbszähler und privaten Pool. Alte Ketten gehen über Schema 9. Inkonsistente Referenzen/Zähler und unbekannte Poolversionen führen zu konkreten Fehlern statt Datenrücksetzung. Backups enthalten weiterhin das vollständige Weltverzeichnis mit Journal und beiden Regelhistorien.

## Postbox

Schema 12 ergänzt `mailbox` nach der bestehenden Schema-11-Porträtmigration. Nachrichten bleiben in Sender-/Empfängerspielerdateien, Lesestatus für Berichte in `readReportIds`. Backups brauchen weiterhin das vollständige Weltverzeichnis einschließlich Transaktionsjournal. Kein neuer Dienst und keine neuen ENV-Parameter. `packages/game-core/mailbox.js` definiert Validierung, Lesestatus und vorläufige Nachrichtenlimits; `WorldStorage.sendMail` übernimmt geprüfte Identitäten und journalbasierte Zweispieler-Zustellung unter der vorhandenen exklusiven Warteschlange. Neue Rückkehrberichte benötigen keine Kopie: fehlende ID in `readReportIds` bedeutet ungelesen.

## Logistikregeln und Migration (Auftrag 13)

Sechs zusätzliche ENV-Werte: `UPKEEP_TRUCK_PER_HOUR=180`, `OIL_INFANTRY_PER_FIELD=0.1`, `OIL_SCOUT_PER_FIELD=0.2`, `OIL_TRUCK_PER_FIELD=1`, `TRUCK_CARGO_CAPACITY=200`, `MAX_ATTACK_DELAY_MINUTES=1440`. Nahrungsunterhalt erlaubt 0–3600000 je Stunde; alle Öl-Typ-Raten müssen positiv 0.001–100000 sein, mit maximal drei Nachkommastellen. Kapazität: Ganzzahl 1–1000000. Zusatzminutenlimit: Ganzzahl 0–10080, 0 deaktiviert Zusatzzeit. Prozess-ENV hat Vorrang vor `.env`; Compose gibt alle Werte an Node weiter. Regeln brauchen keinen Frontend-Rebuild.

Bisherige explizite Öl-Nullwerte müssen vor Neustart durch positive Werte ersetzt werden. `OIL_DELAY_PER_UNIT_PER_MINUTE` entfernen: Dieser Schlüssel ist aufgehoben und wird in Datei-/Prozesskonfiguration ausdrücklich abgewiesen, bevor der Server Spielstände verändert. Gespeicherte alte Missionen mit Nullraten oder einem Minutenpreis bleiben gültig und werden nicht nachbelastet.

`config.logistics` ist je Welt unabhängig, versioniert als `fuel-2-ratio-…`. Öl wird auf Tausendstelbasis normalisiert. Bei normaler Einrichtungszahlung E und Hinreise T, Zusatzzeit D: Gesamt = ceil(E × (2T+D)/T). `fuelPlan` rechnet numerator/denominator mit BigInt; nur einmal abschließend runden. Missionen speichern Raten, Mengen, Distanz, Grundreise/Zusatzzeit/gesamte Hinreise, Termine, ungerundete Teilbeträge, rationale Grundlage und bezahltes Öl. Geänderte Regeln oder niedrigere Verzögerungsgrenzen gelten nur für neue Starts.

Versorgung nutzt die vorhandene `world.supplyRuleHistory`: fehlender Scope bedeutet historisch `all-living`, neuer Scope `stationed`. Beim Neustart werden alte Intervalle und bereits fällige Ereignisse bis zur gemeinsamen Übergangsgrenze mit alten Regeln abgerechnet; danach wird die neue Auswahl samt Spielerständen im Journal gespeichert. Eine exakt an dieser Einführungsgrenze bereits fällige alte Verlustwelle gehört zur alten Abrechnung; sie wird nicht wiederholt. Im normalen Simulationsablauf bleiben Missionsrückkehr/Einlagerung vor gleichzeitig fälligem Hunger. Aktive Mangelzyklen behalten Fristen/Prozentsatz, aber Verlustgruppen folgen dem aktuell gültigen Scope. Kein Loginzeitpunkt als individuelle Aktivierung, keine Wiederbelebung oder Wiederauffüllung historischer Ladung.

Schema 12 → 13 ergänzt Öl/LKW/neue Forschungsstufen mit 0 und Investitionen um Öl 0. Schema 13 → 14 ergänzt fehlende `delayMinutes=0`, ohne Termine, Zahlungen oder alte Berichte neu zu berechnen. Damit werden auch Spielstände der früheren PR-Fassung unterstützt. Queues lesen `trainingSlotId ?? barracksSlotId`; alte Kasernenaufträge werden geprüft, keine Zuordnung zur falschen Fabrik. Porträts, Bewerber, Forschung, Nachrichten und Lesestatus bleiben erhalten. Unbekannte/inkonsistente Versionen führen zu Fehlern, ohne automatische Rücksetzung.

Missionen 1–3 verwenden den skalaren Adapter, neue Missionen ein verbindliches `units`-Objekt. Gesamtbestand und Stadtverbrauch werden getrennt berechnet. Startjournal enthält Sequenz, Ölzahlung, General/Truppenbindung und dauerhaften Request-Beleg. Journalwiederherstellung erfolgt vor Migration und weiterer Abrechnung. Backups brauchen das vollständige Weltverzeichnis mit allen Regelhistorien und Journal.

Prüfungen und Grenzen: [LOGISTICS_VALIDATION.md](LOGISTICS_VALIDATION.md). Testwelten und Browser-/Containerartefakte liegen unter `work/`, nicht in produktiven `data/`-Beständen.

## Frachtregeln (Auftrag 14)

`SCOUT_FUEL_CAPACITY=20`: ganze Zahl 1–1000000 Betriebsöl je Späher. Native Datei-/Prozesspriorität und Compose-Weitergabe entsprechen den bisherigen Spielparametern. Der Wert ist ausschließlich Tankraum; Späher-Gütertraglast bleibt 0. Änderungen betreffen nur neue Vorschauen/Starts. Logistikkennung jetzt `fuel-3-cargo-…`; vorhandene `fuel-2`-Missionen bleiben unverändert.

`packages/game-core/cargo.js` definiert Einheitsgewichte, sichere Cargo-Validierung, Milliöl-Rückwegreserve, ganzzahlige Güterplätze und proportionale Verlustverteilung mit BigInt. Größter Bruchrest bekommt Restplätze, Gleichstand Holz/Stein/Nahrung/Öl. Konservative Reichweitenprüfung: Distanz × positive Ölrate je Einheit ≤ deren Traglast; daneben muss eigene Ladung + gesamtes Startbetriebsöl in den gemeinsamen Frachtraum passen. Mehr LKWs garantieren keine größere Reichweite. Der Dialog nennt konkrete Kapazitäts-/Tank-/Reserve-/Ölmangelgründe; es wird keine pauschale maximale Kartenentfernung behauptet.

Frachtmigration 14 → 15 verändert historische Missionen/Berichte nicht. Neue Einsätze speichern Originalmengen, Regeln, Zeitpunkte und exakte rationale Brennstoffgrundlagen. Kein zusätzlicher Timer, REST-Spielendpunkt oder Reiseunterhalt. Journal behandelt NPC-Beute und Missionsresultat sowie Rückkehr weiterhin atomar; vollständige Weltbackups einschließlich Journal und Versorgungshistorie bleiben erforderlich.

Prüfungen: `npm test`, `npm run build`; gezielt `node --test test/cargo.test.js test/cargo-storage.test.js`. Der Testuhr-Browserablauf sowie lokale Container-/Startprüfung sind in [CARGO_VALIDATION.md](CARGO_VALIDATION.md) dokumentiert. Screenshots/Testwelten bleiben unter `work/` und werden nicht committet.

## Mehrstadtmigration und Betrieb (Auftrag 15)

Spielerschema 15 → 16 verschiebt den bisherigen Stadtbestand in `cities`, inklusive lokaler Truppen, Ausbildung, Versorgung und Bürgermeisterreferenz. Forschung bleibt genau einmal unter `player.research`; ihre aktive Queue bindet `cityId`. Generäle, Bewerber, Erwerbszähler, Porträts, Nachrichten/Lesestatus bleiben einmal vorhanden. Alte Missionen erhalten ihre Ausgangsstadt ohne Fracht-/Öl-/Zeit-Neuberechnung. `canonicalJSON` schreibt weder `player.city` noch doppelte lokale Militärbestände. `cityView`/`commitCity` liefern Adapter für den bestehenden Spielfunktionskern. Weltschema 3 → 4 erhält die Karte/NPC-IDs und ergänzt private `fields`. Koordinaten bleiben verbindlich im Weltregister; jedes Stadtobjekt hat eine stabile ID.

Neue ENV-Werte: `FIELD_DEFENDER_MIN=5` und `FIELD_DEFENDER_MAX=30` (ganze 1–100000, Min ≤ Max), `CITY_CLAIM_TTL_HOURS=24` (Dezimalstunden 1/60–8760, einmal auf Millisekunden gerundet), `CITY_FOUND_WOOD/STONE/FOOD=500` (ganze 1–1000000). Native Datei-/Prozesspriorität und Compose-Weitergabe bleiben erhalten. Fünf Städte ist keine ENV-Option. Feldkontingente werden serverseitig zufällig erzeugt und gespeichert; spätere Konfiguration würfelt bestehende Felder nicht neu. Missionen speichern TTL-/Logistikregeln. Gründungsangebote binden die aktuellen Kostenregeln und Stadtanzahl.

`advanceCities` trennt Offlineintervalle am globalen Forschungsabschluss. Alle Städte erreichen diese Grenze mit dem alten Stand, danach wird die Forschung einmal abgeschlossen; die neue Wirkung gilt für alle weiteren Intervalle. Gleichzeitiger Forschungsabschluss und Hunger werden vor Verlustprüfung zusammengeführt. Weltqueue/Journaling binden Feldkampf, Anspruch und Gründung mit den betroffenen Spielerständen. Feldankünfte haben die stabile Reihenfolge Zeit/Missions-ID; historische NPC-Sequenzen bleiben erhalten. Ansprüche laufen bei `now >= expiresAt` vor einem Gründungsbefehl ab. Reservierte Felder sind auch für zufällige Neuspielerplatzierung belegt.

Vor Betriebsmigration Server stoppen und das vollständige Weltverzeichnis einschließlich Journal, Accounts und Regelhistorien sichern. Alte Versionen können Schema 16/4 nicht lesen. Weiterhin JSON-Prototyp für einen einzelnen Serverprozess; keine Datenbankmigration und kein Deployment in diesem Auftrag.

Reale UI-Prüfung mit isolierter Testwelt: `npm install --prefix work/browser --no-audit --no-fund playwright`, `npm run build`, `node scripts/validate-multicity-ui.mjs`; für vollständigen mobilen Ablauf `BROWSER_MOBILE=1 node scripts/validate-multicity-ui.mjs`. Das Skript verwendet `/usr/bin/chromium`, benötigt lokale Socket-/Browserfreigabe und speichert Testwelt/Screenshots ausschließlich unter ignoriertem `work/`. Automatisierte Abnahme: `npm test`. Nachweise: [MULTICITY_VALIDATION.md](MULTICITY_VALIDATION.md).
