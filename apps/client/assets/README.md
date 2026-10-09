# Spielillustrationen

`game-art.png` ist eine eigens für dieses Projekt am 08.10.2026 mit OpenAI Image Generation erstellte Bildtafel. Sie enthält keine übernommenen War2Glory-Grafiken und wird lokal ausgeliefert, ohne Bilddienste oder Drittanbieter-Anfragen im Browser.

Die neun Motive bilden ein gleichmäßiges 3×3-Raster: Sägewerk, Steinbruch, Bauernhof; Lagerhaus, Kaserne, Aufklärungsflugzeug; Infanterie, General, Stadt. `GameArt` in `src/ui.jsx` wählt das Motiv mit CSS-Hintergrundpositionen. Vite importiert und versieht die Bilddatei mit einem Inhalts-Hash für den Browsercache, sowohl im Entwicklungsmodus als auch im Produktionsbuild.

Der Stil ist eine fiktive frühindustrielle Spielwelt mit realistischen Materialien, warmem Licht und gedeckten Olivfarben. Die Bilder stellen keine zusätzlichen spielbaren Gebäude, Truppentypen oder Fähigkeiten dar.

Die älteren SVGs bleiben für bisherige URLs verfügbar; die aktuelle Oberfläche verwendet die neue Bildtafel. Der Spielserver unterstützt auch JPEG-Dateien (`.jpg` und `.jpeg`) mit dem passenden MIME-Typ für zukünftige importierte Bilder.

## Individuelle Generalporträts

`general-portraits.png` ist eine am 08.10.2026 mit OpenAI Image Generation eigens erstellte Tafel aus 20 unterschiedlichen fiktiven erwachsenen Offizieren. Sie enthält ein 5×4-Raster mit 10 Frauen in den oberen zwei Reihen und 10 Männern in den unteren zwei Reihen. Unterschiedliche Gesichter, Alter, Hauttöne und Frisuren; einheitliche fiktive Uniformen, warmes Licht und Olivfarben. Keine übernommenen Spielgrafiken. Die Tafel wird lokal ausgeliefert und durch Vite versioniert.

Stabile Kennungen `general-portrait-01` bis `general-portrait-20` stehen im gemeinsamen Katalog `packages/game-core/portraits.js`. `GeneralPortrait` zeigt den zugehörigen Ausschnitt quadratisch in Bewerberkarten, Generalübersicht und Modal. Der Server wählt zufällig und speichert vor Auslieferung; Bewerber behalten ihr Bild bei Verpflichtung. Bei einer neuen Vergabe werden bereits verwendete Porträts im eigenen Bestand/Pool bevorzugt vermieden; sind alle 20 belegt, sind Wiederholungen möglich. Bestehende Vergaben werden nicht umgewürfelt.

Schema 11 ergänzt fehlende Porträts einmalig bei vorhandenen Generälen und gespeichertem Bewerberpool. Namen, Identitäten, Werte, XP, Rollen, Kosten und Aufträge bleiben unverändert. Geschlecht und Aussehen haben keine Spielwirkung; Namen werden bei Migration nicht verändert.

## Auftrag 13

`logistics-art.png` ist eine am 08.10.2026 mit OpenAI Image Generation eigens erstellte Bildtafel im Stil von `game-art.png`: realistische Materialien, warmes Licht und gedeckte Olivfarben. Drei gleich große quadratische Motive stehen nebeneinander: Ölraffinerie, Fahrzeugfabrik und LKW. `GameArt` zeigt den jeweiligen Ausschnitt mit CSS-Hintergrundpositionen und `background-size: 300% 100%`. Vite importiert und versioniert die lokal ausgelieferte Datei mit einem Inhalts-Hash. Keine übernommenen War2Glory-Grafiken oder externen Bildanfragen.

Die bisherigen eigenen SVGs `refinery.svg`, `vehicleFactory.svg` und `truck.svg` bleiben für ältere URLs verfügbar. Die aktuelle Oberfläche verwendet die neue Bildtafel.

## Zehn Ausbaustufen je Gebäude (09.10.2026)

`building-levels/` enthält acht eigens mit OpenAI Image Generation erstellte Bildreihen. Jede WebP-Datei enthält zehn unterschiedliche quadratische Szenen in einem gleichmäßigen 5×2-Raster. Die obere Reihe zeigt Stufen 1–5, die untere Stufen 6–10, jeweils von links nach rechts. Kein Motiv ist lediglich ein vergrößerter oder umgefärbter Ausschnitt einer anderen Stufe. Architektur, Ausstattung und Gelände werden schrittweise umfangreicher und repräsentativer.

| Datei | Gebäudetyp | Entwicklung |
| --- | --- | --- |
| `sawmill.webp` | Sägewerk | Kleiner Sägeschuppen → stattliches Holzverarbeitungswerk |
| `quarry.webp` | Steinbruch | Kleine Abbaustelle → große Steinwerke mit Werkhallen und Kränen |
| `farm.webp` | Bauernhof | Kleine Hütte mit Feld → gepflegter Gutshof mit Scheunen und Silos |
| `warehouse.webp` | Lagerhaus | Einfacher Schuppen → repräsentativer Speicherkomplex |
| `university.webp` | Universität | Kleines Schulhaus → stattlicher Campus mit Bibliothek und Gärten |
| `refinery.webp` | Ölraffinerie | Kleine Verarbeitungsstätte → große Anlage mit Hallen, Tanks und Rohrleitungen |
| `barracks.webp` | Kaserne | Kleines Zeltlager → stattliche Garnison mit Exerzierhof |
| `vehicleFactory.webp` | Fahrzeugfabrik | Kleine Fahrzeugwerkstatt → große Fabrikanlage mit Fertigungshallen |

Die vorhandene eigene Bildtafel `game-art.png` diente als Stilreferenz: fiktive frühindustrielle europäische Architektur, natürliche Materialien, warmes Licht und gedeckte Olivfarben. Keine übernommenen War2Glory-Grafiken, echten Marken oder fremden Spielbilder. Generierte PNGs wurden ohne Motivänderung/Skalierung in WebP (Qualität 86) für die lokale Webauslieferung codiert. Die PNG-Arbeitsquellen bleiben außerhalb des Repositorys; versioniert werden die acht WebP-Dateien.

`apps/client/building-art.js` beschreibt Beschriftung und Rasterposition. `BuildingArt` bindet die typabhängige Datei und tatsächliche Stufe ein. Hintergrundgröße 500%×200%, Positionen horizontal 0/25/50/75/100% und vertikal 0/100%. Quadratische Bildflächen verhindern Verzerrung oder den Anschnitt benachbarter Stufen. Vite versieht jede Bildreihe mit einem Inhalts-Hash; der Browser lädt sie von derselben lokalen Spielinstanz.

Neubauangebote zeigen Stufe 1. Bei einem laufenden Ausbau bleibt das aktuelle Motiv erhalten, bis der Server den Abschluss meldet. Die Universität in der Forschung zeigt die ausgewählte Universität, auch wenn mehrere unterschiedlich ausgebaute Gebäude vorhanden sind. Spielstände benötigen keine Migration, da bestehende Gebäudestufen die Auswahl bestimmen. Die älteren Bildtafeln und SVGs bleiben für Truppen, Stadtmotive und bestehende URLs erhalten.
