# Codex-Auftrag 13: Ölwirtschaft, LKWs, Stadtversorgung und verzögerte Ankunft

## Auftrag und Arbeitsweise

Der Nutzer bestätigt Auftrag 12 am 08.10.2026 als abgeschlossen und beauftragt den nächsten Schritt. Implementiere einen vollständigen Ablauf: Ölverarbeitung erforschen → zivile Ölraffinerie bauen → Motorisierung erforschen → Fahrzeugfabrik auf Militärbauplatz bauen → LKWs herstellen → Infanterie und LKWs gemeinsam zum NPC schicken → begrenzte Nahrung erbeuten und zurückbringen.

Verbindliche Nutzerergänzung vom 09.10.2026: Unterwegs befindliche Truppen verbrauchen keine Nahrung aus der Stadt. Beim Angriff/Farmzug soll eine zusätzliche Ankunftsverzögerung in Minuten wählbar sein, für die der Ölbedarf linear steigt. Kampfflugzeuge, Raketenwerfer und zusätzliche Generalfähigkeiten für Luftvorteile sind für eine spätere Phase vorgemerkt, nicht jetzt zu implementieren.

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

## 5. Einheitenwerte und Öl für Mobilmachung

Vorläufige Werte:

| Typ | Kampfwirkung | Nahrungstraglast | Nahrung pro Stunde bei Stationierung | Öl je Einheit/Feld/einfache Strecke |
| --- | --- | --- | --- | --- |
| Infanterie | Bestehende Kampfformel | 20 | Bestehende ENV, Standard 360 | 0 |
| Späher | Bisherige Aufklärung, nicht in Farmzügen | 0 | Bestehende ENV, Standard 180 | 0 |
| LKW | 0 Angriff, keine zusätzliche Kampfstärke/Schutzwirkung | 200 | 180 | 1 |

- LKW ist transportfähig, nicht unverwundbar. Keine Erhöhung der Infanteriestärke, Siegchance oder Verringerung ihrer Verluste allein durch mehr LKWs.
- Die Ölstandards 0 für bestehende Einheiten vermeiden eine neue zwingende Ölhürde für bisherige reine Infanterie-/Spähereinsätze. Betreiber können typabhängige Raten ändern.
- Grundreisezeit T zunächst wie vorhandene Farmzüge: pro Richtung max(5 Sekunden, ceil(Luftlinienentfernung) × 5 Sekunden). Optionale Hinreiseverlängerung siehe unten; Rückreise bleibt T. Keine neue Wegfindung, Geländekosten oder Geschwindigkeitsboni.
- Für neue Missionen Distanzfelder d = max(1, ceil(Luftlinienentfernung)).
- Unverzögerter ungerundeter Ölbedarf B = 2 × d × Summe(entsendete Anzahl je Typ × Ölrate je Typ). Faktor 2 umfasst Hin- und Rückweg. Ohne Verzögerung Gesamtöl = ceil(B); mit Verzögerung kommt vor einmaliger Gesamtrundung der unten definierte Zuschlag hinzu.
- Beispiel 20 Infanteristen und 4 LKWs bei Distanz 5: ceil(2 × 5 × (20 × 0 + 4 × 1)) = 40 Öl.
- Gesamtes Öl beim erfolgreichen Start aus der Heimatstadt einmalig abbuchen, zusammen mit Truppenreservierung, Generalbindung, Missionssnapshot und Wiederholungsbeleg.
- Fehlendes Öl verhindert Start ohne Teilbuchung. Keine spätere Rückwegabbuchung, kein zusätzliches Öl pro Tick und kein automatisches Auffüllen.
- Verluste oder ausgefallener Angriff erstatten keinen bereits bezahlten Kraftstoff. Keine neue Abbruchaktion in diesem Auftrag.
- Eingesetzte Infanterie/Späher werden nur dann ölpflichtig, wenn der Betreiber ausdrücklich ihre Raten erhöht. Auch neue Aufklärungsstarts benötigen dann die serverseitige Ölvorschau/-prüfung.
- Alte bereits laufende Missionen behalten 0 neu fällige Ölkosten; niemals rückwirkend belasten.
- Neue Mission speichert Entfernungsgrundlage, Grundreisezeit, Zusatzverzögerung, Hin-/Rückwegkosten, Ölzuschlag, Einheitensnapshot, Preisregelversion, bezahltes Gesamtöl, Ankunft/Rückkehr und Traglastwerte. Künftige Konfigurationswechsel verändern diese Werte nicht.
- Ölverbrauch und Kapazität anhand tatsächlich gestarteter Truppen; Client kann weder Preise noch Distanzen festlegen.

### Zusätzliche Ankunftsverzögerung für Angriffe/Farmzüge

- Im Startdialog zusätzliche Verzögerung in ganzen Minuten einstellen, Standard 0. Vorläufig maximal 1440 Minuten (24 Stunden), durch MAX_ATTACK_DELAY_MINUTES konfigurierbar.
- Truppen und General verlassen die Stadt bei erfolgreichem Start sofort und sind ab dann gebunden/unterwegs. Es ist keine spätere Abreise und kein geplanter Stadt-Warteauftrag.
- Bei Grundhinreise T und Zusatzverzögerung D gilt: arrivesAt = startedAt + T + D; returnsAt = arrivesAt + T. Nur die Hinreise verlängern.
- Nutzerbeispiel: T = 1 Minute, Zusatzverzögerung = 30 Minuten → Ankunft nach 31 Minuten, Rückkehr nach 32 Minuten ab Start. „30 Minuten“ bedeutet zusätzliche Zeit, nicht Ankunft bei Minute 30.
- Verzögerung wird nur vor Start gewählt. Kein kostenloses nachträgliches Verlängern, Verkürzen, Umplanen oder Abbrechen.
- NPC-Regeneration, Kampf und Beute erst am gespeicherten tatsächlichen Ankunftstermin abrechnen. Kein früher Kampf am ursprünglichen Termin, keine frühzeitige Reservierung von NPC-Vorräten.
- Gleichzeitige Ankünfte weiterhin deterministisch über vorhandene Ereignisnummern ordnen; mehrere Tabs und Wiederanmeldung ändern keine Termine.
- In dieser Etappe für vorhandene NPC-Farmangriffe aktivieren. Spätere PvP-Angriffe sollen denselben Mechanismus nutzen können, PvP hier nicht implementieren. Aufklärung unterstützt weiterhin keine Zusatzverzögerung; unerlaubten positiven Parameter serverseitig ablehnen.

Vorläufiger linearer Ölzuschlag:
- OIL_DELAY_PER_UNIT_PER_MINUTE, Standard 0,1 Öl je entsendeter Einheit und zusätzlicher Minute.
- Bei m Verzögerungsminuten und N tatsächlich entsendeten Einheiten über alle zulässigen Typen: Zuschlag Z = m × N × Zuschlagsrate.
- Gesamtzahlung = ceil(B + Z), wobei B der ungerundete normale Hin-/Rückwegbedarf ist. Nicht jeden Typ, Reiseabschnitt oder Zuschlag einzeln aufrunden.
- Damit ist jeder weitere Verzögerungsminute derselbe ungerundete Zuschlag zugeordnet; angezeigte Gesamtzahlung folgt der dokumentierten Rundung auf ganze Öleinheiten.
- Beispiel bestehender Distanz-5-Zug mit 20 Infanteristen/4 LKWs: B = 40; bei 30 Zusatzminuten Z = 30 × 24 × 0,1 = 72; Gesamtöl 112.
- Reine Infanterie darf nicht kostenlos verzögert werden, nur weil OIL_INFANTRY_PER_FIELD standardmäßig 0 ist: 10 Infanteristen mit 30 Zusatzminuten kosten 30 Öl Zuschlag. Ohne Verzögerung bleibt normale Ölfreiheit erhalten.
- Zuschlag hat einen positiven konfigurierten Satz und gilt auch für Einheiten mit normaler Ölrate 0. Nahrungsbefreiung unterwegs durch keine andere versteckte Nahrungskosten ersetzen.
- Endliche nicht negative Ganzzahlminuten, Grenzen und sichere Zeit-/Kostenarithmetik prüfen. Server vertraut keinen gelieferten Zeitstempeln, Anzahlwerten oder Preisen ohne erneute Prüfung.
- Vorschau zeigt Grundreisezeit, Zusatzminuten, Ankunfts-/Rückkehrzeit, normalen Ölbedarf, Zuschlag und gerundete Gesamtzahlung; bei veränderter Eingabe neu prüfen.
- Berechnung aus Serverzeit beim tatsächlichen Start; Vorschauzeitpunkte als Vorschau kennzeichnen. Normale Verzögerung zwischen Vorschau und Bestätigung verschiebt Abfahrt und damit absolute Termine, nicht gewählte Dauer/Preis. Geänderte Dauer/Regeln/Mengen verlangen neue Bestätigung.
- Ölzahlung und vollständiger Missionsplan atomar und idempotent speichern. Für fehlendes Öl keine Reservierung oder halbe Mission.

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
| OIL_INFANTRY_PER_FIELD | 0 | Öl je Infanterist/Feld/einfache Strecke |
| OIL_SCOUT_PER_FIELD | 0 | Öl je Späher/Feld/einfache Strecke |
| OIL_TRUCK_PER_FIELD | 1 | Öl je LKW/Feld/einfache Strecke |
| TRUCK_CARGO_CAPACITY | 200 | Nahrungstraglast je LKW |
| MAX_ATTACK_DELAY_MINUTES | 1440 | Maximale zusätzliche Hinreisezeit in ganzen Minuten |
| OIL_DELAY_PER_UNIT_PER_MINUTE | 0.1 | Öl je entsendeter Einheit und zusätzlicher Minute |

- Unterhalt wie vorhandene Unterhaltsvariablen validieren, inklusive 0. Ölraten 0–100.000 mit maximal drei Nachkommastellen; einmal auf feste ganzzahlige Tausendstelbasis bringen, damit Aufrundung nicht durch binäre Rundungsfehler zusätzlichen Treibstoff verlangt.
- Kapazität Ganzzahl 1–1.000.000. MAX_ATTACK_DELAY_MINUTES als Ganzzahl 0–10080 (0 deaktiviert Verlängerung), OIL_DELAY_PER_UNIT_PER_MINUTE positiv 0,001–100.000 mit höchstens drei Nachkommastellen auf derselben festen Zahlenbasis. Ungültig/leer/negativ/NaN/Infinity/Überlauf ablehnen. Fehlend nutzt Standard; explizit 0 bei normalem Unterhalt/normalen Ölraten erlaubt, nicht beim Verzögerungszuschlag.
- Preise, Forschungs-/Bau-/Produktionswerte und Herstellungsdauer zentral in versionierten Definitionen halten; dafür in diesem Auftrag keine zusätzlichen ENV-Schalter nötig.
- .env.example, native Starts, Prozessvorrang, Compose-Weitergabe und zulässige Snapshotwerte ergänzen. Keine ganze ENV an Client, kein Frontend-Rebuild nötig.
- Unterhaltsänderung über vorhandene gespeicherte Versorgungsregelhistorie: alte Offlinezeit mit alten Werten, neue Werte erst ab gespeichertem Wechsel. Historische Regeln ohne truck entsprechen für diesen Typ 0, keine nachträgliche Historienmutation.
- Aktive Hungerzyklen bewahren ihre bisherigen Frist-/Verlustregeln. Änderungen dürfen keinen Reset verschenken.
- Neue normale Ölraten, Verzögerungszuschläge, Verzögerungsgrenzen und Traglast gelten nur für neue Starts. Bereits gestartete Missionen verwenden bezahlte Beträge und gespeicherte Zeiten/Traglast auch nach Neustart; kleineres Verzögerungslimit verkürzt laufende Reisen nicht.
- Versionierte Vorschau erkennt Konfigurationsänderung und verlangt neue Prüfung, keine heimliche Nachberechnung beim Start.
- Zwei Weltinstanzen mit verschiedenen Einstellungen dürfen sich nicht beeinflussen.

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
4. Distanz-5-Zug mit 20 Infanteristen/4 LKWs: ohne Zusatzzeit 40 Öl, mit 30 Zusatzminuten 112 Öl (40 + 30 × 24 × 0,1). Fehlendes Öl lässt Truppen, General und Ressourcen unverändert.
5. Linearität vor Rundung: derselbe Zug mit 10/20/30 Zusatzminuten kostet 64/88/112 Öl. Normale Ölraten 0 umgehen Zuschlag nicht: 10 Infanteristen/30 Zusatzminuten = 30 Öl, bei 0 Zusatzminuten 0.
6. Alle Teilbeträge erst am Ende runden, inklusive Dezimalraten; positive kleine Zuschläge dürfen wegen Rundung einzelne gleiche Gesamtpreise ergeben. Sichere Ganzzahlarithmetik für Zeit, Kosten und Grenzwerte.
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
20. ENV native/Compose, Null-Raten und positive Verzögerungsrate, Limits, isolierte Welten, niedrigere neue Verzögerungsgrenze und eingefrorene laufende Zeiten/Öl/Traglast. Historische Versorgung und aktive Fristen ohne Reset.
21. Postbox neue/alte Berichte korrekt, einmalige Ungelesenmeldung, private Daten geschützt. Bewerber, Forschungsleitung und Nachrichten regressionsfrei.

npm test und npm run build sowie betroffene Container-/Startprüfung ausführen. In docs/LOGISTICS_VALIDATION.md ausgeführte Prüfungen und offene Einschränkungen ehrlich dokumentieren. Manueller Ablauf: Freischaltungen/Gebäude/LKWs → Stadtunterhalt prüfen → verzögerten Farmzug mit Ölaufschlüsselung starten → Unterhalt sinkt sofort → Login/Neustart → erst verspätete Ankunft → normal langer Rückweg → Unterhalt steigt mit Überlebenden → Bericht/Einlagerung prüfen. Testuhr verwenden statt reale Wartezeiten abzusitzen.

## 12. Lieferung und Folgeplanung

Ein reviewbarer PR mit nachvollziehbaren Teilcommits, Umsetzung, Migration, Tests und aktualisierten README, Projektplan, WebSocket-/Entwicklungsdokumentation und .env.example. Bestehende Historie und Dateien erhalten; Implementiert/Geplant klar trennen.

Nicht Teil dieses Auftrags: andere Beuteressourcen, PvP, Spielerhandel, unabhängige Transportmissionen, Kampfflugzeuge, Raketenwerfer, zusätzliche Generalfähigkeiten für Luftvorteile, weitere Öltechnologien, Gebäudeflächenvergrößerung oder aktive Matrix-Föderation. Flugzeuge/Raketenwerfer und Luftfähigkeiten sind bestätigte spätere Ziele, keine sofortigen Einheiten oder heutigen Skillpunkte. Ihre Freischaltungen, Gebäudebedarf, Luft-/Boden-Interaktionen, Konter, Öl/Unterhalt und getrennten Bonuswirkungen später gemeinsam spezifizieren. Die grafische Darstellung bisheriger Späher als Flugzeuge ersetzt diese neue Kampfmechanik nicht. Nach dem Logistikkreislauf Balance/Spieltempo prüfen und dann Unterstützung/Handel beziehungsweise zusätzliche militärische Technologien getrennt spezifizieren. Föderation bleibt Kernziel, benötigt später eigene Identitäts- und Vertrauensregeln.
