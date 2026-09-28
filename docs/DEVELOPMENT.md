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
