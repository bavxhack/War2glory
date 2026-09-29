# Codex-Auftrag 9: Nahrungsunterhalt, Hungerverluste und Bürgermeister

## Ausgangspunkt und Auftrag

Der Nutzer meldet einen erfolgreichen ersten Farmzug und bestätigt am 29.09.2026 zwei neue Regeln: Nach einer Schonfrist gehen unversorgte Truppen verloren; Generäle können als Bürgermeister eingesetzt werden und erhöhen anhand ihrer Eigenschaft Führung die Nahrungsproduktion.

README und Protokolldokumentation beschreiben Farmzüge, NPC-Regeneration und das wiederaufnehmbare JSON-Transaktionsjournal als implementiert. Dies ist keine zusätzliche Laufzeitprüfung durch den Planungschat. Prüfe den Code und bewahre vorhandene Funktionen und fremde Änderungen.

Arbeite im Repository bavxhack/War2glory vom aktuellen main aus. Lies AGENTS.md, README.md, docs/PROJECT.md, docs/WEBSOCKET.md und docs/DEVELOPMENT.md. Prüfe offene PRs. Dieser Auftrag ersetzt Auftrag 8 als aktuellen Arbeitsauftrag. Der Planungschat erstellt nur Anweisungen; du implementierst, testest und lieferst einen Pull Request ohne eigenständiges Mergen oder Deployment.

Ziel: Nahrungsertrag und Unterhalt sehen → General als Bürgermeister ernennen → Führungsbonus wirkt → bei Defizit Vorräte aufbrauchen → Schonfrist und Ausbildungsunterbrechung anzeigen → nach anhaltendem Hunger Einheiten verlieren → durch Produktion oder zurückgekehrte Beute Versorgung wiederherstellen.

## 1. Bestätigte Anforderungen und Grenzen

Bestätigt sind unterschiedlicher laufender Nahrungsbedarf je Truppentyp, Defizitversorgung durch Plünderungen, tatsächliche Truppenverluste nach Schonfrist und ein führungsabhängiger Nahrungsbonus des Bürgermeisters.

Die folgenden konkreten Zahlen und Detailregeln sind vorläufige Vorschläge des Planungschats für einen reviewbaren Prototyp. Zentral konfigurieren, versionieren und im PR sichtbar ausweisen. Nicht als endgültige Nutzerentscheidungen oder War2Glory-Originalregeln darstellen.

- React/Vite, zentrale WebSocket-Kommunikation, serverseitige Regeln und JSON-Journal erhalten.
- Laut aktuellem Repository besteht KEIN Führungslimit für Aufklärung/Farmzüge; es gilt eine Obergrenze von insgesamt 10.000 Einheiten je Einsatz. Nicht versehentlich das frühere Limit 20 × Level wieder einführen.
- Bürgermeisterbonus ist eine gezielt neue Wirkung von Führung. XP-Umrechnung, Skillverteilung, militärische Skillboni und Forschungsgeneral bleiben deaktiviert bzw. später.
- Keine neue Rekrutierung, Gratisgeneräle, Universität, Ölpflicht, LKWs, PvP oder zusätzliche Marsch-Reichweitenregel. Nahrungsunterhalt ist keine automatische Bestätigung der separat erwähnten Reichweitenbegrenzung.
- Bestehende Kampf- und Aufklärungsregeln nur dort erweitern, wo Hungerverluste sie ausdrücklich betreffen.

## 2. Laufender Nahrungsbedarf und Wirtschaftsrechnung

Vorläufige Verbrauchswerte:
- Infanterie: 0,10 Nahrung je Einheit und Sekunde.
- Späher/Aufklärungsflugzeuge: 0,05 Nahrung je Einheit und Sekunde.
- Generäle selbst haben in diesem Prototyp keinen zusätzlichen Nahrungsunterhalt.
- Noch nicht fertig ausgebildete Einheiten zählen nicht; sie werden ab dem tatsächlichen Abschluss versorgt.
- Alle lebenden eigenen Einheiten werden genau einmal von ihrer Heimatstadt versorgt, sowohl stationierte als auch solche auf Hin-/Rückmarsch. Reservierung und Marsch erzeugen weder Doppelverbrauch noch eine Ausnahme.
- Tatsächliche Kampf-/Hungerverluste reduzieren den Verbrauch ab ihrem Ereigniszeitpunkt. Auf Rückkehr keine zweite Kopie bereits gebundener Einheiten hinzuzählen.

Rechnung:
- U = Summe aus lebender Einheitenanzahl je Typ × dessen Verbrauchsrate.
- P = Nahrungsproduktion der fertigen Gebäude einschließlich des aktiven Bürgermeisterbonus.
- Netto = P − U. Verbrauch nicht zusätzlich noch einmal abbuchen.
- Beispiel: 2 Nahrung/Sekunde Gebäudeertrag, 10 Prozent Bürgermeisterbonus und 30 Infanteristen ergeben P = 2,2; U = 3; Netto = −0,8 Nahrung/Sekunde. 480 Vorrat reichen bei unveränderten Raten 480 / 0,8 = 600 Sekunden, also 10 Minuten.
- Nutze präzise zeitbasierte Verrechnung mit erhaltenen Resten; Frontend-Rundung verändert keine Bestände.
- Obergrenze/Überbestand korrekt behandeln: Bei S = Kapazität gilt für eine positive Nettobilanz keine weitere Einlagerung; eine negative Nettobilanz senkt den Bestand. Verfügbare Produktion darf am vollen Lager gleichzeitig laufenden Verbrauch decken.
- Bei bestehendem Überbestand aus Abriss gilt dieselbe Nettorechnung: vorhandene Vorräte nicht pauschal kürzen; positiven Nettozuwachs blockieren, negative Bilanz abbuchen. Dies präzisiert die frühere Produktionspause um den jetzt aktiven direkten Verbrauch.
- Kein negativer Nahrungsbestand und keine Nahrungsschuld. Sobald Nahrung auf null sinkt, nur den tatsächlich ungedeckten Zustand als Mangel behandeln.
- Mangelbedingung: Vorrat S = 0 UND U > P. Ein leeres Lager bei U <= P löst keine Hungerstrafe aus.
- Bauernhofausbau/Abriss, Bürgermeisterwechsel, Ausbildung, Verluste, Ausgaben und zurückkehrende Nahrung sind zeitliche Grenzen der Rechnung. Keine rückwirkende Anwendung neuer Raten.
- Missionen verbrauchen unterwegs keine geladenen Beutevorräte direkt. Beute wird weiterhin erst bei Rückkehr in der Heimat verfügbar; ein anderes Feldversorgungssystem bleibt später.

## 3. Schonfrist, Erholung und Truppenverluste

Vorläufige Regeln:
- 30 Minuten tatsächlich unversorgte Zeit als Schonfrist je Stadt.
- Erster Verlust am Ende dieser 30 Minuten, sofern dann Mangel besteht. Danach alle weiteren 5 Minuten unversorgter Zeit eine Verlustwelle.
- Bei zwischenzeitlicher Versorgung pausiert die Mangeldauer. Nach 60 Sekunden ununterbrochener Versorgung wird der Mangelzyklus beendet; ein späterer neuer Mangel beginnt mit voller Schonfrist.
- Eine kleine Nahrungsgutschrift setzt nicht sofort die gesamte Schonfrist zurück. Bis zur vollständigen Erholung bleiben akkumulierte Mangelzeit und nächster Verlusttermin erhalten.
- Versorgung liegt vor, solange S > 0 oder U <= P. Die 60-Sekunden-Erholungsphase beginnt beim tatsächlichen Ende des Mangels, nicht beim nächsten Login.
- Ohne eigene versorgungspflichtige Einheiten Mangelzustand beenden. Keine leeren Verlustereignisse erzeugen.

Verlustwelle:
- N = alle zum Verlustzeitpunkt lebenden eigenen versorgungspflichtigen Einheiten, einschließlich marschierender Einheiten.
- Verlustzahl L = min(N, max(1, ceil(0,05 × N))) bei N > 0 und bestehendem Mangel.
- Beispiel: 100 Einheiten verlieren 5; bei unverändert fortdauerndem Hunger verliert die nächste Welle bei 95 Einheiten wieder ceil(4,75) = 5.
- Verteile L proportional auf Bestände je Einheitentyp und Aufenthaltsgruppe (stationiert oder konkrete Mission): zunächst Abrunden der proportionalen Anteile, verbleibende Verluste nach größten Resten; Gleichstände stabil nach Typ-/Gruppen-ID auflösen.
- Dadurch bleibt die Gesamtverlustzahl bei Aufteilen einer Armee gleich. Nicht je kleine Gruppe separat aufrunden.
- Keine Zufallsverluste und keine bevorzugte Bestrafung nur stationierter Truppen. Entsenden darf keine Hungerimmunität geben.
- Nach Verlusten U sofort neu berechnen. Wenn die reduzierte Armee wieder versorgt werden kann, dürfen keine weiteren vorgeplanten Wellen blind ausgeführt werden.
- Generäle sterben in diesem Auftrag nicht an Hunger. Hungerverluste vergeben niemandem Kampf-XP oder Kampf-/Niederlagenpunkte; die bisherigen Kampfregeln bleiben davon getrennt.
- Speichere private, nachvollziehbare Versorgungsereignisse mit Zeitpunkt und Verlusten, begrenze und paginiere die Anzeige sinnvoll. Keine stillen Truppenänderungen.

Ausbildung:
- Während Mangel alle laufenden Ausbildungsgruppen pausieren und neue Ausbildungsbefehle ablehnen. Restdauer, Reihenfolge und bezahlte Kosten erhalten; keine zweite Zahlung beim Fortsetzen.
- Bereits fällige Abschlüsse vor Mangelausbruch zuerst verarbeiten. Bei gleichem Zeitpunkt verbindlich festlegen und testen: wenn Nahrung bis dahin vorhanden war, Abschluss verarbeiten und den neuen Verbrauch anschließend berücksichtigen.
- Sobald Versorgung wieder besteht, pausierte Ausbildung ohne erneute Bezahlung fortsetzen. Dafür nicht erst das Ende der 60-Sekunden-Erholungsphase abwarten.
- Bau, Nahrungsproduktion und Farmzüge bleiben möglich; bestehende Ressourcen- und Besitzprüfungen gelten weiterhin.

## 4. Auswirkungen auf laufende Missionen

- Vor einem Kampf zählen nur die nach eventuellen Hungerwellen noch lebenden entsandten Einheiten. Ausgangstruppen, Hungerverluste und eigentliche Kampfverluste getrennt protokollieren.
- Ist bei einer Farmankunft keine Infanterie mehr vorhanden, findet kein Kampf und keine Plünderung statt. General tritt den regulären Rückweg an; keine XP/Kampfpunkte erfinden.
- Ist bei einer Aufklärungsankunft kein Späher mehr vorhanden, entsteht kein neuer Aufklärungssnapshot und keine Erstzielbelohnung. General kehrt zurück. Eine bereits erfolgreich erfolgte Aufklärung kann der General trotz späterer Späherverluste als historischen Bericht zurückbringen.
- Bei Hunger auf dem Rückweg die verbleibende Traglast neu berechnen. Übersteigt Ladung diese Kapazität, überschüssige Nahrung als unterwegs verloren kennzeichnen und genau einmal aus der Mission entfernen. Nicht zum NPC zurückbuchen.
- Sind alle Rückkehrtruppen verloren, bleibt General bis zur vorgesehenen Rückkehr gebunden; keine Teleportation und keine Wiederherstellung aus der ursprünglichen Reservierung.
- Endberichte getrennt zeigen: Kampfverluste, Hungerverluste, ursprünglich geladene Beute, unterwegs verlorene Ladung, eingelagerte Menge und Heimatlager-Überlauf.
- Bereits erzielte Kampfergebnisse und deren Belohnungen nicht rückwirkend verändern. Hunger erzeugt keine zusätzlichen Kampfverluste in der Punkteformel.
- Eigene Versorgungswarnungen und Hungerereignisse dürfen sofort sichtbar sein. Öffentliche NPC-Daten und noch nicht freigegebene Feindberichte bleiben geschützt. Tatsächliche eigene Verbrauchsänderungen können Rückschlüsse auf Verluste erlauben; keine vollständige Geheimhaltung behaupten, wenn diese Bilanz solche Rückschlüsse zulässt.

## 5. General als Bürgermeister und Führungsbonus

- Pro Stadt ein Bürgermeister, optional unbesetzt. Ernennung aus eigenen freien Generälen; keine zusätzlichen Generäle erzeugen.
- Generalrolle und militärischer Einsatz sind gegenseitig exklusiv. Ein Bürgermeister kann keine Aufklärung/Farmmission führen. Ein unterwegs gebundener General kann nicht Bürgermeister werden.
- Ernennen, Abberufen und Wechseln sind serverseitig geprüfte, persistente Aktionen. Wechsel zwischen zwei freien eigenen Generälen erfolgt atomar; kein Zwischenzustand mit doppeltem Bonus.
- Abberufung ohne zusätzliche Kosten oder Wartezeit als Prototypregel. Der Nutzer kann seinen einzigen Startgeneral somit abberufen und wieder auf Farmzug schicken.
- Vor einem Rollenwechsel den Zustand bis zum Änderungszeitpunkt mit dem bisherigen Bonus abrechnen. Der neue Bonus gilt erst ab diesem Zeitpunkt und auch während Abwesenheit.
- Keine Bürgermeister-XP über verstrichene Zeit und keine kostenlose Skillvergabe erfinden.

Vorläufige Bonusformel:
- F = bestehender serverseitiger Eigenschaftswert „Führung“ des Generals. Prüfe im tatsächlichen Datenmodell, welches Feld diese Eigenschaft abbildet, und dokumentiere die Zuordnung.
- Verwende nicht versehentlich den früheren, derzeit deaktivierten Grenzwert für befehligte Truppenzahl als Eigenschaft. Bestehende Grundwerte und gespeicherte Eigenschaften nicht ungefragt neu skalieren.
- Bonusanteil b = min(0,50; max(0, F) × 0,01), also ein Prozent je Führungspunkt, vorläufig höchstens 50 Prozent.
- P = fertiger landwirtschaftlicher Grundproduktionsertrag × (1 + b).
- Rechenbeispiel, keine Behauptung über Startwerte: F = 10 ergibt +10 Prozent. Bei 2 Nahrung/Sekunde Grundproduktion ergibt das 2,2 Nahrung/Sekunde.
- Ohne Bürgermeister b = 0. Führung 0 ergibt keinen Bonus; dies darf nicht als mehr Produktion dargestellt werden. Kein pauschaler Sockelbonus ohne Dokumentation.
- Bonus erhöht nur laufende Nahrungsproduktion, nicht Lagerkapazität, aktuelle Vorräte, Beute, NPC-Regeneration oder andere Rohstoffe.
- Wiederholte Zustandsberechnung darf den Bonus nicht immer erneut multiplizieren. Grundproduktion und Bürgermeisterbeitrag getrennt ableiten.
- Änderung eines künftig aktivierten Führungswertes muss später eine neue Produktionsphase beginnen. Jetzt keine XP-Umrechnung oder allgemeinen Skillboni aktivieren.
- Bürgermeister als konkrete Ausnahme zu bisherigen Aussagen „alle Generalboni inaktiv“ dokumentieren. Angriff/Verteidigung und Forschungsgeneral bleiben unverändert.

## 6. Oberfläche und Warnungen

- React: Nahrungsanzeige mit Grundproduktion, Bürgermeisterbonus, Bruttoertrag, Unterhalt und Nettobilanz. Einheit (z.B. pro Stunde) einheitlich anzeigen; intern vereinbarte Sekundenraten korrekt umrechnen.
- Zeige bei negativer Bilanz die voraussichtliche Zeit bis Lagerleerstand bei unveränderten Raten. Bei U <= P keine unsinnige negative/ungeendliche Restzeit.
- Mangelstatus sichtbar: Schonfrist, bereits verstrichene Mangelzeit, nächste Verlustwelle und gegebenenfalls Erholungsphase.
- Ausbildung mit Begründung „wegen Nahrungsmangel pausiert“ und erhaltener Restdauer anzeigen.
- Bürgermeister in Stadtübersicht und Generalmodal anzeigen; Führung und tatsächliche Mehrproduktion offenlegen. Ernennung/Wechsel/Abberufung mit Auswirkung auf die aktuelle Bilanz vorschauen.
- Bei einem aktiven Bürgermeister im Missionsdialog auf erforderliche Abberufung hinweisen; nicht heimlich beim Absenden abberufen.
- Hungerwarnungen dürfen nach erneutem Login erscheinen, aber keine doppelte Verlustbuchung auslösen. Ernste Folgen bei bestätigter riskanter Aktion verständlich anzeigen; keine erfundene garantierte Beute als sichere Versorgung vorhersagen.
- Mobile und Tastaturbedienung, Fokusführung, Abbrechen und serverseitige Fehlermeldungen erhalten.

## 7. Zeitverarbeitung, Aktivierung und Persistenz

- Erweitere den bestehenden weltweiten chronologischen Ereignisablauf und das Transaktionsjournal. Kein zweiter unabhängiger Timer, der zufällig vor oder nach Kämpfen abbucht.
- Berechne Leerstand, Ende der Schonfrist, Verlustwellen, Versorgungsbeginn/-erholung und Änderungen von Ausbildungszeiten anhand ihrer tatsächlichen Zeitpunkte.
- Gleiche Zeitpunkte deterministisch behandeln: Wirtschaftsabrechnung bis T, bestehende Spielereignisse bei T gemäß stabiler Ereignisreihenfolge, dann fällige Hungerwelle nach erneuter Mangelprüfung. Rechtzeitig bei T zurückgekehrte Nahrung kann eine Hungerwelle verhindern.
- Vermeide implizite Änderungen der bestehenden Kampf-Reihenfolge zwischen verschiedenen Spielern. Dokumentiere die Ergänzung der Hungerereignisse und prüfe Aufklärung/Kampf/Rückkehr am selben Zeitpunkt.
- Nach langem Offlinebetrieb müssen alle relevanten Phasen nachgeholt werden. Eine später eintreffende Beute darf frühere Hungerwellen nicht rückwirkend aufheben.
- Die Versorgung einer Mission, ihr Truppenbestand und ihre Ladung müssen zusammenhängend gespeichert werden. Vor jeder Erfolgsantwort muss Wiederherstellung nach Absturz gewährleistet sein.
- requestId-Deduplizierung, Besitzerprüfungen und General-/Stadtversionen verwenden. Gleichzeitiges Ernennen/Entsenden oder mehrfaches Wiederholen darf weder Doppelrolle noch doppelte Gutschrift/Verluste erzeugen.
- Migration versioniert und idempotent. Bestehende Bürgermeisterzuordnung erhalten, falls bereits vorhanden, andernfalls unbesetzt. Keine automatische Ernennung ohne Nutzeraktion.
- Weltweit einen dauerhaften Einführungszeitpunkt des Unterhaltssystems festhalten. Vor diesem Zeitpunkt bestehende Vorgänge nach alten Regeln abschließen; ab ihm tatsächlichen Unterhalt verrechnen, auch für schon unterwegs befindliche lebende Truppen.
- Keine rückwirkende Nahrungsschuld oder Verluste für Zeit vor Aktivierung. Nach Aktivierung gelten Offline-Verbrauch und Schonfrist normal, auch ohne Login.
- Reconnect/Neustart darf Einführung, Mangelzeit, nächste Verlustwelle oder Erholung nicht zurücksetzen.
- Kapazitätsgrenzen/Überbestand und Präzision so behandeln, dass viele kleine Abrechnungsschritte dasselbe Ergebnis liefern wie ein großer mit denselben Ereignissen.

## 8. Tests und Lieferung

Führe bestehende Tests, Frontend-Build und gezielte neue Prüfungen aus:

1. Verbrauch mehrerer Typen, Produktion mit Bürgermeister, positive/null/negative Bilanz und korrekt umgerechnete Zeiteinheiten.
2. Volle Lager, Überbestand, gleichzeitiger Verbrauch/Produktion, exakter Leerstand und keine negative Nahrung.
3. Schonfrist, Verlustwellen, proportionale Verteilung, kleinste Armeen und keine Mehrverluste durch Aufteilen.
4. Kurze Zwischenversorgung pausiert den Hungerzähler; stabile Versorgung setzt ihn erst nach Erholungsdauer zurück.
5. Ausbildung pausiert/fortgesetzt mit korrekter Restdauer, Kosten und Abschlussreihenfolge.
6. Einheiten stationiert/unterwegs genau einmal zählen; Kampfverluste und Rückkehr ändern Verbrauch korrekt.
7. Hunger vor Kampf/Aufklärung, vollständig verlorene Armee, Generalrückkehr, Ladungsverlust und richtige Berichte/Belohnungen.
8. Bürgermeisterwechsel, unzulässige fremde/gebundene Generäle, parallele Mission/Ernennung und kein mehrfach aufaddierter Bonus.
9. Bürgermeisterbonus wirkt auf Nahrungsertrag, nicht Beute/Lager/andere Ressourcen; Skillaktionen bleiben deaktiviert.
10. Gleichzeitige Beuterückkehr und Hungerwelle, Offline-Verarbeitung, Bürgermeisterwechsel nach langer Abwesenheit.
11. Fehler zwischen Journal und Dateien, Neustart, verlorene Bestätigung und Wiederholung ohne doppelte Verluste/Bonuswirkung.
12. Migration ohne rückwirkende Kosten, dauerhaftem Einführungszeitpunkt und unveränderten bisherigen Spielständen.
13. Regression bestehender Farm-, Aufklärungs-, Lager-/Abriss-, Punkte- und Generalfunktionen.

- Simuliere lange Zeiträume in Tests mit kontrollierter Uhr statt realer Wartezeit. Auch die ungünstige Kombination einer großen Armee ohne Versorgung prüfen; Offline-Nachberechnung darf den Server nicht unbegrenzt blockieren.
- Browserprüfung mit zwei Konten, Desktop/Mobilansicht: Bürgermeister ernennen/abberufen, Bilanz prüfen, Warnung, pausierte Ausbildung, Verluste und Versorgung durch Rückkehr. Verwende isolierte Testwelten.
- Liefere nachvollziehbare Commits und einen vollständigen Pull Request. Kein eigenständiges Merge/Deployment.
- Aktualisiere README, docs/PROJECT.md und Protokoll-/Speicherdokumentation; markiere implementierte Funktionen und vorläufige Regeln getrennt.
- Im PR insbesondere 30 Minuten Schonfrist, 5-Minuten-Verlustabstand, 5-Prozent-Verluste, 60 Sekunden Erholung, Verbrauchswerte, Führungspunkt-Bonus und Obergrenze zur Prüfung nennen. Bestätigte Nutzeranforderungen nicht mit diesen Vorschlägen gleichsetzen.
- Nicht ausgeführte Prüfungen und verbleibende Einschränkungen auf Deutsch benennen. Danach Skillregeln bzw. Forschung gemäß Projektplan ausarbeiten, nicht automatisch starten.
