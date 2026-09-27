# Codex-Auftrag 3: Gemeinsame Weltkarte und NPC-Städte

## Arbeitsweise und Ausgangspunkt

Dieser Text ist ein Implementierungsauftrag an Codex. Der begleitende Planungschat erstellt ausschließlich Anforderungen und Anweisungen; Codex programmiert, prüft und öffnet einen Pull Request.

Arbeite im Repository bavxhack/War2glory auf dem aktuellen Stand von main. Lies AGENTS.md, README.md, docs/PROJECT.md, docs/WEBSOCKET.md und docs/FEDERATION.md. Prüfe vorhandene Änderungen und offene Pull Requests. Erhalte fremde Arbeit.

Laut aktuellem Projektplan sind Stadtansicht, Bauplätze, Bauwarteschlange, Konten mit eigenen Städten, WebSocket-Spielkommunikation und getrennte JSON-Spielstände umgesetzt. Prüfe den Code und die vorhandenen Tests selbst. Dieser Auftrag ersetzt Auftrag 2 und baut auf dessen Ergebnis auf.

## Vom Nutzer bestätigte Spielentscheidungen

- Die Weltkarte besteht aus quadratischen Feldern.
- Gelände und Stadtpositionen sind von Anfang an vollständig sichtbar. Es gibt keinen Erkundungsnebel, der Teile der Karte verdeckt.
- Genaue Informationen über fremde Städte erhält ein Spieler erst durch Aufklärung in einer späteren Etappe.
- NPC-Städte werden von allen Spielern derselben Welt gemeinsam genutzt. Es gibt keine persönlichen Kopien und keine getrennten Nahrungsvorräte pro Angreifer.
- Nach späteren Farmangriffen füllen sich die NPC-Ressourcen allmählich bis zu einer Obergrenze wieder auf.
- Zunächst existiert eine gemeinsame Karte pro Serverwelt. Wie Karten später über Matrix verbunden werden, bleibt offen.

## Ziel dieser Etappe

Ein Spieler kann zwischen seiner Stadt und einer gemeinsamen Weltkarte wechseln, seine Stadt verorten, andere Spieler- und NPC-Städte auswählen und öffentliche Informationen sowie Entfernungen ansehen. Neue und bestehende Konten erhalten dauerhaft eindeutige Stadtpositionen.

Angriffe, Aufklärung, Truppenmärsche und das tatsächliche Farmen gehören noch nicht zu diesem Auftrag. Bereite das Datenmodell dafür vor, ohne zusätzliche Spielsysteme vorzeitig einzubauen.

## 1. Gemeinsame, dauerhafte Welt

- Erstelle ein endliches quadratisches Koordinatenraster mit nachvollziehbarem Koordinatensystem und festen Grenzen. Es gibt zunächst keinen Kartenrand-Umbruch.
- Verwalte Kartengröße, NPC-Dichte und technische Generierungsparameter zentral. Wähle handhabbare vorläufige Standardwerte und dokumentiere sie ausdrücklich als eigene Prototypwerte.
- Erzeuge die Karte einmal je Welt und speichere sie in deren serverseitigem JSON-Verzeichnis. Ein Neustart oder erneuter Login darf sie nicht neu würfeln.
- Vergib stabile IDs an Städte und NPCs; Koordinaten allein ersetzen keine Identität.
- Verhindere doppelt belegte Stadtfelder. Neue Spieler erhalten serverseitig einen freien, geeigneten Standort. Ein Client darf seinen Standort nicht frei setzen.
- Berücksichtige gleichzeitige Registrierungen und eine volle Karte. Fehler dürfen weder Doppelbelegung noch unbrauchbare halbfertige Konten hinterlassen.
- Ordne vorhandenen Spielern beim ersten Laden einmalig einen Standort zu. Erhalte dabei Konten, Sitzungen, Ressourcen, Gebäude, Aufträge und bisherige Identitäten.
- Definiere die verbindliche Quelle der Stadtpositionen. Wenn Daten in Welt- und Spielerdateien zusammenhängen, verhindere oder repariere inkonsistente Zwischenstände nach einem Abbruch.
- Versioniere das neue Format und sichere bestehende Daten vor der Migration. Unbekannte Versionen oder beschädigte Dateien werden verständlich abgewiesen und nicht stillschweigend ersetzt.
- Behalte den Betrieb mit genau einem Schreibprozess pro Welt und JSON-Persistenz bei.

## 2. Darstellung und Bedienung

- Ergänze eine funktionierende Navigation zwischen Stadtansicht und Weltkarte.
- Stelle quadratische Felder, Gelände und Städte deutlich erkennbar dar. Eigene Stadt, fremde Spielerstädte und NPC-Städte müssen unterscheidbar sein.
- Nutze das vorhandene Erscheinungsbild und eigene oder nachvollziehbar lizenzierte Grafiken. Die Karte soll eine Landschaft darstellen, keine große Tabelle aus Textfeldern.
- Ermögliche Verschieben, Vergrößern/Verkleinern, Koordinatensuche und „Zur eigenen Stadt“. Begrenze Bewegung und Zoom sinnvoll.
- Zeige Koordinaten und eine verständliche Legende. Ein ausgewähltes Feld öffnet eine Detailansicht.
- Unterstütze Desktop, Touchbedienung und Tastatur. Auswahl und Fokus dürfen durch Serverereignisse nicht verloren gehen.
- Die vollständige Karte ist für angemeldete Spieler zugänglich. Ein Laden nach sichtbarem Kartenausschnitt ist zur Begrenzung der Datenmenge erlaubt und darf keine Erkundungsfreischaltung voraussetzen.
- Vermeide das Rendern unnötig vieler unsichtbarer DOM-Elemente. Wähle eine einfache, nachvollziehbare Darstellung ohne pauschalen Frameworkwechsel.
- Halte die bestehende Stadtansicht, Bauwarteschlange und Rückkehr zur eigenen Stadt funktionsfähig.

## 3. Öffentliche und geheime Informationen

Öffentlich dürfen angezeigt und übertragen werden:
- Koordinaten und Geländetyp.
- Stadt-ID, Stadtname und Typ: eigene Stadt, Spielerstadt oder NPC.
- Bei Spielerstädten der bereits öffentliche Kommandantenname.
- Bei NPCs eine allgemeine Schwierigkeitsstufe.
- Entfernung von der eigenen Stadt.

Vor späterer Aufklärung bleiben bei fremden Spieler- und NPC-Städten verborgen:
- Genaue Ressourcenbestände und Lagerkapazitäten.
- Exakte Garnison, Truppenzusammensetzung und Verteidigungswerte.
- Interne Produktions-/Regenerationswerte und Zeitstempel, aus denen sich verborgene Bestände ableiten lassen.
- Private Gebäude-, Bauauftrags-, Konto- und Sitzungsdaten.

Diese Trennung muss der Server durchsetzen. Verborgene Daten dürfen nicht lediglich in der Oberfläche ausgeblendet werden und nicht über Detailereignisse, Fehlermeldungen oder abgeleitete Metadaten nach außen gelangen. Daten der eigenen Stadt bleiben im bestehenden authentifizierten Stadtkanal verfügbar.

Beschrifte noch unbekannte Details verständlich mit „Aufklärung erforderlich“. Es gibt in dieser Etappe weder eine funktionierende Aufklärungsaktion noch ausgedachte Aufklärungsberichte.

## 4. Gemeinsame NPCs und spätere Regeneration vorbereiten

- Erzeuge mehrere gemeinsam sichtbare NPC-Städte mit stabiler Identität, Position und vorläufiger Schwierigkeitsstufe.
- Lege ihre verbindlichen Daten in der gemeinsamen Weltablage ab, nicht in privaten Kopien je Spieler.
- Bereite ein versioniertes internes Modell für gemeinsam geteilte Ressourcenbestände, Obergrenzen und zeitbasierte Regeneration vor. Nahrung ist der erste vorgesehene Farmrohstoff; weitere Beutearten sind noch nicht entschieden.
- Halte diese internen Werte aus öffentlichen Kartendaten heraus.
- Dokumentiere die spätere Regel: nach einer Plünderung allmähliche Auffüllung bis zur Obergrenze, auch während Serverausfall oder Abwesenheit zeitlich korrekt nachberechenbar. Kein sofortiger vollständiger Reset.
- Lege spätere Beuteentnahme als serverseitigen, serialisierten Vorgang an einer gemeinsamen NPC-Identität konzeptionell fest, damit derselbe Vorrat nicht mehrfach vergeben werden kann.
- Implementiere jetzt keine Plünderungsfunktion, keine Beutegutschrift und keinen künstlichen Farmknopf. Eine aktive Regenerations-/Kampfmechanik folgt mit dem Farmzug-System.

## 5. Entfernungen und WebSocket-Ereignisse

- Berechne und dokumentiere eine einheitliche Entfernung in Kartenfeldern. Ein einfacher geometrischer Abstand ist für diese Etappe ausreichend; kennzeichne ihn als Luftlinie und nicht als spätere tatsächliche Marschroute.
- Es gibt noch keine verbindlichen Marschzeiten, Geländekosten oder Wegfindung. Diese hängen später von Truppen und weiteren Regeln ab.
- Nutze für alle dynamischen Kartenanfragen und Änderungen das vorhandene versionierte WebSocket-Protokoll. Kein HTTP-Spielpolling und kein zweiter REST-Spielkanal.
- Ergänze geeignete Ereignisse für Karteninitialisierung bzw. Ausschnitte, öffentliche Felddetails und Kartenänderungen. Die genauen Namen sollen zur bestehenden Implementierung passen.
- Teile neu entstandene Spielerstädte den verbundenen berechtigten Spielern mit. Sende nicht sekündlich die vollständige unveränderte Karte.
- Prüfe Anmeldung, Koordinaten, Ausschnittsgröße, Rate und erlaubte Felder. Manipulierte IDs dürfen keine privaten Zustände zurückliefern.
- Nach Wiederverbindung wird die Karte konsistent abgeglichen. Ignoriere veraltete Antworten bei raschem Verschieben oder Wechseln der Auswahl.

## 6. Prüfungen und Abnahme

Prüfe bestehende Funktionen und ergänze gezielte Tests:

1. Zwei Spieler sehen dieselbe Welt und dieselben NPC-IDs; ihre eigenen Städte stehen auf unterschiedlichen Feldern.
2. Gleichzeitige Registrierungen können keinen Standort doppelt belegen.
3. Koordinaten, Weltidentität und NPCs bleiben über Neustart und erneuten Login stabil.
4. Bestehende Konten werden ohne Verlust ihrer Städte und Bauaufträge migriert. Wiederholte Migration erzeugt keine neuen Positionen.
5. Eine volle Karte und Speicherfehler führen zu nachvollziehbaren, konsistenten Ergebnissen.
6. Kartendaten und öffentliche Detailantworten enthalten keine privaten Bestände, Garnisonen, Produktions-/Regenerationsdaten oder Zugangsdaten.
7. Ungültige Koordinaten, fremde IDs und übergroße Kartenanfragen werden abgefangen.
8. Neu registrierte Städte erscheinen bei anderen Spielern über WebSocket-Ereignisse ohne Neuladen.
9. Rückkehr nach Verbindungsabbruch liefert einen konsistenten Kartenstand.
10. Die dokumentierte Distanzberechnung stimmt für gleiche, waagerecht, senkrecht und diagonal versetzte Koordinaten.
11. Unterschiedliche Serverwelten besitzen getrennte Karten und Zustände.

Prüfe die Oberfläche auf Desktop und Smartphone, einschließlich Auswahl, Koordinatensuche, Zoom, Verschieben, Tastaturbedienung und Rückkehr zur eigenen Stadt. Füge Screenshots zum Ergebnis hinzu. Benenne nicht ausführbare Prüfungen offen; erfinde keine Testergebnisse.

## Ergebnis und anschließende Etappen

- Aktualisiere README, Projektplan und die Protokoll-/Speicherdokumentation mit dem tatsächlich erreichten Stand.
- Erhalte Docker-/Compose-/CI-Funktionalität und passe sie nur an, wenn es durch diese Etappe erforderlich wird.
- Arbeite auf einem eigenen Branch und öffne einen Pull Request mit Änderungen, Migrationshinweisen, Prüfungen und verbleibenden Grenzen. Nicht selbst zusammenführen oder produktiv deployen.
- Antworte auf Deutsch. Implementierter Stand, vorbereitete Datenstrukturen und spätere Mechaniken müssen eindeutig getrennt bleiben.
- JavaScript bleibt die Projektsprache; die Spiellogik bleibt unabhängig von Oberfläche und Transport.
- Als Nächstes folgen Truppen und Generäle mit Erfahrung/Levelsystem; darauf aufbauend Aufklärung und erste NPC-Farmzüge mit Rückkehr und gemeinsamer Beuteentnahme. Forschung bleibt im Projektplan. Matrix-Föderation und serverübergreifende Gefechte folgen später.
- Entscheide reversible technische Details selbst und dokumentiere Prototypwerte. Die oben bestätigten Spielentscheidungen werden nicht erneut zur Abstimmung gestellt.

## Zusätzlicher Ausblick: Lager und Gebäudeabriss (nicht Teil dieses Auftrags)

Der Nutzer hat folgende spätere Anforderungen ergänzt; sie sind in docs/PROJECT.md genauer festgehalten:

- Höhere Stufen der Produktionsgebäude erhöhen neben der Produktion auch die Lagerkapazität ihrer jeweiligen Ressource.
- Ein neuer, ausbaubarer Gebäudetyp Lagerhaus erhöht die Lagerkapazität aller Ressourcen.
- Gebäude können später abgerissen werden. Der Bauplatz wird frei; ein noch festzulegender kleiner Anteil der kumulierten Investitionen aus Neubau und abgeschlossenen Ausbaustufen wird je Ressourcenart zurückerstattet.
- Kapazitätskurven, Rückerstattungsanteil, Umgang mit Überbeständen und laufenden Bauaufträgen sowie die Migration fehlender Investitionshistorien sind noch abzustimmen.

Diese Punkte jetzt nur als dokumentierte zukünftige Anforderungen erhalten. Keine Lagerhaus-, Abriss- oder Rückerstattungsimplementierung und keine zusätzlichen Balanceentscheidungen in den laufenden Weltkartenauftrag aufnehmen. Falls in diesem Auftrag bestehende Ressourcendaten berührt werden, ihre spätere Erweiterbarkeit erhalten, ohne den vereinbarten Umfang auszuweiten.

## Zusätzlicher Ausblick: Universitäten und Forschung (nicht Teil dieses Auftrags)

Für spätere Etappen sind Universitäten als Forschungsgebäude verbindlich vorgemerkt. Forschung soll Ressourcenproduktion und Lagerkapazität verbessern sowie später Waffensysteme, Truppengattungen und zusätzliche Gebäudetypen mit weiteren Verbesserungen beeinflussen bzw. freischalten.

Die konkreten Technologien, Voraussetzungen, Werte, Forschungszeiten, Universitätsstufen, Parallelität und Gültigkeit pro Stadt oder Spielerkonto sind noch abzustimmen. Forschungsboni müssen später mit Gebäudestufen und Lagerhauskapazitäten nachvollziehbar verrechnet werden; dazu wurde noch keine Formel festgelegt. Details und offene Entscheidungen stehen in docs/PROJECT.md.

Diese Forschungsanforderungen in der Planung erhalten. Im aktuellen Weltkartenauftrag weder Forschung implementieren noch Technologie-, Kosten- oder Bonuswerte eigenmächtig festlegen. Der vereinbarte Umfang dieses Auftrags bleibt unverändert.
