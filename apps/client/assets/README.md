# Spielillustrationen

`game-art.png` ist eine eigens für dieses Projekt am 08.10.2026 mit OpenAI Image Generation erstellte Bildtafel. Sie enthält keine übernommenen War2Glory-Grafiken und wird lokal ausgeliefert, ohne Bilddienste oder Drittanbieter-Anfragen im Browser.

Die neun Motive bilden ein gleichmäßiges 3×3-Raster: Sägewerk, Steinbruch, Bauernhof; Lagerhaus, Kaserne, Aufklärungsflugzeug; Infanterie, General, Stadt. `GameArt` in `src/ui.jsx` wählt das Motiv mit CSS-Hintergrundpositionen. Vite importiert und versieht die Bilddatei mit einem Inhalts-Hash für den Browsercache, sowohl im Entwicklungsmodus als auch im Produktionsbuild.

Der Stil ist eine fiktive frühindustrielle Spielwelt mit realistischen Materialien, warmem Licht und gedeckten Olivfarben. Die Bilder stellen keine zusätzlichen spielbaren Gebäude, Truppentypen oder Fähigkeiten dar.

Die älteren SVGs bleiben für bisherige URLs verfügbar; die aktuelle Oberfläche verwendet die neue Bildtafel. Der Spielserver unterstützt auch JPEG-Dateien (`.jpg` und `.jpeg`) mit dem passenden MIME-Typ für zukünftige importierte Bilder.

## Individuelle Generalporträts

`general-portraits.png` ist eine am 08.10.2026 mit OpenAI Image Generation eigens erstellte Tafel aus 20 unterschiedlichen fiktiven erwachsenen Offizieren. Sie enthält ein 5×4-Raster mit 10 Frauen in den oberen zwei Reihen und 10 Männern in den unteren zwei Reihen. Unterschiedliche Gesichter, Alter, Hauttöne und Frisuren; einheitliche fiktive Uniformen, warmes Licht und Olivfarben. Keine übernommenen Spielgrafiken. Die Tafel wird lokal ausgeliefert und durch Vite versioniert.

Stabile Kennungen `general-portrait-01` bis `general-portrait-20` stehen im gemeinsamen Katalog `packages/game-core/portraits.js`. `GeneralPortrait` zeigt den zugehörigen Ausschnitt quadratisch in Bewerberkarten, Generalübersicht und Modal. Der Server wählt zufällig und speichert vor Auslieferung; Bewerber behalten ihr Bild bei Verpflichtung. Bei einer neuen Vergabe werden bereits verwendete Porträts im eigenen Bestand/Pool bevorzugt vermieden; sind alle 20 belegt, sind Wiederholungen möglich. Bestehende Vergaben werden nicht umgewürfelt.

Schema 11 ergänzt fehlende Porträts einmalig bei vorhandenen Generälen und gespeichertem Bewerberpool. Namen, Identitäten, Werte, XP, Rollen, Kosten und Aufträge bleiben unverändert. Geschlecht und Aussehen haben keine Spielwirkung; Namen werden bei Migration nicht verändert.
