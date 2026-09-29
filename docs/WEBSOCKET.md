# WebSocket-, Konto- und Speicherformat

## Ereignisprotokoll (Version 1)

Die Anwendung lädt nur statische Dateien, `GET /health` und die öffentliche Föderationsbeschreibung über HTTP. Private Spielstände und Spielbefehle sind ausschließlich über `GET /game` als WebSocket-Upgrade erreichbar. Jedes Clientereignis enthält `version`, `type`, eine eindeutige `requestId` und `payload`. Antworten tragen dieselbe `requestId`; Push-Ereignisse benötigen keine.

Der Server akzeptiert `auth.register`, `auth.login`, `auth.resume`, `auth.logout`, `city.sync`, `construction.enqueue`, `building.preview`, `building.demolish`, `training.enqueue`, `scouting.start`, `raid.start`, `general.rename`, `map.viewport` und `map.details`. Er sendet zusätzlich `map.snapshot`, `map.details` und bei neu registrierten Städten `map.changed`. Kartenausschnitte sind höchstens 15×15 Felder groß; Koordinaten, IDs und eine kurze Anfragerate werden serverseitig geprüft. Antworten auf öffentliche Kartendetails enthalten keine Ressourcen, Garnisonen, Bauaufträge oder Regenerationszeitstempel. Nachrichten sind auf 16 KiB begrenzt. Der Server prüft Format, Ereignistyp und Origin. Hinter einem Reverse Proxy werden erlaubte öffentliche Origins explizit angegeben:

```sh
npm start -- --host 0.0.0.0 --origins https://spiel.example.org
```

Der Proxy muss WebSocket-Upgrades weiterreichen. Externer Zugriff muss TLS verwenden, damit Browser `wss://` einsetzen. Weitergeleitete Header allein erweitern nicht die Vertrauensgrenze.

## Sicherheit und Wiederholung

Passwörter werden mit Node.js `scrypt`, zufälligem 128-Bit-Salt und konstantem Vergleich geprüft. Sitzungsschlüssel besitzen 256 Bit Zufall, laufen nach 30 Tagen ab, sind widerrufbar und werden serverseitig nur SHA-256-gehasht gespeichert. Der Browser speichert den Schlüssel in `localStorage`, damit ein Neustart wieder zur Stadt führt. Das schützt nicht gegen JavaScript aus einer XSS-Lücke derselben Origin. Passwortwiederherstellung und Mehrfaktor-Anmeldung sind noch nicht vorhanden.

Eine bestätigte Befehls-ID bleibt 30 Tage lang erhalten, höchstens die letzten 500 IDs pro Spieler. Dieselbe ID und derselbe Inhalt liefern eine idempotente Bestätigung einschließlich des gespeicherten Abrissergebnisses. Ein abweichender Inhalt wird abgewiesen. Zustandsänderungen werden je Welt serialisiert und erst nach erfolgreichem atomarem Speichern bestätigt.

## JSON-Ablage, Sicherung und Altstadt

Eine Welt enthält `world.json`, `accounts.json` und je Spieler `players/<serverseitige-uuid>.json`. `world.json` ist die verbindliche Quelle für Weltidentität, Karte, NPCs und Stadtpositionen. Für eine neue Stadt wählt der Server kryptografisch zufällig aus allen freien, bebaubaren Feldern; die serialisierte Vergabe verhindert Doppelbelegungen bei gleichzeitigen Registrierungen. Die Weltänderung wird bei einer Registrierung vor Spieler und Konto atomar geschrieben und bei Folgefehlern zurückgerollt; alle Schritte laufen in derselben Prozesswarteschlange. Bestehendes Weltschema 1 wird vor der einmaligen Migration als `world.json.schema-1.backup` gesichert und erhält für alle vorhandenen Konten Positionen. Wiederholtes Laden vergibt keine neue Position. Temporäre Dateien werden atomar umbenannt. Dateinamen stammen nie aus Benutzereingaben. Pro Weltverzeichnis darf genau ein Serverprozess schreiben. Unbekannte oder beschädigte JSON-Dateien stoppen den Start, statt still überschrieben zu werden.

NPC-Nahrung und Garnison sind gemeinsame, versionierte Bestände. Der Server rechnet beide nur bis zum fachlichen Zeitpunkt des nächsten chronologischen Ereignisses fort. Ankunft und Rückkehr werden mit einer persistenten Ereignisnummer geordnet. `transaction.json` enthält vor dem Schreiben zusammengehöriger Welt-/Spielersnapshots eine wiederholbar anwendbare Transaktion und wird beim Start vor Spielzugriff wiederhergestellt. So sehen gleichzeitige Angriffe den fortgeschriebenen Bestand und ein Absturz zwischen Einzeldateien erzeugt weder doppelte Beute noch nur halb angewandte Verluste. Die Datei ist intern und wird nie an Clients projiziert.

Für Sicherung und Wiederherstellung den Server stoppen und das vollständige Verzeichnis `data/<welt>/` kopieren beziehungsweise ersetzen. Bestehende `state.json`-Demo-Daten werden nicht automatisch einem Konto gegeben. Nach Registrierung und bei gestopptem Server erfolgt die ausdrückliche Übernahme so:

```sh
npm run claim-legacy -- --world alpha --username Kommandant --confirm
```

Das Werkzeug migriert Schema 1 oder übernimmt Schema 2, schreibt die Stadt in die ausgewählte Spielerdatei und benennt die Quelle als datiertes Backup um.

## Lager-, Militär-, Aufklärungs- und Farmprototyp (Spielerschema 6)

Schema 4 ergänzt stabile Gebäudeidentitäten, tatsächlich am Auftrag festgehaltene Kosten und eine Investitionsgrundlage je Gebäude. Alte fertige Gebäude werden konservativ als unvollständig dokumentiert markiert; ihre Kosten werden nicht aus der aktuellen Preistabelle erfunden. Nachweisbare alte Warteschlangenaufträge übernehmen die unter dem damaligen Prototyp verbindlich abgezogenen Auftragskosten.

Snapshots enthalten Kapazität, Produktion und Kapazitätsaufschlüsselung je aktiver Ressource. `building.preview` liefert für ein eigenes fertiges Gebäude eine an Identität und Zustand gebundene Abrissvorschau. `building.demolish` verlangt deren `slotId`, `buildingId` und `version`; der Server prüft Bau- und Ausbildungsabhängigkeiten erneut, schreibt Abriss, Rückerstattung und Deduplizierungsbeleg atomar und lehnt veraltete Vorschauen ab. Die vorläufigen zentralen Werte sind 2000 Grundkapazität, 250 Kapazität je Produktionsgebäudestufe oberhalb Stufe 1, 500 je Lagerhausstufe für alle Ressourcen und 10 Prozent abgerundete Rückerstattung nachgewiesener Kosten. Abriss ist sofortig; Überbestand bleibt erhalten und stoppt nur positive Produktion der betroffenen Ressource.

`city.snapshot` und `city.updated` enthalten nun zusätzlich die abgeleitete Punkteübersicht, vier getrennte Militärbauplätze, stationierte Einheiten, Ausbildungsaufträge, den Startgeneral, eigene Einsätze und ausschließlich zurückgekehrte Berichte. Neue authentifizierte Befehle sind `training.enqueue` (`barracksSlotId`, `unit`, `amount`) und `scouting.start` (`targetId`, `generalId`, `scouts`). Beide verwenden dieselbe Befehls-ID-Deduplizierung und werden vor der Bestätigung atomar im Spielerstand gespeichert. Der Server leitet die Kaserne aus dem eigenen gespeicherten Militärbauplatz ab; fremde Spieler-, Bauplatz- oder Berichts-IDs werden nicht als Autorität akzeptiert.

Die zentralen vorläufigen Testwerte sind: vier Militärbauplätze; gemeinsame Bauwarteschlange mit drei Plätzen; **jede fertige Kaserne besitzt eine eigene Ausbildungswarteschlange mit drei Gruppen**; höchstens 1.000 Einheiten je Gruppenauftrag; Späher kosten 10 Holz/5 Stein/5 Nahrung und benötigen auf Kasernenstufe 1 zwei Sekunden, Infanterie 15/10/10 und drei Sekunden. Verschiedene Kasernen bilden parallel aus. Innerhalb einer Kaserne wird die gesamte Gruppe erst gemeinsam fertig, und folgende Gruppen beginnen erst nach dem Ende der vorherigen. Eine höhere Kasernenstufe teilt nur die beim Auftragsstart festgeschriebene Dauer. Gebäudepunkte sind `10 × Summe fertiger Gebäudelevel`; Forschung, Kampf und Niederlageneinfluss werden sichtbar, aber noch nicht berechnet.

Jeder Spieler erhält idempotent einen Startgeneral. Level L benötigt insgesamt `50 × L × (L − 1)` Erfahrung (maximal 10), die Führung beträgt als vorbereiteter, derzeit rein informativer Wert `20 × Level`. Schema 5 übernimmt alle vorhandenen Generäle und aktiven ID-Verweise verlustfrei. Jeder General besitzt zusätzlich eine Besitzer-ID, eine Konfliktversion, Grundwerte für Führung/Angriff/Verteidigung sowie getrennte Zähler für verwendete XP, erworbene/freie Skillpunkte und Verteilungen. Fehlende Skilldaten beginnen bei null; bestehende Gesamterfahrung bleibt unverändert. `general.rename` verlangt General-ID, Namen und erwartete Konfliktversion, wird wie andere Änderungen dedupliziert und akzeptiert nach dem Trimmen 1–40 Unicode-Codepunkte ohne Steuerzeichen. Gleichnamige Generäle bleiben zulässig. Skillbefehle und Boni sind im produktiven Regelsatz deaktiviert; reine Spielkernfunktionen werden nur mit injizierten Testregeln geprüft. Vor Aufklärung oder Farmzug wählt der Spieler einen freien General und eine positive Anzahl stationierter, nicht bereits gebundener Einheiten. Ein Führungslimit ist für diese Einsätze derzeit nicht aktiv. Der Server reserviert General und Einheiten für den gesamten Hin- und Rückweg; sie stehen erst nach der Rückkehr wieder für andere Aktionen bereit. Die erste zurückgekehrte Aufklärung je NPC gibt 10 General-Erfahrung. Pro Richtung gilt `max(5 Sekunden, ceil(Luftlinie) × 5 Sekunden)`. Gelände beeinflusst den Weg noch nicht; Aufklärungen gelingen ohne Verluste. Berichte werden erst bei Rückkehr sichtbar und enthalten einen historischen Snapshot. Aufklärung gewährt weder Beute noch Kommandanten-Kampfpunkte.

## React-/Vite-Client

Der Browser verwendet weiterhin ausschließlich den Endpunkt `/game` und Protokollversion 1. Eine zentrale Transportschicht in `apps/client/src/transport.js` verwaltet genau eine Verbindung je gemounteter Anwendung, Sitzungswiederaufnahme, Request-IDs, Reconnect und den bestätigten Zustand. Vite leitet im Entwicklungsmodus nur diesen Pfad weiter; im normalen Betrieb liefert der Node-Server den gebauten Client selbst aus. Entwicklungsursprünge müssen mit `--origins` ausdrücklich freigegeben werden.
