# Codex-Auftrag 10: General-Skills aktivieren und wirksam einsetzen

## Ausgangspunkt und Ziel

Der Nutzer bestätigt am 08.10.2026 Auftrag 9 als abgeschlossen. README und Protokolldokumentation beschreiben Versorgung, Hungerverluste und Bürgermeister als implementiert. Die General-Skillgrundlage existiert bereits, XP-Umrechnung und Verteilung sind bislang deaktiviert. Prüfe den tatsächlichen Code; der Planungschat hat keine eigenen Laufzeittests durchgeführt.

Arbeite vom aktuellen main in bavxhack/War2glory. Lies AGENTS.md, README.md, docs/PROJECT.md, docs/WEBSOCKET.md und docs/DEVELOPMENT.md. Prüfe offene PRs und vorhandene Änderungen, bewahre fremde Arbeit. Dieser Auftrag ersetzt Auftrag 9 als aktuellen Arbeitsauftrag.

Der Planungschat schreibt ausschließlich Anweisungen. Du implementierst und prüfst Auftrag 10 und lieferst einen Pull Request ohne eigenständiges Merge oder Deployment.

Ziel: Erfahrung aus vorhandenen Einsätzen erhalten → im Generalmodal gezielt Skillpunkte kaufen → auf Führung, Angriff und Verteidigung verteilen → tatsächliche Wirkung verstehen → verbesserten Bürgermeister oder General einsetzen → Fortschritt nach Neustart wiederfinden.

Die konkreten Kosten- und Kampfformeln unten sind Vorschläge des Planungschats für einen spielbaren, reviewbaren Prototyp. Keine einzeln bestätigten Nutzerwerte und keine Originalregeln behaupten. Als zentralen, versionierten Regelsatz implementieren und im PR sichtbar zur Prüfung aufführen. Dieser eigene Aktivierungsauftrag ersetzt für seinen Umfang frühere Anweisungen, Skills lediglich als deaktivierte Grundlage vorzuhalten.

## A. Umfang und Erhaltung des Bestands

- Vorhandene reine Skillfunktionen, Generaldaten, React-Modal, zentralen WebSocket-Transport und JSON-Journal weiterverwenden. Keine parallele zweite Skillverwaltung.
- Manuelle XP-Umrechnung und Verteilung jetzt als echte Spielaktionen aktivieren.
- Führung verstärkt den bestehenden Bürgermeisterbonus. Angriff und Verteidigung erhalten begrenzte Wirkungen im bestehenden NPC-Infanteriekampf.
- Kein militärisches Führungslimit wieder einführen. Das bestehende Gesamtmaximum von 10.000 Einheiten je Einsatz bleibt, ebenso die Exklusivität Bürgermeister/Missionsführer.
- Rekrutierung weiterer Generäle, kostenlose Zusatzgeneräle, Respec/Rückerstattung verteilter Skills, Universität, Forschungsgeneral, Öl/LKWs und PvP bleiben spätere Aufgaben.
- Bestehende XP-Quellen, Levelkurve, Ernährungswerte, Hungerverluste, NPC-Regeneration und Bau-/Lagerregeln nicht neu ausbalancieren.
- Erhalte neue Illustrationen und bestehende mobile Gestaltung.

## B. Manuelle XP-Umrechnung

Vorläufiger Regelsatz:
- Der n-te insgesamt erworbene Skillpunkt eines Generals kostet 10 × n XP; n beginnt bei 1.
- Kostenbasis ist die Gesamtzahl jemals erworbener Skillpunkte dieses Generals, einschließlich bereits verteilter. Punkte verteilen macht den nächsten Punkt nicht günstiger.
- Kosten für m neue Punkte bei bereits k erworbenen Punkten: 10 × Summe der Zahlen von k+1 bis k+m, gleich 5 × m × (2k+m+1).
- Beispiel: erste drei Punkte kosten 10 + 20 + 30 = 60 XP. Bei 75 verfügbaren XP bleiben danach 15; der vierte Punkt kostet 40.
- Bei bereits drei erworbenen Punkten kosten die nächsten zwei 40 + 50 = 90 XP.
- Umrechnung nur nach bewusster Bestätigung. Kein automatischer XP-Verbrauch bei Login, Erfahrungsgewinn oder Levelaufstieg.
- Vor Umrechnung Anzahl, Einzelpreis des nächsten Punktes, Gesamtkosten und verbleibende XP anzeigen. Optional „maximal bezahlbar“ serverseitig berechnen.
- Insgesamt verdiente XP bleiben unverändert. Nur bereits verwendete XP erhöhen und freie Skillpunkte gutschreiben. Generallevel weiter aus der bisherigen Gesamt-XP-Regel ableiten, kein Levelverlust durch Ausgaben.
- Prüfe positive ganze Anzahl, sichere numerische Grenzen und vorhandene XP. Kein negativer Rest, keine Teilbuchung und kein unbeschränktes Durchlaufen großer Clientzahlen.
- Vorhandene Skillzähler berücksichtigen; keine doppelte Berechnung aus alten XP und bereits erworbenen Punkten.
- Freie Skillpunkte dürfen zunächst aufgehoben werden. Keine Verfallsfrist und kein automatisches Verteilen.

## C. Verteilung und Grenzen

- Ein freier Skillpunkt erhöht genau eine gewählte Eigenschaft um einen Punkt.
- Grundwerte, verteilte Punkte und effektive Werte getrennt halten. Effektiver Eigenschaftswert = vorhandener Grundwert + entsprechende bestätigte Skillzuweisung; verifiziere die tatsächlichen bestehenden Felder.
- Führung für den Bürgermeister nutzt diesen effektiven Führungswert. Verwende nicht das historische, deaktivierte Truppenführungslimit als Ersatz.
- Für die neuen Kampfboni zählt ausschließlich der neu aktivierte verteilte Skillanteil bei Angriff/Verteidigung. Bestehende bisher wirkungslose Grundwerte werden nicht ungefragt zu einem zusätzlichen Kampfbonus. Diese Übergangsregel klar erklären.
- Invariante: insgesamt erworbene Punkte = freie Punkte + Summe aller verteilten Punkte. Erhaltene Altbestände anhand ihrer vorhandenen Daten konsistent migrieren.
- UI-Plus/Minus verändert zunächst nur einen lokalen Entwurf. Minus darf nur ungespeicherte Zuweisungen zurücknehmen. Speichern bestätigt alle Änderungen zusammen, Abbrechen verändert nichts.
- Keine kostenlose Rücksetzung bereits gespeicherter Punkte, kein XP-Transfer zwischen Generälen und keine künstliche Kommandantenpunktebelohnung für Umrechnung oder Verteilung.
- Wirkungsobergrenzen vor Bestätigung zeigen. Neue Zuweisungen, die eine unten festgelegte Obergrenze überschreiten, serverseitig ablehnen; bestehende überhöhte Altgrundwerte weder kürzen noch rückwirkend bestrafen.
- Vorläufig maximal 25 verteilte Angriffspunkte und 25 verteilte Verteidigungspunkte, entsprechend jeweils 50 Prozent maximaler Wirkung. Führung nur soweit weiter steigerbar, wie ihr effektiver Wert unter der bestehenden Bürgermeister-Wirkungsgrenze 50 liegt.
- Falls durch bestehende Daten eine Wirkungsgrenze bereits erreicht ist, diese Eigenschaft als ausgeschöpft anzeigen. Aufgehobene Skillpunkte bleiben erhalten; Käufer auf vollständig ausgeschöpfte Eigenschaften hinweisen.
- Begrenzungen sind Prototypwerte, keine endgültige Vorgabe für das spätere Forschungs-/Waffensystem.

## D. Führungswirkung auf Bürgermeister und Versorgung

- Bestehende Bonusregel erhalten: b = min(0,50; max(0, effektive Führung) × 0,01). Nahrungsproduktion = landwirtschaftliche Grundproduktion × (1 + b).
- Beispiel: Führung 10 → 12 durch zwei Skillpunkte erhöht den Bonus von 10 auf 12 Prozent. Bei 2 Nahrung/Sekunde Grundproduktion steigt der Ertrag von 2,20 auf 2,24. Dies sind zwei zusätzliche Prozentpunkte des Grundbonus, nicht 2 Prozent auf den bereits erhöhten Ertrag.
- Skillverteilung bei einem amtierenden Bürgermeister ist zulässig. Vor Buchung alle fälligen Wirtschafts-/Versorgungsereignisse bis zum wirksamen Zeitpunkt mit dem alten Bonus verarbeiten.
- Den neuen Ertrag erst ab diesem Zeitpunkt verwenden, Hunger-/Erholungszustand neu prüfen und gegebenenfalls pausierte Ausbildung nach den bestehenden Regeln fortsetzen.
- Keine rückwirkend erzeugte Nahrung, kein Neustart der Schonfrist allein wegen einer Skillbuchung. Tatsächliche Versorgung entscheidet.
- Skillverteilung bei einem nicht als Bürgermeister eingesetzten General verändert keine Stadtproduktion.
- Bonus betrifft weder Lagerkapazität, Holz/Stein, Beutemenge noch NPC-Regeneration. Wiederholte Snapshots dürfen den Bonus nicht nochmals aufaddieren.

## E. Vorläufige Kampfboni für neue Farmmissionen

Kapsle den erweiterten Kampf als neue Regelversion. Für einen neuen Einsatz werden zum Start die Skillboni des gewählten Generals festgeschrieben.

Definitionen:
- N = bei Kampfbeginn tatsächlich noch lebende angreifende Infanterie, nach bisherigen Hungerverlusten.
- D = bei Kampfbeginn tatsächlich vorhandene NPC-Verteidiger.
- a = min(0,50; 0,02 × verteilte Angriffspunkte).
- v = min(0,50; 0,02 × verteilte Verteidigungspunkte).
- Angriffsstärke S = N × (1 + a). Bonusstärke ist keine zusätzliche Einheit und erzeugt weder Traglast noch Unterhalt.
- Verwende ganzzahlige Prozentrechnung bzw. exakte rationale Vergleiche, damit Rundungsfehler keine Siegschwellen verschieben.

Ausgang:
- N = 0: bestehende Regel ohne Kampf/Beute anwenden.
- D = 0 bei N > 0: bestehender unverteidigter Farmzug, keine Verluste oder Kampfbelohnung.
- Bei D > 0 gewinnt der Angreifer genau dann, wenn S > D; Gleichstand bleibt Verteidigersieg.

Verluste:
- Bei Sieg: alle D Verteidiger fallen. Eigene Verluste = min(N, ceil((D / 2) × (1 − v))).
- Bei Niederlage: NPC-Verluste = min(D, floor(S / 2)); eigene Verluste = min(N, ceil(N × (1 − v))).
- Damit senkt Verteidigung eigene Kampfverluste auch bei Niederlage. Diese Änderung gegenüber dem bisherigen vollständigen Angreiferverlust ausdrücklich im PR und im Spielregeltext nennen.
- Niederlage bleibt Niederlage: Überlebende kehren ohne neue Beute zurück. General überlebt entsprechend der bisherigen Regel.
- Ohne verteilte Angriff-/Verteidigungspunkte muss das Modell für jeden Fall identische Ergebnisse wie die bisherige Kampfversion liefern.
- Verteidigung reduziert ausschließlich Kampfverluste, nicht Hunger. Angriff steigert weder XP pro getötetem Gegner noch Geschwindigkeit oder Transportkapazität.

Abnahmerechnungen:
- N = 10, D = 10, 0 Angriff/0 Verteidigung: bisherige Niederlage, 10 eigene Verluste und 5 NPC-Verluste.
- N = 10, D = 10, 5 Angriffspunkte/0 Verteidigung: a = 10 Prozent, S = 11; Sieg, 5 eigene Verluste, 10 NPC-Verluste und 5 Überlebende.
- N = 30, D = 20, 0 Angriff/10 Verteidigungspunkte: v = 20 Prozent; Sieg mit ceil(10 × 0,8) = 8 eigenen Verlusten statt 10.
- N = 10, D = 20, 0 Angriff/10 Verteidigungspunkte: Niederlage, 8 eigene und 5 NPC-Verluste; 2 Überlebende kehren ohne Beute zurück.
- Anschließende Traglast, Unterhalt, Hunger, XP und Kampfbeiträge anhand tatsächlicher Überlebender/Verluste nach ihren bestehenden Regeln berechnen.

## F. Laufende Missionen und Migration

- Generäle dürfen während eines Einsatzes XP umwandeln und Punkte verteilen; Wirkung auf militärische Einsätze jedoch erst ab dem nächsten Start.
- Speichere für neue Missionen eine unveränderliche Aufnahme der wirksamen Kampfboni und Kampfregelversion. Nicht beim späteren Kampf aus dem dann aktuellen General neu ableiten.
- Vor Aktivierung gestartete Farmmissionen behalten ihre bisherige Kampfversion ohne neue Boni, auch wenn der General vor Ankunft verbessert wird. Kein rückwirkender Vorteil oder Nachteil.
- Bereits gespeicherte Kampfresultate und historische Berichte bleiben unverändert. Bei fehlender alter Versionskennung ausdrücklich der bisherigen Version zuordnen, nicht dem neuesten Standard.
- Vorhandenes Journal muss auch ältere noch offene Transaktionen vor neuen Aktionen korrekt wiederherstellen können.
- Migration erhält alle Generäle, Rollen, XP, freien/verteilten Punkte, aktive Einsätze, Ressourcen und Mangelzeitpunkte. Keine automatische Skillverteilung und kein Bonusgeschenk bei Anmeldung.
- Regelsatz-/Datenversion dauerhaft speichern; Neustart und erneute Migration dürfen weder XP erneut freigeben noch Punkte duplizieren.
- Kampfberichte der neuen Version zeigen tatsächlich angewandte Angriffs-/Verteidigungsboni und Verluste; alte Berichte dürfen keine nachträgliche neue Bonusdarstellung bekommen.

## G. WebSocket, Vorschau und React-Modal

- Aktiviere/ergänze Skillbefehle gemäß bestehender Protokollkonvention. Vorher die schon vorhandenen Spielkernfunktionen und deaktivierten Befehle prüfen.
- Ein authentifizierter Befehl identifiziert General, gewünschte Menge bzw. Zuweisungsdeltas, erwartete Generalversion und Regelsatzversion. Kosten, Eigenschaften, XP und Besitzer bestimmt der Server.
- Vorschau und Bestätigung gegen veraltete General-/Regelstände prüfen. Konkurrierende Änderungen dürfen keine Punkte mehrfach ausgeben; bei Konflikt aktuellen Zustand liefern und erneute bewusste Bestätigung ermöglichen.
- XP-Umrechnung und Eigenschaftsverteilung sind zwei klar getrennte Schritte. Ihre jeweiligen Abbuchungen und Gutschriften intern atomar speichern.
- Deduplizierung beibehalten: gleiche requestId und gleicher Inhalt erzeugen keine weitere Wirkung, widersprüchlicher Inhalt wird abgewiesen.
- Vor Erfolg dauerhaft konsistent speichern. Speicherfehler, Absturz oder verlorene Antwort dürfen keine verlorene XP-Buchung oder doppelte Skillpunkte verursachen.
- Eigentumsprüfung, private Snapshots und Kontowechselabsicherung erhalten. Keine neue WebSocket-Verbindung je Modal und kein HTTP-Spielpolling.
- Modal zeigt Gesamt-XP/Level, verfügbare/verwendete XP, erworbene/freie Punkte, Preis des nächsten Punktes, Grundwerte und zugewiesene Skillanteile.
- Vorschau zeigt pro Eigenschaft ihre tatsächliche Wirkung und Obergrenze. Erkläre, dass kleine Änderungen durch Rundung nicht in jedem Kampf sofort eine weitere Einheit retten.
- Keine Siegchance aus geheimen aktuellen NPC-Daten berechnen. Beispielrechnungen oder zeitgestempelte eigene Aufklärungsberichte dürfen als solche erkennbar verwendet werden.
- Während Einsatz im Modal erklären: neu verteilte Kampfpunkte gelten ab nächster Entsendung. Bürgermeisteränderung wirkt ab erfolgreicher Speicherung.
- Mobile/Tastaturbedienung, Fokusführung, verständliche Fehler- und Ladezustände erhalten. Entwürfe nicht bei jedem Push ungefragt überschreiben.

## H. Prüfung und Lieferung

Führe bestehende Tests und Frontend-Build aus; ergänze gezielte Prüfungen:

1. XP-Kosten aller genannten Beispiele, Rest-XP, Mehrfachkauf, bereits ausgegebene Punkte und numerische Grenzen.
2. Manuelle Bestätigung, kein automatischer Kauf durch Login/XP-Ereignis; Gesamt-XP und Level bleiben bei Umrechnung erhalten.
3. Verteilungsinvariante, kostenlose Rücksetzung ausgeschlossen, Effektschranken und unveränderte Altgrundwerte.
4. Bürgermeister-Führung vor/nach Buchung bei laufender Produktion, Hunger/Erholung und pausierter Ausbildung.
5. Exakte Kampfbeispiele, Siegschwellen/Gleichstand, leeres Ziel, vollständiger vorheriger Hungerabgang und identische alte Ergebnisse bei null Skills.
6. Höherer Angriff darf unter sonst gleichen Bedingungen keine schlechtere Erfolgsbewertung, höhere Verteidigung keine höheren eigenen Kampfverluste bewirken.
7. Keine Wirkung auf Traglast pro Einheit, Marschzeit, Nahrungsbedarf pro Einheit, Hungerverlustrate oder militärisches Führungslimit.
8. Alte Missionen bleiben in alter Regelversion; neue Missionen verwenden den beim Start gespeicherten Bonus trotz späterer Verteilung.
9. Rückkehr mit Überlebenden nach Niederlage, korrekte XP/Punkte aus echten Verlusten und keine Beute bei Niederlage.
10. Doppelte/gleichzeitige Befehle, fremde General-ID, veraltete Vorschau, Speicherfehler und Neustart ohne doppelte XP-/Punktebuchung.
11. Migration mit laufendem Einsatz, amtierendem Bürgermeister, vorhandenen Skillzählern und offenem Journal.
12. Regression von Generalrollen, Farmzügen/Aufklärung, Ernährung/Hunger und Lager/Abriss.

Browserprüfung mit zwei Konten, Desktop und Mobilansicht: Erfahrung anzeigen → Punkte kaufen → Entwurf abbrechen/speichern → Bürgermeisterertrag prüfen → neuen Farmzug starten → Bonus im privaten Bericht prüfen → erneut anmelden. Isolierte Testwelten für Kampfvergleiche nutzen; produktive Spielstände nicht verändern.

- Liefere nachvollziehbare Teilcommits und einen vollständigen Pull Request; nicht selbst mergen/deployen.
- Aktualisiere README, docs/PROJECT.md und Protokoll-/Speicherdokumentation. Veraltete Aussagen „alle Skillfunktionen deaktiviert“ und „Niederlage vernichtet immer alle Angreifer“ für den neuen Regelsatz korrigieren, historische Regeln als solche erhalten.
- Dokumentiere Rechenbeispiele und alle vorläufigen Werte: 10 × n XP, manuelle Umrechnung, ein Eigenschaftspunkt je Skillpunkt, 2 Prozent je militärischem Skillpunkt, 50-Prozent-Wirkungsgrenzen und Überlebende bei Niederlage.
- Trenne umgesetzt/getestet/offen. Nicht ausführbare Prüfungen und reale Einschränkungen ausdrücklich benennen.
- Danach Universität und erste Wirtschafts-/Lagerforschungen als eigener Auftrag. Forschungsgeneral und weitere Generalrekrutierung benötigen eigene Regeln; nicht automatisch implementieren.
