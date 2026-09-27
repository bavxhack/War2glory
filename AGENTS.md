# Projektleitlinien

- Lies README.md, docs/PROJECT.md und für Netzwerkarbeit docs/FEDERATION.md.
- Implementierter Stand und geplante Funktionen müssen klar unterschieden werden.
- Spielcode in JavaScript mit ES-Modulen; Oberfläche mit HTML/CSS.
- Behalte Spiellogik in packages/game-core unabhängig von HTTP, Matrix und Speicherung.
- Der Spielserver prüft Kosten, Zeit, Eigentum und erlaubte Aktionen.
- NPC-Städte zum Farmen von Nahrung sowie Generäle mit Erfahrung, Leveln und Truppenführung gehören zu den Kernanforderungen.
- Originalwerte von War2Glory nicht erfinden; neue Balancewerte ausdrücklich als Vorschläge markieren.
- Matrix ist der bevorzugte Föderationsansatz. Externe Ereignisse sind keine ungeprüften Befehle und keine Beweise für faire Spielzustände.
- Jede neue Spielmechanik in einem kleinen spielbaren Ablauf entwickeln; kritische Zustandsübergänge prüfen.
- Testbefehl: npm test. Lokaler Start: npm start. Laufzeit: Node.js 24 oder neuer.
- Keine Tokens, Passwörter oder data/-Spielstände committen.
