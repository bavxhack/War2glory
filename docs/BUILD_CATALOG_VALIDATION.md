# Baukatalog: Layoutkorrektur und tatsächliche Prüfungen

Geprüft am 06.11.2026, Ausgangscommit `abf2633`. Node.js 24.19.0, Vite, Chromium/Playwright; ausschließlich isolierte Testwelt unter `work/build-catalog/world`, kein produktiver Spielstand.

## Ursache und Korrektur

Der Fehler aus dem Screenshot wurde mit Stadt 2, `plot-7` und Bautechnik Stufe 1 reproduziert. Das alte Raster hatte eine 74-Pixel-Bildspalte, während die allgemeinere Stadtgebäuderegel Bilder auf 140×105 Pixel setzte. Überschrift, Beschreibung, Sperrgrund und Button waren zudem unabhängige Rasterelemente: Texte gerieten in die schmale Bildspalte, Buttons wurden auf die Höhe der Nachbarzelle gestreckt. Der Forschungszusatz verstärkte den Fehler.

`BuildingCard.jsx` gruppiert jetzt Überschrift, Preis/Dauer/Forschungsanzeige und Sperrgrund. Der Baukatalog besitzt eine eigene Dialogklasse; die gezielten Regeln in `style.css` begrenzen seine Bilder auf 88×66 bzw. mobil 64×48 Pixel. Der Baubutton hat eine eigene volle Rasterzeile, natürliche Höhe und mindestens 44 Pixel. Dialogbreite, Überschriftenumbruch und Schließen-Button bleiben auch bei schmalen Fenstern nutzbar. Alte unvollständige Katalogregeln wurden ersetzt.

Preise, Forschungswirkung, Berechtigungen, Bauprüfung, Warteschlangen und Speicherung bleiben unverändert. Zivil- und Militärkatalog verwenden dieselbe korrigierte Anordnung und weiterhin ihre getrennten Angebote.

Tatsächlich gemessener erster Eintrag:

| Fensterbreite (CSS-Pixel) | Bild vorher → nachher | Buttonhöhe vorher → nachher | Überschneidung nachher |
| --- | --- | --- | --- |
| 1440 | 140 → 88 | 199 → 48 | keine |
| 768 | 140 → 88 | 199 → 48 | keine |
| 390 | 140 → 64 | 199 → 44 | keine |
| 320 | 140 → 64 | 199 → 44 | keine |
| 640 | 140 → 88 | 199 → 44 | keine |

## Ausgeführte Prüfungen

- `CATALOG_BASELINE=1 CATALOG_ARTIFACTS=/workspace/War2glory/work/build-catalog/before node scripts/validate-build-catalog-ui.mjs`: ursprüngliches Layout mit Screenshots und Bounding-Box-Messungen bei allen fünf Breiten erfasst; der überlappende Titel und die 199-Pixel-Buttons sind dokumentiert.
- `npm run build`: erfolgreich.
- `node scripts/validate-build-catalog-ui.mjs`: bestanden. Alle zivilen Einträge bei 1440/768/390/320/640 CSS-Pixeln ohne Bild-/Titelüberlappung oder horizontalen Überlauf; Bildgröße höchstens 100 Pixel; Buttons zwischen 44 und 110 Pixel hoch. Letztes Angebot durch Scrollen/Tastatur erreichbar, fokussierbar und nicht durch den Dialogfuß verdeckt. Escape schließt.
- Tatsächlicher mobiler Bau in Stadt 2: Sägewerk auf `plot-7` eingereiht, genau 40 Holz/30 Stein bezahlt, Ausgangsstadt ohne Bauauftrag. Forschungsangebot bleibt erhalten.
- Militärkatalog bei 390 Pixeln: korrekte Bild-/Text-/Buttonanordnung und keine zivilen Angebote. Fehlende Ressourcen im zivilen Katalog: lesbare Sperrgründe, deaktivierter Bau, kein Überlauf.
- `npm test`: **282 Tests bestanden, 0 fehlgeschlagen**.
- `git diff --check`: ohne Befund.

Nachweise unter `docs/screenshots/build-catalog/`: `before-390.png`, `before-geometry.json`, `civil-1440.png`, `civil-768.png`, `civil-390.png`, `civil-320.png`, `civil-640.png`, `military-390.png`, `missing-resources-390.png`, `geometry.json` und `checks.json`. Repräsentative Desktop-/Mobilaufnahmen wurden visuell geprüft.

Grenzen: Chromium mit emulierten Fensterbreiten, kein physisches Mobilgerät und keine zusätzliche Safari-/Firefox-Prüfung. 640 CSS-Pixel prüfen eine reduzierte Arbeitsfläche; dies ist kein separat ausgeführter Browserzoom-Test. Kein Dockerbuild oder Deployment für diese reine Clientkorrektur.
