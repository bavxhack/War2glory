# Postbox: Prüfung vom 08.10.2026

Umsetzung baut auf dem aktuellen Auftrag-12-Branch/PR #14 auf. Die Postbox hat Nachrichten, Aufklärung, Angriffe und Gesendet als getrennte Bereiche, zehn Zeilen je Seite, Suche, Ungelesen-Filter und Detailansicht. Militär behält aktive Einsätze, zeigt jedoch keine wachsende Berichtsliste mehr. Öffnen eines Eintrags markiert ausschließlich diesen als gelesen. Neue Rückkehrberichte und eingehende Nachrichten erhöhen die ungelesene Anzahl, lösen rotes Blinken aus und bleiben ungelesen, bis sie geöffnet werden. Reduzierte Bewegung zeigt statisches Rot.

## Ausgeführt

- `npm test`: 107 Tests erfolgreich. Bestehende Rekrutierung, Forschung, Versorgung, Missionen und Porträtmigration weiterhin geprüft.
- Neue Postbox-Tests: Textvalidierung; Schema-11-Migration ohne Änderungen an bisherigen Zuständen/Berichten; späterer Bericht ungelesen; Lesestatus nach Neustart; Rate-Limit ohne Teilzustellung; dauerhafte Deduplizierung und Konfliktprüfung; unterbrochenes Journal zwischen beiden Spielerdateien mit vollständiger Zustellung nach Wiederherstellung; korrekte große WebSocket-Frames.
- Echter WebSocket-Ablauf mit Sender, Empfänger, zweitem Empfängertab und unbeteiligtem Konto: private Zustellung, Absenderkopie, gleiche ID nur einmal, abweichender Inhalt abgewiesen, fremde Lese-ID abgewiesen, Lesestatus in beiden Tabs, Aufklärungs-/Angriffsbericht ungelesen, Offline-Zustellung und Wiederanmeldung nach Serverneustart.
- Chromium bei 1440×1000 und 390×844: 23 Aufklärungsberichte plus Angriffsbericht, Blättern, Detailansichten, Lesen, Nachrichten senden/antworten, als Text angezeigter HTML-artiger Betreff, Blinken/Ende der Animation, Neuladen, Suche und reduzierte Bewegung. Keine JavaScript-Fehler oder horizontale Überbreite. Zweiter Durchlauf prüft die endgültige Gestaltung mit SVG-Symbol.
- `npm run build` erfolgreich. Containerbuild mit dem Repository-Dockerfile (temporär nur um CA-Secret für die Umgebungsproxy-Verbindung ergänzt) erfolgreich. Temporärer Container gesund; sieben abweichende Offiziers-Compose-Werte identisch zum nativen Einstieg. Kein produktives Datenverzeichnis verwendet.
- `git diff --check` erfolgreich.

## Daten und Grenzen

Spielerschema 12 wird über die vollständige bisherige Migrationskette erreicht. Historische Berichts-IDs beginnen gelesen; Inhalte, Missionen, Ressourcen, Generäle und laufende Aufträge bleiben bestehen. Neue Registrierung beginnt mit leerer Postbox. Nachrichten und Lesestatus liegen in privaten Spielerdateien. Sender/Empfänger werden zusammen journalbasiert gespeichert; Erfolgsantwort erst nach dauerhaftem Commit. `commandId` und Fingerprint bleiben intern, Deduplizierung läuft unabhängig von der allgemeinen zeitlich begrenzten Befehlshistorie.

Vorläufige eigene Nachrichtenlimits: 100 Zeichen Betreff, 4000 Zeichen Text, fünf neue Nachrichten pro Minute. Eine Welt, keine Matrix-Zustellung. Keine Anhänge, Löschung oder Lesebestätigung gegenüber dem Absender. Alle Berichte/Nachrichten bleiben erhalten; die Oberfläche ist paginiert, private Snapshots enthalten weiterhin die vollständige Historie. Ein Langzeitlasttest mit sehr großen Postfächern und ARM64-Laufzeit wurde nicht ausgeführt.
