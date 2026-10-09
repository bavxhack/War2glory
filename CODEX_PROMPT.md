# Codex-Auftrag 13: Ölwirtschaft, LKWs, Stadtversorgung und verzögerte Ankunft

## Auftrag und Arbeitsweise

Der Nutzer bestätigt Auftrag 12 am 08.10.2026 als abgeschlossen und beauftragt den nächsten Schritt. Implementiere einen vollständigen Ablauf: Ölverarbeitung erforschen → zivile Ölraffinerie bauen → Motorisierung erforschen → Fahrzeugfabrik auf Militärbauplatz bauen → LKWs herstellen → Infanterie und LKWs gemeinsam zum NPC schicken → begrenzte Nahrung erbeuten und zurückbringen.

Verbindliche Nutzerergänzung vom 09.10.2026: Unterwegs befindliche Truppen verbrauchen keine Nahrung aus der Stadt. Beim Angriff/Farmzug soll eine zusätzliche Ankunftsverzögerung in Minuten wählbar sein, für die der Ölbedarf linear steigt. Kampfflugzeuge, Raketenwerfer und zusätzliche Generalfähigkeiten für Luftvorteile sind für eine spätere Phase vorgemerkt, nicht jetzt zu implementieren.

Weitere verbindliche Präzisierung vom 09.10.2026: Alle Einheitentypen sind bei Bewegung ölpflichtig; verlängertes Hinwegöl = normale Hinwegkosten × verlängerte Hinreisedauer / normale Hinreisedauer. Rückweg bleibt normal. Dies ersetzt den zuvor vorgeschlagenen pauschalen Minutenpreis und Öl-Nullraten.

Diese Fassung ersetzt die frühere Versorgung reisender Truppen in Auftrag 13. Bereits begonnene Arbeiten anpassen und Daten bewahren. Konkrete neue Zuschläge/Grenzen sind vorläufige Balancevorschläge; die drei genannten Nutzeranforderungen sind verbindlich.

Der Planungschat aktualisiert ausschließlich Anweisungen. Du implementierst auf Basis des aktuellen main in bavxhack/War2glory, liest AGENTS.md, README.md, docs/PROJECT.md, docs/WEBSOCKET.md und docs/DEVELOPMENT.md, beachtest offene PRs/fremde Änderungen und lieferst einen getesteten PR ohne selbstständiges Merge/Deployment. Vorläufige neue Zahlen sind eigene Balancevorschläge, keine War2Glory-Originalwerte.

Auftrag 12 sowie die danach ergänzten individuellen Porträts und die Postbox erhalten. Im gelesenen Stand ist Spielerschema 12 aktiv, nicht mehr 9 oder 10. Der Planungschat hat Code gelesen, keine Anwendungstests ausgeführt.

Reihenfolge als nachvollziehbare Teilcommits:
1. Neue Ressource, zwei Forschungsfreischaltungen und Gebäude.
2. Fahrzeugherstellung und typabhängige Einsatzvorschau einschließlich Öl.
3. Gemischte Farmzüge, Ankunftsverzögerung, stationärer Nahrungsunterhalt und Berichte.
4. Migration/Integration prüfen und Dokumentation vervollständigen.

## 1. Konkrete Ansatzpunkte

Gegen tatsächlichen Arbeitsstand verifizieren:
- packages/game-core/index.js: RESOURCE_KEYS enthält wood/stone/food; Bauangebote, Ressourceninitialisierung, Kapazitäten, Investitionen, Produktion und Rückerstattung auf Öl erweitern.
- packages/game-core/research.js: derzeit ein globales maxLevel und einheitliche Kosten/Dauer. Technologien benötigen eigene Voraussetzungen, Maximalstufe und Grundkosten/-dauer, ohne alte Technologien zu verändern.
- packages/game-core/military.js: Einheiten scout/infantry, Ausbildung bislang kasernengebunden; startRaidMission und Missionsdaten nutzen einzelne Infanteriefelder.
- packages/game-core/supply.js: livingUnitGroups mischt stationierte und reisende Einheiten für Unterhalt/Hunger. Bestandsanzeige und versorgungspflichtige Gruppen bewusst trennen. Ab neuem gespeichertem Regelwechsel zählt nur stationierter Bestand; historische Zeiträume benötigen weiterhin die alte Abrechnung.
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

## 5. Öl für jede Truppenbewegung und proportional verlängerte Hinreise

Verbindliche Präzisierung des Nutzers vom 09.10.2026: ALLE Einheitentypen kosten bei Truppenbewegung Öl. Verzögerungsverbrauch leitet sich aus dem normalen Verbrauch der tatsächlich versendeten Gruppe und ihrer normalen Hinreisedauer ab. Der bisher vorgeschlagene einheitliche Minutenpreis entfällt.

Vorläufige Einheitenwerte:

| Typ | Kampfwirkung | Nahrungstraglast | Nahrung pro Stunde bei Stationierung | Öl je Einheit/Feld/einfache Strecke |
| --- | --- | --- | --- | --- |
| Infanterie | Bestehende Kampfformel | 20 | Bestehende ENV, Standard 360 | 0,1 |
| Späher | Bisherige Aufklärung, nicht in Farmzügen | 0 | Bestehende ENV, Standard 180 | 0,2 |
| LKW | 0 Angriff, keine zusätzliche Kampfstärke/Schutzwirkung | 200 | 180 | 1 |

Die positiven Grundraten sind vorläufige Balancevorschläge. Verbindlich sind positive Ölkosten für alle Typen und die folgende Verhältnisrechnung. Keine normale Ölfreiheit für Infanterie oder Späher.

### Normale Strecke und Grundkosten

- LKWs bleiben reine Transporteinheiten ohne zusätzliche Kampf-/Schutzwirkung.
- Für neue Missionen Distanzfelder d = max(1, ceil(Luftlinienentfernung)).
- Normale Reisezeit T je Richtung vorläufig max(5 Sekunden, ceil(Luftlinienentfernung) × 5 Sekunden). Keine neue Wegfindung/Geländekosten; T muss positiv sein.
- Anzahl des Typs i ist n_i, positive Ölrate je Einheit/Feld ist r_i.
- Normaler UNGERUNDETER Ölbedarf der gesamten Gruppe für EINE Richtung: E = d × Summe(n_i × r_i).
- Ohne Verzögerung Hinweg E, Rückweg E, Gesamtzahlung ceil(2 × E).
- Beispiel 20 Infanteristen/4 LKWs bei Distanz 5: E = 5 × (20 × 0,1 + 4 × 1) = 30; normale Gesamtzahlung 60 Öl.
- Auch Aufklärungen sowie jede andere neu gestartete bereits implementierte Truppenbewegung müssen Öl prüfen und bezahlen. Keine Ausnahmen durch reine Infanterie-/Spähergruppen oder alternative Startendpunkte.
- Künftige Einheitentypen benötigen eine explizite positive Rate; fehlende Rate ist ein Definitionsfehler, kein implizites 0.
- Neue Städte/Altstädte erhalten weiterhin keine erfundenen Ölvorräte. Die erste Bewegung benötigt daher eigene Ölproduktion; Technologie-/Gebäudekette bleibt ohne Öl erreichbar.

### Zusätzliche Ankunftsverzögerung

- Im Angriffs-/Farmdialog zusätzliche Verzögerung D in ganzen Minuten einstellen, Standard 0; intern in dieselbe Zeiteinheit wie T umrechnen.
- MAX_ATTACK_DELAY_MINUTES bleibt vorläufig 1440 (24 Stunden). Das ist eine Grenze für Zusatzminuten, nicht die gesamte Reise.
- Truppen und General verlassen die Stadt beim erfolgreichen Start sofort und sind ab dann unterwegs/gebunden; keine spätere Abreise.
- Verlängerte Hinreisedauer H = T + D.
- arrivesAt = startedAt + H; returnsAt = arrivesAt + T. Rückweg weder zeitlich noch hinsichtlich Öl mit dem Verzögerungsfaktor multiplizieren.
- Öl Hinweg = E × H / T.
- Öl Rückweg = E.
- Verzögerungsmehrkosten = E × D / T.
- Gesamtzahlung = ceil(E × (T + D) / T + E) = ceil(E × (2T + D) / T).
- Das ist die gewünschte lineare Skalierung aus der normalen Gruppenrate; kein zusätzlich frei festgelegter Einheits-/Minutenpreis.
- Die Zusammensetzung der Gruppe beeinflusst E und damit automatisch den Verzögerungsverbrauch. Zwei gleich große Gruppen mit verschiedenen Typen dürfen unterschiedliche Kosten haben.
- Nur nach Addition beider ungerundeter Strecken einmal auf ganze Öleinheiten aufrunden. Keine vorgerundeten normalen Gruppenkosten als Basis verwenden.

Verbindliches Nutzerbeispiel:
- Normale Hinreise T = 1 Minute, normale Kosten E = 10 Öl für die gesamte Gruppe.
- Gewünschte gesamte Hinreise H = 10 Minuten bedeutet D = 9 Zusatzminuten.
- Hinweg 10 × 10 / 1 = 100 Öl, Rückweg unverändert 10 Öl und 1 Minute.
- Gesamtzahlung 110 Öl; Ankunft nach 10, Rückkehr nach 11 Minuten.
- Bei stattdessen 10 ZUSATZminuten dauert der Hinweg 11 Minuten und kostet 110 Öl, plus Rückweg 10 = 120 Gesamtöl. UI muss Zusatzzeit und gesamte Hinreise ausdrücklich unterscheiden.
- Früheres Beispiel bleibt zeitlich richtig: 1 Minute normale Fahrt plus 30 Zusatzminuten = Ankunft nach 31, Rückkehr nach 32 Minuten. Bei E = 10 wären dies 310 Hinweg + 10 Rückweg = 320 Öl.

Ablauf:
- Verzögerung nur vor Start wählen. Kein nachträgliches kostenloses Verlängern/Verkürzen/Umplanen oder neue Abbruchaktion.
- NPC-Regeneration, Kampf und Beute erst am tatsächlichen gespeicherten Ankunftstermin; keine frühe Reservierung von Zielvorräten.
- Gleichzeitige Ankünfte nach vorhandenen Ereignisnummern deterministisch ordnen.
- Zusätzliche Verzögerung zunächst nur für vorhandene NPC-Angriffs-/Farmzüge. Positiven Verzögerungsparameter bei Aufklärung ablehnen; Aufklärung selbst ist trotzdem ölpflichtig. PvP und weitere Bewegungsarten erst später implementieren.
- Vorschau zeigt Typmengen und positive Raten, normale Hinreise, Zusatzzeit, gesamte Hinreise, Rückreise, Ankunft/Rückkehr, normales Öl je Richtung, verlängertes Hinwegöl, Mehrkosten und gesamte Zahlung.
- Alle sichtbaren Kosten aus derselben serverseitigen Formel. Bei veränderten Mengen/Regeln/Verzögerung neue Vorschau; Browser berechnet keine eigene verbindliche Rundung.
- Vorschauzeitpunkte als solche markieren; tatsächlicher Start aus Serverzeit verschiebt absolute Termine, nicht gebuchte Dauer/Preis.

Buchung und Bestand:
- Gesamtes Öl einschließlich normalen Rückwegs beim erfolgreichen Start einmalig abbuchen, gemeinsam mit Truppenreservierung, Generalbindung, vollständigem Snapshot und Wiederholungsbeleg.
- Fehlendes Öl oder veraltete Vorschau verhindert Start ohne Teilbuchung. Keine Rückweg-Nachforderung oder zusätzliche Tick-Abbuchung.
- Rückwegkosten anhand beim Start entsendeter Gruppe vorausbezahlen. Kampfverluste führen wie bisher zu keiner Erstattung.
- Mission speichert Ölregelversion, positive Typ-Raten, Mengen, d, T, D, H, Zeitpunkte, ungerundete Teilbeträge/rationale Berechnungsgrundlage, gerundete Zahlung, Generalboni und Traglast.
- Neue Formel versionieren, z. B. fuel-2-positive-ratio-provisional. Bereits laufende alte Missionen behalten bezahlte Kosten und Termine, auch bei früherer Ölfreiheit oder altem Minuten-Zuschlag.
- Alte Bezahldaten nicht neu aus heutigen Raten berechnen. Keine rückwirkende Ölrechnung; alte Berichte nach tatsächlich verwendeter Version darstellen.
- Nahrungsbefreiung unterwegs bleibt unverändert, keine Ersatz-Nahrungskosten.

## 6. Gemischter Farmzug und klare Verlustregeln

Start:
- Spieler wählt freien eigenen General, positive Infanteriezahl und optional nicht negative LKW-Zahl. Späher bleiben für Farmzüge gesperrt.
- Reine LKW-Farmzüge ablehnen, auch bei zuletzt unverteidigtem Ziel. Mindestens ein Infanterist beim Start erforderlich.
- Vorhandene 10.000-Einheiten-Grenze umfasst Summe aller entsendeten Typen. Kein militärisches Führungslimit wieder einführen.
- Alle Mengen sichere Ganzzahlen, unbekannte Typen ablehnen; stationierte verfügbare Bestände prüfen und gemeinsam reservieren.
- Vorschau zeigt Truppen, Grundreisezeit, Zusatzminuten, Ankunft/Rückkehr, Ölaufschlüsselung, Stadtunterhalt vor/nach Abreise und maximale Starttraglast. Keine ungeklärten aktuellen NPC-Vorräte/Garnisonen oder garantierte Beute offenlegen. Alte Aufklärung bleibt datierter Bericht.

Kampf:
- Neue gemischte Missionsregelversion, beispielsweise npc-pve-4-logistics-provisional. Infanteriekampf unverändert nach der Grundwert-/Skillregel aus Auftrag 12 rechnen.
- Kampfwerte ausschließlich aus beim Start gespeicherten Generalboni und bei Ankunft noch lebender Infanterie. LKWs zählen nicht zu Angreiferstärke und verursachen keine Verteidigerverluste.
- Sei I die bei Kampfbeginn lebende Infanterie, T die dann lebenden LKWs und L die durch diesen Kampf verlorene Infanterie. LKW-Kampfverluste = min(T, ceil(T × L / I)), wenn I > 0. Bei L = 0 keine LKW-Verluste. Ganzzahlig sicher berechnen.
- Das gilt bei Sieg und Niederlage. Überlebende beider Typen kehren zurück; Niederlage bringt keine Beute. Keine Erbeutung oder Reparatur beschädigter Fahrzeuge.
- Robustheits-/Altbestandsfall I = 0 bei Ankunft (etwa Verlust vor Aktivierung der neuen Versorgungsregel): Angriff fällt aus, keine Verteidigerverluste, keine Beute/XP/Kampfpunkte; verbliebene LKWs treten den planmäßigen Rückweg an. Kein Teilen durch null. Nach neuem Versorgungsbeginn gibt es keine zusätzlichen Stadt-Hungerverluste unterwegs.
- Bei unverteidigtem Ziel und I > 0 Sieg ohne Kampfverluste, aber weiterhin ohne künstliche Kampf-XP oder Punkte.
- General überlebt gemäß bisherigen Regeln und bleibt bis zur Rückkehr gebunden.

Beute:
- Erst NACH Kampfverlustrunden: Kapazität = überlebende Infanterie × 20 + überlebende LKWs × gespeicherte LKW-Kapazität.
- Geladene Nahrung bei Sieg = min(floor(tatsächlich verfügbarer NPC-Nahrung), Kapazität). Keine Beute bei Niederlage/ausgefallenem Angriff.
- NPC-Abzug und Missionsladung atomar im Weltjournal, weiter für alle Spieler gemeinsame NPC-Bestände und geordnete gleichzeitige Ankünfte.
- Beispiel ohne Generalboni: 20 Infanteristen + 4 LKWs gegen 10 Verteidiger. Infanterieverlust 5, LKW-Verlust ceil(4 × 5 / 20) = 1. Es bleiben 15 Infanteristen und 3 LKWs, Kapazität 15 × 20 + 3 × 200 = 900. Bei 1000 NPC-Nahrung werden 900 geladen, bei 500 nur 500.
- Allgemeine Traglastfunktion in Vorschau, Kampf, historischer Verlustabrechnung und Rückkehr verwenden; Ressourcen später nicht jeweils mit voller identischer Kapazität beladen.
- In dieser Etappe ausschließlich Nahrung als Beute. Kein Handel, selbstständiger Transportauftrag oder PvP.

## 7. Nahrung nur für stationierte Truppen, Rückkehr und Punkte

Diese Regel ersetzt ausdrücklich die frühere laufende Stadtversorgung reisender Truppen.

- Laufenden Unterhalt aus der Heimatstadt ausschließlich für dort stationierte lebende Einheiten berechnen. Gilt für Infanterie, Späher, LKWs und später weitere Typen.
- Unterwegs auf Hinreise, zusätzlicher Verzögerung und Rückreise: kein Nahrungsabzug aus Heimatstadt. In Herstellung befindliche Einheiten bleiben ebenfalls bis Abschluss unberücksichtigt.
- In dieser Fassung kein mitgenommener Reiseproviant, keine pauschale Nahrungszahlung beim Start, keine separate Feldversorgung und keine Nahrungskosten bei Rückkehr. Ein späteres Proviantsystem benötigt eigene Spezifikation.
- Aus diesem Modell folgen keine durch Heimatmangel verursachten Hungerverluste unterwegs. Keine Nahrung aus Beuteladung verbrauchen. Solche Verluste nicht weiterhin in einer zweiten Hintergrundroutine anwenden.
- Bestehende Gesamt-/stationiert-/unterwegs-Ansicht bleibt korrekt. Militärische Gesamtstärke nicht auf versorgungspflichtige Einheiten verkürzen; getrennte Helfer für sichtbare Bestände und Stadtverbrauch.
- Standardbeispiel: 20 Infanteristen und 4 LKWs vollständig stationiert → 20 × 360 + 4 × 180 = 7920 Nahrung/Stunde. Nach Abreise aller dieser Einheiten → 0 Stadtunterhalt aus ihnen; andere stationierte Einheiten bleiben kostenpflichtig.
- Teilabreise ebenso korrekt: von 20 stationierten Infanteristen verlassen 12 die Stadt → Verbrauch sinkt von 7200 auf 2880/Stunde. Nach Rückkehr von 10 Überlebenden sind 18 stationiert → 6480/Stunde.
- Vor Abreise alle bis zur Befehlszeit fälligen Ereignisse nach bestehender Ordnung abrechnen, danach Bestände reservieren und neuen Stadtverbrauch ab diesem Zeitpunkt ableiten.
- Unterhalt der Rückkehrer beginnt exakt mit Rückkehr, keine Nachzahlung für Reisezeit. Alle Überlebenden einmalig stationär hinzufügen; Beute einmalig bis freie Lagerkapazität einlagern, Überlauf verfällt.
- Bei gleichzeitiger Rückkehr/Hungerwelle erst Überlebende und rechtzeitig eintreffende Nahrung einlagern, dann tatsächlichen Stadtmangel neu bewerten und ggf. fällige Welle auf nun stationierte Einheiten anwenden.
- Stationierte Truppen behalten bestehende Schonfrist, proportionale deterministische Hungerverluste, Erholung und Auswirkungen auf Herstellung. Null-Unterhalts-Einheiten anzeigen, aber nicht in hungerpflichtige Verlustgruppen nehmen.
- Abreise setzt Mangelzeit nicht unmittelbar zurück. Reicht die verbleibende Stadtversorgung, beginnt normale stabile Erholung; Rückkehr vor Ende bewahrt bisherigen Zähler. Auch wenn alle kostenpflichtigen Einheiten weg sind, kann die vorhandene Erholungsfrist normal ablaufen; keine künstliche Ausnahme.
- Bei Rückkehr in weiterhin mangelversorgte Stadt können die Rückkehrer in eine bereits fällige Hungerwelle geraten. Dies als Stadtverlust nach Rückkehr ausweisen, nicht als rückwirkenden Kampf-/Transportverlust.
- In neuer Versorgung keine hungerbedingte Beutereduktion unterwegs. Vor dem Regelwechsel bereits eingetretene Verluste und beschädigte Beuteladung historischer Missionen bewahren; nichts ersetzen oder wiederauffüllen.
- Bereits gespeicherte Kampfverluste, historische Reise-Hungerverluste, historische Ladungsverluste, Einlagerung und Lagerüberlauf getrennt halten. Ein veralteter Bericht bekommt keine erfundenen neuen Werte.
- General überlebt und bleibt bis geplanter Rückkehr gebunden, auch wenn alle Truppen im Kampf verloren gehen. Keine vorzeitige doppelte Freigabe/Belohnung.
- General-XP weiter 2 je getötetem NPC-Verteidiger, keine XP für Transportmenge/LKWs.
- Neuer Kampfbeitrag = getötete NPC-Verteidiger minus eigene Infanterie-/LKW-Kampfverluste. Stationärer Hunger gibt keinen zusätzlichen Kampfpunktabzug.
- Beispiel 20 Infanterie/4 LKW gegen 10 ohne Boni: +4 Kampfbeitrag und 20 General-XP. Einmal beim bisherigen Belohnungszeitpunkt; Altversionen behalten ihre Wertung.
- Forschungspunkte weiter abgeleitet, keine doppelte Gutschrift.

### Einführung der geänderten Versorgung ohne rückwirkende Umschreibung

- Dauerhaften serverseitigen Aktivierungszeitpunkt und Regelversion für stationären Unterhalt speichern, z. B. upkeepScope: stationed gegenüber historisch all-living.
- Vor Aktivierung vergangene Intervalle nach alten gespeicherten Regeln einschließlich damaliger Reiseverluste korrekt nachberechnen. Ab Aktivierung gilt stationed für ALLE unterwegs befindlichen Missionen, auch bereits laufende alte Missionen.
- Das ist eine bewusste Ausnahme vom unveränderten Kampfsnapshot alter Missionen: Kampfwerte, Öl, Ankunft/Rückkehr und Berichte bleiben unverändert; nur zukünftiger laufender Stadtunterhalt/Hunger folgt ab Wechsel der neuen Stadtregel.
- Keine rückwirkende Erstattung, Wiederbelebung oder Auffüllung von schon verlorener Ladung. Alte Intervalle nicht mit heutiger stationärer Auswahl neu berechnen.
- Regelwechsel mit bestehendem Welt-/Spielerjournal absturzsicher speichern und beim Wiederanlauf nicht erneut aktivieren. Auch lange nicht eingeloggte Spieler an derselben gespeicherten Zeitgrenze behandeln.
- An der Aktivierungsgrenze historische Zeit vor dem Zeitpunkt, neue Gruppenauswahl ab diesem Zeitpunkt. Fällige Grenzereignisse dokumentiert und deterministisch behandeln; keine doppelte oder ausgelassene Hungerwelle.
- Aktive Mangelzyklen behalten gespeicherte Frist-/Verlustwerte, aber NICHT historische Auswahl reisender Einheiten. Versorgungsscope und Verlustgruppenauswahl aus aktuell zeitlich gültiger Stadtregel, Zyklus nur für Frist/Prozentsatz.
- Regeln von heute nicht mutierend in alte Regelhistorie schreiben. Historische Datensätze ohne upkeepScope ausdrücklich all-living, nicht mit einem neuen Default unbemerkt umdeuten.

## 8. ENV und Regelwechsel

Bestehenden zentralen Konfigurationseinstieg verwenden; reine Spiellogik erhält Konfiguration explizit.

| Variable | Standard | Einheit |
| --- | --- | --- |
| UPKEEP_TRUCK_PER_HOUR | 180 | Nahrung je stationiertem lebendem LKW/Stunde |
| OIL_INFANTRY_PER_FIELD | 0.1 | Öl je Infanterist/Feld/einfache Strecke |
| OIL_SCOUT_PER_FIELD | 0.2 | Öl je Späher/Feld/einfache Strecke |
| OIL_TRUCK_PER_FIELD | 1 | Öl je LKW/Feld/einfache Strecke |
| TRUCK_CARGO_CAPACITY | 200 | Nahrungstraglast je LKW |
| MAX_ATTACK_DELAY_MINUTES | 1440 | Maximale zusätzliche Hinreisezeit in ganzen Minuten |

- Unterhalt weiter inklusive 0 zulassen. Dagegen ALLE Öl-Typ-Raten positiv 0,001–100.000 mit höchstens drei Nachkommastellen; explizites 0 nicht akzeptieren und nicht heimlich ersetzen.
- Auf feste ganzzahlige Tausendstel-Ölbasis umrechnen. Verhältnis von T und D exakt rational mit sicheren Ganzzahlen/BigInt rechnen; einzig am Ende aufrunden. Nicht zuvor H/T oder E runden.
- Beispiel bei Raten in Tausendsteln: Gesamtzahlung = ceil(d × Summe(n_i × rateMilli_i) × (2T + D) / (1000 × T)), T/D in derselben positiven bzw. nicht negativen ganzzahligen Zeiteinheit.
- Kapazität Ganzzahl 1–1.000.000. MAX_ATTACK_DELAY_MINUTES Ganzzahl 0–10080, 0 deaktiviert Zusatzzeit. Negative/gebrochene Zusatzminuten, NaN/Infinity, leere Werte und Überläufe ablehnen.
- Fehlende ENV-Variable verwendet positiven Standard. Bisher ausdrücklich eingestellte OIL_INFANTRY_PER_FIELD=0/OIL_SCOUT_PER_FIELD=0 vor Spielstandänderung mit verständlicher Anleitung zur neuen positiven Einstellung abweisen.
- OIL_DELAY_PER_UNIT_PER_MINUTE entfällt vollständig aus neuen Definitionen, .env.example, Compose und UI. Falls alte Betreiberkonfiguration ihn noch enthält, gezielt als entfernt melden und Start vor Spielstandänderung abbrechen; keine stille weitere Verwendung oder unbemerkte Parallelformel. Migrationshinweis: alten Schlüssel entfernen.
- Gespeicherte historische Missions-/Regeldaten mit alten Nullraten oder Minutenpreisen sind weiterhin gültige Altversionen und dürfen nicht durch neue ENV-Validierung unlesbar werden.
- Preise/Forschung/Bau/Produktion zentral versioniert; keine zusätzlichen ENV-Schalter dafür nötig.
- .env.example, native Starts, Prozessvorrang, Compose-Weitergabe und freigegebene Snapshotwerte gemeinsam aktualisieren; keine ganze ENV an Client oder Client-Neubuild.
- Unterhaltsänderungen und Versorgungsscope über vorhandene Regelhistorie. Historische Unterhaltsregeln ohne truck entsprechen für diesen Typ 0; das ist Nahrungsunterhalt, keine Ausnahme von positiven Ölraten.
- Aktive Hungerzyklen bewahren Fristen/Verlustanteile ohne Reset; neue Ölformel verändert Nahrung nicht.
- Neue Ölraten/Formel/Verzögerungsgrenzen/Traglast nur für neue Starts. Keine Nachforderung oder Terminänderung für bereits laufende Missionen.
- Vorschauen bei wirksamer Regeländerung ungültig machen; neue Bestätigung verlangen.
- Konfiguration verschiedener Weltinstanzen getrennt halten.

## 9. Zeit, Speicherung, Migration und WebSocket

- Neue Aktionen/Angebote/Push-Zustände ausschließlich über vorhandenen WebSocket. Bestehende Ausbildungs-/Bau-/Forschungsbefehle gezielt erweitern, Missionen um serverseitige Vorschau ergänzen.
- Vorschau bindet eigene Truppenmengen, General-ID/Version, Ziel-ID, Zusatzverzögerung in Minuten, relevante Regeln und Voraussetzungen. Start prüft aktuellen Bestand, Öl, Rolle und Eigentum erneut. Ein zwischenzeitlich veränderter sichtbarer Vorschauwert erfordert erneute Bestätigung.
- Keine private HTTP-Spiel-API, Client-Timer oder zweite Tickautorität. Fällige Ereignisse vor Befehlsprüfung bis Serverzeit verarbeiten.
- Bei gleichem Zeitstempel bisherige Ordnung erhalten: Wirtschafts-/Forschungsabschlüsse, geordnete Missionsereignisse einschließlich Einlagerung, dann verbleibende Hungerwelle.
- Forschung/Bauproduktion ab tatsächlichem Abschluss; Herstellung, Ölverbrauch, Kampf und Hunger zeitlich konsistent auch bei langen Offlineintervallen.
- Zahlung + Herstellung/Start + Reservierung + Generalbindung + Deduplizierungsbeleg vor Erfolgsantwort konsistent speichern. Gleiche requestId/Payload nur einmal, abweichender Payload abweisen. Fehler darf keinen nur teilweise geänderten Arbeitsspeicher hinterlassen.
- Welt-/Spieleränderungen weiter über Journal; Ausfall zwischen NPC-Abzug und Spielerspeicherung wiederaufnehmbar.
- Versionierte Migration ab aktuellem Schema 12 auf nächste freie Version. Ältere Ketten vollständig ausführen; vorher Journal wiederherstellen.
- oil=0, truck=0 und neue Forschungsstufen=0 ergänzen; vorhandene Ressourcen, Gebäude, Investitionen, Forschung, Missionen, Generalprofile, Erwerbszähler, Bewerbertermine, Porträts, Nachrichten und Lesestatus bewahren.
- Neue Städte ebenfalls Öl 0. Keine rückwirkende Ölproduktion ohne Raffinerie, keine kostenlosen LKWs oder Freischaltungen.
- Alte Missionsversionen 1–3 anhand alter Kampffelder/-regeln korrekt fertigstellen; delayMinutes=0 für fehlende Zusatzverzögerung, vorhandene Termine nicht neu berechnen. Keine neuen Truckverluste/Ölrechnungen oder geänderten historischen Berichte. Zukünftiger Stadtunterhalt für alte Missionen folgt ausdrücklich dem Aktivierungswechsel aus Abschnitt 7.
- Ressourcenschlüssel in alten Investitionsobjekten vorsichtig erweitern; fehlendes Öl ist 0, unbekannte alte Holz-/Steinkosten bleiben unbekannt.
- Unbekannte/inkonsistente Schemas konkret melden, nie automatisch zurücksetzen. Keine Umplatzierung oder Vermehrung von Bauplätzen.

## 10. Oberfläche und Postbox

- Forschung zeigt zwei neue Freischaltungen mit Bedingungen und Wirkung.
- Stadt bietet freigeschaltete Ölraffinerie; Militär Fahrzeugfabrik und LKW-Produktion. Gesperrte Angebote nennen fehlende Forschung.
- Öl in Sidebar/Lageraufschlüsselung; Nahrung weiter mit Brutto, Bürgermeister, Forschung, typabhängigem Unterhalt und Netto.
- Militärübersicht zeigt Gesamtbestand, stationiert, unterwegs und in Herstellung je Typ getrennt. Sidebar verwendet nur stationierte Mengen für tatsächlichen Nahrungsverbrauch und erklärt Unterwegs-Befreiung.
- Einsatzdialog zeigt Infanterie/LKWs, Zusatzverzögerung in Minuten, Traglast, Grundöl/Zuschlag/Gesamtöl, Grundreisezeit, Ankunft/Rückkehr und Stadtverbrauch vor/nach Abreise. Auf unterwegs entfallenden Stadtunterhalt hinweisen. LKWs erhöhen keine Kampfkraft; Starttraglast ist keine garantierte Beute.
- Bestehende private Aufklärungsinformationen mit Datum verwenden, keine Live-NPC-Geheimnisse in Vorschau.
- Neue gemischte Angriffsberichte in vorhandener Postbox: Startmengen, Kampf-/Rückkehrmengen je Typ, Grundreisezeit, gewählte Zusatzminuten, tatsächliche Zeitpunkte, Grundöl/Zuschlag/Gesamtöl, Boni, Traglast und Einlagerung. Historische Reise-Hunger-/Ladungsverluste weiterhin anzeigen, aber keine neuen solchen Ereignisse nach Aktivierung erfinden. Alte Berichte weiterhin korrekt anzeigen, fehlende alte Ölwerte als nicht erhoben/alte Version statt erfundene Zahlung.
- Neue Berichte und Ungelesenzähler/Animation genau einmal auslösen. Bereits gelesene Berichte und private Nachrichten erhalten.
- Illustrationen/Porträts erhalten; für Raffinerie, Fabrik und LKW passende eigene lokal ausgelieferte Darstellung erstellen, keine Originalgrafiken des Vorbilds übernehmen.
- Schmale Bildschirme und Tastaturbedienung überprüfen. Keine nur scheinbar bedienbaren Platzhalter.

## 11. Abnahme und Tests

Mit unabhängigen Erwartungen prüfen:
1. Technologieabhängigkeiten, individuelle Maximalstufe 1, alte Maximalstufe 5, Bauschutz und erreichbarer Start ohne Öl. Motorisierung bei Universität 2/Führung 20 dauert 182 Sekunden.
2. Öl 0 bei Neuanlage/Migration, Produktion ab Fertigstellung, Beispielkapazität 3025, Lagerhaus-/Logistikwirkung, Offlineproduktion und Abriss/Überbestand.
3. Raffinerie nur zivil, Fabrik nur militärisch; LKW nur Fabrik, andere Einheiten nur Kaserne. Gruppenherstellung, Hungerpause/Fortsetzung, parallele Fabriken, Ausbau-/Abrisssperre und einmalige Kosten.
4. Positive Kosten jedes Typs, inklusive reiner Infanterie und Späher bei D=0. Distanz-5-Zug 20 Infanterie/4 LKW: E=30, ohne Verzögerung 60 Gesamtöl. Fehlendes Öl lässt Truppen, General und Ressourcen unverändert; auch Aufklärung und alternative Startpfade prüfen.
5. Verbindliches Beispiel T=60 Sekunden/E=10: gesamte Hinreise 10 Minuten (D=9 Minuten) kostet 100 Hinweg + 10 Rückweg = 110; Ankunft nach 10, Rückkehr nach 11 Minuten. D=10 Minuten ergibt 120 Gesamtöl. H/T-Faktoren 1/2/5/10 ergeben Hinweg 10/20/50/100, Rückweg stets 10.
6. Gemischte Gruppen gleicher Kopfzahl haben typabhängige Kosten. T=25 Sekunden/E=30: Zusatzzeit 0/60/120 Sekunden ergibt Gesamtöl 60/132/204. Bruchteilsfall E=0,15/T=60/D=540: Hinweg 1,5 + Rückweg 0,15 ergibt Gesamtzahlung 2, nicht aus vorgerundetem E berechnen. Sichere rationale Rechnung, T=0 abweisen; maximale Mengen/Zeiten/Raten prüfen.
7. Zeitbeispiel Grundreise 1 Minute + 30 Minuten Verzögerung: Ankunft bei Minute 31, Rückkehr bei Minute 32. NPC bei Minute 1 unverändert durch diesen Einsatz; erst bei Minute 31 regenerieren/angreifen/plündern. Nicht auf Minute 30 verkürzen und Rückweg nicht nochmals verzögern.
8. Zusatzminuten 0/Maximum erlaubt, negativ/gebrochen/über Maximum/NaN/Infinity/Stringmanipulation abgewiesen. Positiver Verzögerungsparameter bei Aufklärung gesperrt. Eingabeänderung verlangt neue Vorschau; neuer Startzeitpunkt verschiebt nur absolute Termine.
9. Summe 10.000 über Typen, ungültige Typen/Mengen, reine LKW-Mission und fremde IDs abweisen. Konkurrierende verzögerte Starts binden General/Truppen nur einmal und bezahlen Öl nur einmal.
10. Kampfbeispiel 20 Infanterie/4 LKW gegen 10 ohne Boni: 5 Infanterie- und 1 LKW-Verlust, Kapazität 900, XP 20, Beitrag +4. Ohne LKW dieselben Infanterie-/Verteidigerverluste. Niederlage/Überlebende, unverteidigtes Ziel und historischer Null-Infanterie-Fall.
11. Konkurrierende echte Ankünfte teilen tatsächlich verfügbaren NPC-Vorrat; spätere Ankunft kann andere Beute vorfinden. Vorschau reserviert weder Vorrat noch Garnison.
12. 20 Infanterie/4 LKW stationiert = 7920 Nahrung/Stunde, nach vollständiger Abreise = 0 aus diesem Kontingent. Teilabreise 20 → 8 Infanterie = 7200 → 2880/Stunde, Rückkehr von 10 = 6480/Stunde. Kein einmaliger Reiseproviant oder nachträgliche Nachzahlung.
13. Durchgehend leere Heimat mit langer Verzögerung: reisende Einheiten verlieren durch Stadthunger keine Truppen oder Ladung; verbliebene stationierte Einheiten hungern weiterhin nach Regeln. Gesamtbestand zeigt beide Gruppen korrekt.
14. Abreise/Rückkehr an exakter Produktions-, Leerstands-, Erholungs- und Hungergrenze, fertige Herstellung während Abwesenheit, Heimkehr mit/ohne ausreichende Beute. Rückkehr erst einlagern, dann fällige Stadt-Hungerwelle; keine sofortige Rücksetzung des Mangelzählers bei Abreise.
15. Regelwechsel mitten in einer alten laufenden Mission: vor Aktivierung alter Verbrauch/alte Verluste, danach keine Reisebelastung, nach Rückkehr wieder Stadtunterhalt. Kampf- und Reisezeit-Snapshot unverändert. Bestehende historische Ladungsverluste weder löschen noch auffüllen.
16. Beispiel Rückkehr 900 Ladung und 600 freies Lager: 600 einlagern, 300 Überlauf. Nach Aktivierung keine neue Reise-Hungerreduktion; alte gespeicherte Reduktionen bleiben korrekt in alten Berichten.
17. Großer Offline-Schritt gleich vielen kleinen: Aktivierungswechsel, Abreise, verzögerte Ankunft, Kampf, Rückkehr, Forschung, Bau, Hunger und ENV-Wechsel chronologisch identisch. Altregeln ohne Scope weiter historisch all-living lesen.
18. Neustart/Schreibfehler vor und nach Migration, Ölbuchung, Kampf und Rückkehr; Journal, gleiche requestId/Payload und Konfliktfälle verhindern Doppelbuchung. Lange nicht eingeloggte Spieler erhalten dieselbe Aktivierungsgrenze, nicht Loginzeit.
19. Migration aktueller/älterer Schemas erhält Missionen 1–3, Forschung, Queues, Porträts, Bewerber und Postboxlesestatus. Fehlende Verzögerung 0 ergänzt ohne vorhandene Termine zu verändern.
20. ENV native/Compose, positive Ölstandards, explizite Öl-Nullraten abweisen (Nahrungs-Nullunterhalt bleibt erlaubt), entfernten Minutenpreis melden, isolierte Welten und Limits. Alte Missionssnapshots mit Nullraten/Minutenpreis weiter korrekt lesen; neue Formeln wirken nur bei neuen Starts. Historische Versorgung/Fristen ohne Reset.
21. Postbox neue/alte Berichte korrekt, einmalige Ungelesenmeldung, private Daten geschützt. Bewerber, Forschungsleitung und Nachrichten regressionsfrei.

npm test und npm run build sowie betroffene Container-/Startprüfung ausführen. In docs/LOGISTICS_VALIDATION.md ausgeführte Prüfungen und offene Einschränkungen ehrlich dokumentieren. Manueller Ablauf: Freischaltungen/Gebäude/LKWs → Stadtunterhalt prüfen → verzögerten Farmzug mit Ölaufschlüsselung starten → Unterhalt sinkt sofort → Login/Neustart → erst verspätete Ankunft → normal langer Rückweg → Unterhalt steigt mit Überlebenden → Bericht/Einlagerung prüfen. Testuhr verwenden statt reale Wartezeiten abzusitzen.

## 12. Lieferung und Folgeplanung

Ein reviewbarer PR mit nachvollziehbaren Teilcommits, Umsetzung, Migration, Tests und aktualisierten README, Projektplan, WebSocket-/Entwicklungsdokumentation und .env.example. Bestehende Historie und Dateien erhalten; Implementiert/Geplant klar trennen.

Nicht Teil dieses Auftrags: andere Beuteressourcen, PvP, Spielerhandel, unabhängige Transportmissionen, Kampfflugzeuge, Raketenwerfer, zusätzliche Generalfähigkeiten für Luftvorteile, weitere Öltechnologien, Gebäudeflächenvergrößerung oder aktive Matrix-Föderation. Flugzeuge/Raketenwerfer und Luftfähigkeiten sind bestätigte spätere Ziele, keine sofortigen Einheiten oder heutigen Skillpunkte. Ihre Freischaltungen, Gebäudebedarf, Luft-/Boden-Interaktionen, Konter, Öl/Unterhalt und getrennten Bonuswirkungen später gemeinsam spezifizieren. Die grafische Darstellung bisheriger Späher als Flugzeuge ersetzt diese neue Kampfmechanik nicht. Nach dem Logistikkreislauf Balance/Spieltempo prüfen und dann Unterstützung/Handel beziehungsweise zusätzliche militärische Technologien getrennt spezifizieren. Föderation bleibt Kernziel, benötigt später eigene Identitäts- und Vertrauensregeln.
