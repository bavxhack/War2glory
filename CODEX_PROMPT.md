# Codex-Auftrag 11: Unterhalt prüfen, Serverkonfiguration per .env und erste Forschung

## Auftrag und Ausgangspunkt

Der Nutzer bestätigt Auftrag 10 am 08.10.2026 als weitgehend fertig und beauftragt die nächste Etappe. Zusätzlich sollen Einstellungen wie Weltkartengröße und Truppenunterhalt über Umgebungsvariablen konfigurierbar werden. Er vermutet zu hohen oder falsch berechneten Unterhalt.

Der Planungschat erstellt nur Anweisungen. Du implementierst diesen Auftrag, prüfst ihn und lieferst einen Pull Request ohne selbstständiges Merge/Deployment. Arbeite vom aktuellen main in bavxhack/War2glory, lies AGENTS.md, README.md, docs/PROJECT.md, docs/WEBSOCKET.md und docs/DEVELOPMENT.md. Bewahre fremde Änderungen und prüfe offene PRs.

Reihenfolge innerhalb dieses Auftrags:
1. Unterhalt anhand reproduzierbarer Fälle prüfen und bestätigte Fehler korrigieren.
2. Validierte serverseitige Umgebungskonfiguration einschließlich sicherer zeitlicher Regelwechsel einführen.
3. Universität, erste Wirtschafts-/Lagerforschungen und Forschungspunkte darauf aufbauen.

Ziel ist ein vollständiger gemeinsamer PR mit nachvollziehbaren Teilcommits. Forschung darf keinen Unterhaltsfehler verdecken. Bereits vorhandene React-Oberfläche, Bilder, Skills, Bürgermeister, Farmzüge und JSON-Journal erhalten. Keine Balanceänderung als Fehlerkorrektur ausgeben.

„Feldgröße“ wird in diesem Auftrag als Zahl der Felder der Weltkarte verstanden: Breite × Höhe. Quadratische Einzelzellen bleiben erhalten; CSS-Zellgröße, Bauplatzanzahl und Marschdistanz pro Feld werden nicht damit vermischt.

## A. Vorprüfung und konkrete Hinweise aus der Codelektüre

Der Planungschat hat am 08.10.2026 den Quellcode gelesen, aber keine Anwendungstests ausgeführt. Verifiziere die folgenden Hinweise gegen deinen Arbeitsstand und dokumentiere bestätigte Ursachen, Korrekturen und ausgeschlossene Vermutungen.

Gelesene Stellen:
- packages/game-core/supply.js: SUPPLY_RULES, livingUnitGroups, supplySummary, advanceSupply, lossIsDue.
- packages/game-core/index.js: produce, advanceCity, productionRates.
- apps/server/storage.js: advanceWorld und Abschlussverarbeitung.
- apps/server/server.js: Zeitfortschreibung vor Befehlen, Snapshots und periodischer Verarbeitung.
- apps/client/src/SidebarStatus.jsx: Umrechnung pro Stunde und Unterhaltsaufschlüsselung.
- test/supply.test.js: vorhandene Tests.

Feststellungen:
- Aktuelle Raten stehen fest im Code: Infanterie 0,1 Nahrung/Sekunde, Späher 0,05.
- Das entspricht 360 bzw. 180 je Einheit/Stunde. 100 Infanteristen benötigen 36.000 Nahrung/Stunde.
- Ein Bauernhof Stufe 1 erzeugt ohne Boni 1 Nahrung/Sekunde = 3.600/Stunde und versorgt damit zehn Infanteristen. Das ist zunächst eine Balanceeigenschaft, kein nachgewiesener Rechenfehler.
- Die Sidebar multipliziert Sekundenraten mit 3600. Zeige dieselben Einheiten für Ertrag und Verbrauch; Ausbildungs-Einmalkosten nicht mit laufendem Unterhalt verwechseln.
- Im gelesenen advanceSupply wird vor Ablauf der Schonfrist der bereits verstrichene Mangel über den Fünf-Minuten-Modulo verrechnet. Beispiel bei 10 Minuten bestehendem Mangel: die Formel liefert weitere 30 statt 20 Minuten bis zum Ende einer 30-Minuten-Schonfrist. Das ist ein konkreter Verdacht auf schrittweitenabhängige Verlusttermine, nicht der Nachweis einer zu hohen Verbrauchsrate.
- Reproduziere genau diesen Fall: durchgehend leerer Vorrat, keine Produktion, ausreichend Einheiten; Vergleich einer Abrechnung 0 → 31 Minuten mit Schritten 0 → 10 → 31 Minuten. Die erste Verlustwelle muss in beiden Fällen bei Minute 30 liegen. Prüfe zusätzlich 0 → 10 → 35 sowie den exakten Grenzfall 0 → 10 → 30; nur ein Test exakt auf der Grenze kann den Fehler verdecken. Die erste Schonfrist benötigt Rest = Schonfrist minus akkumulierte Mangelzeit; periodische Wellen erst danach.
- Prüfe zusätzlich die exakte Modulo-/Gleichheitslogik bei gebrochenem Leerstandszeitpunkt. Keine künstlichen cursor-Epsilons verwenden, die ökonomische Zeit überspringen oder doppelte Verluste verdecken.
- livingUnitGroups filtert aktuell über den Wahrheitswert einer Verbrauchsrate. Bei künftig erlaubtem Verbrauch 0 müssen sichtbarer Truppenbestand, Unterhaltsrechnung und hungerrelevante Gruppen bewusst getrennt werden.
- advanceSupply, advanceWorld und der ältere advanceMilitary besitzen überlappende Abschlusswege. Mehrere Aufrufe sind allein kein Beweis doppelter Buchung: prüfe Zeitmarken und tatsächlich angewandte Ereignisse. Beseitige echte konkurrierende Abschlusswege, insbesondere für pausierte Ausbildung und Aufklärung.

Unabhängige Abnahmerechnungen:
- 10 Infanteristen, keine Produktion/Boni, 1000 Nahrung, 60 Sekunden: Verbrauch 60, Rest 940.
- 10 Infanteristen, Bauernhof Stufe 1, keine Boni: Nettobilanz 0.
- 30 Infanteristen, Grundproduktion 2/Sekunde, Bürgermeisterbonus 10 Prozent: Verbrauch 3, Ertrag 2,2, Netto −0,8; nach 60 Sekunden 48 weniger Nahrung.
- 18 lebende Infanteristen und 7 lebende Späher: 18 × 0,1 + 7 × 0,05 = 2,15/Sekunde = 7740/Stunde. Stationär/unterwegs aufteilen, ohne die Summe zu verändern.

Prüfe einzelne große gegen viele kleine Abrechnungen, mehrere Browserverbindungen, Login/Logout, Neustart, Truppenausbildung, Kampf-/Hungerverluste, Rückkehr, volle Lager, Überbestand und Bürgermeister-/Skilländerung. Bei unveränderten Ereignissen dürfen Abrufhäufigkeit und Verbindungszahl keinen Einfluss haben.

Erstelle im Implementierungs-PR docs/UPKEEP_AUDIT.md mit Ausgangswerten, Rechenfällen, reproduzierten Fehlern, Testbelegen und getrenntem Balancefazit. Keine pauschale Bestätigung „alles korrekt“ aus einzelnen Tests und keine erfundenen historischen Schadensersatzbuchungen.

## B. Zentrale serverseitige Umgebungskonfiguration

Führe einen einzigen validierten Konfigurationseinstieg ein. process.env und .env werden beim Serverstart gelesen; reine Spielkernfunktionen erhalten Konfiguration explizit. Keine verstreuten Zugriffe oder global veränderlichen Testkonfigurationen, die zwischen Welten überlaufen.

Mindestens folgende Variablen bereitstellen; vorhandene Namen bevorzugen, falls gleichwertige schon existieren:

| Variable | Einheit / Bedeutung | Kompatibler Standard |
| --- | --- | --- |
| WORLD_WIDTH | Weltkartenbreite in Feldern | 24 |
| WORLD_HEIGHT | Weltkartenhöhe in Feldern | 24 |
| WORLD_NPC_COUNT | NPC-Anzahl bei Weltanlage | 18 |
| UPKEEP_INFANTRY_PER_HOUR | Nahrung je Infanterist/Stunde | 360 |
| UPKEEP_SCOUT_PER_HOUR | Nahrung je Späher/Stunde | 180 |
| SUPPLY_GRACE_SECONDS | Schonfrist | 1800 |
| SUPPLY_LOSS_INTERVAL_SECONDS | Abstand der Hungerwellen | 300 |
| SUPPLY_LOSS_PERCENT | Verlustanteil in Prozent | 5 |
| SUPPLY_RECOVERY_SECONDS | stabile Versorgung bis Erholung | 60 |

- Bestehende Laufzeitwerte ohne explizite Einstellung erhalten. Nicht allein wegen einer Vermutung die Standardkosten still senken.
- Dokumentiere daneben ein optionales milderes Beispiel: 36 Nahrung/Stunde je Infanterist und 18 je Späher, also ein Zehntel der aktuellen Raten. Dieses Beispiel ist ein Balancevorschlag, keine Fehlerkorrektur und kein heimlich angewandter Standard.
- Intern einmalig auf die vereinbarte Zeitbasis umrechnen. Beispielsweise 36/Stunde = 0,01/Sekunde. Keine zweite Multiplikation/Division in Verbrauch oder Frontend.
- Nicht negative endliche Dezimalwerte für Unterhalt; 0 ist eine gültige bewusste Einstellung. Fehlende Variable nutzt Standard, explizites 0 niemals durch || mit Standard ersetzen.
- Fristen/Intervalle als positive endliche Werte mit dokumentierten Grenzen; Verlustprozentsatz größer 0 und höchstens 100. Ganzzahlige Kartendimensionen/NPC-Zahl mit sinnvollen, explizit dokumentierten Obergrenzen passend zur vorhandenen Speicher-/Kartentechnik.
- Ungültige Angaben, NaN, Infinity, negative Werte, leere explizite Werte und ungeeignete Dezimal-/Einheitenformate mit konkreter Fehlermeldung vor Spielstandänderung ablehnen.
- Keine Obergrenze für massiv größere Welten behaupten, ohne Erzeugung, Koordinatenprüfung, Speicher und Navigation dafür geprüft zu haben.
- .env.example mit Einheiten, Standards, milderem Beispiel und Kennzeichnung „nur neue Welt“ bzw. „ab Neustart“ liefern. Tatsächliche .env-Dateien ignorieren und nicht committen.
- Native Node-Starts und npm-Skripte müssen .env nach dokumentierter Methode laden. Bereits gesetzte Prozessvariablen haben Vorrang vor .env; explizite bestehende CLI-Parameter haben Vorrang für ihre jeweiligen Optionen. Fehlende optionale .env-Datei ist kein Startfehler.
- Docker Compose muss die vorgesehenen Spielvariablen wirklich an den Containerprozess übergeben. Eine Datei, die nur Compose-Portplatzhalter ersetzt, genügt nicht. Native und Containerstarts auf dieselben effektiven Werte testen.
- Keine VITE_-Variablen für verbindliche Spielregeln und kein Client-Rebuild zum Ändern von Unterhalt. Server liefert nur freigegebene wirksame Regeln/Versionskennung an den Client, niemals die gesamte Umgebung oder Geheimnisse.
- Konfiguration/Version/Einheit im Betreiberprotokoll und die nötige Unterhaltsaufschlüsselung im Spiel nachvollziehbar anzeigen.

## C. Bestehende Welten und zeitlich korrekte Konfigurationsänderung

Kartengröße:
- WORLD_WIDTH/HEIGHT/NPC_COUNT dienen zunächst der Erzeugung NEUER Welten. Bei bestehender Welt bleiben gespeicherte Dimensionen, Seed, NPC-IDs und Stadtpositionen verbindlich.
- Abweichende Erzeugungsvariablen bei vorhandener Welt deutlich protokollieren: nicht angewandt, gespeicherte Karte bleibt. Keine stille Neugenerierung, Verkleinerung oder Umsiedlung.
- Keine automatische Kartenvergrößerung in dieser Etappe. Sie benötigt später eine eigene Migration.
- Variabel große Karten bis in Generator, Positionierung, Grenzen, Ausschnittsgröße, Suche, Zoom und mobile Navigation durchführen. Kleine Welten dürfen nicht an der bisher festen 15×15-Ausschnittsgröße scheitern.
- Vor Speicherung prüfen, dass genug bebaubare Felder für NPCs und mindestens einen Spieler vorhanden sind. Unmögliche Einstellungen klar ablehnen statt teilweise erzeugte Welten speichern.

Laufende Unterhaltsregeln:
- Jede Welt erhält eine dauerhafte wirksame Konfiguration/Regelversion mit Gültigkeitsbeginn. Bereits gespeicherte Regeln müssen für die Abrechnung früherer Zeiträume verfügbar bleiben.
- Beim ersten Übergang das bisherige Regelsystem aus den bekannten alten Konstanten übernehmen. Fehlende alte Konfiguration bedeutet nicht, heutige ENV-Werte auf die gesamte Offlinezeit anzuwenden.
- Beim Neustart mit geänderten Raten bis zum Übergangszeitpunkt mit vorher gültigen Raten und korrekten Ereignissen abrechnen; neue Raten erst ab gespeichertem Wechselzeitpunkt nutzen.
- Übernahme/Wiederherstellung mit vorhandenem Journal absturzsicher machen. Absturz zwischen alter Abrechnung und neuem Regelsatz darf keine doppelte Gutschrift oder erneut ausgelösten Wechsel verursachen.
- Keine rückwirkend veränderten Kampfberichte oder Missionsergebnisse. Stationierte und unterwegs lebende Truppen nutzen ab dem Ratenwechsel die neue laufende Versorgung; ihr Kampf-Snapshot bleibt unverändert.
- Schonfrist/Verlustintervall/-anteil/Erholung eines bereits laufenden Mangelzyklus vorläufig mit dessen gespeicherter Regelversion zu Ende führen; neue Werte gelten für den nächsten Mangelzyklus. So entstehen keine rückwirkenden zusätzlichen Verlustwellen.
- Ratenänderung darf die aktuelle Mangeldauer nicht einfach löschen. Neue tatsächliche Bilanz kann natürlich nach den bestehenden Erholungsregeln zur Versorgung führen.
- Bei ausschließlich kostenlosen Einheiten bzw. Unterhalt 0 keinen Hunger auslösen; die Truppen bleiben trotzdem in Bestands-/Missionsübersichten sichtbar.
- Konfigurationswechsel innerhalb desselben laufenden Prozesses ist nicht nötig; Änderungen werden beim Neustart geladen.

## D. Universität als ziviles Gebäude

Die folgenden Forschungsregeln sind vorläufige Vorschläge für den Review, keine endgültigen Nutzerentscheidungen:

- Ausbaubare Universität auf zivilen Bauplätzen, niemals auf Militärplätzen. Verwende vorhandene Bauangebote, gemeinsame Bauwarteschlange, Stufenobergrenze und als Testbasis die vorhandene zivile Baukosten-/Zeitkurve.
- Universität produziert selbst keine Rohstoffe und erhöht keine Lagerkapazität. Sie zählt als Gebäude nach der bestehenden Punkteregel.
- Erste Universität ohne Forschungsvoraussetzung bauen können. Keine kostenlose automatische Platzierung oder zusätzliche Bauplätze.
- Mehrere Universitäten dürfen bestehen, aber pro Stadt läuft zunächst genau eine Forschung. Zusätzliche Gebäude eröffnen keine parallelen Forschungsplätze.
- Forschung wird an einer ausgewählten eigenen fertigen Universität begonnen. Neue Zielstufe n benötigt Universitätsstufe mindestens n.
- Keine Forschungswarteschlange in dieser ersten Fassung: ein laufender Auftrag, danach nächster Start. Keine Abbruch-/Erstattungsaktion.
- Universität mit laufender Forschung nicht abreißen. Ausbau ist zulässig; er beschleunigt einen bereits gestarteten Forschungsauftrag nicht rückwirkend.
- Investitionsnachweise, Abrissvorschau, Lagergrenzen und bestehenden Eigentumsschutz des Gebäudesystems weiterverwenden.

## E. Erste Forschungen und Effekte

Forschung gilt zunächst für die jeweilige Stadt. Keine Übertragung auf andere Städte/Server oder Vervielfachung je Universität.

Vier Technologien, je Stufe 0 bis 5:
- Forstwirtschaft: +5 Prozent Holzproduktion je abgeschlossener Stufe.
- Steinverarbeitung: +5 Prozent Steinproduktion je abgeschlossener Stufe.
- Landwirtschaft: +5 Prozent Nahrungsgrundproduktion je abgeschlossener Stufe.
- Lagerlogistik: +5 Prozent Lagerkapazität aller aktuell aktiven Ressourcen je abgeschlossener Stufe.

Vorgeschlagene Testkosten/-zeiten für Zielstufe n:
- 100 × n Holz und 100 × n Stein; keine Nahrung als zusätzliche Forschungskosten in dieser Etappe.
- Dauer = aufgerundet 60 × n / (1 + 0,1 × (Universitätsstufe − 1)) Sekunden. Universitätsstufe beim Start festschreiben.
- Beispiel: Zielstufe 2 an Universität Stufe 2 kostet 200 Holz und 200 Stein, dauert ceil(120 / 1,1) = 110 Sekunden.
- Voraussetzung: vorige Forschungsstufe abgeschlossen, eigene Universität mit erforderlicher Stufe, keine andere aktive Forschung und genügend Ressourcen.
- Preis, Dauer, Wirkung und Voraussetzungen ausschließlich aus serverseitigem Angebot. Beim Start Kosten einmalig abziehen und Auftrag dauerhaft speichern.
- Forschungsparameter zentral in einem Regelsatz definieren; dieser Auftrag verlangt dafür keine zusätzlichen ENV-Schalter. Eine spätere Konfigurierbarkeit muss möglich bleiben.

Verrechnung:
- Grundproduktion je Ressource aus fertigen Produktionsgebäuden bestimmen. Passender Forschungsfaktor = 1 + 0,05 × Forschungsstufe.
- Nahrungsertrag = Gebäudegrundproduktion × Landwirtschaftsfaktor × (1 + Bürgermeisterbonus). Davon den einmalig berechneten Truppenunterhalt abziehen.
- Beispiel: Bauernhöfe liefern 2/Sekunde, Landwirtschaft Stufe 2 ergibt Faktor 1,10, Bürgermeister 20 Prozent ergibt 2 × 1,10 × 1,20 = 2,64/Sekunde. Bei unverändertem Bedarf 3/Sekunde ist Netto −0,36.
- Forschungsbonus und Bürgermeister getrennt ausweisen; den Bürgermeister nicht doppelt anwenden.
- Lagerkapazität je Ressource = floor((Grundkapazität + passende Gebäude-/Lagerhausbeiträge) × (1 + 0,05 × Lagerlogistikstufe)).
- Beispiel: 2500 Kapazität vor Forschung und Lagerlogistik Stufe 2 ergeben 2750. Forschung erzeugt keine 250 zusätzlichen Ressourcen, nur Platz.
- Bestehende Überbestände und Regeln bei Abriss/Beuterückkehr erhalten. Alle Kapazitätsprüfungen müssen dieselbe abgeleitete Kapazität verwenden.
- Boni gelten ab dem tatsächlichen Forschungsabschluss. Ein wartender/laufender Auftrag hat noch keine Wirkung.
- Abgeschlossene Forschung bleibt bei Universitätsabriss erhalten und wirksam; für weitere Forschung wird wieder eine geeignete Universität benötigt. Keine doppelte Wirkung durch Neubau.
- Forschungspunkte als weiterer Kommandantenbereich aktivieren: vorläufig 10 × Summe abgeschlossener Forschungsstufen. Laufende Forschung zählt nicht.
- Gesamtpunkte nach vorhandener Regel aus Gebäude-, Forschungs- und signiertem Kampfbeitrag berechnen, nur Gesamtanzeige unten auf null begrenzen. Abgeleitete Forschungspunkte nicht zusätzlich noch einmal als Ereignisbonus addieren.
- Kein Forschungsgeneral, militärischer Technologiebaum, Ölbonus, Einheiten-/Waffenfreischaltung in dieser Etappe. Die spätere Erweiterbarkeit bleibt im Projektplan.

## F. Zeit, Persistenz und Ereignisse

- Forschungsstart, Vorschau, Fortschritt, Abschluss und neue Stadtzustände über den vorhandenen WebSocket-Transport.
- Eigenen Stadt-/Universitätsbesitz, gültige Technologie, erwartete nächste Stufe und Ressourcen serverseitig prüfen. Freie Clientwerte für Kosten/Faktoren/Zeiten ignorieren bzw. ablehnen.
- Startauftrag enthält stabile ID, Technologie/Zielstufe, Universität-ID, bezahlte Kosten, Regelversion, Start-/Endzeit und festgeschriebene Dauer.
- Wiederholte requestId, zwei Verbindungen und gleichzeitige Startversuche dürfen weder doppelt abbuchen noch mehrere Stadtforschungen starten.
- Versionierte Migration: bestehende Städte mit Forschungsstufe 0 und ohne erfundene historische Forschung versehen. Vorhandene Daten, falls die tatsächliche Implementierung schon etwas enthält, erhalten.
- Forschungsabschlüsse in die bestehende globale Zeitverarbeitung einordnen: alte Wirtschaftsrate bis Abschluss, dann Forschung genau einmal fertigstellen, neue Produktion/Kapazität/Punkte ableiten und Versorgung neu prüfen.
- Bürgermeisterwechsel/Skillverteilung, ENV-Regelwechsel, Forschung, Bau, Ausbildung, Kampf, Rückkehr und Hunger zeitlich korrekt zusammenführen. Keine getrennten Browser- oder Background-Timer als zweite Autorität.
- Bei Forschung und Rückkehr zum gleichen Zeitpunkt eine deterministische, dokumentierte Ordnung verwenden. Empfohlene Regel: fällige Wirtschaftsabschlüsse einschließlich Forschung vor Missionseinlagerung, Hungerwelle nach rechtzeitiger Versorgung. Bestehende Missionsreihenfolge untereinander erhalten.
- Forschung läuft während Abwesenheit und bei Nahrungsmangel weiter; Ausbildungspause nicht versehentlich auf Forschung übertragen.
- Neue Produktionswirkung kann Hunger beenden, aber frühere Verluste nicht zurücknehmen oder aufgelaufene Mangelzeit eigenmächtig löschen.
- Speichern vor Erfolgsbestätigung und Wiederherstellung aus Journal. Speicherung atomarer Einzeldateien allein nicht als Ersatz für konsistente Ereignisverarbeitung behandeln.

## G. Oberfläche und Dokumentation

- Universität in vorhandene Stadtdarstellung und Bauangebote integrieren; vorhandene Bild-/Designsprache erhalten.
- Forschungsansicht über Universität oder klare Navigation erreichbar machen: vier Technologien, erreichte/nächste Stufe, Wirkung, Kosten, Voraussetzungen und laufender Fortschritt.
- Keine scheinbar bedienbaren Platzhalter für kommende Militärforschung. Verständliche Sperrgründe, Vorschau und Bestätigung.
- Ressourcenübersicht: Gebäudeertrag, Forschungsanteil, Bürgermeisteranteil, Gesamtproduktion, Verbrauch je Typ, Gesamtverbrauch und Netto in konsistenter Einheit.
- Beim Unterhalt Anzahl × Kosten je Einheit/Stunde sichtbar machen, damit der Nutzer seine Rechnung nachvollziehen kann. Stationiert, lebend unterwegs und noch in Ausbildung sauber unterscheiden.
- Lageraufschlüsselung enthält Forschungsfaktor, ohne Kapazität mit vorhandenem Vorrat zu verwechseln.
- Forschungspunkte in bestehender Punkteansicht ergänzen. Private Forschungen anderer Spieler nicht über öffentliche Karte offenlegen.
- README, .env.example, Container-/Entwicklungsanleitung, Protokoll-/Speicherdokumentation und Projektplan auf tatsächlichen Stand bringen.
- Bestehende widersprüchliche Aussagen korrigieren: bereits vorhandene Konten, Farmzüge und Skills nicht weiter als fehlend beschreiben. Historische Regelstände erkennbar von aktuellen Regeln trennen.

## H. Verbindliche Prüfung und Lieferung

Zusätzlich zu bestehender Testsuite und Frontend-Build:
1. Unabhängige Unterhaltsrechnungen aus Abschnitt A, Einmalkosten getrennt, keine Änderung durch Verbindungs-/Abrufanzahl.
2. Schonfrist in großem und in vielen kleinen Schritten, über die erste Verlustwelle hinaus; gebrochener Leerstandszeitpunkt, Erholung, Offline-/Online-Gleichheit.
3. Stations-/Missionszählung, Kampf-/Hungerverluste, Ausbildung und Rückkehr genau einmal.
4. ENV-Standards, explizites 0, Dezimalwerte, ungültige Grenzen, fehlende/ungültige Datei, dokumentierte Prioritäten.
5. Zwei isolierte Welten mit unterschiedlichen Konfigurationen ohne gegenseitige Beeinflussung.
6. Neue rechteckige/kleine/größere Karten, unmögliche NPC-Anzahl und bestehende Welt mit abweichenden Erzeugungswerten.
7. Native und Compose-Starts mit wirksamen Unterhaltswerten ohne Frontend-Neubuild.
8. Neustart mit Ratenwechsel nach Offlinezeit: vorherige Regeln vor Übergang, neue Regeln danach; kein Rücksetzen laufender Mangelzyklen, korrekte Wiederherstellung nach Fehler.
9. Universitätsbau/Ausbau/Abriss, militärische Plätze abweisen, kein Abriss bei aktiver Forschung, erhaltene Forschung nach Neubau.
10. Forschungsstartkosten, Stufenvoraussetzungen, eine Forschung je Stadt trotz mehrerer Universitäten, Ende/Offlineabschluss und keine doppelte Zahlung/Wirkung.
11. Alle Produktions-/Lagerformeln einschließlich Bürgermeister, Forschungspunkte, Hunger und Beuterückkehr.
12. Manipulierte/fremde IDs, Parallelbefehle, Speicherfehler, Neustart und Regression von Skills, Farmzügen, Lager/Abriss.

Browserprüfung mit zwei Konten und Desktop/Mobilansicht: nachvollziehbare Unterhaltsanzeige, Universität bauen, Forschung starten/abschließen, Wirkung prüfen, erneut anmelden. Isolierte Testwelten und kontrollierte Uhr für lange Zeiträume verwenden.

Liefere einen vollständigen PR mit Teilcommits „Unterhaltsprüfung/Fixes“, „ENV-Konfiguration“, „Forschung“ und den nötigen Integrationstests. Fehlende Prüfungen ausdrücklich benennen. Balancesenkung getrennt von Fehlerkorrekturen ausweisen, keine behauptete Live-Ursache ohne Beleg. Nicht selbst mergen oder deployen.

Danach Forschungsgeneral und weitere Forschung/Freischaltungen sowie Regeln für zusätzliche Generäle als eigene Etappe; Öl/LKWs und Föderation gemäß Projektplan.
