# Codex-Auftrag 2: Stadtansicht, WebSocket und eigene Spielerstädte

## Arbeitsaufteilung und Auftrag

Dieser Text ist der Implementierungsauftrag an Codex. Im begleitenden Planungschat werden auf Wunsch des Nutzers ausschließlich Anforderungen und Codex-Anweisungen erstellt. Codex übernimmt die Programmierung, Tests und den Pull Request.

Arbeite im Repository bavxhack/War2glory auf dem aktuellen Stand von main. Lies zuerst AGENTS.md, README.md, docs/PROJECT.md, docs/FEDERATION.md und docs/DEVELOPMENT.md. Prüfe vorhandene Änderungen und offene Pull Requests. Erhalte fremde Arbeit.

Dieser Auftrag ersetzt den bisherigen Startauftrag für Etappe 1. Die dortige Einschränkung, noch keine Konten anzulegen, ist für diesen neuen Auftrag aufgehoben. Implementiere die nachfolgend beschriebene Etappe vollständig.

## Ausgangspunkt

Bei der Prüfung am 27.09.2026 war main auf Commit 69a18e7ede2d46648eb21c4279ee0e4b043ecd9e. Etappe 1 ist bereits zusammengeführt: neun Bauplätze, Errichten und Ausbauen, eine sequenzielle Warteschlange mit maximal drei Aufträgen, serverseitige Angebote und Migration älterer Spielstände. Es existieren Dockerfile, Compose-Konfiguration und eine Container-Pipeline. Prüfe den tatsächlichen Stand erneut; diese Beschreibung ersetzt keine Codeprüfung.

Der bisherige Bildschirm wirkt wie ein Dashboard: dunkler Hintergrund, Rohstoffkarten, ein Raster aus Gebäudekacheln mit Buchstaben und eine Warteschlangenliste. Der Nutzer möchte eine anschauliche Stadt statt dieses abstrakten Rasters.

Verwende ausschließlich den Repository-Stand als Implementierungsbasis. Im Planungschat begonnene, unveröffentlichte Codeentwürfe sind keine fertige Grundlage.

## Ziele dieser Etappe

1. Eine deutlich schönere, als Stadt erkennbare Spielansicht.
2. Sämtliche dynamische Kommunikation zwischen Spielclient und Spielserver über WebSocket-Ereignisse.
3. Mehrere Benutzer auf derselben Serverinstanz, jeweils mit einer eigenen Stadt.
4. Dauerhafte serverseitige JSON-Spielstände pro Benutzer und verlässlicher Wiederbeitritt.

## A. Stadtbild und Bedienung

Gestalte eine zusammenhängende Landschaft in stilisierter Vogelperspektive oder isometrischer Ansicht. Bestehende Bauplätze und Spielregeln bleiben erhalten.

- Stelle Sägewerk, Steinbruch und Bauernhof mit unterschiedlichen, erkennbaren Gebäudegrafiken dar: beispielsweise Dächer und Holzstapel, Felsflächen und Abbaugeräte sowie Scheune und Felder.
- Verbinde die Stadt visuell durch Wege, Grünflächen, Bäume und klare Grundstücksgrenzen. Freie Bauplätze sollen tatsächlich wie bebaubare Grundstücke aussehen.
- Verwende eigene Grafiken oder nachvollziehbar lizenzierte Assets und dokumentiere deren Herkunft. Einfache eigene SVG-/CSS-Grafiken sind ausreichend, wenn das Gesamtbild überzeugend ist.
- Zeige aktive Baustellen, wartende Aufträge und Gebäudestufen direkt an den betreffenden Plätzen. Dekoration darf keine nicht vorhandenen Spielfunktionen vortäuschen.
- Halte Rohstoffe, Produktion, ausgewähltes Gebäude, Baukosten, Dauer und Warteschlange gut lesbar. Gebäudeauswahl soll eine verständliche Detailansicht öffnen.
- Verwende eine kompakte Kopfzeile, damit die Stadt den größten Teil des sichtbaren Spielbereichs einnimmt.
- Unterstütze Desktop und Smartphone: ausreichend große Bedienflächen, keine abgeschnittenen Bedienelemente und eine zugängliche Detailansicht.
- Erhalte Tastaturbedienbarkeit, sichtbare Fokusmarkierungen, sinnvolle Beschriftungen und ausreichenden Kontrast. Regelmäßige Zustandsereignisse dürfen den Tastaturfokus nicht verlieren lassen.
- Zeige den eigenen Kommandantennamen, Stadtnamen und Verbindungsstatus. Nicht implementierte Weltkarte, Generäle und Bündnisse höchstens eindeutig als geplant kennzeichnen.

Die Ansicht muss mit echten Serverdaten funktionieren. Eine reine Bildvorlage oder kosmetisch umgefärbte Kacheln erfüllen den Auftrag nicht.

## B. Ereignisbasierte Spielkommunikation

Ersetze die bisherigen REST-Aufrufe für Spielzustand und Bauaufträge sowie das HTTP-Polling durch eine WebSocket-Verbindung. Anmeldung, Registrierung, Wiederaufnahme, Abmeldung, Bauaufträge, Bestätigungen, Fehler und Zustandsänderungen laufen darüber.

HTML, CSS, JavaScript und Grafiken dürfen zum Laden der Anwendung weiterhin über HTTP(S) ausgeliefert werden. Auch ein technischer Healthcheck und die bestehende Föderationsbeschreibung dürfen HTTP-Endpunkte bleiben. Sie dürfen keine privaten Spielstände offenlegen. Die WebSocket-Verbindung zum Browser ist unabhängig von der späteren Matrix-Föderation.

Dokumentiere ein versioniertes Ereignisformat mit Ereignistyp, eindeutiger Anfrage-/Befehls-ID, Nutzdaten und zuordenbarer Antwort. Folgende Namen sind ein Vorschlag, keine vorhandene Implementierung:

| Richtung | Ereignis | Zweck |
| --- | --- | --- |
| Client → Server | auth.register / auth.login | Konto erstellen oder anmelden |
| Client → Server | auth.resume / auth.logout | Sitzung wiederaufnehmen oder beenden |
| Client → Server | construction.enqueue | Bauauftrag einreichen |
| Client → Server | city.sync | Einmaligen vollständigen Abgleich anfordern |
| Server → Client | auth.success / auth.required | Identität bestätigen oder Anmeldung anfordern |
| Server → Client | city.snapshot / city.updated | Eigenen Zustand oder Änderungen senden |
| Server → Client | construction.completed | Abgeschlossenen Bau melden |
| Server → Client | command.ok / command.error | Befehl bestätigen oder verständlich ablehnen |

Anforderungen:

- Der Server entscheidet weiterhin über Identität, Eigentum, Rohstoffe, Kosten, Zeiten und zulässige Zustandsänderungen.
- Push-Nachrichten gehen nur an die berechtigten Verbindungen. Sitzungen desselben Spielers dürfen dessen Änderungen gemeinsam erhalten.
- Verwende für Ressourcen und Bauzeiten serverseitige Ereignisse bzw. geeignete Ticks. Es gibt keine regelmäßigen Client-Anfragen als Ersatz-Polling.
- Nach Verbindungsabbruch automatisch mit begrenztem Backoff erneut verbinden, Sitzung prüfen und vollständig synchronisieren.
- Wiederholte Bauaufträge dürfen niemals doppelte Kosten oder doppelte Bauausführung verursachen. Definiere und teste die Aufbewahrungs-/Ablaufregeln für Befehls-IDs. Eine ID mit verändertem Inhalt muss abgelehnt werden.
- Ein bereits bestätigter Auftrag bleibt nach Verbindungsabbruch und Serverneustart erhalten. Bei unklarer Bestätigung darf die Oberfläche keinen zweiten unabhängigen Auftrag erzeugen.
- Prüfe Nachrichtenschema, Größe, erlaubte Typen, Rate und WebSocket-Origin. Fange ungültiges JSON und unerwartete Verbindungsabbrüche ab.
- Halte Spiellogik, Transport, Anmeldung und Speicherung in getrennten Modulen. Verwende eine gepflegte WebSocket-Bibliothek, wenn Node.js dafür keine passende Serverfunktion bietet; dokumentiere neue Abhängigkeiten.
- Entferne oder sperre alte Spiel-HTTP-Endpunkte, damit keine zweite, ungeschützte Zugriffsmöglichkeit bestehen bleibt.

## C. Konten und getrennte Städte

Implementiere Registrierung, Anmeldung, Abmeldung und Wiederaufnahme einer Sitzung. Ein bloßer frei eingebbarer Spielername ist keine ausreichende Authentifizierung.

- Jedes neue Konto erhält genau eine eigene Stadt mit eigenem Ressourcenbestand, Gebäuden, Bauplätzen und Bauaufträgen.
- Eine robuste Kennwort-/Sitzungslösung ist für diese Etappe ausreichend. Passwörter müssen mit einem geeigneten gesalzenen Passwort-Hash gespeichert werden; verwende die dokumentierte Standardbibliothek oder eine gepflegte Bibliothek.
- Persistente Sitzungsschlüssel müssen ausreichend zufällig sein, dürfen nicht in URLs oder Logs stehen und benötigen Ablauf- und Widerrufsregeln. Erläutere die gewählte Browser-Speicherung und deren Sicherheitsgrenzen.
- Nach Browserneustart oder Serverneustart muss eine gültige Sitzung wieder zur eigenen Stadt führen. Nach Ablauf oder Abmeldung muss eine erneute Anmeldung mit demselben Konto möglich bleiben.
- Ziehe die Spieleridentität ausschließlich aus der authentifizierten Verbindung. Eine vom Client gesendete fremde Spieler-ID darf niemals fremde Daten lesen oder verändern.
- Verhindere die doppelte Registrierung derselben normalisierten Identität auch bei gleichzeitigen Anfragen.
- Prüfe Eingaben, begrenze Anmeldeversuche und übertrage keine Kennwörter oder Sitzungsschlüssel an andere Spieler.
- Zwei getrennte Browserprofile müssen gleichzeitig unabhängig spielen können. Eine Übersicht anderer Kommandanten ist optional; private Ressourcen und Aufträge werden nicht veröffentlicht.
- Dokumentiere Grenzen wie eine noch fehlende Passwortwiederherstellung ehrlich.

## D. JSON-Persistenz und bisherige Spielstände

Der Nutzer verlangt für jeden Spieler einen eigenen, serverseitigen JSON-Spielstand. Verwende dafür noch keine Datenbank.

- Lege Spielerdaten innerhalb der jeweiligen Welt ab, beispielsweise unter data/<welt>/players/<sichere-spieler-id>.json. Dateipfade werden serverseitig festgelegt und gegen Pfadmanipulation geschützt.
- Speichere Stadt, Ressourcen, Bauwarteschlange, Identität, relevante Zeitstempel, Schema-/Regelsatzversion und notwendige Metadaten für Wiederaufnahme und Deduplizierung.
- Kontozugangsdaten können separat gespeichert werden. Verhindere inkonsistente Zwischenstände zwischen Registrierung, Konto und Stadt.
- Schreibe atomar über eine temporäre Datei mit anschließender Umbenennung. Bestätige zustandsändernde Befehle erst nach erfolgreicher Speicherung.
- Stelle sicher, dass parallele Befehle und mehrere Verbindungen desselben Spielers keine Änderungen verlieren.
- Offline-Produktion und mehrere zwischenzeitlich abgeschlossene Bauaufträge müssen nach Wiederbeitritt zeitlich korrekt nachberechnet werden.
- Keine Geheimnisse oder echten Spielstände committen oder aus dem statischen Webverzeichnis ausliefern.
- Unterstütze zunächst genau einen Schreibprozess pro Weltverzeichnis; dokumentiere oder erzwinge diese Grenze.
- Erhalte die bisherige gemeinsame Demo-Stadt samt Rohstoffen und laufenden Aufträgen durch Backup und versionierte Migration. Ordne sie nicht automatisch dem ersten beliebigen Registrierenden zu. Stelle einen nachvollziehbaren, ausdrücklich durch den Betreiber ausgelösten Übernahmeweg zu einem bestimmten Konto bereit.
- Unbekannte oder beschädigte Spielstände dürfen nicht stillschweigend durch neue Städte überschrieben werden.
- Ergänze eine kurze Anleitung zum Sichern und Wiederherstellen des gesamten Weltverzeichnisses.

## E. Bestehenden Betrieb erhalten

Passe Dockerfile, Compose, Lockdatei, Healthcheck und CI an, soweit die neuen Abhängigkeiten und Endpunkte das erfordern. Der vorhandene Containerweg muss funktionsfähig bleiben.

Prüfe eine zulässige Origin-/Host-Konfiguration auch bei abweichenden Hostports und hinter einem Reverse Proxy. Leite keine Vertrauensentscheidung allein aus beliebigen Client-Headern ab. Dokumentiere WebSocket-Upgrades und HTTPS/WSS für Zugriff über andere Rechner. Veröffentliche keinen Server und ändere keine produktive Infrastruktur eigenständig.

## F. Abnahme und Prüfungen

Führe die vorhandenen Tests vor und nach der Änderung aus. Ergänze gezielte Integrationsprüfungen:

1. Zwei Konten besitzen unterschiedliche Städte; Bauen bei A verändert weder Rohstoffe noch Aufträge von B.
2. Nicht angemeldete Verbindungen und manipulierte Spieler-IDs erhalten keinen Zugriff auf fremde Städte.
3. Richtige und falsche Anmeldung, Sitzungsablauf, Abmeldung und Wiederaufnahme funktionieren.
4. Browser-Neuladen, Verbindungsunterbrechung und Serverneustart erhalten den Spieler und seinen Fortschritt.
5. Ein wiederholter Auftrag wird nur einmal ausgeführt; gleiche ID mit anderem Inhalt wird abgewiesen.
6. Gleichzeitige Aufträge und mehrere Verbindungen eines Spielers verlieren keine Änderungen.
7. Offline-Produktion und Bauabschlüsse bleiben korrekt; der Server meldet Änderungen ohne HTTP-Spielpolling.
8. Fehler beim Speichern erzeugen keine fälschliche Erfolgsbestätigung und keinen zerstörten letzten Spielstand.
9. Migration und gezielte Übernahme der bisherigen Demo-Stadt erhalten deren Daten.
10. Ungültige, zu große oder unerlaubte WebSocket-Nachrichten bringen den Server nicht zum Absturz.
11. Docker-/CI-Konfiguration berücksichtigt die tatsächlichen Abhängigkeiten und den neuen Healthcheck.

Prüfe die Oberfläche im Browser auf Desktop und einer schmalen Mobilansicht. Dokumentiere die neue Stadtansicht mit Screenshots. Falls Browser- oder Containerprüfungen nicht möglich sind, benenne genau, was ungeprüft bleibt. Behaupte keine erfolgreiche Prüfung ohne Ausführung.

## Ergebnis und Umfang

- Implementiere den vollständigen Ablauf: registrieren → eigene Stadt sehen → bauen → Verbindung verlassen → wieder anmelden → dieselbe Stadt mit korrektem Fortschritt erhalten.
- Aktualisiere README, Projektplan und eine kurze WebSocket-/Speicherdokumentation.
- Öffne einen Pull Request von einem eigenen Branch. Beschreibe sichtbare Änderungen, Migration, Tests und offene Grenzen. Nicht selbst zusammenführen oder produktiv deployen.
- Antworte auf Deutsch und trenne implementierte Funktionen von geplanten Funktionen.
- Keine Umstellung auf TypeScript oder ein neues Frontend-Framework ohne konkrete Notwendigkeit.
- Matrix-Föderation, NPC-Städte zum Farmen von Nahrung sowie Generäle mit Truppenführung, Erfahrung und Levelsystem bleiben verbindliche spätere Ziele. Implementiere sie in diesem Auftrag noch nicht.

Arbeite die zusammengehörenden Änderungen in überprüfbaren Schritten ab. Entscheide reversible technische Einzelheiten selbst; frage nur bei einer tatsächlich blockierenden Produktentscheidung nach.
