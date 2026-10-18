# Weltkarte – Windrose, Lesbarkeit und räumliche Darstellung

Implementiert am 18.10.2026, Abschlussprüfung am 19.10.2026 auf dem bestehenden Forschungs-PR-Stand. Node.js 24.19.0, gebauter React-/Vite-Client und System-Chromium. Keine produktiven Spielstände verwendet oder zurückgesetzt.

## Implementiertes Verhalten

- Die Weltkarte nutzt die volle verfügbare Inhaltsbreite. Desktop startet mit 5×5, schmale Geräte bis einschließlich 560 px mit 3×3 Feldern. Kleine gespeicherte Welten werden entsprechend ihrer tatsächlichen Grenzen angezeigt. Zoom zwischen 3×3 und 11×11 bleibt innerhalb der Servergrenzen; alle Zeilen bleiben im scrollbaren Karteninhalt sichtbar.
- Windrose **oberhalb** der Karte mit acht Richtungen und Zentrierung auf die eigene Stadt. Pro Richtungstaste ein Feld je beteiligter Achse. Nicht mögliche Richtungen werden am Rand gesperrt. Die Buttons haben deutsche zugängliche Namen und funktionieren per Tab/Enter/Leertaste.
- Kein Verschieben durch Mausziehen, Touch-Wischen, Mausrad oder lose Pfeiltasten. Touch darf den Seiteninhalt weiterhin vertikal scrollen. Klick beziehungsweise Enter auf einem fokussierten Feld wählt weiterhin dieses Feld aus.
- Koordinatensuche, Zoom und eigener Stadtmittelpunkt bleiben verfügbar. „Suche & Zoom“ ist auf schmalen Geräten zunächst zugeklappt, damit die Karte mehr Platz erhält; die Werkzeuge sind per Tastatur aufklappbar.
- 13-px-Stadtnamen und 12-px-Koordinaten, kontrastreiche Beschriftungen und zusätzliche Stadttypen als Text. Namen werden umbrochen statt auf winzige Schrift reduziert. Die Felder bleiben innerhalb ihrer Spalten und überdecken keine Nachbarfelder.
- Lokale SVG-Reliefgrafiken: geschattetes Land, Wald, Hügel und Wasser; Stadtminiaturen mit Dächern, Seitenflächen, Schatten und Fahnen. Eigene, fremde und NPC-Städte sind grafisch und textlich unterscheidbar. Reservierte Felder zeigen eine Fahne statt einer bereits gebauten Stadt. Herkunft: eigene Vektorzeichnungen in `WorldTileArt.jsx`.

Dies ist eine 2,5D-Reliefdarstellung innerhalb der bestehenden Oberfläche. Keine neue Spielengine, keine frei drehbare WebGL-Kamera und keine tatsächliche Höhenkarte. Die Bilder verraten keine zusätzlichen Bestände oder Verteidiger. Welt-/Spielerschema, gespeicherte Koordinaten, Gelände, Entfernungsmodell, Bewegungskosten, Reisezeiten und Spielregeln bleiben unverändert.

## Navigation und Speicherung

Alle Kartendaten und Details laufen weiterhin über `map.viewport`, `map.snapshot` und `map.details` auf dem bestehenden WebSocket. Der Client klemmt Ausschnitte an Weltgrenzen. Schnelle Bedienungen werden mit 100 ms zusammengefasst, bevor der neu gewünschte Ausschnitt angefragt wird; die bestehende serverseitige Mindestfrist von 75 ms wurde nicht verändert. Ausstehende Timer werden bei Ansichts-/Stadtwechsel verworfen. Verbindungsfehler werden sichtbar gemeldet. Ein neu übernommener Standardausschnitt wird wieder auf die gewählte lesbare Größe gebracht. Die Initialisierung berücksichtigt auch den doppelten Effect-Aufruf im React-Entwicklungsmodus.

Die alte Pointer-Capture-/Drag-Navigation wurde entfernt. Die zugehörigen drei alten Navigationstests wurden durch Prüfungen für Ausschnittgrenzen, alle acht Windrosenrichtungen und deaktivierte Rand-/Diagonalbewegungen ersetzt. Spielstände benötigen keine Migration.

## Tatsächlich ausgeführte Befehle

| Befehl | Ergebnis |
| --- | --- |
| `npm test` | 230 Tests bestanden, 0 fehlgeschlagen/übersprungen |
| `npm run build` | Vite-Produktionsbuild erfolgreich |
| `PLAYWRIGHT_MODULE=/opt/codex/runtimes/cua/lib/node_modules/playwright/index.mjs node scripts/validate-world-map-ui.mjs` | Neun protokollierte Browserprüfschritte erfolgreich; keine JavaScript-Seitenfehler |
| `git diff --check` | Keine Whitespacefehler |

Die Tests wurden in der Umgebung mit Freigabe für lokale Test-Ports ausgeführt. Protokolle: `work/world-map-test.log`, `work/world-map-build.log`, `work/world-map-browser.log`. Die Browserwelt und Sitzungen bleiben unter ignoriertem `work/world-map-ui/`; mitgeliefert werden ausschließlich Screenshots und bereinigte Prüfresultate.

## Browserprüfungen

Das reproduzierbare Skript `scripts/validate-world-map-ui.mjs` startet einen echten lokalen Server mit einer vorbereiteten 24×24-Welt und zwei Testkonten. Eigene, fremde und NPC-Stadt liegen sichtbar nebeneinander. Es verwendet den gebauten Client und erfasst echte ausgehende `map.viewport`-Nachrichten.

- Alle acht Richtungen, eigene Zentrierung und mehrere schnelle aufeinanderfolgende Tastenbedienungen mit korrektem Zielausschnitt.
- Windrose liegt geometrisch über der Karte. Ziehen mit der Maus, Rad und lose Pfeiltasten verändern den Ausschnitt nicht und erzeugen keine Navigationsanfrage.
- Fokussierte Richtungstaste plus Enter bewegt die Karte. Suche an beiden Weltenden klemmt den Ausschnitt und sperrt unzulässige Richtungen.
- Zoom 3×3 bis 11×11 und zurück; die letzte Zeile/Spalte bleibt innerhalb der Karte und wird nicht abgeschnitten.
- Eigene Stadt per Tastatur auswählbar. NPC- und freie Feldwahl öffnen ihre vorhandenen Aufklärungsdialoge; verbindliche Servervorschauen werden ohne Zahlung geprüft.
- Schriftgrößen der Stadt-/Koordinatenbeschriftung, vorhandene räumliche Stadtgrafiken, volle Kartenbreite und kein horizontaler Dokumentüberlauf.
- Mobil 390×844 und 320×844: automatische 3×3-Ansicht, kein Überdecken benachbarter Felder, Richtungstasten weiterhin funktionsfähig. Aufklappbare Such-/Zoomwerkzeuge per Tastatur geprüft. Synthetische Touch-Zeigerbewegung löst keine Kartenverschiebung aus.
- Reload mit wiederaufgenommener Sitzung und erneuter mobiler Karteninitialisierung.

Screenshots wurden zusätzlich visuell angesehen: [Desktop](screenshots/world-map/desktop.png), [390 px](screenshots/world-map/mobile-390.png), [320 px](screenshots/world-map/mobile-320.png). [Bereinigte Prüfschritte](screenshots/world-map/checks.json).

Entwicklungszwischenläufe wurden korrigiert und erneut ausgeführt: Ein anfangs feststehender Testserver-Zeitgeber ließ erwartungsgemäß weitere Kartenanfragen an der bestehenden 75-ms-Sperre scheitern; das Browser-Skript nutzt nun reale Zeit. Ein nicht eindeutiger Heading-Selektor wurde präzisiert. Die visuelle Mobilprüfung fand außerdem eine durch Mindesthöhe/Seitenverhältnis verursachte Überbreite einzelner Felder; feste Spaltenbreiten und eine zusätzliche Geometrieprüfung verhindern das Überdecken benachbarter Felder. Diese Zwischenläufe werden nicht als bestandene Prüfungen gewertet.

Grenzen: Headless-Chromium, kein physisches Touchgerät, kein Safari/Firefox und kein Screenreader-Audit. Das Skript prüft synthetische Touch-Zeigerereignisse; kein echter Mehrfinger-/Pinch-Gestentest. Reacts Entwicklungsmodus wurde berücksichtigt, aber kein eigener interaktiver Vite-Entwicklungsserver-Browserlauf ausgeführt. Der neue Browserpfad prüft Einsatzvorschauen ohne kostenpflichtigen Missionsstart; Kampf-/Fracht-/Mehrstadt-/Persistenzregressionen sind Bestandteil des vollständigen automatisierten Testsatzes. Kein Deployment oder Dockerbuild ausgeführt.
