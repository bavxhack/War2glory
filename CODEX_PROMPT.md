# Codex-Auftrag 7: Generalverwaltung, Eigenschaften-Modal und Skillgrundlage

## Ausgangspunkt und Ziel

Der Nutzer bestätigt am 29.09.2026, dass das React-Refactoring umgesetzt ist und funktioniert. README und Projektplan beschreiben den React-/Vite-Client, Lagerwirtschaft, Abriss, Ausbildung, Startgeneral und NPC-Aufklärung als implementiert. Prüfe den tatsächlichen Code; der Planungschat hat keine eigenen Laufzeittests ausgeführt.

Arbeite vom aktuellen main im Repository bavxhack/War2glory aus. Lies AGENTS.md, README.md, docs/PROJECT.md, docs/WEBSOCKET.md und docs/DEVELOPMENT.md. Prüfe offene PRs und fremde Änderungen; vorhandene Arbeit erhalten. Auftrag 7 ersetzt Auftrag 6 als aktuellen Arbeitsauftrag.

Der Planungschat erstellt nur Anweisungen. Du implementierst diesen Auftrag in überprüfbaren Schritten, testest ihn und lieferst einen Pull Request. Keine erneute React-Migration und keine neuen Kampfregeln.

Jetzt spielbarer Ablauf: Militärbereich öffnen → vorhandene Generäle ansehen → General auswählen → Details im Modal öffnen → Namen ändern → freien General gezielt für eine Aufklärung auswählen → Fortschritt und Status nach Rückkehr und Wiederbeitritt sehen.

Zusätzlich wird die technische Grundlage für Erfahrung → Skillpunkte → Eigenschaften vollständig vorbereitet und in isolierten Tests durchgespielt. Ihre Aktivierung im regulären Spiel benötigt noch die unten genannten Produktentscheidungen. Stelle die Grundlage nicht als bereits aktiviertes Skillsystem dar.

## A. Bestätigte Anforderungen und bewusste Grenzen

- Ein Kommandant kann mehrere Generäle besitzen. Wann und wie weitere Generäle erzeugt/rekrutiert werden, entscheidet der Nutzer später.
- Jeder General hat eigene Identität, Namen, Erfahrung, Eigenschaften und Einsatzstatus.
- Eigenschaften sind Führung, Angriff und Verteidigung.
- Erfahrung soll später aus Kämpfen entstehen, in Skillpunkte umgerechnet und auf Eigenschaften verteilt werden. Der Erfahrungsbedarf je weiterem Skillpunkt steigt mit dem Fortschritt.
- Spätere Einsatzrollen sind Truppengeneral, Bürgermeister und Forschungsgeneral. Rollen sind keine zusätzlichen Eigenschaften.
- Kostenkurve, automatische oder manuelle Umrechnung, Bonusformeln, Obergrenzen, Rekrutierung und Rücksetzung sind nicht bestätigt.
- Kein Rekrutierungsbutton, keine zusätzlichen Gratisgeneräle, kein neuer aktiver Kampf-/Forschungsbonus und keine Umstellung der bestehenden Levelregeln auf Grundlage erfundener Balancewerte.
- Bereits vorhandene Aufklärungs-Erfahrung und Führungskapazität bleiben erhalten. Keine stillschweigende Abschaffung der bisherigen Erstzielbelohnung.

## B. Mehrere Generäle im persistenten Spielmodell

- Prüfe zuerst, ob bereits eine Sammlung statt eines Einzelobjekts existiert. Erweitere diese gezielt statt eine zweite Datenstruktur einzuführen.
- Jeder General erhält eine stabile ID und den eindeutigen Besitzer innerhalb seiner Welt. Namen sind veränderbare Anzeigewerte, niemals Schlüssel für Einsätze.
- Ein vorhandener General wird verlustfrei übernommen: ID, Name, Erfahrung, Level, Kapazität, Einsatzstatus und aktive Verweise bleiben erhalten.
- Migriere versioniert und idempotent. Mehrfachlogin, Reconnect, Neustart und erneute Migration dürfen keinen weiteren Startgeneral vergeben.
- Ein Startgeneral ist eine einmalige Einstiegshilfe, keine maximale Bestandszahl. Mehrfachbesitz darf im Datenmodell und in der Ansicht nicht auf das erste Element reduziert werden.
- Prüfe mehrere Generäle mit isolierten Testspielständen. Testdaten dürfen nie zusätzliche Generäle in regulären Weltverzeichnissen erzeugen. Kein öffentlich nutzbarer Test-/Erzeugungsendpunkt.
- Erhalte Aufträge, Gebäude, Truppen, Rohstoffe, Forschungsplatzhalter und Kommandantenpunkte. Keine Spielstandrücksetzung.
- Rollen/Zuordnungen erweiterbar halten. Jetzt sind nur die vorhandenen militärischen Einsätze aktiv; Bürgermeister und Forschungsgeneral bekommen noch keine Ernennungsaktion oder Wirkung.

## C. Generalübersicht und React-Modal

- Ergänze im Militärbereich eine übersichtliche Generalverwaltung. Zeige je General Name, Level, Erfahrung und verfügbaren/gebundenen Status; vorhandene Kapazität nachvollziehbar anzeigen.
- Ein Klick öffnet ein Modal des konkreten Generals. Ein ausgewählter General bleibt anhand seiner ID ausgewählt, auch wenn die Sammlung neu übertragen oder anders sortiert wird.
- Ermögliche Namensänderungen. Vorläufige technische Eingabegrenze: nach Entfernen äußerer Leerzeichen 1 bis 40 Unicode-Codepunkte, keine Steuerzeichen; dokumentiere diese UI-Grenze, behalte normale Unicode-Namen bei. Gleichnamige Generäle dürfen existieren, da IDs unterscheiden.
- Der Server prüft Namen und Eigentum. Namen sicher als Text darstellen; keine ungeprüfte HTML-Ausgabe.
- Zeige Führung, Angriff und Verteidigung mit ihren tatsächlich gespeicherten bzw. abgeleiteten Werten. Fehlende Werte nicht als bereits verdiente Boni darstellen.
- Zeige Gesamt-Erfahrung, für die spätere Umrechnung verfügbare Erfahrung und gegebenenfalls freie Skillpunkte klar getrennt. Noch nicht aktive Funktionen verständlich kennzeichnen.
- Bereite Plus-/Minus-Bedienung für einen lokalen Verteilungsentwurf und eine Vorschau vor. Minus nimmt nur noch ungespeicherte Änderungen zurück; bereits gespeicherte Verteilungen erhalten keine kostenlose Rücksetzung.
- Im regulären Spiel bleiben Umrechnung und Skillverteilung serverseitig deaktiviert, solange kein freigegebener Regelsatz vorliegt. Im Modal erklären, dass die Skillregeln noch festgelegt werden; keine scheinbar funktionierenden Schaltflächen.
- Die Namensbearbeitung funktioniert unabhängig davon. Schließen/Abbrechen einer Skillvorschau bucht keine Erfahrung oder Punkte.
- Normale Servermeldungen dürfen einen Namensentwurf nicht ungefragt überschreiben. Bei konkurrierender Änderung einen nachvollziehbaren Konflikt bzw. aktualisierten Stand anzeigen.
- Mobile Bedienung, beschriftete Felder, Tastaturbedienung, Fokusführung, Escape und Fokusrückkehr berücksichtigen.

## D. Nachvollziehbare Erfahrungs- und Skillgrundlage

- Halte mindestens folgende Größen getrennt nachvollziehbar: insgesamt verdiente Erfahrung, bereits zur Skillumrechnung verwendete Erfahrung, noch verfügbare Erfahrung, insgesamt erworbene Skillpunkte, freie Skillpunkte und Verteilungen auf Eigenschaften.
- Vermeide unnötig redundant gespeicherte Werte. Abgeleitete Werte müssen eindeutig aus dem verbindlichen Zustand berechenbar sein.
- Bestehende Generallevel beruhen weiterhin auf der bislang geltenden Erfahrungsauswertung. Eine spätere XP-Ausgabe darf Gesamt-Erfahrung nicht löschen oder dadurch einen unbeabsichtigten Levelverlust erzeugen.
- Migrationsregel für Generäle ohne vorheriges Skillsystem: vorhandene XP bleiben Gesamt-Erfahrung; keine erfundenen früheren Umrechnungen oder Skillbelohnungen. Neue Skillzähler/Verteilungen beginnen ohne vergebene Punkte. Falls im tatsächlichen Code schon Skillfortschritt existiert, verlustfrei erhalten und die abweichende Migration dokumentieren.
- Technischer Vorschlag für die Kostenbasis: insgesamt jemals erworbene Skillpunkte einschließlich bereits verteilter Punkte. Kosten dürfen nicht sinken, nur weil freie Punkte ausgegeben werden. Diese Auslegung bleibt als Vorschlag gekennzeichnet.
- Implementiere reine, konfigurierbare Berechnungsfunktionen im Spielkern für Vorschau, Umrechnung und Verteilung. Die produktive Konfiguration enthält noch keinen automatisch aktivierten neuen Regelsatz.
- Ein gültiger Testregelsatz hat positive, ganzzahlige und mit der erworbenen Skillpunktzahl steigende XP-Kosten. Bei mehreren Umrechnungen wird jeder Punkt mit dem dann gültigen neuen Preis berechnet. Nicht benötigte Erfahrung bleibt übrig.
- Teste exakte Schwellen, nicht ausreichende XP, mehrere aufeinanderfolgende Käufe, Rest-XP und numerische Grenzen. Keine negative Erfahrung, Bruchteile von Skillpunkten oder übergroße unkontrollierte Schleifen zulassen.
- Invariante bei dem hier vorbereiteten Modell ohne Gratispunkte: erworbene Skillpunkte = freie Skillpunkte + Summe der verteilten Skillpunkte. Die Ausgabe von XP und Erzeugung von Skillpunkten erfolgen gemeinsam.
- Grundwerte, zugewiesene Skillpunkte und daraus abgeleitete Boni sind getrennte Größen. Test-Bonusformeln ausdrücklich als Testdaten behandeln; keine versteckte neue produktive Führungskapazität oder Kampfkraft.
- Automatische und manuelle Umrechnung dürfen nicht gleichzeitig dieselbe Erfahrung nutzen. Berechnungsbausteine unabhängig vom später gewählten Auslöser halten.
- Für spätere Kampferfahrung eine nachvollziehbare, serverseitige Vergabe vorbereiten; noch keine neue Belohnungsquelle aktivieren. Wiederholte Ergebnisereignisse dürfen keine doppelte XP-Buchung erzeugen.
- Kommandantenpunkte bleiben von General-XP und Skills getrennt.

## E. Einsatzwahl und Schutz bestehender Aufklärung

- Im vorhandenen Aufklärungsdialog einen konkreten eigenen freien General auswählen. ID, verfügbare Kapazität und Status serverseitig prüfen.
- Ein General kann nur einen aktiven Einsatz führen. Zwei Generäle dürfen unterschiedliche verfügbare Truppen gleichzeitig führen, soweit die bisherigen Einsatzregeln dies erlauben.
- Verhindere doppelte Reservierung derselben stationierten Truppen über mehrere Generäle oder Verbindungen. Keine globale Sperre aller Generäle als Ersatz für korrekte Reservierung.
- Speichere den eingesetzten General eindeutig an der Mission. Bei Rückkehr genau diesen General freigeben und ihm die vorhandene Belohnung zuweisen.
- Die bisherige Erstaufklärungsbelohnung je Kommandant/NPC darf durch Wechsel des Generals nicht erneut erschlichen werden. Den vorhandenen Berechtigungsumfang erhalten.
- Umbenennen verändert weder Missionen noch historische Berichte. Zeige in bereits erstellten Berichten den damals gespeicherten Namen, soweit vorhanden; IDs nicht nach Namen auflösen.
- Laufende Einsätze behalten ihre beim Start geltenden relevanten Werte. Neue Fortschritte oder spätere Skills dürfen deren Dauer oder Kapazität nicht rückwirkend verändern.
- Ungültige, fremde, nicht existierende oder bereits gebundene General-IDs ohne Buchung/Reservierung ablehnen.

## F. WebSocket, Konsistenz und Speicherung

- Verwende den zentralen React-Clientzustand und bestehenden WebSocket-Transport. Keine neue Verbindung je General oder Modal, kein HTTP-Spielpolling.
- Ergänze benannte Nachrichten für die tatsächlich neuen Vorgänge entsprechend dem bestehenden versionierten Protokoll; vor Nutzung vorhandene Nachrichten prüfen. Client sendet Wünsche und IDs, keine verbindlichen Punkte, Kosten, Boni oder Besitzer.
- Der Server erzwingt die deaktivierte Skillfunktion unabhängig von der Oberfläche. Testregeln nur in isolierten Tests oder ausdrücklich separater lokaler Testwelt injizieren, niemals per unberechtigtem Clientparameter aktivieren.
- Besitz und Sitzung bei jedem Befehl prüfen; private Daten anderer Kommandanten weder in Listen, Berichten noch Fehlern übertragen.
- Speichere akzeptierte Änderungen mit Deduplizierungsnachweis konsistent vor Erfolgsbestätigung. JSON-Persistenz und bestehenden seriellen Schreibablauf beibehalten.
- Gleiche requestId mit gleichem Inhalt darf keine zweite Wirkung haben; gleicher Schlüssel mit anderem Inhalt wird abgewiesen.
- Skillvorschau/Bestätigung für den späteren aktiven Modus an Generalversion und Regelversion binden. Parallel geänderte XP oder Verteilungen werden serverseitig neu geprüft; keine Teilbuchung bei Konflikten.
- Reconnect und Kontowechsel dürfen keine alten Entwürfe für einen anderen Besitzer übernehmen. Verspätete Antworten eindeutig der Sitzung/Anfrage zuordnen.

## G. Abnahme und gezielte Tests

Führe vorhandene Tests und Frontend-Build aus. Ergänze gezielte Prüfungen für:

1. Verlustfreie Migration mit vorhandenem General und laufendem Hin-/Rückmarsch; mehrfaches Laden ohne zusätzliche Generäle.
2. Mehrere Generäle mit getrenntem Fortschritt, gleicher Namenswahl und stabilen IDs.
3. Namensvalidierung, Unicode, sichere Darstellung, fremde IDs, doppelte Nachrichten und konkurrierende Änderungen.
4. Auswahl verschiedener Generäle, gemeinsame Truppenverfügbarkeit, keine doppelte Reservierung, Rückgabe an den korrekten General.
5. Erstaufklärungsbelohnung weiterhin je Kommandant/NPC, auch beim Wechsel des Generals.
6. Skillberechnung mit isolierten Testregeln: steigende Kosten, Rest-XP, Grenzen, unveränderte Gesamt-XP/Level sowie konsistente Punktverteilung.
7. Abbrechen eines Entwurfs ohne Mutation, keine kostenlose Rücksetzung gespeicherter Punkte und keine doppelte Umrechnung bei Parallelität oder Neustart.
8. Skillaktionen bleiben in der regulären Konfiguration auch bei direkt gesendeten WebSocket-Befehlen deaktiviert.
9. Speicherfehler, verlorene Erfolgsantwort und erneute Anfrage ohne doppelten Fortschritt.
10. Zwei Konten: private General-/Skilldaten und aktive Einsätze strikt getrennt.
11. Regression für Stadt/Militär, Lagerhaus/Abriss, Ausbildung, Karte und bestehenden React-Verbindungsablauf.

Browserprüfung auf Desktop und Mobilansicht: Generalübersicht → Name ändern → Modal abbrechen/speichern → General für Aufklärung wählen → Rückkehr → erneuter Login. Mehrfachbesitz und Skillentwurf zusätzlich in isolierter Testwelt prüfen. Screenshots liefern und Testwelt klar von aktivem Produktumfang unterscheiden.

## H. Lieferung und anschließende Entscheidungen

- Liefere nachvollziehbare Commits und einen Pull Request, nicht selbstständig mergen oder deployen.
- Aktualisiere README, docs/PROJECT.md und Protokoll-/Speicherdokumentation. Trenne klar: aktive Generalverwaltung, geprüfte Skillgrundlage und noch nicht aktivierte Spielregeln.
- Dokumentiere Migration, Testergebnisse, Einschränkungen und den weiterhin einmaligen Startgeneral. Nicht ausgeführte Prüfungen ausdrücklich benennen.
- Lege für den folgenden Planungsdialog einen kurzen Vorschlag für eine steigende XP-Kostenkurve mit Rechenbeispielen, automatische gegenüber manueller Umrechnung und Wirkungen von Führung/Angriff/Verteidigung vor. Das ist ein Vorschlag, kein stillschweigender produktiver Regelwechsel.
- Spätere Rekrutierung und zivile Rollen bleiben offen. Keine Bonusaktivierung allein deshalb, weil eine Testfunktion existiert.
- Anschließend folgt der eigene NPC-Farmauftrag: tatsächliche Garnison, Kampf/Verluste, typabhängige Traglast, gemeinsam begrenzte Vorräte, Rückkehr mit Nahrung, Regeneration, General-XP und Kampf-/Niederlagenpunkte. Vor diesem Auftrag werden Kampf- und Bonusregeln festgelegt.
- Nahrungsunterhalt mit oder unmittelbar nach dem Farmkreislauf nach Festlegung von Verbrauch und Mangelregeln. Öl/LKWs, Forschung, Bürgermeister/Forschungsgeneral, PvP und Föderation bleiben gemäß Projektplan spätere Etappen.
