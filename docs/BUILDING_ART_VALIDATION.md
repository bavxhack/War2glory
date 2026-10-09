# Prüfung der Gebäudebilder je Ausbaustufe

Geprüft am 09.10.2026 mit Node.js 24.19.0 und Chromium. Alle acht bestehenden Gebäudetypen besitzen Motive für sämtliche zehn unterstützten Stufen. Die Änderung betrifft ausschließlich Bilder und Oberfläche; Berechnungen und Speicherung werden nicht verändert. Bestehende Gebäudestufen wählen unmittelbar das passende Bild, daher ist keine Migration erforderlich.

## Automatische Prüfungen

- `npm test`: 163 Tests bestanden, keine Fehler, keine übersprungenen Tests; umfasst die bestehenden Berechnungs-, Migrations-, Server- und Oberflächentests.
- `npm run build`: erfolgreich, 56 Module verarbeitet. Alle acht WebP-Dateien werden durch Vite importiert und mit Inhalts-Hash ausgeliefert.
- Abgleich mit `BUILDINGS` und `MAX_LEVEL` aus dem Spielkern: alle acht Typen vollständig, Höchststufe 10 und zehn verschiedene Rasterpositionen pro Typ.
- `git diff --check`: ohne Fehler.

Die acht Bilddateien umfassen zusammen rund 5,47 MB (646–713 kB pro Gebäudetyp). Pro Typ enthält eine lokal ausgelieferte Datei sämtliche Stufen; der Ausbau benötigt keinen weiteren Bilddownload.

## Spielablauf im echten Browser

Eine isolierte Testwelt mit echtem Spielserver und Produktionsbuild wurde über Playwright/Chromium geprüft. Die reguläre Registrierung und ein tatsächlicher serverseitiger Ausbau wurden über die Oberfläche ausgeführt. Anschließend wurden ausschließlich im isolierten Testspielstand die acht Gebäudetypen auf Stufen 1–10 gesetzt, um jede Darstellung ohne zehnfache Wartezeit zu prüfen. Serverzeit und Testbestände wurden für diesen Prüfablauf kontrolliert; kein produktiver Spielstand wurde verändert.

1. Sägewerk Stufe 1 auswählen und Ausbau auf Stufe 2 starten. Vor Ablauf der Bauzeit (9.999 ms) bleiben Gebäudestufe und Bild auf Stufe 1. Nach 10.000 ms meldet der Server Stufe 2 und die Oberfläche wechselt das Bild.
2. Für jede Stufe 1–10 die sechs zivilen und zwei militärischen Gebäude anzeigen. Jeder Typ verwendet zehn unterschiedliche Bildpositionen. Die zivilen Bilder haben die passende Stufenbeschriftung, lokale WebP-URL und Hintergrundgröße `500% 200%`.
3. Militärische Gebäudeauswahl, Forschung mit Universität Stufe 10 und Abrissdialog kontrollieren: alle zeigen das Motiv der aktuellen Stufe.
4. Desktop (1366×1000) und Handy (390×844) prüfen. Screenshots der Stadt und des Militärbereichs auf Stufen 1, 5 und 10 sowie beider mobilen Ansichten wurden visuell kontrolliert. Bildflächen der mobilen Stadtbauplätze sind quadratisch und lesbar.
5. Auf einem freien Stadtgrundstück zeigen alle sechs Neubauangebote Stufe 1 mit quadratischer Bildfläche.
6. Keine JavaScript-Fehler und keine fehlgeschlagenen WebP-Antworten während des gesamten Ablaufs.

Die Screenshots und das temporäre Playwright-Prüfskript liegen im ignorierten Arbeitsverzeichnis `work/`; Testkonten, Spielstände und generierte PNG-Arbeitsquellen werden nicht versioniert. Bildherkunft und Rasterzuordnung sind in [assets/README.md](../apps/client/assets/README.md) dokumentiert.
