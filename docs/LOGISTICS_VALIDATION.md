# Auftrag 13: Prüfbelege der ergänzten Fassung

Stand: 09.10.2026, auf `main` mit Präzisierung `7d6b31a`. Die Vorarbeit aus offenem PR #16 wurde übernommen und angepasst. Zahlen sind eigene vorläufige Balancevorschläge, keine War2Glory-Originalwerte. Keine Spielstände aus `data/` wurden geändert.

## Ausgeführte Prüfungen

- `npm test`: **146 Tests bestanden**, keine Fehler, keine übersprungenen Tests. Vollständige Regression umfasst Forschung, Generäle/Bewerber/Porträts, Nachrichten/Postbox, WebSocket, Speicherung und bisherige Spielregeln.
- `npm run build`: erfolgreich, React/Vite mit lokal importierten bisherigen und neuen Logistikillustrationen.
- `git diff --check`: erfolgreich.
- `docker compose config --quiet`: erfolgreich. Das lokale Image wurde gebaut und gestartet; `/health` antwortete `{"status":"ok"}`. Container-ENV `MAX_ATTACK_DELAY_MINUTES=120` und `UPKEEP_TRUCK_PER_HOUR=90` ergaben tatsächlich Limit 120, 90 Nahrung/Stunde/LKW und Scope `stationed`. Testcontainer beendet. Für das Netzwerk der Prüfumgebung wurde beim Imagebau eine CA nur temporär an `npm ci` gemountet, mit unveränderter TLS-Prüfung; keine Zertifikate oder Sitzungswerte im Projektimage eingebaut.
- Vollständiger Chromium-Ablauf über echte UI-Aktionen mit kontrollierter Serveruhr bei Desktop 1440×1000 und Mobil 390×844. Vorschau und Postbox visuell geprüft, kein horizontaler Seitenüberlauf, keine Browserfehler. Geänderte Zusatzminuten deaktivierten die Bestätigung bis zur neuen Vorschau. Dialog/Ankunft/Rückkehr blieben nach Wiederanmeldung und Serverneustart korrekt.

Tests benötigen lokale TCP-Testserver und Node-Unterprozesse; die reine Prozesssandbox erlaubte diese zunächst nicht. Alle oben genannten Tests wurden anschließend mit den benötigten lokalen Ausführungsrechten erfolgreich ausgeführt.

## Browserablauf und unabhängige Ergebnisse

Registrierung → Universität 1/2 → Forschungsleitung → Ölverarbeitung → zivile Raffinerie → Lagerlogistik → Motorisierung → Forschungsleiter abberufen → Kaserne/Fahrzeugfabrik → 20 Infanteristen/4 LKW → Farmzug mit einer Zusatzminute → Abmelden/Anmelden → Serverneustart → verspäteter Kampf → Rückkehr → Postboxbericht lesen.

Testfixture: Anfangsvorrat 20000 Holz/Stein, 2000 Nahrung, **0 Öl**, Führung 20 ohne Angriff-/Verteidigungsbonus, NPC fünf Felder entfernt mit zehn Verteidigern und 1000 Nahrung ohne Regeneration. Nur Anfangsvorräte, Kartenpositionen/Generalgrundwerte und Testuhr waren kontrollierte Fixtures. Gebäude, Forschung, Herstellung, Einsatz und Bericht liefen über die gebaute Oberfläche. Die Uhr sprang auf tatsächlich gespeicherte Fertigstellungstermine.

| Beobachtung | Ergebnis |
| --- | --- |
| Ölverarbeitung mit Universität 2 und Führung 20 | 91 Sekunden |
| Lagerlogistik 1 | 46 Sekunden |
| Motorisierung | 182 Sekunden |
| Herstellung abgeschlossen | 20 Infanteristen, 4 LKW |
| Normalöl bei Distanz 5 | 30 je Richtung, 60 zusammen |
| Zusatzminute bei T=25 Sekunden | 72 Mehrkosten; Hinweg 102, Rückweg 30, Gesamt 132 |
| Hinreise / Rückreise | 85 / 25 Sekunden |
| Stadtunterhalt bei Start | 7920 → 0 Nahrung/Stunde |
| Zum ursprünglichen Ankunftstermin | Kein Kampf; NPC-Nahrung unverändert 1000 |
| Tatsächlicher Kampf | 5 Infanterie- und 1 LKW-Verlust; 10 NPC-Verluste |
| Traglast und Beute | 15×20 + 3×200 = 900 Nahrung |
| Rückkehr | 15 Infanteristen/3 LKW wieder stationiert |
| Belohnung / historische Reiseverluste | 20 General-XP, +4 Kampfbeitrag / 0 |
| Einlagerung im konkreten Browserstand | 34 Nahrung, 866 Überlauf bei inzwischen fast vollem Lager |
| Postbox | Ein Bericht, Öl 132 und Zuschlag 72; Lesestatus gespeichert |

Das Lagerbeispiel mit exakt 600 freiem Platz ist separat im Integrationstest unabhängig geprüft: 900 geladen, 600 eingelagert, 300 Überlauf; keine Reise-Hungerreduktion.

## Geprüfte Regel- und Grenzfälle

`test/delayed-logistics.test.js` prüft die neue Fassung zusätzlich zur übernommenen, angepassten Logistik-Testabdeckung:

- Verhältnisbeispiel E=10/T=1 Minute/H=10 Minuten: Zusatzzeit 9 Minuten, Hinweg 100, Rückweg 10, Gesamt 110, Rückkehr nach 11 Minuten. D=10 bedeutet H=11 und 120 Gesamtöl. D=30 ergibt 320 und Zeitplan 31/32 Minuten.
- Linearität vor Gesamtrundung, verschiedene Zusammensetzungen gleich großer Gruppen, Tausendstel/Bruchverhältnisse, positive Typ-Raten auch bei Infanterie/Aufklärung und Überlaufabweisung. Keine Teilrundung von E, Hinweg, Rückweg oder Zuschlag.
- Zusatzzeit 0/Maximum, negative/gebrochene/zu große/NaN/Infinity/String/Null-Eingaben, Aufklärungsverbot für positive Zusatzzeit und sichere Zeitrechnung. Fehlende Eingabe bedeutet 0.
- Geänderte Mengen, Regeln, Generalversion oder Dauer verlangen neue Vorschau; spätere tatsächliche Startzeit verschiebt nur absolute Termine. Fehlendes Öl lässt Vorräte, General und Truppen unverändert.
- Stationierter Unterhalt 7920/Stunde für 20 Infanteristen/4 LKW; vollständige Abreise 0. Teilabreise, Rückkehr, normale Erholung, beibehaltener Mangelzähler bei kurzer Abwesenheit und leere Heimat während langer Reise. Reisende Truppen/Ladung bleiben unbeschädigt.
- Kampf erst zur tatsächlichen verzögerten Ankunft, Beute nach Verlusten, unveränderte Infanteriekampfstärke durch LKWs, 900-Traglastbeispiel, Niederlage/unverteidigtes Ziel und historischer Fall ohne Infanterie.
- Unterschiedlich verzögerte echte Ankünfte teilen knappen NPC-Vorrat in tatsächlicher Reihenfolge. Großer Offline-Schritt und kleine Schritte ergeben identische Spielstände. Gleichzeitige Ankünfte bleiben durch Ereignissequenzen geordnet.
- Historische Regeln ohne Scope zählen `all-living`. Alte Reise-/Ladungsverluste bleiben erhalten, neue Zeiträume nutzen `stationed`. Aktiver Hungerzyklus behält alte Frist/Prozentsatz; Verlustgruppen folgen sofort dem aktuellen Scope.
- Einführungsgrenze beim Neustart: zuerst bis dahin fällige Altregel-Ereignisse, danach persistierter neuer Scope. Eine exakt dort fällige alte Welle bleibt Teil der vor dem Wechsel abgeschlossenen Abrechnung. Keine erneute Aktivierung beim nächsten Neustart und keine individuellen Login-Grenzen.
- Rückkehr genau an einer Stadt-Hungergrenze: Nahrung zuerst einlagern; ausreichende Beute verhindert Welle. Ohne ausreichende Beute werden nun stationierte Rückkehrer mitgezählt. Dies erzeugt Stadtversorgungsereignisse und keine Reise-/Kampfverluste im Bericht.
- Schema 12 und ältere Ketten über Schema 13 → 14, einschließlich alter Kampfversionen 1–3, ursprünglicher Forschungs-/Reisezeiten, Queues, Investitionen, Bewerber, Porträts, Nachrichten und Lesestatus. Historische Null-Öl-Snapshots bleiben gültig; fehlende Zusatzzeit wird 0 ohne Neuberechnung der Termine.
- Fehlgeschlagene Migrationsspeicherung lässt die ursprüngliche Datei erhalten. Journalunterbrechung nach Weltaktivierung oder NPC-Abzug/vor Spieler-Rename wird wiederhergestellt. Kein doppelter Kampf, kein doppeltes Öl, keine zweite Belohnung/Beute oder Bericht.
- Gleichzeitige Starts aus zwei Tabs, widersprüchliche Wiederholung und dauerhafter Request-Beleg nach Neustart/gewöhnlicher Belegfrist. Niedrigeres neues Verzögerungslimit und neue Preise verändern keinen gestarteten Missionsplan.
- Native Datei-/Prozesspriorität und Compose-Weitergabe. Unterhalts-Nullwerte zulässig; Öl-Nullwerte und entfernter Minutenpreis vor Spielstandänderung konkret abgewiesen. Getrennte Weltkonfigurationen bleiben unabhängig.

## Einschränkungen und Folgeplanung

Der vollständige Browserablauf wurde mit Prüfuhr und kontrolliertem Anfangsstand ausgeführt; mehrtägige Lasttests und vollständige Screenreader-Abnahme wurden nicht durchgeführt. JSON-Speicherung bleibt der vorhandene Einprozess-Prototyp. Balance und Spieltempo benötigen Nutzerreview.

NPC-Beute bleibt ausschließlich Nahrung. Keine Umsetzung von PvP, Handel, unabhängigen Transportmissionen, Flugzeugen, Raketenwerfern, neuen Luftfähigkeiten oder aktiver Matrix-Föderation. Diese Themen bleiben im Projektplan vorgemerkt. PR #16 bleibt unverändert; der neue Branch stellt die aktualisierte Fassung zur Prüfung bereit. Kein Merge oder Deployment.
