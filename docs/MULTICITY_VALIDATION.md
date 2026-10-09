# Auftrag 15: Mehrstadt-Abnahme

Geprüft am 09.10.2026 auf `main`-Grundlage `937ea0540ff5aca6f47e0342ef1729f4895de847`, Node.js 24.19.0. Auftrag 15 ersetzt Lieferungen; Auftrag 16 bleibt geplant. Kein Merge und kein Deployment ausgeführt. Alle neuen Zahlen sind vorläufige eigene Projektbalance.

## Implementierter Ablauf

Bis fünf kanonische Städte, stadtbezogene Wirtschaft/Armeen/Queues/Versorgung/Bürgermeister und spielerweiter Generalpool, Bewerber, Erwerbszähler, Forschung/eine Queue, Postbox und Punkte. Explizite Besitzprüfung jeder stadtbezogenen Aktion. Auswahl pro Tab, gefilterte Antworten und Ausgangsstadt in Missionen/Berichten. Neue Städte entstehen ausschließlich über eigene abgeschlossene aktuelle Feldaufklärung, erfolgreiche Eroberung mit überlebender Infanterie, exklusiven Anspruch und Gebührenzahlung aus der gespeicherten Ausgangsstadt.

Spielerschema 16 / Weltschema 4: alte Stadtidentität, Karte, NPC-IDs, Ressourcen, Gebäude, Forschung, Bürgermeister, Bewerber/Porträts, Nachrichten, Versorgung und historische Missionen bleiben erhalten. Neue Ausgangsstadtreferenz ohne Neuberechnung alter Fracht, Zahlung oder Termine. JSON enthält nur `cities`, keine zweite autoritative `player.city`-Kopie. Ansichtsadapter bestehen ausschließlich im Arbeitsspeicher/Protokoll.

Feldkontingente werden einmal serverseitig erzeugt und geteilt gespeichert. Niederlagen erhalten die restlichen Verteidiger; keine Feldregeneration. Anspruch läuft nach gespeicherter TTL ab und stellt das ursprüngliche Kontingent mit neuer Revision wieder her. Stadtplätze werden bereits beim Eroberungsstart reserviert. Weltfeld wird erst nach Sieg exklusiv; konkurrenzielle Ankünfte folgen Zeit/Missions-ID. Historische NPC-Sequenzordnung bleibt erhalten. Keine Beute/Erkundungs-XP oder zusätzliche Eroberungsprämie. Fracht-/Betriebsölrechnung und Rückkehr aus Auftrag 14 bleiben aktiv.

## Ausgeführte Befehle und Ergebnisse

| Befehl | Ergebnis |
| --- | --- |
| `npm test` | 184 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen |
| `npm run build` | Vite-Produktionsbuild erfolgreich |
| `node scripts/validate-multicity-ui.mjs` | Vollständiger realer Chromium-/WebSocket-Ablauf erfolgreich |
| `BROWSER_MOBILE=1 node work/browser-flow.mjs` | Derselbe vollständige Ablauf ab 390×844 Pixel, Tastatur-Feldauswahl, erfolgreich; das versionierte Skript ist die entsprechende Kopie unter `scripts/` |
| `git diff --check` | Keine Whitespacefehler |

Die ursprüngliche Sandbox sperrt lokale Sockets und den eingerichteten Netzwerkproxy. Server-/Browserintegration wurde mit der dafür erteilten Ausführungsfreigabe geprüft. Erste unveränderte Baseline: Build erfolgreich; Socket-Tests meldeten `listen EPERM`. Diese Infrastrukturfehler wurden nicht als erfolgreich geprüfte Tests gezählt.

## Gezielte automatisierte Nachweise

`test/multicity.test.js` prüft:

- Idempotente Schema-15-Migration mit Bürgermeister, globaler Forschungsqueue, Beständen und Porträts; diskrete kanonische JSON-Struktur. Bestehende Migrations-/Logistiktests erhalten die frühere Schemakette und historische Missionen/Fracht.
- Persistente variable Verteidigung, Wiederholung/Neustart, öffentliche Karte ohne private Verteidigung.
- Scoutbericht erst nach Rückkehr, keine Feld-XP, gefälschte Berichts-ID und geänderte Revision abgewiesen.
- Eroberung, Verluste, keine Beute, separate Cargo-/Ölbilanzen, Gründung bereits vor Armeerückkehr und Rückkehr zur ursprünglichen Stadt über Neustart.
- Fehlende Gebühr ohne Teilzahlung, manipulierte Quote, fremder Anspruch, Unicode-Codepoint-/Steuerzeichenprüfung, exakte Ablaufgrenze.
- Zwei gleichzeitige Eroberer: erster Sieg nach Missions-ID; Konkurrenz kehrt ohne Kampf/Prämien und ohne künstliche Truppenverluste zurück. Reservierungen sind von zufälliger Spielerplatzierung ausgeschlossen.
- Vollständige Folge Stadt 2 bis 5, Gebühren 500/1000/1500/2000, nur ein reservierter Platz, sechster Platz abgewiesen und kein weiterer General.
- Niederlage mit dauerhaft verringerter Feldverteidigung, vollständige eigene Verluste, ungültiger alter Bericht und keine Beute/Ansprüche.
- Unabhängige Queues/Bestände/Armeen, lokaler Bürgermeister/Hunger und keine General-Doppelbelegung.
- Forschung wirkt einmal ab ihrem tatsächlichen Abschluss in allen Städten; globaler Landwirtschaftsabschluss verhindert auch in einer anderen Stadt eine genau gleichzeitig fällige Hungerwelle.
- Crash-Injektion bei Sieg und Gründung an Journal-, Welt- und Spielerdateigrenzen: Recovery beziehungsweise verworfene unjournalisierte Aktion, keine doppelte Stadt/Zahlung/Kampfbelohnung/Rückkehr.
- Echte WebSocket-Mehrtabzugriffe mit expliziten Stadt-IDs, fremde/fehlende IDs, Gebührenquote, dauerhafte Gründungs-Deduplizierung, getrennte Bauqueues.
- ENV-Grenzen und unveränderliche Fünf-Städte-Obergrenze.

`test/transport.test.js` prüft zusätzlich `sessionStorage`, automatische explizite `cityId`, verworfene Vorschauen beim Wechsel und verspätete Stadt-/Karten-/Dialogereignisse. Alle bestehenden NPC-, Cargo-, Versorgungs-, Forschungs-, Bewerber-, Portrait-, Postbox-, Punkte- und Servertests laufen weiter. Alte Testfixtures werden als tatsächliches Altschema konstruiert; ihre Erwartungen berücksichtigen die neue Schema-/Ausgangsstadtmetadaten.

## Reale Oberfläche

Chromium öffnet den gebauten Client und kommuniziert über den tatsächlichen WebSocket. Isolierte Testwelt mit kontrollierter Serveruhr und vorab bereitgestellten Rohstoffen/Truppen; Produktionsdaten werden nicht angefasst. Ablauf: registrieren → freies Feld per Tastatur auswählen → Aufklärung prüfen/starten → Rückkehrbericht ansehen → Eroberung prüfen/starten → Anspruch → Gebühr prüfen/bezahlen → neue Stadt auswählen → getrennte Bestände/Armee prüfen → Auswahl per Tastatur und nach Neuladen wiederherstellen → mobile Militäransicht → Armeerückkehr in Ausgangsstadt → Kampfbericht in Postbox. Keine JavaScript-Seitenfehler, mobile Dokumentbreite ohne horizontalen Überlauf. Der mobile Lauf beginnt bereits bei 390 Pixel Breite und durchläuft dieselben Feldaktionen. Tests/Screenshots liegen im ignorierten `work/`.

## Betrieb und Umfangsgrenzen

Weiterhin ein JSON-Prototyp mit serialisierter Weltqueue für einen einzelnen Serverprozess. Keine Prüfung produktiver Last/Mehrprozesskoordination oder echter Betriebsspielstände. Der Browsertest stellt bereits vorhandene Truppen/Öl bereit; die davorliegende Forschungs-/Herstellungskette ist durch bestehende Regressionstests abgedeckt. Neue Stadt startet mit Ressourcen 0 und drei Produktionsgebäuden Stufe 1; globale Forschung wirkt, ohne weitere Gratisarmee/Bewerber/Generäle.

Lieferungen, Stadt-zu-Stadt-Truppenverlegung, PvP, Stadtaufgabe, Anspruchshandel und aktive Föderation sind nicht implementiert. Betreiber sichern vor Schemawechsel die vollständige Welt einschließlich Journal/Regelhistorien; ältere Software kann das neue Schema nicht lesen. Neue ENV-Werte und Compose-Weitergabe sind in `.env.example`, `docs/DEVELOPMENT.md` und `docs/WEBSOCKET.md` beschrieben.
