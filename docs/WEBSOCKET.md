# WebSocket-, Konto- und Speicherformat

## Ereignisprotokoll (Version 1)

Die Anwendung lädt nur statische Dateien, `GET /health` und die öffentliche Föderationsbeschreibung über HTTP. Private Spielstände und Spielbefehle sind ausschließlich über `GET /game` als WebSocket-Upgrade erreichbar. Jedes Clientereignis enthält `version`, `type`, eine eindeutige `requestId` und `payload`. Antworten tragen dieselbe `requestId`; Push-Ereignisse benötigen keine.

Der Server akzeptiert `auth.register`, `auth.login`, `auth.resume`, `auth.logout`, `city.sync`, `construction.enqueue`, `map.viewport` und `map.details`. Er sendet zusätzlich `map.snapshot`, `map.details` und bei neu registrierten Städten `map.changed`. Kartenausschnitte sind höchstens 15×15 Felder groß; Koordinaten, IDs und eine kurze Anfragerate werden serverseitig geprüft. Antworten auf öffentliche Kartendetails enthalten keine Ressourcen, Garnisonen, Bauaufträge oder Regenerationszeitstempel. Nachrichten sind auf 16 KiB begrenzt. Der Server prüft Format, Ereignistyp und Origin. Hinter einem Reverse Proxy werden erlaubte öffentliche Origins explizit angegeben:

```sh
npm start -- --host 0.0.0.0 --origins https://spiel.example.org
```

Der Proxy muss WebSocket-Upgrades weiterreichen. Externer Zugriff muss TLS verwenden, damit Browser `wss://` einsetzen. Weitergeleitete Header allein erweitern nicht die Vertrauensgrenze.

## Sicherheit und Wiederholung

Passwörter werden mit Node.js `scrypt`, zufälligem 128-Bit-Salt und konstantem Vergleich geprüft. Sitzungsschlüssel besitzen 256 Bit Zufall, laufen nach 30 Tagen ab, sind widerrufbar und werden serverseitig nur SHA-256-gehasht gespeichert. Der Browser speichert den Schlüssel in `localStorage`, damit ein Neustart wieder zur Stadt führt. Das schützt nicht gegen JavaScript aus einer XSS-Lücke derselben Origin. Passwortwiederherstellung und Mehrfaktor-Anmeldung sind noch nicht vorhanden.

Eine bestätigte Bau-ID bleibt 30 Tage lang erhalten, höchstens die letzten 500 IDs pro Spieler. Dieselbe ID und derselbe Inhalt liefern eine idempotente Bestätigung. Ein abweichender Inhalt wird abgewiesen. Zustandsänderungen werden je Welt serialisiert und erst nach erfolgreichem atomarem Speichern bestätigt.

## JSON-Ablage, Sicherung und Altstadt

Eine Welt enthält `world.json`, `accounts.json` und je Spieler `players/<serverseitige-uuid>.json`. `world.json` ist die verbindliche Quelle für Weltidentität, Karte, NPCs und Stadtpositionen. Die Weltänderung wird bei einer Registrierung vor Spieler und Konto atomar geschrieben und bei Folgefehlern zurückgerollt; alle Schritte laufen in derselben Prozesswarteschlange. Bestehendes Weltschema 1 wird vor der einmaligen Migration als `world.json.schema-1.backup` gesichert und erhält für alle vorhandenen Konten Positionen. Wiederholtes Laden vergibt keine neue Position. Temporäre Dateien werden atomar umbenannt. Dateinamen stammen nie aus Benutzereingaben. Pro Weltverzeichnis darf genau ein Serverprozess schreiben. Unbekannte oder beschädigte JSON-Dateien stoppen den Start, statt still überschrieben zu werden.

NPC-Nahrung ist intern als gemeinsamer, versionierter Bestand mit Kapazität, Regenerationsrate und `updatedAt` vorbereitet. Später wird der Server beim Zugriff die seit diesem Zeitpunkt entstandene Nahrung bis zur Kapazität nachberechnen. Eine künftige Beuteentnahme muss unter derselben serialisierten Weltsperre speichern, bevor Nahrung gutgeschrieben wird, damit parallele Angriffe denselben Bestand nicht doppelt erhalten. Diese Regeneration und Beuteentnahme sind noch nicht implementiert.

Für Sicherung und Wiederherstellung den Server stoppen und das vollständige Verzeichnis `data/<welt>/` kopieren beziehungsweise ersetzen. Bestehende `state.json`-Demo-Daten werden nicht automatisch einem Konto gegeben. Nach Registrierung und bei gestopptem Server erfolgt die ausdrückliche Übernahme so:

```sh
npm run claim-legacy -- --world alpha --username Kommandant --confirm
```

Das Werkzeug migriert Schema 1 oder übernimmt Schema 2, schreibt die Stadt in die ausgewählte Spielerdatei und benennt die Quelle als datiertes Backup um.
