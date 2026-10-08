# Auftrag 13: Logistikprüfung

Implementiert und geprüft am 08.10.2026 auf Basis von main `e30e184`. Alle Zahlen bleiben eigene vorläufige Prototypvorschläge, keine War2Glory-Originalwerte. Kein Merge oder Deployment ausgeführt.

## Vollständiger Spielablauf

1. Registrieren bzw. anmelden. Universität auf einem freien zivilen Grundstück bauen und auf Stufe 2 ausbauen. Ein freier General kann die Forschungsleitung übernehmen.
2. Ölverarbeitung erforschen, maximal Stufe 1. Sie kostet 300 Holz/300 Stein, Grunddauer 120 Sekunden. Danach eine zivile Ölraffinerie bauen. Öl beginnt bei 0 und entsteht erst ab dem tatsächlichen Bauabschluss.
3. Lagerlogistik 1 abschließen. Motorisierung erfordert zusätzlich Ölverarbeitung 1 und Universität 2, kostet 500 Holz/500 Stein und hat 240 Sekunden Grunddauer. Bei Führung 20 und Universität 2 dauert sie 182 Sekunden. Freischaltungen bleiben bei Universitätsabriss erhalten.
4. Forschungsleiter abberufen, damit der General einen Marsch führen kann. Eine Kaserne und eine Fahrzeugfabrik auf getrennten Militärplätzen bauen. Eine Fabrik eröffnet keine Offizierssuche.
5. Infanterie in der Kaserne ausbilden, LKWs in der Fabrik herstellen. Pro LKW 100 Holz/100 Stein, keine einmaligen Öl-/Nahrungskosten. Auf Stufe 1 dauert eine Gruppe von vier LKWs 40 Sekunden. Jede Fabrik besitzt drei sequenzielle Gruppenplätze, andere Gebäude arbeiten parallel. Hunger pausiert die vorhandene Herstellung; Ausbau und Abriss sind während ihrer Belegung gesperrt.
6. Auf der Weltkarte einen NPC auswählen, „NPC angreifen“ öffnen, freien General, positive Infanterie und optionale LKWs wählen. „Einsatz prüfen“ zeigt serverseitig Traglast, Hin-/Rückweg, Öl, Unterhalt und Generalboni. Erst „Öl bezahlen und starten“ reserviert General und Truppen. Ein verändertes Angebot verlangt erneute Prüfung.
7. Infanterie kämpft; LKWs geben keine Stärke. Transportverluste folgen proportional den Infanteriekampfverlusten. Beute wird nach Verlusten auf die verbleibende gemeinsame Traglast und den tatsächlichen NPC-Vorrat begrenzt. Während der Rückreise können Hungerwellen weitere Truppen und überzählige Ladung entfernen.
8. Erst bei Rückkehr werden überlebende Typen stationiert und Nahrung bis zur freien Lagerkapazität eingelagert. Der General erhält Kampf-XP und der Kommandant den signierten Kampfbeitrag einmal. Der Bericht erscheint einmal ungelesen in der bestehenden Postbox. Lesen, Wiederanmeldung und Neustart bewahren Bericht und Lesestatus.

## Ausgeführter Browserdurchlauf

Mit lokalem Chromium über die gebaute React-Oberfläche geprüft: Registrierung → Universität 1/2 → Forschungsleitung → Ölverarbeitung → Raffinerie → Lagerlogistik → Motorisierung → Abberufung → Kaserne/Fabrik → 20 Infanteristen und vier LKWs → gemischter Farmzug → Postbox → Abmelden/Anmelden → Serverneustart und Sitzungswiederaufnahme.

Die kontrollierte Testwelt verwendete 20.000 Holz/Stein und 1.000 Nahrung als Startvorrat, weiterhin **0 Öl**, Führung 20 und keine Angriffs-/Verteidigungsboni. Der NPC lag fünf Felder entfernt, mit zehn Verteidigern und 1.000 Nahrung ohne Regeneration. Nur Vorräte/Kartenpositionen und die Serveruhr waren Testfixtures; Gebäude, Forschung, Herstellung, Einsatz, Zahlung und Bericht wurden über die Oberfläche ausgeführt. Die Uhr wurde an echte gespeicherte Abschlusszeiten vorgeschoben; kein Warten auf Echtzeitproduktion behauptet.

| Beobachtung | Ergebnis |
| --- | --- |
| Ölverarbeitung, Universität 2/Führung 20 | 91 Sekunden |
| Lagerlogistik 1, dieselbe Leitung | 46 Sekunden |
| Motorisierung | 182 Sekunden |
| Fertige Truppen | 20 Infanterie, 4 LKW, 0 Späher |
| Öl vor Einsatz | 298 |
| Einsatzvorschau | 1.200 Nahrung Traglast, 40 Öl, 7.920 Nahrung/Stunde, je 25 Sekunden Reise |
| Kampf | 5 Infanterie-/1 LKW-Verlust, 10 NPC-Verluste |
| Rückkehr | 15 Infanterie/3 LKW, 900 Nahrung geladen und eingelagert, 0 Überlauf |
| Belohnung | 20 General-XP, +4 Kampfbeitrag |
| Wiederanmeldung/Neustart | Ein Bericht, gelesen; 15/3 Truppen; +4 Punkte; Öl 308 einschließlich laufender Raffinerieproduktion |

1440×1000 und 390×844 Pixel geprüft. Schmale Karte und Postbox verursachen keinen Dokumentüberlauf; die Truppenbilanz lässt sich innerhalb ihrer beschrifteten Region horizontal scrollen. Einsatzbestätigung per Tastaturfokus/Enter ausgeführt. Keine Browser-JavaScript-Fehler. Bestehende Porträtdatei unverändert erhalten und im Build enthalten.

Dabei gefundene und behobene Fehler: Die WebSocket-Begrüßung löschte bisher den gespeicherten Sitzungsschlüssel; sie ist nun von einer tatsächlich fehlgeschlagenen Anmeldung getrennt. Neue Einsatzvorschauen werden durch den bestehenden zentralen Promise-Transport aufgelöst. Die erste Kampfwertung einer neuen Stadt beginnt ausdrücklich bei null. Die mobile Weltkarte erhält eine begrenzte Spaltenbreite.

## Automatisierte Prüfungen

`npm test`: **127 Tests bestanden, 0 Fehler**; kein Test übersprungen. Tests benötigen lokale Ports und Node-Unterprozesse und wurden mit den dafür nötigen Ausführungsrechten ausgeführt. `npm run build`: bestanden, einschließlich Porträtatlas und neuer eigener SVG-Grafiken.

Neue Tests in `test/logistics.test.js`, `test/logistics-server.test.js` und `test/transport.test.js` ergänzen die bestehende Regression:

- Individuelle Forschungsgrenzen, Abhängigkeiten, serverseitiger Bau-/Herstellungsschutz, Öl-Einstieg ohne Kreisabhängigkeit, Kapazität 3025 und zeitlich exakte Raffinerieproduktion/Abriss/Überbestand.
- Drei Gruppen je Fabrik, parallele Herstellung, nachgewiesene Kosten, Hungerpause/Fortsetzung, Ausbau-/Abrisssperren und Bestände erst nach Abschluss.
- Festkomma-Ölraten: einmalige Gesamtrundung, 40-Öl-Beispiel, konfigurierte Späherkosten, Nullwerte, ungültige Werte/Grenzen, native Datei-/Prozesspriorität und Compose-Weitergabe.
- Sichere Ganzzahlen, typübergreifende Grenze, unbekannte Typen, fremde Generäle, keine reinen LKW-Farmzüge; veraltete/manipulierte Vorschau ohne Teilbuchung.
- Kampf unverändert für Infanterie, Transportverluste bei Sieg/Niederlage, keine LKW-Kampfkraft, unverteidigtes Ziel ohne künstliche Belohnung, ausgefallener Angriff bei fehlender Infanterie.
- Unterhalt stationiert/unterwegs einmal; Null-Unterhaltseinheiten bleiben sichtbar. Tatsächliche Hungerwelle verliert einen LKW und senkt 900 auf 700 Ladung. Rückkehr bei 600 freiem Lager: 600 eingelagert, 100 Überlauf, getrennt von 200 unterwegs verlorener Nahrung.
- Zwei Spieler gegen knappen gemeinsamen Vorrat: geordnete Ankünfte laden zusammen höchstens 500. NPC-Abzug und Spielerzustand sind journalisiert.
- Schreibfehler vor Startjournal ohne Öl-/Truppen-/Sequenzänderung; Fehler nach NPC-Abzug vor Spielerdatei wird aus dem Journal wiederhergestellt, ohne zweite Beute/XP/Punkte/Berichte.
- Zwei Tabs, gleiche ID/Payload, anderer Payload, Wiederanmeldung und Neustart. Selbst nach Ablauf der 30-tägigen allgemeinen Befehlshistorie bleibt die Mission ein dauerhafter Startbeleg (geprüft nach 31 Tagen).
- Schema 12 → 13 und ältere Ketten bewahren Ressourcen, Investitionen, bezahlte Forschung, Queues, Bewerber, Porträts, Nachrichten/Lesestatus. Öl/LKW/Freischaltungen beginnen bei null. Wiederholtes Laden erzeugt keine weiteren Bestände. Missionen der Versionen 1–3 schließen auf Hin- und Rückweg mit alter Wertung und ohne Öl ab.
- Historische Versorgung ohne truck behandelt den Typ als kostenlos, ohne die Historie umzuschreiben. Neuer Unterhalt beginnt beim gespeicherten Regelwechsel. Laufende Missionen behalten ihre Öl-/Traglastaufnahme nach Konfigurationswechsel.
- Große Offlineabrechnung und 1-Sekunden-Schritte stimmen bei Truppen, Terminen, Forschung, Öl und Berichten überein. Vorhandene Gleitkomma-Nahrung kann im Bereich um 10⁻¹² abweichen; verglichen wird mit 10⁻⁹ Toleranz, ohne ganzzahlige Kampfergebnisse zu tolerieren.

## Container und Betriebsprüfung

- `docker compose config --quiet`: bestanden.
- Container aus dem endgültigen Quellstand gebaut. Für den Netzwerkzugang der verwalteten Umgebung wurde eine Kopie des Dockerfiles unter `work/` verwendet, die beim `npm ci` die Plattform-CA als BuildKit-Secret einbindet; TLS-Prüfung blieb aktiv. Das Repository-Dockerfile wurde dafür nicht geändert.
- Image lokal gestartet, `/health` erfolgreich. Abweichende Container-ENV `UPKEEP_TRUCK_PER_HOUR=90`, `OIL_TRUCK_PER_FIELD=0.125`, `TRUCK_CARGO_CAPACITY=250` ergaben 0,025 Nahrung/Sekunde, exakt 125 Öl-Tausendstel/Feld und Traglast 250. Container anschließend beendet.
- Native Starts, Prozessvorrang und Neustarts zusätzlich in vorhandenen/erweiterten Tests geprüft. Kein produktiver Spielstand, Zugangsschlüssel oder Container veröffentlicht.

## Grenzen und Folgearbeit

Die nachträglich ergänzte Bildtafel `logistics-art.png` zeigt Ölraffinerie, Fahrzeugfabrik und LKW im Stil der bestehenden Spielillustrationen. Erneuter Produktionsbuild und alle 127 Tests bestanden. Der vollständige Browserablauf wurde erneut ausgeführt; die Fahrzeugfabrik und LKW-Darstellung wurden bei 1440×1000 und 390×844 geprüft. Die Motive werden lokal über einen von Vite versionierten Import geladen.

Balance/Spieltempo bleiben zu bewerten. Browserablauf wurde mit kontrollierten Vorräten und Uhr ausgeführt; unbeaufsichtigte langfristige Lasttests und vollständige Screenreader-Abnahme sind nicht ausgeführt. Automatische Grenz-/Offline-/Hungerprüfungen ersetzen keine solche Belastungsprüfung. NPCs liefern ausschließlich Nahrung. PvP, Handel, eigenständige Transporte, weitere Kampfeinheiten und aktive Matrix-Föderation bleiben geplant.
