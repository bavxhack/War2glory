# Spielillustrationen

`game-art.png` ist eine eigens für dieses Projekt am 08.10.2026 mit OpenAI Image Generation erstellte Bildtafel. Sie enthält keine übernommenen War2Glory-Grafiken und wird lokal ausgeliefert, ohne Bilddienste oder Drittanbieter-Anfragen im Browser.

Die neun Motive bilden ein gleichmäßiges 3×3-Raster: Sägewerk, Steinbruch, Bauernhof; Lagerhaus, Kaserne, Aufklärungsflugzeug; Infanterie, General, Stadt. `GameArt` in `src/ui.jsx` wählt das Motiv mit CSS-Hintergrundpositionen. Vite importiert und versieht die Bilddatei mit einem Inhalts-Hash für den Browsercache, sowohl im Entwicklungsmodus als auch im Produktionsbuild.

Der Stil ist eine fiktive frühindustrielle Spielwelt mit realistischen Materialien, warmem Licht und gedeckten Olivfarben. Die Bilder stellen keine zusätzlichen spielbaren Gebäude, Truppentypen oder Fähigkeiten dar.

Die älteren SVGs bleiben für bisherige URLs verfügbar; die aktuelle Oberfläche verwendet die neue Bildtafel. Der Spielserver unterstützt auch JPEG-Dateien (`.jpg` und `.jpeg`) mit dem passenden MIME-Typ für zukünftige importierte Bilder.
