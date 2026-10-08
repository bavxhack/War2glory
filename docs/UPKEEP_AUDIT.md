# Unterhaltsprüfung – Auftrag 11

Ausgangsstand: main b4a3609, Node.js 24.19.0. Die bestehende Suite bestand vor Änderungen mit 62 Tests. Prüfungen verwenden isolierte Teststände, keine produktiven Daten.

## Reproduzierte Fehler und Korrektur

Neue Regressionstests reproduzierten vor der Korrektur abweichende Verluste bei 0 → 31 gegenüber 0 → 10 → 31 Minuten, ebenso bei Minute 35/46 und gebrochenem Leerstandszeitpunkt. Ursache: vor Schonfristende wurde akkumulierte Mangelzeit modulo Verlustintervall verrechnet. Zusätzlich konnte die exakte Gleichheits-/Modulo-Prüfung bei Bruchteilen Wellen übersehen.

Die Simulation speichert nun die nächste akkumulierte Verlustschwelle, berechnet vor der ersten Welle die echte Restschonfrist und verarbeitet danach periodische Schwellen. Keine künstlichen Cursor-Epsilons. Die neuen Tests prüfen auch Minute 30 exakt, viele kleine Schritte und zwei Wellen nach gebrochenem Leerstand.

Ausbildungsabschlüsse gehören ausschließlich in die Versorgungssimulation. Zusätzliche Abschlussblöcke in WorldStorage wurden entfernt; Befehle rufen die ältere Militärfortschreibung nicht mehr auf. Diese konnte pausierte Ausbildung und Aufklärung außerhalb der gemeinsamen Ereignisordnung abschließen. Standalone-Kompatibilitätsfunktion bleibt für bestehende Integrationen erhalten. Kein Beleg einer doppelten laufenden Nahrungsabbuchung: die Stadt verarbeitet die Nettorate genau einmal.

## Unabhängige Rechnungen

| Fall | Erwartung | Test |
| --- | --- | --- |
| 10 Infanteristen, 1000 Nahrung, keine Produktion, 60 s | 60 Verbrauch, 940 Rest | supply.test.js |
| 10 Infanteristen, Bauernhof 1 | 1/s Produktion, 1/s Unterhalt, netto 0 | supply.test.js |
| 30 Infanteristen, Grundproduktion 2/s, Bürgermeister 10 % | Ertrag 2,2/s, Bedarf 3/s, nach 60 s 48 weniger | supply.test.js |
| 18 Infanteristen + 7 Späher, stationiert/unterwegs | 2,15/s = 7740/h | supply.test.js |
| 100 Truppen, leeres Lager, keine Produktion | erste Welle Minute 30, nächste Minute 35, unabhängig von Abrufen | supply.test.js |

## Balancefazit

360 Nahrung/Stunde je Infanterist und 180 je Späher sind die bisherigen Prototypwerte. 100 Infanteristen benötigen 36.000/h; Bauernhof 1 liefert 3600/h und versorgt zehn. Das ist eine hohe Balanceanforderung, kein nachgewiesener Multiplikationsfehler. Ausbildungs-Einmalkosten sind getrennt. Standards bleiben erhalten. Das optionale ENV-Beispiel 36/18 ist ausdrücklich eine Balancealternative. Historische Verluste/Berichte werden nicht durch erfundene Ausgleichsbuchungen geändert.

## Prüfumfang

Nach der ersten Korrektur: alle 14 Versorgungstests bestanden, einschließlich der zuvor scheiternden Reproduktionen. Die folgenden Ergebnisse stammen aus tatsächlichen lokalen Prüfungen.


## Ergebnis der Gesamtprüfung

Am 08.10.2026 unter Node.js 24.19.0:

| Prüfung | Ergebnis / Beleg |
| --- | --- |
| Bestehende Suite vor Änderungen | 62/62 bestanden |
| Unterhaltskorrektur | 68/68 bestanden; 14 gezielte Versorgungstests im Zwischenstand; 15 im Endstand |
| ENV-Zwischenstand | 73/73 bestanden und Vite-Build erfolgreich |
| Endstand | 87/87 Tests bestanden; `npm test` |
| Frontend | `npm run build` erfolgreich, React/Vite 7.1.7 |
| Native ENV-Startprüfung | wirkliche Node-CLI mit `.env`, Prozess-/CLI-Vorrang; gespeicherte 9×4-Karte/3 NPCs und 0,01/0,005 Nahrung/s |
| Container | lokales AMD64-Image gebaut; isolierter Compose-Start mit eigenem Volume; identische gespeicherte Karte/Raten 36/18 pro Stunde ohne Client-Rebuild |
| Browser | Chromium/Playwright, 1440×1000 und 390×844, getrennte Konten; Universität bauen → Vorschau → bestätigen → Abschluss → Forschungswirkung/Punkte → kleine rechteckige Karte/Suche → Logout/Login |
| Browser-Unterhalt | zehn Infanteristen tatsächlich ausgebildet; vorher 0 im Unterhalt, anschließend `10 × 36 Nahrung/h`, getrennte Ausbildungsanzeige |
| Mobile Sichtprüfung | keine horizontale Seitenüberbreite oder JavaScript-Fehler; nach Korrektur keine überlagernde Ressourcenleiste; Ertrags-/Lagerdetails aufklappbar |

`test/config.test.js` belegt Standards/0/Dezimalwerte, ungültige Werte/Dateien, Vorrang, kleine/rechteckige und 64×64-Karten, unmögliche NPC-Belegung ohne gespeicherte Welt, unveränderte Bestandskarten, kostenlose sichtbare Truppen und voneinander unabhängige Regeln. Neustarttests rechnen Offlinezeit vor Übergang mit alten Raten und danach mit neuen, stellen alte Spielerjournalbilder mit Regelhistorie wieder her und erhalten aktive Mangelzyklusregeln bis Erholung.

`test/research.test.js` belegt Universitätsbau/Gebiet/Investitionen, die 200/200- und 110-Sekunden-Rechnung, Voraussetzungen und atomare Ablehnung, genau einen Auftrag trotz mehrerer Gebäude, Produktions-/Lager-/Bürgermeisterformeln, Punkterechnung, Online-/Offlinegrenzen, Hunger/Erholung, Abrissbindung, unveränderte laufende Dauer bei Ausbau, erhaltenes Wissen nach Neubau und Abschluss vor Beuteeinlagerung bei gleichem Zeitpunkt. Journal-Schreibfehler nach Berechnung und Wiederherstellung im gleichen Prozess erzeugen keine doppelte Stufe oder Punkte.

`test/server.test.js` belegt Forschungsaktionen mit zwei Verbindungen, eine Zahlung/einen Auftrag, abweichende Wiederholung, fremde Universität, private öffentliche Kartendetails, Speicherfehler ohne Abbuchung und Neustart/Deduplizierung. Bestehende Tests decken Skills, Bürgermeister, Farmzug-Verluste/Beute, Hunger, Lagergrenzen, Überbestand, Anmeldung und Sitzungen ab. Snapshot-Abrufe besitzen keinen separaten Abrechnungsweg.

Zusätzlicher bestätigter Altbestandsfehler: Bei einer Stadtzeit vor Versorgungsaktivierung konnte die erste Stadtfortschreibung ihre aktuelle Unterhaltskorrektur auf die gesamte alte Stadtzeit anwenden. Jetzt wird dieses Vorintervall ausdrücklich ohne Unterhalt fortgeschrieben. Regression: 1000 Nahrung, zehn Infanteristen, Aktivierung bei 60 s, Abruf bei 120 s ergibt 940 (keine 120-Sekunden-Rechnung). Die ausdrückliche Demo-Übernahme ergänzt ebenfalls Forschungsdaten und liest die gleiche ENV-Konfiguration.

## Grenzen und nicht durchgeführte Prüfungen

Keine produktiven Daten, reales Langzeitdeployment oder Matrix-Föderation geprüft. Kein ARM64-Containerlauf und keine Prüfung anderer Browser als Chromium. Die lokale Containerprüfung nutzte eine nur für diese Umgebung angepasste Builddatei mit CA-Secret für den vorgeschriebenen Proxy; die Projekt-Dockerdatei und TLS-Prüfung bleiben unverändert. Kritische Absturzfenster werden durch deterministische Journal-/Schreibfehler und Neustarts geprüft; keine Behauptung vollständiger Hardware-/Stromausfallsicherheit. JSON-Speicherung bleibt auf genau einen Prozess je Welt beschränkt.

Vorläufige Forschungskosten, 5-Prozent-Faktoren, Universitätsbeschleunigung und Forschungspunkte sowie bestehende Versorgungsbalance bleiben Reviewwerte. Keine automatische Senkung, keine rückwirkenden Kampfbonusänderungen und keine historischen Ersatzbuchungen.
