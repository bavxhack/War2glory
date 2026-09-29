# Codex-Auftrag 8: Erster vollständiger NPC-Farmzug

## Ziel, Ausgangspunkt und Arbeitsweise

Der Nutzer bestätigt am 29.09.2026 die Umsetzung der Generalverwaltung. README und Protokolldokumentation beschreiben mehrere verwaltbare Generäle, Namensbearbeitung und persistente Skillgrundlagen; Skillumrechnung und Boni bleiben deaktiviert. Aufklärung, React/Vite, Lagerhaus und Abriss sind bereits vorhanden. Prüfe den tatsächlichen Code; der Planungschat hat keine eigenen Laufzeittests durchgeführt.

Arbeite vom aktuellen main in bavxhack/War2glory. Lies AGENTS.md, README.md, docs/PROJECT.md, docs/WEBSOCKET.md und docs/DEVELOPMENT.md. Prüfe offene PRs und bestehende Änderungen und bewahre fremde Arbeit. Auftrag 8 ersetzt Auftrag 7 als aktuellen Arbeitsauftrag.

Der Planungschat erstellt ausschließlich Anweisungen. Du implementierst und prüfst diesen Auftrag und lieferst einen Pull Request. Nicht selbst mergen oder deployen.

Spielbarer Ablauf: NPC auswählen → bei Bedarf aufklären → freien General und Infanterie entsenden → Hinmarsch → serverseitiger Kampf → begrenzte Nahrung laden → Rückmarsch → Überlebende, Beute, Erfahrung und privaten Bericht erhalten.

## 1. Umfang und Status der vorgeschlagenen Regeln

- Implementiere zunächst ausschließlich Angriffe auf gemeinsame NPC-Städte derselben Serverwelt. Kein Angriff auf Spieler, kein PvP, keine Eroberung und kein Verlust einer Spielerstadt.
- Für diese erste Kampfversion ist nur bestehende Infanterie als Angriffstruppe zugelassen. Aufklärungsflugzeuge/Späher behalten ihre vorhandene Aufklärungsfunktion. Kein künstliches Umdeuten dieser Einheiten zu Transportern.
- NPC-Garnison und Nahrung sind gemeinsame Bestände; jede Aktion verändert den tatsächlich aktuellen Zustand für alle folgenden Angriffe.
- Die konkreten Kampf-, Garnisons-, Transport- und Belohnungsregeln unten sind neue, ausdrücklich vorläufige Vorschläge des Planungschats für einen überprüfbaren Prototyp. Sie sind keine einzeln bestätigten Nutzerentscheidungen und keine Originalwerte von War2Glory. Zentral konfigurieren, versionieren und im PR mit Beispielen zur Prüfung aufführen.
- Der PR ist die reviewbare Umsetzung dieser Vorschläge. Regelparameter nicht als endgültig beschlossene Balance darstellen.
- Bereits bestätigte Anforderungen bleiben: serverseitige Regeln, WebSocket-Ereignisse, JSON-Spielstände, getrennte Stadt-/Militärplätze und private Informationen.
- Nahrungsunterhalt, Öl, Raffinerien, LKWs, Forschung, zivile Generalrollen, neue Rekrutierung und Skillbonusaktivierung sind nicht Teil dieses Auftrags. Bestehende deaktivierte Skills nicht nebenbei aktivieren.

## 2. Gemeinsame NPC-Garnison und Ressourcenregeneration

- Ergänze je NPC eine dauerhaft gespeicherte Garnison aus einfacher NPC-Infanterie. Prototyp: maximale Stärke = 5 × vorhandene Schwierigkeitsstufe. Bei Stufen 1, 2 und 3 sind das 5, 10 und 15 Verteidiger.
- Initialisiere die Garnison bei Migration genau einmal. Später geschlagene NPCs dürfen durch Laden, Login oder Neustart nicht automatisch wieder voll besetzt werden.
- Prototyp für Wiederaufbau: ein Verteidiger je 300 Sekunden bis zur Obergrenze, unabhängig von der Nahrungsregeneration. Rechne Bruchteile nachvollziehbar, ohne durch häufige Zugriffe Fortschritt zu verlieren. Bei voller Garnison keine Wiederaufbauzeit für spätere Verluste ansparen.
- Aktiviere die bisher vorbereitete allmähliche Nahrungsregeneration. Verwende vorhandene Kapazität und Rate je NPC, keine pauschale Überschreibung. Laut README sind 500 Nahrung Kapazität und 25 Nahrung pro Stunde vorbereitet; im Code verifizieren.
- Nahrung(t) = min(Kapazität, alter Bestand + Rate pro Stunde × verstrichene Sekunden / 3600). Bruchteile erhalten; für ganzzahlige Beute höchstens den abgerundeten verfügbaren Bestand verwenden.
- Regeneration und Garnisonsaufbau laufen ab dokumentiertem Aktivierungs-/Migrationszeitpunkt. Keine rückwirkende Erfindung dieser Mechanik für frühere Aufklärungen.
- NPC-Zustände bleiben intern. Öffentliche Karte/Detailantworten dürfen weder Vorrat noch Garnison, Regenerationszeitstempel oder genaue Kampfvorschau preisgeben.
- Neue Aufklärungen erfassen Nahrung und echte Garnison am vorgesehenen Ankunftszeitpunkt. Bericht bleibt historisch und wird weiterhin erst bei Rückkehr sichtbar.
- Bereits gespeicherte Berichte bleiben unverändert. Bei einem alten Aufklärungs-Ankunftszeitpunkt vor Aktivierung darf keine nachträglich erzeugte Garnison als damals beobachtet ausgegeben werden; frühere Nichtmodellierung kennzeichnen.

## 3. Vorläufiger deterministischer Kampf

Für den ersten Farmkreislauf verwenden beide Seiten nur gleichwertige Infanterie. Bewusst ein einfaches, reproduzierbares Mengenmodell ohne Zufall, Trefferpunkte oder erfundene aktive Generalboni:

- A = Zahl entsandter Infanteristen; D = unmittelbar vor Kampf vorhandene NPC-Verteidiger.
- A muss positiv und ganzzahlig sein. A wird gegen stationierte Verfügbarkeit und bestehende Führungskapazität des gewählten Generals geprüft.
- Bei D = 0: Angreifer besetzt das Ziel für diesen Farmzug erfolgreich, keine Verluste, keine Kampferfahrung oder Kampfpunkte aus diesem leeren Gefecht.
- Bei A > D: Angreifer gewinnt. Alle D Verteidiger gehen verloren; Angreifer verliert min(A, ceil(D / 2)) Infanteristen.
- Bei A <= D und D > 0: Angreifer verliert. Alle A Infanteristen gehen verloren; NPC verliert min(D, floor(A / 2)) Verteidiger. Gleichstand zählt damit als Verteidigersieg.
- Persistiere NPC-Verluste unmittelbar beim Kampfergebnis. Teilverluste bleiben für nachfolgende Angriffe bestehen und werden nur über den definierten Wiederaufbau ersetzt.
- Ein Gefecht wird am fachlichen Ankunftszeitpunkt genau einmal ausgewertet. Es gibt keine separate Kampfdauer in diesem Prototyp.
- Auf Niederlage folgt keine Plünderung. Der General überlebt vorläufig immer und kehrt nach der normalen Rückreisedauer allein zurück. Er bleibt bis dahin gebunden. Kein kostenloser Ersatz verlorener Truppen.
- Das Mengenmodell ist eine temporäre PvE-Regel, kein endgültiges System für Waffen oder Truppentypen. Berechnung als austauschbaren, reinen Spielkernbaustein mit Regelversion kapseln.
- Gegenwärtige Führungskapazität und Aufklärungsregeln erhalten. Angriff-/Verteidigungs-Skills bleiben inaktiv; keine Bonusversprechen in der Oberfläche.

Beispiele als Abnahmereferenz:
- A = 10, D = 5: Sieg, 3 eigene Verluste, 7 Überlebende, 5 NPC-Verluste.
- A = 4, D = 5: Niederlage, 4 eigene Verluste, 2 NPC-Verluste, 3 Verteidiger bleiben.
- A = 5, D = 0: Sieg ohne Verluste und ohne Kampfbelohnung.

## 4. Typabhängige Traglast, Beute und Heimatlager

- Definiere Transportkapazität je Einheitenart getrennt von Kampfstärke und späterem Unterhalt/Ölbedarf.
- Vorläufige Werte für diesen Auftrag: Infanterie trägt 20 Nahrung je überlebender Einheit; Aufklärungsflugzeuge/Späher tragen 0 und sind keine erlaubten Farmtruppen. LKWs bleiben später.
- Verfügbare Traglast = Summe der überlebenden transportfähigen Einheiten je Typ × deren Einzelkapazität. In diesem Auftrag reduziert sich dies auf überlebende Infanterie × 20.
- Bei Sieg: geladene Nahrung = min(Traglast, floor(verfügbarer NPC-Nahrung)). Bei Niederlage 0. Erst nach der Kampfverlustberechnung beladen.
- Im Beispiel A = 10, D = 5 bleiben 7 Träger mit insgesamt 140 Kapazität. Bei 500 vorhandener Nahrung werden 140 entnommen und 360 bleiben beim NPC; bei nur 80 Nahrung werden 80 geladen.
- Beuteentnahme und Zuordnung zur Mission müssen konsistent und genau einmal erfolgen. Zwei Spieler können nicht denselben NPC-Vorrat erhalten.
- Während der Rückreise gehört Beute zur Mission, nicht zum Stadtlager. Es gibt in dieser Etappe keine Abfangangriffe oder weiteren Rückreiseverluste.
- Vorläufige neue Regel für Beute bei Ankunft: nach zeitlich korrekter heimischer Wirtschaftsabrechnung wird nur bis zur aktuellen freien Nahrungslagerkapazität entladen. Überschüssige Beute wird als nicht eingelagerte/verfallene Beute im Bericht ausgewiesen.
- Bestehende heimische Überbestände aus Abriss werden dabei weder gekürzt noch erweitert. Bei vollem Lager oder Überbestand ist die eingelagerte Beute null.
- Beispiel: Mission trägt 140 Nahrung, bei Rückkehr sind 50 Lagerplätze frei: 50 einlagern, 90 als nicht eingelagert ausweisen. Diese 90 werden nicht zum NPC zurückgebucht und nicht als später abrufbarer Vorrat gespeichert.
- Vor Entsendung diesen möglichen Beuteverlust bei vollem Heimatlager erklären. Verfügbare Lagerplätze sind nur eine Momentaufnahme, keine garantierte Vorhersage der Rückkehr.
- Im Bericht geladene, eingelagerte und nicht eingelagerte Menge getrennt zeigen. Keine stillschweigende Vernichtung bestehender Stadtvorräte.
- Nur Nahrung als Beute; keine zusätzlichen plünderbaren Ressourcen oder Transportaufträge.

## 5. General-Erfahrung und Kommandantenpunkte

- Ein serverseitiges Kampfergebnis enthält stabile Kampf-/Missions-ID, Regelversion, Teilnehmer, Verluste und daraus abgeleitete Belohnungen.
- Prototyp für General-XP: 2 × tatsächlich in diesem Gefecht vernichtete NPC-Verteidiger, auch bei Niederlage. Keine XP für unverteidigte Ziele oder bloße Beutemenge.
- Im Beispiel 10 gegen 5 entstehen 10 XP; bei 4 gegen 5 entstehen 4 XP. Gutschrift für den eingesetzten General erst bei Rückkehr, genau einmal.
- Gesamt-XP erhöhen; bestehende Generallevel nach bisheriger Regel berechnen. Umgerechnete Erfahrung und Skillverteilungen unverändert lassen. XP-zu-Skill-Funktionen bleiben deaktiviert.
- Die vorhandene Erstaufklärungsbelohnung bleibt getrennt und weiterhin je Kommandant/NPC einmalig.
- Prototyp für Kommandanten-Kampfbeitrag je Gefecht: tatsächlich vernichtete NPC-Verteidiger minus eigene verlorene Infanteristen.
- Beispiel 10 gegen 5: 5 − 3 = +2; Beispiel 4 gegen 5: 2 − 4 = −2. Unverteidigter NPC ergibt 0. Keine weiteren pauschalen Sieges- oder Niederlagenboni.
- Persistiere den kumulierten Kampfbeitrag vorzeichenbehaftet. Gesamtanzeige = max(0, vorhandene Gebäudepunkte + sonstige bereits aktive Beiträge + kumulierter Kampfbeitrag). Forschung bleibt inaktiv.
- Negative Kampfbeiträge nicht beim Speichern auf null setzen, sonst würden spätere Bauten/Siege anders bewertet. Gebäudepunkte selbst bleiben aus vorhandenem Gebäudebestand abgeleitet.
- Keine zusätzliche doppelte Niederlagenstrafe oder Truppenwert-Abbuchung aus den Gebäudepunkten.
- XP, Punkte und privater Bericht werden bei Rückkehr zusammen mit den Rückkehrfolgen freigegeben. Kein mehrfaches Belohnen durch Reconnect, erneute Auswertung oder Absturz.
- Vernichtete und später tatsächlich regenerierte Verteidiger können in späteren Gefechten erneut zählen. Keine Belohnung pro identischem Ereignis und keine unbegrenzte Belohnung an dauerhaft leerer Garnison. Weitere Anti-Farming-/PvP-Regeln bleiben später.

## 6. Missionen, Ereignisse und Oberfläche

- Ergänze bei NPCs eine Aktion „Angreifen“ zusätzlich zu „Aufklären“. Bei Spielerstädten bleibt Angriff gesperrt.
- Eine vorherige Aufklärung ist in dieser ersten Fassung optional. Ohne Bericht gibt es keine genaue Gegneranzeige; ein vorhandener Bericht wird mit Erfassungszeit und Hinweis auf mögliche Änderungen angezeigt.
- Dialog: eigener freier General, verfügbare Infanterie, Entfernung, Hin-/Rückreisezeit, maximale Traglast vor möglichen Verlusten, aktueller Lagerplatz und Hinweise auf Verlustrisiko/Überlauf.
- Keine garantierte Beutemenge oder Siegchance aus geheimem Live-NPC-Zustand berechnen. Auch Fehlerantworten dürfen solche Daten nicht verraten.
- Bestehende Luftlinienreise verwenden: pro Richtung max(5 Sekunden, ceil(Entfernung) × 5 Sekunden), soweit der Code diese Regel bestätigt. Keine neue Wegfindung.
- Entsendung reserviert General und Truppen gemeinsam. Ein General führt nur einen Einsatz; Truppen dürfen nicht gleichzeitig in Farmzug und Aufklärung oder mehreren Armeen gebunden sein.
- Persistiere Missionsart, Eigentümer, Ziel-ID, General-ID, Ausgangstruppe, Überlebende, Ladung, Status, Zeitpunkte und verbindliche Regelversion. Daten, die erst beim Kampf entstehen, nicht vorher vortäuschen.
- Zustände mindestens Hinmarsch, Rückmarsch und abgeschlossen. Keine Rückruf-/Abbruchaktion in dieser Etappe.
- Verluste, Ausgang und Ladung bis Rückkehr nicht über den normalen Clientzustand vorzeitig offenlegen. Allgemeiner Rückmarschstatus darf sichtbar sein; intern gebundene/überlebende Truppen sind von öffentlichen Projektionen zu trennen.
- Bei Rückkehr Überlebende einmal stationieren, General freigeben, Beute begrenzt einlagern, XP/Punkte verbuchen und historischen privaten Bericht veröffentlichen.
- Bericht: NPC, Zeiten, Ausgang, eingesetzter General zum Einsatzzeitpunkt, beiderseitige Anfangstruppen und Verluste, Überlebende, Traglast, Ladung, Einlagerung/Überlauf, XP und Punkteänderung.
- React-Komponenten, Dialoge und zentralen WebSocket-Transport wiederverwenden. Keine zweite Verbindung und kein HTTP-Spielpolling. Namen/variable Texte sicher darstellen.
- Zeige die vereinfachten Prototypregeln verständlich, ohne technische Speicher-/Transaktionsdetails im Spielablauf auszubreiten.

## 7. Weltweite Zeitreihenfolge und absturzsichere JSON-Persistenz

Dies ist der kritische Teil: Farmzüge ändern gleichzeitig Welt- und Spielerzustand. Eine Prozesssperre und atomare Einzeldateien allein genügen nicht für einen Absturz zwischen zwei Dateien.

- Behalte einen schreibenden Prozess pro Welt und die bestehende serialisierte Verarbeitung. Entwickle einen dokumentierten, dauerhaft protokollierten Ablauf für zusammengehörige Welt-/Spieleränderungen, etwa mittels Journal und wiederaufnehmbarer Transaktions-ID.
- Vor Veröffentlichung einer erfolgreichen Änderung muss ein dauerhafter Nachweis existieren, aus dem alle betroffenen Dateien nach Absturz widerspruchsfrei hergestellt werden können.
- Gemeinsame NPC-Verluste, Nahrung, Missionsresultat und spätere Rückkehr dürfen weder doppelt angewandt noch nur teilweise als abgeschlossen erscheinen. Deduplizierung von Kampfergebnissen ist unabhängig vom begrenzten Cache der Client-requestIds nötig.
- Nach Start zuerst offene Transaktionen wiederherstellen, bevor neue Befehle oder Snapshots verarbeitet werden. Keine Datenbankumstellung nötig, aber echte Wiederherstellung statt bloßem In-Memory-Rollback.
- Verarbeite fällige Ereignisse der gesamten Welt chronologisch, auch für offline befindliche Spieler: Aufklärungsankünfte, Farmankünfte, Rückkehr und betroffene Bau-/Ausbildungsabschlüsse.
- Bei identischen Zeitpunkten eine persistente deterministische Reihenfolge verwenden, etwa gespeicherte Ereignisnummer; nicht Reihenfolge von Login, Dateieinlesen oder Netzwerkzugriff.
- NPC-Regeneration und Garnisonsaufbau vor jedem relevanten Ereignis nur bis zu dessen fachlichem Zeitpunkt berechnen. Kein Vorziehen auf die aktuelle Uhrzeit mit anschließend rückwärts verarbeiteten Kämpfen.
- Ein später verarbeiteter Spielerlogin darf frühere gemeinsame Kämpfe oder historische Aufklärungsdaten nicht verändern. Alle zum Auswertungszeitpunkt nötigen Ereignisse müssen berücksichtigt sein.
- Migration darf für bereits vergangene Zeiträume keine neue Kampf-/Regenerationshistorie erfinden. Aktive Aufklärungen und bestehende historische Berichte erhalten.
- Umgang mit rückwärts springender Uhr explizit begrenzen: keine negative Regeneration oder Rückabwicklung bereits abgeschlossener Ereignisse.
- Snapshots, Berichte und Fehler pro Besitzer filtern. Ein gemeinsames internes Journal darf nicht Teil öffentlicher Karten-/Clientantworten werden.
- Regeln/Parameter pro Mission bzw. Gefecht nachvollziehbar versionieren; Änderungen nach Update dürfen bereits festgeschriebene Ergebnisse nicht neu würfeln oder neu berechnen.

## 8. Prüfungen und Abnahme

Bestehende Tests, Frontend-Build und gezielte neue Regel-/Integrationstests ausführen:

1. Alle oben angegebenen Rechenbeispiele, Gleichstand, leere Garnison, Null/negative/gebrochene Truppenzahl sowie Führungslimit.
2. Persistente NPC-Teilverluste und Wiederaufbau bis Maximum, ohne Ansparen bei voller Garnison.
3. Nahrungsregeneration mit Teilmengen, Obergrenze, unterschiedlich großen Zeitschritten und Neustart.
4. Beute anhand Überlebender, knappe Vorräte, leeres NPC-Lager und volles/übervolles Heimatlager.
5. Zwei Spieler greifen denselben NPC an: der zweite trifft auf den korrekt fortgeschriebenen Zustand. Entnahme insgesamt nicht größer als Bestand plus zwischenzeitliche Regeneration.
6. Offline-Aufklärung zwischen zwei Farmankünften zeigt exakt den damaligen Zustand. Umgekehrte Login-Reihenfolge ändert Ergebnisse nicht.
7. Gleichzeitige Reservierung über mehrere Verbindungen/Missionen verhindert doppelte Truppen- oder Generalbindung.
8. Niederlage mit vollständigem Truppenverlust und allein zurückkehrendem General; Sieger mit einmaliger Beutegutschrift.
9. XP und positive/negative Kampfbeiträge, nicht negative Gesamtanzeige, erhaltene negative Historie und unveränderte Gebäudepunkte.
10. Datenzugriff vor/nach Rückkehr, fremde Berichte und öffentliche NPC-Details ohne geheime Bestände oder Garnison.
11. Absturz-/Fehlerinjektion zwischen dauerhaftem Journal, Weltdatei und Spielerdatei sowie zwischen Speicherung und Antwort: keine doppelte Beute, verlorene verbindliche Entnahme oder doppelte Belohnung.
12. Neustart während Hinmarsch, direkt beim Kampf, Rückmarsch und Rückkehr; wiederholte Nachrichten und widersprüchliche requestIds.
13. Regression von Generalverwaltung, deaktivierten Skills, Lagerwirtschaft/Abriss, Ausbildung und Aufklärung.

Browser-Abnahme mit zwei getrennten Konten, auf Desktop und Mobilansicht: aufklären, angreifen, Mission verfolgen, zurückkehren, Bericht prüfen, erneut anmelden. Sieg und Niederlage in isolierten Testdaten prüfen, produktive Spielstände nicht verändern. Screenshots von Angriffsdialog, Mission, Bericht und Punkteübersicht liefern. Nicht mögliche Prüfungen benennen.

## 9. Lieferung und Folgeauftrag

- Nachvollziehbare Teilcommits für NPC-Modell/Zeitverarbeitung, Kampf/Traglast, konsistente Missionsverarbeitung sowie React-Oberfläche.
- Ein vollständiger, getesteter Pull Request; keine eigenständige Zusammenführung oder Veröffentlichung.
- README, docs/PROJECT.md und Protokoll-/Speicherdokumentation auf tatsächlichen Stand bringen. Regelvorschläge, Risiken und Grenzen sichtbar getrennt dokumentieren.
- Im PR alle vorläufigen Zahlen/Formeln sowie vollständigen Angreiferverlust bei Niederlage, unsterblichen General, Heimatlager-Überlauf und weiterhin deaktivierte Skills ausdrücklich zur Prüfung nennen.
- Keine behauptete historische Kampfleistung bei Migration, kein rückwirkendes Auffüllen von XP oder Punkten.
- Danach den eigenen Nahrungsunterhaltsauftrag vorbereiten: Verbrauch pro Typ, Versorgung unterwegs, leeres Lager und Auswirkungen. Kostenkurve und Bonuswirkung der General-Skills separat zur Entscheidung vorlegen; der existierende Vorschlag 10 × n XP ist weiterhin kein freigegebener Regelsatz.
