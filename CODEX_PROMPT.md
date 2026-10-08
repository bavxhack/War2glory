# Codex-Auftrag 13: Forschungsfreischaltungen, Ölwirtschaft und LKW-Farmzüge

## Auftrag und Arbeitsweise

Der Nutzer bestätigt Auftrag 12 am 08.10.2026 als abgeschlossen und beauftragt den nächsten Schritt. Implementiere einen vollständigen Ablauf: Ölverarbeitung erforschen → zivile Ölraffinerie bauen → Motorisierung erforschen → Fahrzeugfabrik auf Militärbauplatz bauen → LKWs herstellen → Infanterie und LKWs gemeinsam zum NPC schicken → begrenzte Nahrung erbeuten und zurückbringen.

Der Planungschat aktualisiert ausschließlich Anweisungen. Du implementierst auf Basis des aktuellen main in bavxhack/War2glory, liest AGENTS.md, README.md, docs/PROJECT.md, docs/WEBSOCKET.md und docs/DEVELOPMENT.md, beachtest offene PRs/fremde Änderungen und lieferst einen getesteten PR ohne selbstständiges Merge/Deployment. Vorläufige neue Zahlen sind eigene Balancevorschläge, keine War2Glory-Originalwerte.

Auftrag 12 sowie die danach ergänzten individuellen Porträts und die Postbox erhalten. Im gelesenen Stand ist Spielerschema 12 aktiv, nicht mehr 9 oder 10. Der Planungschat hat Code gelesen, keine Anwendungstests ausgeführt.

Reihenfolge als nachvollziehbare Teilcommits:
1. Neue Ressource, zwei Forschungsfreischaltungen und Gebäude.
2. Fahrzeugherstellung und typabhängige Einsatzvorschau einschließlich Öl.
3. Gemischte Farmzüge, Transportverluste, Versorgung und Berichte.
4. Migration/Integration prüfen und Dokumentation vervollständigen.

## 1. Konkrete Ansatzpunkte

Gegen tatsächlichen Arbeitsstand verifizieren:
- packages/game-core/index.js: RESOURCE_KEYS enthält wood/stone/food; Bauangebote, Ressourceninitialisierung, Kapazitäten, Investitionen, Produktion und Rückerstattung auf Öl erweitern.
- packages/game-core/research.js: derzeit ein globales maxLevel und einheitliche Kosten/Dauer. Technologien benötigen eigene Voraussetzungen, Maximalstufe und Grundkosten/-dauer, ohne alte Technologien zu verändern.
- packages/game-core/military.js: Einheiten scout/infantry, Ausbildung bislang kasernengebunden; startRaidMission und Missionsdaten nutzen einzelne Infanteriefelder.
- packages/game-core/supply.js: livingUnitGroups, Hungerverluste und Rückwegtraglast sind teilweise explizit an Infanterie bzw. Späher gebunden.
- apps/server/storage.js: Kampfauswertung, Beute und Rückkehr rechnen derzeit mit survivors × 20 sowie Infanterie. Diese Stellen gemeinsam generalisieren; nicht nur UI-Eingabe für LKWs ergänzen.
- Auftrag 12 verwendet npc-pve-3-general-bases-provisional, Grundwerte plus Skills und beim Start gespeicherte Boni. Alte Kampfversionen weiter unterstützen.
- Storage enthält Schema 12, Porträtmigrationen, Nachrichten und Lesestatus. Nächste Migration daran anschließen; kein Überspringen alter Migrationen.
- Postbox statt paralleler neuer Berichtsliste verwenden; vorhandene Nachrichtenfunktion nicht verändern.

Für neue Missionen ein verbindliches Mengenmodell je Einheitentyp verwenden. Alte skalare Missionsfelder können über einen klaren versionsbezogenen Adapter gelesen werden; niemals beide Darstellungen als zwei Bestände zählen.

## 2. Öl als vierte Ressource

- Neue Ressource oil mit deutscher Anzeige „Öl“. Neue und migrierte Städte beginnen mit 0 Öl; Holz/Stein/Nahrung erhalten.
- Ölraffinerie ist ein ziviles Ressourcenproduktionsgebäude, niemals auf Militärbauplätzen.
- Freischaltung über abgeschlossene Ölverarbeitung (siehe Abschnitt 3). Erste Forschung, Raffinerie und Fahrzeugfabrik benötigen kein Öl, damit kein unerreichbarer Kreislauf entsteht.
- Raffinerie ausbaubar bis bestehender Gebäudehöchststufe. Vorläufig dieselbe Baukosten-/Zeitkurve wie andere zivile Gebäude: Zielstufe n kostet 40n Holz/30n Stein, dauert 5n Sekunden. Bestehende gemeinsame Bauwarteschlange verwenden.
- Produktion vorläufig 1 Öl pro Sekunde je fertiger Raffineriestufe. Keine zusätzliche Rohöl-Ressource, Verarbeitungskette oder Bürgermeisterwirkung auf Öl.
- Ölkapazität vorläufig 2000 Grundkapazität + 250 je Raffineriestufe oberhalb 1 + 500 je Lagerhausstufe; Lagerlogistik multipliziert wie bei anderen Ressourcen, abschließend abrunden.
- Beispiel Raffinerie 2 + Lagerhaus 1 + Lagerlogistik 2: floor((2000 + 250 + 500) × 1,10) = 3025 Ölkapazität. Der Ausbau erzeugt keinen Ölvorrat.
- Produktion erst ab tatsächlicher Fertigstellung, Lager- und Offlineabrechnung wie vorhandene Ressourcen. Bestehende positive Überbestände bei Kapazitätsverlust erhalten.
- Abriss mit vorhandener Vorschau und nachgewiesener Teilrückerstattung, Produktions-/Kapazitätsverlust und Bauplatzfreigabe. Keine Investitionen aus heutigen Preisen erfinden.
- Öl in Ressourcenanzeige, Kosten-/Kapazitätsansichten, privatem Snapshot, Lagerhausvorschau, Bau/Abriss und persistiertem Modell ergänzen. Allgemeine Helfer dürfen nicht still nur drei Ressourcen behandeln.
- NPCs bleiben in dieser Etappe reine Nahrungsziele; Öl wird dort nicht als neue Beute oder Vorrat hinzugefügt.

## 3. Zwei Forschungsfreischaltungen

Vier bestehende Wirtschafts-/Lagertechnologien bleiben unverändert. Zwei neue Technologien mit jeweils genau einer abschließbaren Stufe:

| Technologie | Voraussetzungen | Kosten | Grunddauer vor Universitäts-/Generalbonus | Schaltet frei |
| --- | --- | --- | --- | --- |
| Ölverarbeitung | Eigene fertige Universität mindestens Stufe 1 | 300 Holz, 300 Stein | 120 Sekunden | Ölraffinerie |
| Motorisierung | Universität mindestens Stufe 2, Ölverarbeitung 1, Lagerlogistik 1 | 500 Holz, 500 Stein | 240 Sekunden | Fahrzeugfabrik und LKW-Herstellung dort |

- Diese Technologien erhöhen nicht automatisch Produktion/Traglast oder Forschungsfaktoren. Es sind Freischaltungen, keine weiteren 5-Prozent-Boni.
- Forschungsdefinitionen enthalten Typ, individuelle Maximalstufe, Voraussetzungen, Kosten, Grunddauer und freigeschaltete Inhalte.
- Dauer = max(1, ceil(Grunddauer / (Universitätsfaktor × Forschungsleiterfaktor))) Sekunden, wie bisher einmal runden.
- Beispiel Motorisierung an Universität 2 mit Führungsbonus 20 Prozent: ceil(240 / (1,1 × 1,2)) = 182 Sekunden.
- Weiter eine aktive Forschung je Stadt, keine Warteschlange/Abbruchfunktion. Forschungsleiterbindung, versionierte Vorschau und gespeicherte Dauer erhalten.
- Freischaltung erst ab tatsächlichem Abschluss. Server prüft Voraussetzungen bei Vorschau UND Aktion; CSS-Sperren genügen nicht.
- Abgeschlossenes Wissen bleibt nach Universitätsabriss erhalten; bestehende Gebäude/Einheiten werden dadurch nicht gesperrt oder vernichtet.
- Je neue abgeschlossene Stufe 10 Forschungspunkte nach bestehender abgeleiteter Regel, kein zusätzlicher Ereignisbonus.
- Alte research-1- und research-2-Aufträge mit ursprünglicher Dauer/Kosten korrekt fertigstellen. Neue Technologiekenntnisse bei Migration 0; keine kostenlosen Freischaltungen.
- UI zeigt erreichbare Abhängigkeiten und verständliche Sperrgründe. Kein umfangreicher leerer Technologiebaum.

## 4. Fahrzeugfabrik und LKW-Herstellung

- Neue ausbaubare Fahrzeugfabrik gehört ausschließlich auf Militärbauplätze. Ressourcengebäude bleiben dort verboten.
- Freischaltung durch Motorisierung; vorläufig bestehende Baukosten/-dauer und Gebäudehöchststufe übernehmen. Gemeinsame Bauwarteschlange und vorhandene Gebäudepunkte.
- Fahrzeugfabrik produziert keine Ressourcen und vergrößert kein Lager.
- LKWs ausschließlich dort herstellen, Infanterie/Späher weiterhin in Kasernen. Eine Fahrzeugfabrik erfüllt nicht die Kasernenvoraussetzung für Offiziersbewerber.
- Herstellung nach vorhandenem Ausbildungsmodell: drei sequenzielle Gruppen je Fabrik, andere Gebäude parallel; höchstens 1000 Einheiten pro Auftrag.
- Vorläufig pro LKW 100 Holz und 100 Stein, kein Öl und keine Nahrung als einmalige Herstellungskosten. Öl ist Mobilmachungskosten, laufender Nahrungsunterhalt wird gesondert abgerechnet.
- Grunddauer 10 Sekunden je LKW, geteilt durch Fabrikstufe nach bestehender Gruppen-Rundungsregel. Kosten und Stufe/Dauer beim Einreihen festhalten.
- Erst fertige Gruppe wird verfügbar und unterhaltspflichtig. Hungrige Stadt pausiert Fahrzeugherstellung wie bisher Kasernenausbildung; später fortsetzen ohne erneute Zahlung.
- Herstellung während Fabrikausbau gemäß bisheriger Kasernenregel sperren. Fabrikabriss bei laufender/wartender Herstellung blockieren; vorhandene fertige LKWs nach Abriss erhalten.
- Gemeinsam genutzte Ausbildungshelfer gebäudetypabhängig erweitern. Alte barracksSlotId-Aufträge sicher lesen/migrieren; niemals einem falschen Gebäude zuordnen.
- Keine parallele zweite Queue-/Zeitimplementierung.

## 5. Einheitenwerte und Öl für Mobilmachung

Vorläufige Werte:

| Typ | Kampfwirkung | Nahrungstraglast | Nahrung pro Stunde | Öl je Einheit/Feld/einfache Strecke |
| --- | --- | --- | --- | --- |
| Infanterie | Bestehende Kampfformel | 20 | Bestehende ENV, Standard 360 | 0,1 |
| Späher | Bisherige Aufklärung, nicht in Farmzügen | 0 | Bestehende ENV, Standard 180 | 0,5 |
| LKW | 0 Angriff, keine zusätzliche Kampfstärke/Schutzwirkung | 200 | 180 | 1 |

- LKW ist transportfähig, nicht unverwundbar. Keine Erhöhung der Infanteriestärke, Siegchance oder Verringerung ihrer Verluste allein durch mehr LKWs.
- Nutzerergänzung nach Umsetzung: Auch reine Infanterieangriffe und Aufklärungen kosten standardmäßig Öl. Vorläufige neue Standards sind 0,1 für Infanterie und 0,5 für Späher je Feld/einfache Strecke. Zuerst Ölverarbeitung erforschen und eine Raffinerie bauen; Betreiber können typabhängige Raten weiterhin ändern.
- Fahrgeschwindigkeit zunächst wie vorhandene Farmzüge: pro Richtung max(5 Sekunden, ceil(Luftlinienentfernung) × 5 Sekunden). Keine neue Wegfindung, Geländekosten oder Geschwindigkeitsboni.
- Für neue Missionen Distanzfelder d = max(1, ceil(Luftlinienentfernung)).
- Gesamtöl = ceil(2 × d × Summe(entsendete Anzahl je Typ × Ölrate je Typ)). Faktor 2 umfasst Hin- und Rückweg; nur Gesamtsumme einmal aufrunden.
- Beispiel 20 Infanteristen und 4 LKWs bei Distanz 5: ceil(2 × 5 × (20 × 0,1 + 4 × 1)) = 60 Öl. Zwei Späher über fünf Felder kosten 10 Öl.
- Gesamtes Öl beim erfolgreichen Start aus der Heimatstadt einmalig abbuchen, zusammen mit Truppenreservierung, Generalbindung, Missionssnapshot und Wiederholungsbeleg.
- Fehlendes Öl verhindert Start ohne Teilbuchung. Keine spätere Rückwegabbuchung, kein zusätzliches Öl pro Tick und kein automatisches Auffüllen.
- Verluste oder ausgefallener Angriff erstatten keinen bereits bezahlten Kraftstoff. Keine neue Abbruchaktion in diesem Auftrag.
- Neue Infanterie- und Spähereinsätze benötigen standardmäßig Öl, einschließlich serverseitiger Ölvorschau/-prüfung für Aufklärung. Explizite Betreiberwerte bleiben wirksam.
- Alte bereits laufende Missionen behalten 0 neu fällige Ölkosten; niemals rückwirkend belasten.
- Neue Mission speichert Entfernungsgrundlage, Hin-/Rückwegkosten, Einheitensnapshot, Preisregelversion, bezahltes Gesamtöl und Traglastwerte. Künftige Konfigurationswechsel verändern diese Werte nicht.
- Ölverbrauch und Kapazität anhand tatsächlich gestarteter Truppen; Client kann weder Preise noch Distanzen festlegen.

## 6. Gemischter Farmzug und klare Verlustregeln

Start:
- Spieler wählt freien eigenen General, positive Infanteriezahl und optional nicht negative LKW-Zahl. Späher bleiben für Farmzüge gesperrt.
- Reine LKW-Farmzüge ablehnen, auch bei zuletzt unverteidigtem Ziel. Mindestens ein Infanterist beim Start erforderlich.
- Vorhandene 10.000-Einheiten-Grenze umfasst Summe aller entsendeten Typen. Kein militärisches Führungslimit wieder einführen.
- Alle Mengen sichere Ganzzahlen, unbekannte Typen ablehnen; stationierte verfügbare Bestände prüfen und gemeinsam reservieren.
- Vorschau zeigt Truppen, Reisefristen, Öl, Nahrung pro Stunde und maximale Starttraglast. Keine ungeklärten aktuellen NPC-Vorräte/Garnisonen oder garantierte Beute offenlegen. Alte Aufklärung bleibt datierter Bericht.

Kampf:
- Neue gemischte Missionsregelversion, beispielsweise npc-pve-4-logistics-provisional. Infanteriekampf unverändert nach der Grundwert-/Skillregel aus Auftrag 12 rechnen.
- Kampfwerte ausschließlich aus beim Start gespeicherten Generalboni und bei Ankunft noch lebender Infanterie. LKWs zählen nicht zu Angreiferstärke und verursachen keine Verteidigerverluste.
- Sei I die bei Kampfbeginn lebende Infanterie, T die dann lebenden LKWs und L die durch diesen Kampf verlorene Infanterie. LKW-Kampfverluste = min(T, ceil(T × L / I)), wenn I > 0. Bei L = 0 keine LKW-Verluste. Ganzzahlig sicher berechnen.
- Das gilt bei Sieg und Niederlage. Überlebende beider Typen kehren zurück; Niederlage bringt keine Beute. Keine Erbeutung oder Reparatur beschädigter Fahrzeuge.
- Sonderfall I = 0 bei Ankunft durch Hunger: Angriff fällt aus, keine Verteidigerverluste, keine Beute/XP/Kampfpunkte; verbliebene LKWs treten den planmäßigen Rückweg an. Kein Teilen durch null. Hunger bleibt aktiv.
- Bei unverteidigtem Ziel und I > 0 Sieg ohne Kampfverluste, aber weiterhin ohne künstliche Kampf-XP oder Punkte.
- General überlebt gemäß bisherigen Regeln und bleibt bis zur Rückkehr gebunden.

Beute:
- Erst NACH Kampfverlustrunden: Kapazität = überlebende Infanterie × 20 + überlebende LKWs × gespeicherte LKW-Kapazität.
- Geladene Nahrung bei Sieg = min(floor(tatsächlich verfügbarer NPC-Nahrung), Kapazität). Keine Beute bei Niederlage/ausgefallenem Angriff.
- NPC-Abzug und Missionsladung atomar im Weltjournal, weiter für alle Spieler gemeinsame NPC-Bestände und geordnete gleichzeitige Ankünfte.
- Beispiel ohne Generalboni: 20 Infanteristen + 4 LKWs gegen 10 Verteidiger. Infanterieverlust 5, LKW-Verlust ceil(4 × 5 / 20) = 1. Es bleiben 15 Infanteristen und 3 LKWs, Kapazität 15 × 20 + 3 × 200 = 900. Bei 1000 NPC-Nahrung werden 900 geladen, bei 500 nur 500.
- Allgemeine Traglastfunktion verwenden, dieselbe in Vorschau, Kampf, Hunger und Rückkehr; Ressourcen später nicht jeweils mit voller identischer Kapazität beladen.
- In dieser Etappe ausschließlich Nahrung als Beute. Kein Handel, selbstständiger Transportauftrag oder PvP.

## 7. Unterhalt, Hungerverluste, Rückkehr und Punkte

- Jeder lebende LKW benötigt Nahrung gemäß ENV, stationiert und unterwegs genau einmal. In Produktion befindliche LKWs noch nicht zählen.
- Beispiel Standardwerte: 20 Infanteristen und 4 LKWs = 20 × 360 + 4 × 180 = 7920 Nahrung/Stunde = 2,2/Sekunde.
- Rückkehrende Mission zählt aktuelle Überlebende pro Typ, nicht ursprünglichen Bestand zusätzlich. Abgeschlossene Missionen zählen nicht.
- Bestehende Schonfrist, proportional/deterministisch verteilte Hungerwellen und Erholungsregeln auf LKW-Gruppen erweitern. Auch LKWs können bei Hunger dauerhaft ausfallen.
- Null-Unterhaltswerte bleiben gültig; solche Einheiten weiterhin anzeigen, nicht in hungerpflichtige Verlustgruppen nehmen. Gemischte Einheiten mit unterschiedlichen Kosten korrekt erfassen.
- Nach Hungerwelle aktuelle Gesamttraglast berechnen und überschüssige Ladung dauerhaft entfernen. In Berichten separat ausweisen, nicht wieder beim NPC gutschreiben.
- Beispiel mit 15 Infanteristen, 3 LKWs und 900 geladener Nahrung: Ein LKW fällt auf Rückweg aus → Kapazität 700, 200 Nahrung gehen verloren.
- Wenn alle Infanteristen auf Rückweg sterben, dürfen überlebende LKWs weiter vorhandene Beute transportieren; Begleitpflicht gilt für Angriff, nicht als zusätzliche automatische Vernichtung auf Rückweg.
- Alle Truppen tot: Ladung vollständig verloren, General kommt zum bestehenden Rückkehrtermin zurück; keine zweite Rückkehrbelohnung.
- Bei Rückkehr alle noch lebenden Typen stationär hinzufügen, Nahrung bis zur dann freien Lagerkapazität einlagern; Überlauf verfällt nach bestehender Regel.
- Kampfverluste, spätere Hungerverluste, geladene Nahrung, unterwegs verlorene Nahrung, eingelagerte Nahrung und Lagerüberlauf getrennt speichern, nicht rückwirkend Kampfergebnis überschreiben.
- General-XP weiterhin 2 je getötetem NPC-Verteidiger. Keine XP für LKWs, Transportmenge oder Verluste.
- Vorläufiger Kampfbeitrag neuer Missionen: getötete NPC-Verteidiger minus eigene im Kampf verlorene Infanteristen minus eigene im Kampf verlorene LKWs, je Einheit ein Punkt. Hunger weiter ohne zusätzlichen Kampfpunktabzug.
- Beispiel oben: 10 − 5 − 1 = +4 Kampfpunkte und 20 General-XP. Nur einmal bei bisherigem Belohnungszeitpunkt buchen. Alte Missionen/Berichte behalten alte Wertung.
- Forschungspunkte bleiben abgeleitet; keine doppelte Gutschrift über neue Freischaltungsereignisse.

## 8. ENV und Regelwechsel

Bestehenden zentralen Konfigurationseinstieg verwenden; reine Spiellogik erhält Konfiguration explizit.

| Variable | Standard | Einheit |
| --- | --- | --- |
| UPKEEP_TRUCK_PER_HOUR | 180 | Nahrung je lebendem LKW/Stunde |
| OIL_INFANTRY_PER_FIELD | 0.1 | Öl je Infanterist/Feld/einfache Strecke |
| OIL_SCOUT_PER_FIELD | 0.5 | Öl je Späher/Feld/einfache Strecke |
| OIL_TRUCK_PER_FIELD | 1 | Öl je LKW/Feld/einfache Strecke |
| TRUCK_CARGO_CAPACITY | 200 | Nahrungstraglast je LKW |

- Unterhalt wie vorhandene Unterhaltsvariablen validieren, inklusive 0. Ölraten 0–100.000 mit maximal drei Nachkommastellen; einmal auf feste ganzzahlige Tausendstelbasis bringen, damit Aufrundung nicht durch binäre Rundungsfehler zusätzlichen Treibstoff verlangt.
- Kapazität Ganzzahl 1–1.000.000. Ungültig/leer/negativ/NaN/Infinity/Überlauf vor Spielstandänderung ablehnen; fehlend nutzt Standard, explizit 0 bei Unterhalt/Öl nicht ersetzen.
- Preise, Forschungs-/Bau-/Produktionswerte und Herstellungsdauer zentral in versionierten Definitionen halten; dafür in diesem Auftrag keine zusätzlichen ENV-Schalter nötig.
- .env.example, native Starts, Prozessvorrang, Compose-Weitergabe und zulässige Snapshotwerte ergänzen. Keine ganze ENV an Client, kein Frontend-Rebuild nötig.
- Unterhaltsänderung über vorhandene gespeicherte Versorgungsregelhistorie: alte Offlinezeit mit alten Werten, neue Werte erst ab gespeichertem Wechsel. Historische Regeln ohne truck entsprechen für diesen Typ 0, keine nachträgliche Historienmutation.
- Aktive Hungerzyklen bewahren ihre bisherigen Frist-/Verlustregeln. Änderungen dürfen keinen Reset verschenken.
- Neue Ölraten/Traglast gelten nur für neu gestartete Einsätze. Bereits bezahlte Missionen verwenden gespeicherte Werte auch nach Neustart.
- Versionierte Vorschau erkennt Konfigurationsänderung und verlangt neue Prüfung, keine heimliche Nachberechnung beim Start.
- Zwei Weltinstanzen mit verschiedenen Einstellungen dürfen sich nicht beeinflussen.

## 9. Zeit, Speicherung, Migration und WebSocket

- Neue Aktionen/Angebote/Push-Zustände ausschließlich über vorhandenen WebSocket. Bestehende Ausbildungs-/Bau-/Forschungsbefehle gezielt erweitern, Missionen um serverseitige Vorschau ergänzen.
- Vorschau bindet eigene Truppenmengen, General-ID/Version, Ziel-ID, relevante Regeln und Voraussetzungen. Start prüft aktuellen Bestand, Öl, Rolle und Eigentum erneut. Ein zwischenzeitlich veränderter sichtbarer Vorschauwert erfordert erneute Bestätigung.
- Keine private HTTP-Spiel-API, Client-Timer oder zweite Tickautorität. Fällige Ereignisse vor Befehlsprüfung bis Serverzeit verarbeiten.
- Bei gleichem Zeitstempel bisherige Ordnung erhalten: Wirtschafts-/Forschungsabschlüsse, geordnete Missionsereignisse einschließlich Einlagerung, dann verbleibende Hungerwelle.
- Forschung/Bauproduktion ab tatsächlichem Abschluss; Herstellung, Ölverbrauch, Kampf und Hunger zeitlich konsistent auch bei langen Offlineintervallen.
- Zahlung + Herstellung/Start + Reservierung + Generalbindung + Deduplizierungsbeleg vor Erfolgsantwort konsistent speichern. Gleiche requestId/Payload nur einmal, abweichender Payload abweisen. Fehler darf keinen nur teilweise geänderten Arbeitsspeicher hinterlassen.
- Welt-/Spieleränderungen weiter über Journal; Ausfall zwischen NPC-Abzug und Spielerspeicherung wiederaufnehmbar.
- Versionierte Migration ab aktuellem Schema 12 auf nächste freie Version. Ältere Ketten vollständig ausführen; vorher Journal wiederherstellen.
- oil=0, truck=0 und neue Forschungsstufen=0 ergänzen; vorhandene Ressourcen, Gebäude, Investitionen, Forschung, Missionen, Generalprofile, Erwerbszähler, Bewerbertermine, Porträts, Nachrichten und Lesestatus bewahren.
- Neue Städte ebenfalls Öl 0. Keine rückwirkende Ölproduktion ohne Raffinerie, keine kostenlosen LKWs oder Freischaltungen.
- Alte Missionsversionen 1–3 anhand alter Felder/Regeln auf beiden Reisephasen korrekt fertigstellen. Keine neuen Truckverluste/Ölrechnungen und keine geänderten historischen Berichte.
- Ressourcenschlüssel in alten Investitionsobjekten vorsichtig erweitern; fehlendes Öl ist 0, unbekannte alte Holz-/Steinkosten bleiben unbekannt.
- Unbekannte/inkonsistente Schemas konkret melden, nie automatisch zurücksetzen. Keine Umplatzierung oder Vermehrung von Bauplätzen.

## 10. Oberfläche und Postbox

- Forschung zeigt zwei neue Freischaltungen mit Bedingungen und Wirkung.
- Stadt bietet freigeschaltete Ölraffinerie; Militär Fahrzeugfabrik und LKW-Produktion. Gesperrte Angebote nennen fehlende Forschung.
- Öl in Sidebar/Lageraufschlüsselung; Nahrung weiter mit Brutto, Bürgermeister, Forschung, typabhängigem Unterhalt und Netto.
- Militärübersicht zeigt LKW-Bestand, stationiert, unterwegs und in Herstellung getrennt.
- Einsatzdialog zeigt wählbare Infanterie/LKWs, Traglast, Öl für Hin/Rückweg, Reisezeit, stündlichen Nahrungsbedarf und Bestätigung. Klar erklären: mehr LKWs ist keine höhere Kampfkraft, Starttraglast ist keine garantierte Beute.
- Bestehende private Aufklärungsinformationen mit Datum verwenden, keine Live-NPC-Geheimnisse in Vorschau.
- Neue gemischte Angriffsberichte in vorhandener Postbox: Startmengen, Kampf-/Hunger-/Rückkehrmengen je Typ, Kraftstoff, Boni, Traglast, Beuteverlust und Einlagerung. Alte Berichte weiterhin korrekt anzeigen, fehlende alte Ölwerte als nicht erhoben/alte Version statt erfundene Zahlung.
- Neue Berichte und Ungelesenzähler/Animation genau einmal auslösen. Bereits gelesene Berichte und private Nachrichten erhalten.
- Illustrationen/Porträts erhalten; für Raffinerie, Fabrik und LKW passende eigene lokal ausgelieferte Darstellung erstellen, keine Originalgrafiken des Vorbilds übernehmen.
- Schmale Bildschirme und Tastaturbedienung überprüfen. Keine nur scheinbar bedienbaren Platzhalter.

## 11. Abnahme und Tests

Mit unabhängigen Erwartungen prüfen:
1. Technologieabhängigkeiten, individuelle Maximalstufe 1, alter Maximalwert 5, echter serverseitiger Bauschutz und erreichbarer Start ohne Öl. Motorisierung mit Universität 2/Führung 20 dauert 182 Sekunden.
2. Ölressource mit 0, Produktion ab Fertigstellung, Beispielkapazität 3025, Lagerhaus-/Lagerlogistikwirkung, Offlineproduktion und Abriss/Überbestand.
3. Raffinerie nur zivil, Fabrik nur militärisch; LKW nur Fabrik, andere Einheiten nur Kaserne. Bauplätze und alte Queues unverändert.
4. Gruppenherstellung: einmalige Kosten, Fertigstellung, mehrere Fabriken, Hungerpause/Fortsetzung, Ausbau-/Abrisssperre und Neustart.
5. Distanz-5-Beispiel mit 20 Infanteristen/4 LKWs kostet 60 Öl. Reine Infanterie und Aufklärung haben positive Standardkosten. Fehlendes Öl keine Teilbuchung. Ölraten 0 gültig; konfigurierter Späherbedarf auch beim Aufklärungsstart geprüft. Rundung einmal über gesamte Hin-/Rückstrecke.
6. Maximalmenge typübergreifend, unbekannte Typen, negative/gebrochene Mengen, reine LKW-Mission und fremde Generäle/Bauten/Truppen abgewiesen.
7. Kampfbeispiel 20 Infanterie/4 LKW gegen 10 ohne Boni: 5 Infanterie- und 1 LKW-Verlust, Kapazität 900, XP 20, Kampfbeitrag +4. Dieselbe Infanterie ohne LKW erzeugt dieselben Verteidiger-/Infanterieverluste.
8. Niederlage mit Überlebenden, vollständiger Kampfverlust, unverteidigtes Ziel und Infanterie bereits vor Ankunft durch Hunger verloren. Keine LKW-Kampfkraft oder Teilung durch null.
9. Gemeinsamer NPC mit knapper Nahrung und konkurrierenden Angriffen: Summe Beute nie größer als tatsächlicher Bestand plus korrekte Regeneration.
10. Unterhalt 20 Infanteristen/4 LKW = 7920 pro Stunde. Stationierung → Hinweg → Kampf → Rückweg → Rückkehr ohne Doppelzählung; Null-Unterhalt, Ausbildung und hungerbedingte Verluste pro Typ.
11. Rückwegbeispiel 900 Nahrung/15 Infanterie/3 LKW: Verlust eines LKW reduziert Ladung auf 700; Rückkehrlager mit nur 600 frei lagert 600 ein und verliert weitere 100 als Überlauf. Getrennte Verlustgründe, keine Neugutschrift beim NPC.
12. Große Offlineabrechnung und viele kleine Schritte ergeben denselben Bestand, Termine und Berichte, einschließlich Forschung/Bau/Produktion, Hunger und Rückkehr auf gleicher Zeitgrenze.
13. Neustart vor/nach Ölbuchung, Kampfauswertung und Rückkehr sowie Schreibfehler/Journalwiederherstellung. Request-Wiederholung/mehrere Tabs dürfen weder Öl noch Beute/Truppen/XP/Punkte duplizieren.
14. Migration ab Schema 12 und älterer Kette; Missionen 1–3 auf Hin-/Rückweg, laufende Forschung, Ausbildung, Postboxlesestatus und Porträts erhalten. Wiederholung der Migration ohne Zusatzbestände.
15. ENV native/Compose, ungültige Werte, isolierte Welten, historische Unterhaltswechsel und eingefrorene Öl-/Traglastwerte. Aktive Mangelzyklen nicht zurücksetzen.
16. Postbox zeigt neue und historische Berichte korrekt, keine privaten Leaks oder doppelten Ungelesenmeldungen. Bestehende Bewerber/Forschungsleiter/Messaging-Funktionen regressionsfrei.

npm test und npm run build sowie betroffene Container-/Startprüfung ausführen. Manuellen kompletten Durchlauf mit neuen Gebäuden und gemischtem Farmzug dokumentieren, einschließlich Wiederanmeldung und Neustart. In docs/LOGISTICS_VALIDATION.md ausgeführte Prüfungen, Balancebeispiele und tatsächlich offene Einschränkungen festhalten; keine ungetesteten Behauptungen.

## 12. Lieferung und Folgeplanung

Ein reviewbarer PR mit nachvollziehbaren Teilcommits, Umsetzung, Migration, Tests und aktualisierten README, Projektplan, WebSocket-/Entwicklungsdokumentation und .env.example. Bestehende Historie und Dateien erhalten; Implementiert/Geplant klar trennen.

Nicht Teil dieses Auftrags: andere Beuteressourcen, PvP, Spielerhandel, unabhängige Transportmissionen, neue Kampfeinheiten/Waffen, weitere Öltechnologien, Gebäudeflächenvergrößerung oder aktive Matrix-Föderation. Nach dem Logistikkreislauf Balance/Spieltempo prüfen und dann Unterstützung/Handel beziehungsweise zusätzliche militärische Technologien getrennt spezifizieren. Föderation bleibt Kernziel, benötigt später eigene Identitäts- und Vertrauensregeln.
