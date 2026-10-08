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

Nach der ersten Korrektur: alle 14 Versorgungstests bestanden, einschließlich der zuvor scheiternden Reproduktionen. Gesamtergebnisse und ENV-/Forschungsintegration werden bei Lieferung ergänzt. Browser-/Containerprüfungen werden nur als durchgeführt ausgewiesen, wenn sie tatsächlich ausgeführt wurden.
