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
