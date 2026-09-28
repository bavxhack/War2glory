# Codex-Auftrag 5: Lagerwirtschaft, Lagerhaus und Gebäudeabriss

## Auftrag und Ausgangspunkt

Dies ist Schritt 2 der zuletzt vorgeschlagenen Entwicklungsreihenfolge. Der Nutzer meldet Schritt 1 als umgesetzt. Ersetze keine fertigen Systeme: Lies AGENTS.md, README.md, docs/PROJECT.md, docs/WEBSOCKET.md und docs/FEDERATION.md und prüfe Code, offene PRs und vorhandene Änderungen. Bewahre fremde Arbeit.

Die README beschreibt bereits getrennte zivile/militärische Bauplätze, Kommandantenpunkte, Ausbildung, Startgeneral und NPC-Aufklärung. Verifiziere diese Ausgangslage im Code. Der Planungschat hat dafür keine Laufzeittests durchgeführt. Aussagen über Implementierung und Tests müssen auf deiner eigenen Prüfung beruhen.

Der Planungschat erstellt nur Anweisungen. Du implementierst den folgenden begrenzten Auftrag in JavaScript, prüfst ihn und lieferst einen Pull Request. Dieser Auftrag löst Auftrag 4 als aktuellen Arbeitsauftrag ab; dessen noch offene General- und Zukunftsanforderungen bleiben in docs/PROJECT.md erhalten.

Ziel: Lagergrenzen je Ressource verstehen → Produktionsgebäude ausbauen → Kapazitätszuwachs sehen → Lagerhaus bauen/ausbauen → Gebäude mit nachvollziehbarer Teilrückerstattung abreißen → Platz neu bebauen → nach Wiederbeitritt denselben korrekten Zustand erhalten.

## A. Vorläufige, zentrale Prototypregeln

Die folgenden Zahlen und Grenzfallregeln sind Vorschläge des Planungschats für einen reviewbaren Prototyp, keine einzeln bestätigten Nutzerentscheidungen oder Originalwerte. Implementiere sie zentral konfigurierbar und dokumentiere sie gesammelt im PR. Bestehende anderweitige Spielregeln bleiben erhalten.

- Behalte die bisherige Grundlagerkapazität je Ressource bei; laut README sind dies aktuell 2000. Überprüfe den tatsächlichen Ausgangswert.
- Jedes fertiggestellte Produktionsgebäude erhöht die Kapazität seiner Ressource um 250 je Stufe oberhalb Stufe 1: Beitrag = 250 × max(0, Gebäudestufe − 1). Dadurch bleiben die bisherigen Startlager mit Gebäuden auf Stufe 1 unverändert.
- Ein Lagerhaus erhöht jede aktuell aktive Ressourcenlagerkapazität um 500 × seine fertiggestellte Stufe. Beiträge mehrerer Lagerhäuser und Produktionsgebäude addieren sich.
- Gesamtkapazität je Ressource = Grundkapazität + passende Produktionsgebäudebeiträge + Lagerhausbeiträge. Ohne Gebäude bleibt die Grundkapazität bestehen.
- Beispiel bei Grundkapazität 2000: Sägewerk Stufe 3 bringt 500 zusätzliches Holzlager; Lagerhaus Stufe 2 bringt 1000 für jede Ressource. Holzkapazität: 2000 + 500 + 1000 = 3500. Ohne weitere passende Gebäude haben Stein und Nahrung jeweils 3000.
- Lagerhausbau und -ausbau nutzen für diesen Prototyp die vorhandene allgemeine Baukosten-/Bauzeitkurve und Stufenobergrenze. Falls der Code bereits unterschiedliche Kurven je Gebäudetyp besitzt, wähle explizit die bestehende Kurve eines zivilen Produktionsgebäudes als Testvorlage und dokumentiere die Auswahl.
- Abriss erfolgt nach ausdrücklicher Bestätigung sofort und vollständig, nicht stufenweise. Keine zusätzliche Abrissgebühr oder Abrisswarteschlange.
- Rückerstattung je Ressource = abgerundet 10 Prozent der nachweislich bezahlten Investitionen in Neubau und fertiggestellte Ausbaustufen. Beispiel: nachgewiesene 240 Holz und 180 Stein ergeben 24 Holz und 18 Stein. Kosten aktuell unfertiger Aufträge gehören nicht dazu.
- Nach Kapazitätsverlust bleiben vorhandene Vorräte erhalten. Auch Abrissrückerstattungen werden vollständig aufgenommen; dadurch darf vorläufig Überbestand entstehen. Diese Ausnahme betrifft in diesem Auftrag nur Erhalt vorhandener Vorräte und Abrissrückerstattungen, nicht automatisch spätere Beute oder Handel.
- Bei vollem Lager oder Überbestand pausiert nur die positive Produktion der betroffenen Ressource. Ausgaben bleiben möglich. Sobald wieder Platz besteht, wird Produktion ab diesem Zeitpunkt fortgesetzt. Keine nachträgliche Nachproduktion für die blockierte Zeit.

## B. Lagerkapazitäten und neues Lagerhaus

- Berechne Lagerkapazitäten je Ressource aus verbindlichen Gebäudeständen. Keine verstreuten festen Obergrenzen in Browser, Produktion, Speicherung oder Angeboten.
- Sägewerk wirkt auf Holz, Steinbruch auf Stein, Bauernhof auf Nahrung. Produktion und Lagerwirkung bleiben getrennt; ein Ausbau erhöht weiterhin die bestehende Produktion.
- Das Lagerhaus ist ein ausbaubares ziviles Gebäude ohne eigene Rohstoffproduktion. Es darf nur auf freien zivilen Plätzen entstehen; Militärplätze sind serverseitig gesperrt.
- Verwende vorhandene Bauangebote und die gemeinsame Bauwarteschlange. Ein fertiggestelltes Lagerhaus zählt nach der bestehenden Gebäudepunktregel.
- Ein geplanter oder laufender Bau erhöht noch keine Kapazität. Neubau und Ausbau wirken ab ihrem tatsächlichen Abschlusszeitpunkt.
- Zeige je Ressource Bestand, Kapazität und Produktionsrate. Erkläre Kapazitätsbeiträge in einer verständlichen Detailansicht.
- Zeige vor Bau/Ausbau die aktuelle und anschließende Lagerwirkung. Überbestand muss sichtbar sein, auch wenn der Lagerbalken optisch bereits voll ist.
- Erhalte das Erscheinungsbild der Stadt und ergänze eine erkennbare Lagerhausdarstellung.

## C. Nachvollziehbare Investitionen und Migration

- Führe je Gebäude eine dauerhafte Investitionsgrundlage nach Ressourcenart und Zahlungsherkunft. Bei Beauftragung wird der tatsächlich bezahlte Betrag am Auftrag festgehalten; bei Fertigstellung genau einmal dem Gebäude zugerechnet.
- Änderungen an Preistabellen dürfen frühere Investitionen nicht verändern. Ein Preisangebot allein belegt keine Zahlung.
- Kostenlose Startgebäude haben für ihre kostenlose Ausgangsstufe keine bezahlte Investition. Tatsächlich bezahlte spätere Upgrades zählen.
- Migriere Altgebäude und laufende Aufträge anhand vorhandener belastbarer Zahlungs-/Auftragsdaten, soweit solche Daten existieren.
- Vorläufige konservative Regel für fehlende Historie: unbekannte Altinvestitionen nicht aus heutigen Preisen erfinden. Markiere sie als unbekannt und berücksichtige nur nachweisbare Beträge. Das kann für ein Altgebäude zunächst eine Rückerstattung von null ergeben.
- Zeige diese Einschränkung vor Abriss ausdrücklich an: „Frühere Baukosten sind nicht vollständig dokumentiert; erstattet werden nur nachgewiesene Investitionen.“ Stelle null nicht als Beweis dar, dass das Gebäude kostenlos war.
- Dokumentiere Umfang und Folgen dieser Altbestandsregel im PR als offene Produktentscheidung. Kein behauptet vollständiger historischer Kostennachweis.
- Nach Abriss erhält ein Neubau auf demselben Platz eine neue Gebäudeidentität und eigene Investitionsgrundlage. Er darf keine Investitionen des Vorgängers erben.
- Sichere bestehende Daten und versioniere Migrationen. Wiederholte Migration darf weder Grundkapazität noch Investitionen, Gebäude oder Punkte vervielfachen. Unbekannte Speicherversionen nicht überschreiben.
- Bestehende Gebäude, Platz-IDs, Ressourcen, Generäle, Einsätze und bereits bezahlte Aufträge bleiben erhalten.

## D. Abriss mit Vorschau und sicheren Zustandsübergängen

- Biete Abriss für eigene fertiggestellte Gebäude im jeweiligen Baubereich an. Ein leerer Platz oder fremdes Gebäude ist kein gültiges Ziel.
- Ein Gebäude mit laufendem oder wartendem Bau-/Ausbauauftrag darf nicht abgerissen werden. Keine stillschweigende Stornierung.
- Eine Kaserne mit laufender oder wartender Ausbildung darf nicht abgerissen werden. Bereits fertige stationierte oder marschierende Truppen und Generäle bleiben beim Abriss einer sonst ungebundenen Kaserne bestehen. Falls der aktuelle Code weitere echte Abhängigkeiten enthält, verhindere deren Beschädigung und erkläre eine Sperre konkret.
- Zukünftige Gebäude mit Forschung oder anderen Belegungen benötigen eigene Abrissregeln; diese Mechaniken jetzt nicht implementieren.
- Zeige im Bestätigungsmodal Gebäudetyp/Stufe, vollständigen Verlust des Gebäudes, genaue Rückerstattung und deren Datengrundlage, Produktionsverlust, Kapazitäten danach, möglichen Überbestand und Punkteänderung.
- Abbrechen verändert nichts. Nach Bestätigung werden Gebäude entfernt, Platz freigegeben, Rückerstattung verbucht und Produktion, Kapazitäten sowie Gebäudepunkte neu berechnet.
- Der Server prüft Eigentum, stabile Gebäudeidentität, Platz, Abhängigkeiten und aktuellen Zustand erneut. Clientwerte für Rückerstattung oder Kapazitäten sind nicht verbindlich.
- Bindung der Bestätigung an Gebäudeversion bzw. relevanten Angebotsstand: Hat sich seit der Vorschau etwa Stufe, Investition oder Belegung geändert, lehne sie ohne Nebenwirkungen ab und liefere eine aktualisierte Vorschau.
- Abriss, Gutschrift, neue Kapazitäten, Punkte und Deduplizierungsnachweis müssen gemeinsam konsistent gespeichert sein, bevor Erfolg bestätigt wird.
- Gleiche Anfrage mehrfach führt zu derselben Antwort ohne weitere Gutschrift. Gleiche Anfrage-ID mit anderem Inhalt ablehnen. Parallele Verbindungen dürfen denselben Abriss nicht doppelt ausführen.
- Ein erneuter Befehl für ein abgerissenes Gebäude darf kein inzwischen auf demselben Platz neu gebautes Gebäude treffen.

## E. Zeit, Kommunikation und Vorbereitung späterer Systeme

- Alle dynamischen Spielbefehle und Änderungen laufen über das bestehende WebSocket-Protokoll. Kein HTTP-Spielpolling und keine clientseitig verbindliche Wirtschaftsberechnung.
- Erhalte JSON-Persistenz und den bestehenden einzelnen Schreibprozess pro Welt. Folge der vorhandenen Serialisierung und Besitzertrennung.
- Verrechne Produktion chronologisch über Kapazitäts-/Ratenwechsel hinweg. Vor einer Mutation zunächst den Zustand bis zum wirksamen Zeitpunkt abrechnen.
- Bei Offline-Bauabschlüssen gilt die neue Kapazität erst ab dem echten Abschlusszeitpunkt. Ein Neustart darf keine rückwirkende Produktion in zuvor volle Lager erlauben.
- Überbestand darf beim Laden, Tick oder Reconnect nicht stillschweigend auf die Grenze gekürzt werden.
- Halte Ressourcen und Gebäudewirkungen erweiterbar, damit später Öl und Forschung hinzukommen. Öl jetzt nicht aktivieren; die Ölraffinerie bleibt ein späteres ziviles Produktionsgebäude.
- Trenne intern Produktion, Bestandsänderungen und Kapazitäten so, dass später Nahrungsunterhalt korrekt ergänzt werden kann. Noch keine Unterhaltsabbuchungen, negativen Vorräte, Hungerfolgen oder Ölpflicht.
- Keine neue Generalrekrutierung, Skillbalance, Universität, Kampfaktion, NPC-Regeneration, LKWs oder Matrix-Verbindung in diesem Auftrag.

## F. Gezielte Prüfungen und Abnahme

Führe die bestehende Testsuite aus und ergänze aussagekräftige Regel-/Integrationstests:

1. Ressourcenspezifische Beiträge, mehrere Produktionsgebäude und Lagerhäuser; keine Wirkung unfertiger Aufträge.
2. Lagerhaus nur auf zivilen Plätzen, einschließlich direkt manipulierter WebSocket-Anfragen.
3. Offline-Produktion bei zunächst vollem Lager und späterem Bauabschluss; korrekte zeitliche Grenzen.
4. Überbestand nach Abriss bleibt bestehen; nur die betroffene Produktion pausiert und setzt nach Ausgaben korrekt wieder ein.
5. Rückerstattung aus kumulierten nachgewiesenen Kosten, Preisänderungen, kostenlose Startstufen und unbekannte Altkosten.
6. Idempotente Migration sowie laufende vor der Migration bezahlte Aufträge; keine erfundenen Kosten.
7. Abrisssperren für Bau und Ausbildung, veraltete Vorschau und unveränderte Armeen/Generäle.
8. Mehrfacher Abrissbefehl, widersprüchliche Anfrage-ID, zwei Verbindungen und Abriss/Neubau auf demselben Platz.
9. Speicherfehler und Neustart: keine doppelte Gutschrift oder teilweise bestätigte Änderung.
10. Kommandantenpunkte nach Ausbau/Abriss/Neubau ohne dauerhafte Zusatzpunkte.
11. Zwei Spieler: fremde Angebote, Investitionsdaten und Gebäude bleiben geschützt.
12. Regression für Anmeldung, Stadt/Militär, Ausbildung, Weltkarte und bestehende Aufklärung.

Browser-Abnahme auf Desktop und Mobilansicht: Lagerhaus bauen/ausbauen, Kapazitäten prüfen, Abrissvorschau öffnen/abbrechen/bestätigen, Überbestand sehen, neu bauen, reconnecten. Screenshots von Lageranzeige, Lagerhaus und Abrissmodal liefern. Nicht mögliche Prüfungen ausdrücklich benennen.

## Ergebnis und nächste Etappen

- Liefere nachvollziehbare Commits und einen Pull Request. Nicht eigenständig mergen oder deployen.
- Aktualisiere README, docs/PROJECT.md und erforderliche Protokoll-/Speicherdokumentation anhand des tatsächlich implementierten Stands. Entferne widersprüchliche Aussagen über feste Lagergrenzen.
- Berichte auf Deutsch: geändertes Verhalten, Tests, Migrationseinschränkungen und sämtliche vorläufigen Regeln. Insbesondere 250/500 Kapazitätsbeiträge, 10 Prozent Rückerstattung, sofortiger Abriss, Überbestand und unbekannte Altinvestitionen im PR sichtbar zur Prüfung aufführen.
- Danach: Generalverwaltung/Skillregeln vervollständigen, verbleibende Ausbildungs-/Aufklärungslücken schließen, NPC-Farmzüge mit typabhängiger Traglast und anschließend bzw. gleichzeitig abgestimmtem Nahrungsunterhalt.
- Später Universität/Forschung, Bürgermeister und Forschungsgeneral, LKWs/Ölwirtschaft, weitere Einheiten, Bündnisse/Handel/PvP und Föderation. Die bestätigten Zukunftsanforderungen in docs/PROJECT.md bleiben erhalten.
