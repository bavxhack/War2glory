# Codex-Auftrag 12: Offiziersbewerber, steigende Rekrutierungskosten und Forschungsleitung

## Auftrag und Ausgangspunkt

Der Nutzer bestätigt Auftrag 11 am 08.10.2026 als fertig und beauftragt den nächsten Schritt. Ergänzung vom selben Tag: Er bestätigt die Bewerberauswahl mit unterschiedlichen Anfangsstärken und verlangt, dass jeder weitere General teurer wird. Diese Fassung ersetzt die direkte Rekrutierung identischer Generäle aus der vorherigen Fassung von Auftrag 12. Falls deren Umsetzung bereits begonnen hat, bestehende Arbeit gezielt anpassen und Daten erhalten. Implementiere den Ablauf: zusätzliche Generäle rekrutieren, einen General als Forschungsleiter einsetzen und schneller forschen, während andere Generäle Bürgermeister bleiben oder NPC-Einsätze führen.

Der Planungschat erstellt ausschließlich Anweisungen. Du implementierst und prüfst sie in bavxhack/War2glory. Lies AGENTS.md, README.md, docs/PROJECT.md, docs/WEBSOCKET.md und docs/DEVELOPMENT.md. Arbeite vom aktuellen main auf einem eigenen Branch, beachte offene PRs und fremde Änderungen. Liefere einen getesteten Pull Request ohne selbstständiges Merge/Deployment.

Alle neu vorgeschlagenen Preise, Grenzen und Bonusformeln sind vorläufige eigene Prototypwerte für den Review, keine Originalwerte von War2Glory oder einzeln bestätigten Nutzerentscheidungen. Bestehende Skills, Bürgermeister, Forschung, Versorgung, ENV-Regelhistorie, Farmzüge und Bildsprache erhalten.

## 1. Vorprüfung

Der Planungschat hat Quellcode und Dokumentation gelesen, keine Anwendungstests ausgeführt. Prüfe diese Ansatzpunkte gegen den tatsächlichen Arbeitsstand:
- packages/game-core/military.js besitzt ein generals-Array, einen Startgeneral, Skills und Statusprüfungen. Rekrutierung fehlt im gelesenen Stand.
- packages/game-core/supply.js verwendet military.mayorGeneralId und effektive Führung. Bürgermeister sind bereits eine exklusive Rolle.
- packages/game-core/research.js bietet vier Technologien und einen aktiven Auftrag je Stadt; dessen Dauer wird beim Start gespeichert.
- apps/server/storage.js verwendet Spielerschema 9. Migration aus Schema 8 setzt derzeit direkt auf PLAYER_SCHEMA_VERSION. Bei Erhöhung der Version diese Kette ausdrücklich über Schema 9 fortsetzen, damit die neue Migration nicht übersprungen wird.
- finishResearch vergleicht derzeit mit der aktuellen RESEARCH_RULES.version. Beim Ergänzen neuer Regeln alte laufende Forschungsaufträge gezielt weiter unterstützen; weder ablehnen noch rückwirkend beschleunigen.
- effectiveAttributes ist die Quelle für Eigenschaften. Das historische general.leadership nicht mit attributes.leadership plus zugewiesenen Skillpunkten verwechseln.

Bestehende Funktionen erweitern, keine zweite Generalverwaltung oder Forschungszeitrechnung einführen.

## 2. Offiziersbewerber statt identischer Direktrekrutierung

### Zugang und Auswahlzyklus

- Kostenloser Startgeneral bleibt unverändert. Standardlimit weiterhin insgesamt drei Generäle je Spieler/Welt; alle Rollen und Einsätze zählen mit. Das Limit bleibt per ENV einstellbar.
- Eine eigene fertige Kaserne auf einem Militärbauplatz schaltet die Offizierssuche frei. Keine neue Gebäudeart oder Forschung nötig.
- Drei private Bewerber mit Namen, Profil, vollständigen Grundwerten und Rekrutierungsvorschau anbieten. Genau einen davon verpflichten; anschließend verfällt die restliche Auswahl.
- Erste Auswahl bei erstmalig erfüllter Kasernenvoraussetzung serverseitig erzeugen und speichern. Danach standardmäßig alle 24 Stunden neue Auswahl. Sofortige Einstellung nach Bestätigung, aber keine weitere Auswahl bis zum nächsten Wechseltermin.
- Pool speichert stabile ID/Version, Kandidaten-IDs, Generierungsregelsatz, vollständige Werte, createdAt, expiresAt und Zustand offen/verbraucht. Kandidaten sind noch keine Generäle, haben keine Rollen und zählen nicht gegen deren Limit.
- Intervall an gespeicherten Terminen verankern, nicht an Browseraufrufen. Neuladen, mehrere Tabs, Login, Prozessneustart, Abriss/Neubau der Kaserne oder Erreichen des Limits erzeugen keinen Neuwurf und setzen den Termin nicht zurück.
- Auch ohne Kauf läuft das Angebot am festen Termin ab. Ab exakt expiresAt ist der alte Pool ungültig. Ein vor Ablauf gesendeter, aber erst danach serverseitig bearbeiteter Kauf wird abgewiesen.
- Nach langer Abwesenheit höchstens die Auswahl des aktuellen Zeitfensters erzeugen, keine verpassten Pools oder Ansprüche ansammeln. Sprung zum aktuellen Zeitfenster arithmetisch bestimmen, ohne alle verpassten Intervalle zu simulieren.
- Zufall ausschließlich serverseitig; einmal erzeugte Werte vor Auslieferung persistieren. Keine neue Würfelung bei Vorschau/Kauf, ungültigem Befehl oder fehlenden Ressourcen. Testbarer Generator mit injizierter Zufallsquelle, keine Clientseeds.
- Ohne Kaserne oder bei erreichtem Limit nicht rekrutierbar; Wiedererfüllung setzt weder Zyklus noch verbrauchten Pool zurück.
- Keine bezahlte Sofortauffrischung, Kandidatenreservierung, Gratisneuwürfe, Entlassung oder Verkauf.

### Grundfähigkeiten und Entwicklung

Vorläufiges Budget je Bewerber: insgesamt 30 unverteilbare Grundwertpunkte in Führung, Angriff und Verteidigung. Alle Bewerber besitzen dasselbe Budget; Verteilung und Namen variieren. Gleiche Summe garantiert wegen unterschiedlicher Wirkungen keine gleiche Spielstärke; Profile als Balancevorschläge testen.

| Profil | Führung | Angriff | Verteidigung |
| --- | --- | --- | --- |
| Organisator | 20 | 5 | 5 |
| Angreifer | 10 | 15 | 5 |
| Verteidiger | 10 | 5 | 15 |
| Allrounder | 10 | 10 | 10 |

- Pro Pool drei unterschiedliche Profile aus diesen vier wählen. Kleine Variation optional innerhalb dieser klaren Regel: bis zu zwei Punkte insgesamt zwischen Eigenschaften übertragen, Summe immer 30, keine negativen Werte, Abstand jedes Werts zur Vorlage höchstens zwei. Spezialisten behalten damit ihren Schwerpunkt.
- Profile sind Beschreibung, keine Klassen- oder Rollensperre. Jeder General darf jede zulässige Rolle übernehmen und später vorhandene Skillpunkte frei nach Regeln verteilen.
- Grundwerte dauerhaft getrennt von erworbenen Skillpunkten speichern. Grundwertbudget gibt weder freie Skills noch verbrauchte XP und verteuert den ersten gekauften Skillpunkt nicht.
- Eingestellter Kandidat beginnt mit Level 1, Erfahrung 0, leeren Skillzählern und exakt seinen angezeigten Grundwerten. Kein Rücksetzen auf Führung 20/Angriff 0/Verteidigung 0 beim Normalisieren oder Levelaufstieg.
- Server vergibt stabile General-ID und ownerId; Erwerbsnachweis enthält Kandidaten-/Pool-ID, Profil, ursprüngliche Grundwerte, Erwerbszeit, Preisstufe, Regelkennung und bezahlte Kosten.
- Bewerbername darf bei Verpflichtung geändert werden. Bestehende Namensvalidierung verwenden (getrimmt 1–40 Unicode-Codepunkte, keine Steuerzeichen, gleiche Namen erlaubt); danach bestehendes Modal.
- Altgeneräle einschließlich Startgeneral behalten vollständig ihre bisherigen Grundwerte, XP und Skills. Keine automatische Aufwertung auf 30 oder nachträgliche Kosten.
- Rekrutierung gibt keine Kommandantenpunkte/XP. Aufklärungs-Erstzielbelohnung bleibt je Kommandant/NPC, nicht je neuem General.
- Kein laufender General-Unterhalt. Kasernenabriss löscht keine Generäle.

### Jeder weitere General wird teurer

Verwende einen dauerhaft gespeicherten, monotonen Erwerbszähler k für bereits erhaltene Generäle einschließlich Startgeneral. Einmal gesetzte Werte niemals wegen Rollenwechsel, Mission, zukünftigem Verlust/Entlassen oder Migration verringern.

- Für neue Konten k=1. Bei Altbeständen einmalig mindestens die tatsächlich vorhandene Generalzahl übernehmen; größere vorhandene konsistente Erwerbszähler erhalten. Fehlende historische Verluste/Zahlungen nicht erfinden.
- Kosten pro Ressource = Basispreis × k hoch Kostenexponent.
- Vorläufige Standards: Basispreis jeweils 500 Holz und 500 Stein, Exponent 2.
- Zweiter General (k=1): 500 × 1² = 500 Holz und 500 Stein.
- Dritter (k=2): 500 × 2² = 2000 je Ressource.
- Vierter (k=3): 4500 je Ressource; fünfter (k=4): 8000 je Ressource. Diese letzten Beispiele gelten nur bei entsprechend erhöhtem General-Limit.
- Alle Kandidaten desselben Erwerbsschritts kosten gleich viel. Teurer wird die Zahl dauerhaft erworbener Generäle, nicht die Häufigkeit von Vorschauen/Poolwechseln.
- Zähler nur bei erfolgreicher Verpflichtung genau einmal erhöhen. Kein Kostenanstieg nach fehlgeschlagenem Kauf und kein Zurücksetzen beim Poolwechsel.
- Preise ausschließlich positive Ganzzahlen, Exponent mindestens 1: damit wird jeder weitere Erwerb unter unveränderten Betreiberregeln strikt teurer. Sichere Ganzzahlarithmetik und Überlaufprüfung vor jeder Buchung.
- Keine Nahrung oder XP als Rekrutierungskosten. Höhere Preise dürfen Lagerausbau voraussetzen; nicht automatisch an vorhandene Kapazität rabattieren.
- Vorschau zeigt aktuelle Preisstufe, Kosten und nächste Preisstufe; bei erreichtem Limit zusätzlich die Sperre.
- Betreiber können Preise bewusst ändern. Geänderte Regeln machen alte Kaufvorschauen ungültig; bereits gezahlte Kosten bleiben bestehen. Strenge Preissteigerung gilt innerhalb desselben Regelsatzes.

### Anfangswerte müssen tatsächlich wirken

Im bisher gelesenen Code berücksichtigen militärische Boni nur verteilte Skillpunkte. Passe dies gezielt an, damit ein Angreiferprofil tatsächlich einen Anfangsvorteil besitzt:

- Für NEU gestartete Farmzüge effektiver Angriff/Verteidigung = jeweiliger Grundwert plus zugewiesene Skillpunkte.
- Vorläufige militärische Boni weiter 2 Prozent pro effektivem Punkt, maximal 50 Prozent. Führung weiterhin für Bürgermeister/Forschung nach deren Regeln.
- Neue Missionsregelversion einführen, beispielsweise npc-pve-3-general-bases-provisional. Kampfentscheidung, Verluste, Beute und Versorgung ansonsten unverändert.
- Bei Missionsstart effektive Werte und Bonus festschreiben. Alte laufende Missionen und historische Berichte der Versionen 1/2 exakt nach deren Regeln behandeln.
- Neue Missionen vorhandener Generäle verwenden ebenfalls die wirksamen Grundwerte. Falls Altgeneräle von null abweichende Angriffs-/Verteidigungsgrundwerte haben, diesen bewussten Effekt für neue Einsätze dokumentieren; keine alten Ergebnisse umschreiben.
- Obergrenzen für neue Skillzuweisungen berücksichtigen bereits vorhandene Grundwerte: Angriff/Verteidigung maximal effektive 25, Führung nach bestehender wirksamer Grenze. Altbestände oberhalb Grenzen nicht kürzen; nur zusätzliche wirkungslose Zuweisungen verhindern.
- Bereits vorhandene überzählige Zuweisungen nicht entfernen/erstatten; Bonus bleibt begrenzt. Gekaufte freie Punkte können weiterhin auf andere ausbaufähige Eigenschaften verteilt werden.
- Skillkosten richten sich weiter nur nach insgesamt erworbenen Skillpunkten. Grundwerte nicht doppelt als Skillzuweisung oder Bonus einrechnen.
- Beispiel Angreifer mit Grundangriff 15 und zwei zugewiesenen Punkten: effektiver Angriff 17, Bonus 34 Prozent. Ohne Zuweisung bereits 30 Prozent. Neues Skillbudget im Angriff dann höchstens weitere acht Punkte bis 25.

## 3. Exklusive Forschungsleitung

Forschungsleiter ist eine wechselbare Rolle eines normalen Generals, kein permanenter Generaltyp.

- Voraussetzung: mindestens eine eigene fertige Universität. Ein eigener freier General kann als Forschungsleiter eingesetzt werden.
- Genau eine Forschungsleitung je Stadt. Mehrere Universitäten vervielfachen weder Rollen noch parallele Forschung.
- Ohne General bleibt Forschung möglich.
- Frei, Bürgermeister, Forschungsleitung und Einsatz sind gegenseitig ausschließende Zustände. Ein General darf nie zwei Aufgaben gleichzeitig übernehmen.
- Drei unterschiedliche Generäle dürfen gleichzeitig Bürgermeister, Forschungsleiter und Einsatzgeneral sein.
- Forschungsleiter bleibt zwischen Projekten im Amt, bis er abberufen/gewechselt wird. Abschluss macht ihn nicht automatisch frei.
- Ohne aktive Forschung Wechsel/Abberufung erlauben; alten General freigeben und neuen binden in derselben atomaren Änderung.
- Während aktiver Forschung Ernennung, Wechsel und Abberufung ablehnen, auch wenn der Auftrag ohne General begann. Keine nachträgliche Bonusvergabe.
- Forschung bindet beim Start den eingesetzten Leiter an genau diesen Auftrag bis zum tatsächlichen Abschluss.
- Kein stiller Rollenwechsel: Bürgermeister vorher ausdrücklich abberufen, danach als Forschungsleiter einsetzen und umgekehrt. Missionsgebundene Generäle bleiben bis Rückkehr gesperrt.
- Wiederholte identische Zuweisung darf keine zusätzliche Wirkung haben; veraltete Befehle dürfen neuere Rollen nicht überschreiben.
- Eigentum und Bindung aus verbindlichen Referenzen prüfen, nicht nur anhand eines Statusstrings. Rollenreferenzen, Generalstatus und Konfliktversionen konsistent halten.
- Letzte Universität ohne aktive Forschung abreißen: Forschungsleiter in derselben Transaktion abberufen und freigeben. Bei weiterer Universität bleibt die stadtbezogene Rolle erhalten.
- Abrisssperre der Universität mit aktivem Forschungsauftrag erhalten.
- Forschung läuft bei Nahrungsmangel weiter. Keine passive XP-Erzeugung durch Amtszeit oder Forschung, kein zusätzlicher General-Nahrungsverbrauch.
- Umbenennen, XP-Umwandlung und Skillverteilung gemäß bisherigen Regeln weiterhin möglich; Änderungen wirken nicht auf den gespeicherten Bonus eines laufenden Auftrags.

## 4. Forschungsbonus und verbindliche Vorschau

Bestehende Eigenschaft Führung verwenden; kein neues Intelligenz-/Wissenschaftsattribut und keine weitere Skillwährung.

Vorläufige Formel:
- Effektive Führung F = attributes.leadership + skills.allocations.leadership über die zentrale Funktion.
- Bonus B = min(50, max(0, F) × 1) Prozent auf Forschungsgeschwindigkeit; ohne General B = 0.
- Für Zielstufe n und Universitätsstufe U:
  Dauer in Sekunden = max(1, ceil(60 × n / ((1 + 0,1 × (U − 1)) × (1 + B / 100)))).
- Erst nach beiden Faktoren einmal auf ganze Sekunden aufrunden, nicht die bereits gerundete bisherige Dauer erneut teilen.
- Beispiel n=2, U=2, F=20: ceil(120 / (1,1 × 1,2)) = 91 Sekunden; ohne General ceil(120 / 1,1) = 110 Sekunden.
- 50 Prozent höhere Geschwindigkeit bedeutet Division durch 1,5, nicht Halbierung der Zeit. In UI korrekt benennen.
- Bonus verändert ausschließlich Dauer, keine Kosten, Voraussetzungen, Technologieeffekte, Obergrenzen oder Forschungspunkte.
- Angriff/Verteidigung verwenden für neue Farmzüge die in Abschnitt 2 definierte Grundwert-plus-Skill-Regel. Bürgermeisterbonus gilt nur bei tatsächlicher Bürgermeisterrolle.
- Weiter genau ein aktiver Forschungsauftrag je Stadt, keine Warteschlange oder Abbruchfunktion.

Vorschau und Speicherung:
- Server liefert Technologie/Zielstufe, eigene Universität/Stufe, Kosten, Dauer ohne General, General-ID/Name, effektive Führung, Bonus und tatsächliche Dauer.
- Vorschau an Forschungsstand, Universitätsstufe, Rolle einschließlich null, General-ID/Version und wirksame Regelkennung binden.
- Forschungsstart prüft diese Bindung erneut. Geänderte Führung, Rolle, Universität oder Regeln verlangen eine neue Vorschau, statt heimlich andere Zeiten zu buchen.
- Auftrag speichert General-ID, damaligen Namen, Führung, Bonus, Universitätsfaktor, Regelkennung, bezahlte Kosten und feste Start-/Endzeit.
- Skilländerung, Umbenennen, Universitätsausbau und Neustart verändern laufende Dauer nicht. UI trennt Bonus des laufenden Auftrags von künftiger Vorschau.
- Alte Aufträge aus Auftrag 11 behalten exakt Kosten und Endzeit, erhalten keinen Generalbonus und schließen normal ab.

## 5. Neue Balancewerte per ENV

Konfiguration aus Auftrag 11 erweitern, keine verstreuten process.env-Zugriffe, VITE_-Regeln oder globalen veränderlichen Spielregeln.

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| GENERAL_MAX_COUNT | 3 | Maximale Generalzahl je Spieler |
| GENERAL_RECRUIT_WOOD | 500 | Basis-Holzpreis für Basis × Erwerbszähler^Exponent |
| GENERAL_RECRUIT_STONE | 500 | Basis-Steinpreis für Basis × Erwerbszähler^Exponent |
| GENERAL_RECRUIT_COST_EXPONENT | 2 | Exponent der steigenden Preisstaffel |
| GENERAL_CANDIDATE_REFRESH_HOURS | 24 | Dauer eines Bewerberzeitfensters |
| RESEARCH_LEADERSHIP_PERCENT | 1 | Geschwindigkeitsbonus je effektivem Führungspunkt in Prozent |
| RESEARCH_BONUS_CAP_PERCENT | 50 | Obergrenze des Geschwindigkeitsbonus in Prozent |

- Generalzahl als Ganzzahl 1–100, Basispreise als Ganzzahlen 1–1.000.000, Kostenexponent als Ganzzahl 1–3, Bewerberintervall als endliche Dezimalzahl 1/60 bis 8760 Stunden validieren; einmal in ganze Millisekunden umrechnen. Prozent je Führungspunkt 0–10 und Bonusobergrenze 0–100. Sichere Kostenrechnung trotz großer gespeicherter Erwerbszähler prüfen.
- Explizites 0 nur bei Forschungsboni erlauben. Basispreis, Exponent und Bewerberintervall müssen positiv sein, damit Rekrutierungen strikt teurer werden. Fehlende Werte nutzen Standards; leere/ungültige Werte vor Spielstandänderungen abweisen.
- .env.example, natives Laden, Prozessvorrang, Compose-Weitergabe und Dokumentation ergänzen. Nur freigegebene effektive Regeln zum Client übertragen; kein Frontend-Neubuild.
- Spielkern erhält wirksame Konfiguration pro Welt/Server explizit. Stabile Regelkennung für Angebote und Auftragssnapshots verwenden.
- Nach Neustart gelten neue Preise/Boni für neue Kaufvorschauen und neue Forschung. Alte Erwerbskosten, Skillpunkte, Bewerberwerte und laufende Aufträge unverändert erhalten. Ein bestehender Bewerberpool behält seinen gespeicherten Wechseltermin; neuer Intervallwert gilt ab dem ersten Wechsel nach Konfigurationsaktivierung. Den Wechselzeitpunkt/Intervallregelsatz dauerhaft festhalten, damit Offlineberechnung keine vergangenen Intervalle umdeutet.
- Nach Senken des Limits überzählige Altgeneräle behalten und weiter verwenden lassen; nur weitere Rekrutierung sperren.
- Alte Forschungssnapshots müssen ohne alte ENV-Dateien abschließbar bleiben. Unterhalts-/Kartenregeln und deren Historie aus Auftrag 11 erhalten; die neuen Parameter lösen keinen rückwirkenden Wirtschaftswechsel aus.

## 6. WebSocket, Atomarität und Migration

- Privates Spiel ausschließlich über bestehenden WebSocket/Transport. Bewerberpool und Termine im privaten Snapshot; optional general.candidates.sync, außerdem general.recruit.preview, general.recruit, general.researcher und erweiterte research.preview/start. Kein Befehl zum freien Neuwürfeln.
- Client setzt niemals Preise, Grundwerte, XP, Besitzer, neue General-IDs, Dauer oder Bonus.
- Rekrutierungsvorschau an Pool-ID/Version, Kandidaten-ID, Ablaufzeit, Erwerbszähler, Roster-Version und Regeln binden. Kauf prüft aktuellen Besitz/Limit, Kaserne und Ressourcen. Abgelaufene, verbrauchte oder fremde Kandidaten abweisen. Zwei Kandidaten desselben Pools dürfen auch bei parallelen Befehlen nicht beide rekrutiert werden.
- Bestehende requestId-/Payload-Deduplizierung verwenden: gleicher Inhalt wirkt einmal, widersprüchlicher Inhalt wird abgelehnt.
- Zahlung, neuer General mit Kandidatenwerten, Erwerbsnachweis, erhöhter Erwerbszähler, verbrauchter Pool und Deduplizierungsbeleg gemeinsam vor Erfolgsantwort speichern. Schreibfehler darf weder Ressourcenverlust noch Neuwurf, halben Zähleranstieg oder nur im Arbeitsspeicher vorhandenen General hinterlassen. Erfolgreiche Wiederholung zuerst am gespeicherten Beleg erkennen, auch wenn der alte Pool inzwischen abgelaufen ist.
- Rollenwechsel speichert alte/neue Status, Referenz, Konfliktversionen und Wiederholungsbeleg gemeinsam.
- Gleichzeitige Befehle aus mehreren Tabs müssen dieselben verbindlichen Generalbindungen beachten. Relevant sind auch konkurrierende unterschiedliche Befehle, etwa Missionsstart gegen Ernennung.
- Vor Befehlen fällige Wirtschafts-/Forschungs-/Versorgungs- und Missionsereignisse bis Serverzeit abrechnen. Ist Forschung exakt jetzt fertig, wird sie vor Rollenwechsel abgeschlossen.
- Forschungsabschluss lässt General in seiner Forschungsrolle. Missionsrückkehr darf nicht die Rolle eines anderen Generals verändern.
- Chronologische Verarbeitung und Journal weiterverwenden; kein zweiter autoritativer Timer.
- Schema 9 ausdrücklich auf nächste Version migrieren, ältere Ketten vollständig über 9 führen. Journal zuerst wiederherstellen.
- Altgeneräle, Namen, IDs, Rollen, XP, Skills, Missionen, bezahlte Forschung, Ressourcen, Kartenpositionen und Versorgung erhalten. Fehlende Forschungsleitung als null ergänzen, Erwerbszähler konservativ initialisieren, Pool bei erster Berechtigung anlegen; keine neuen Generäle automatisch erzeugen. Auch eventuell bereits implementierte Direktrekrutierungen aus der ersten Fassung von Auftrag 12 verlustfrei übernehmen; Schema nach tatsächlichem Stand wählen.
- Bestände oberhalb Limit erhalten. Inkonsistente Referenzen oder unbekannte Versionen konkret melden, nicht still Daten zurücksetzen.
- Keine privaten General-/Forschungsdaten anderer Spieler auf öffentlicher Karte offenlegen. Namen als Text rendern.

## 7. React-Oberfläche

- Bestehende Generalverwaltung/Modal erweitern. Alle Generäle mit Name, Level, verfügbaren XP/Skillpunkten und Rolle zeigen.
- Rekrutierung zeigt drei Kandidaten mit Profil, Grundwerten, daraus folgenden Boni, Bestand/Limit, Kaserne, Preisstufe, Kosten, Name und Bestätigung. Poolwechsel als Countdown mit Server-Endzeit; verbrauchter Pool zeigt Wartezeit. Grundwerte, zugewiesene Skillpunkte und effektive Werte im Modal getrennt anzeigen. Höhere nächste Kosten erklären; keine versteckten Werte oder Neuwurf-Schaltfläche.
- Nach Kauf neuen General sichtbar auswählen; bestehendes Namens-/Skillmodal verwenden.
- Forschungsansicht zeigt Leiter, Führung, Geschwindigkeit, Einsetzen/Wechseln/Abberufen und Sperre während laufender Forschung.
- Generalmodal und Auswahl für Bürgermeister, Forschung und Einsätze verwenden den gesamten passenden Bestand, nicht generals[0].
- Lokale Skillentwürfe nicht durch Push unbemerkt verwerfen. Bei Konflikt aktuelle Daten und neue bewusste Bestätigung anbieten.
- Laufendes Projekt zeigt gespeicherten Bonus und Bindung; nach Abschluss bleibt Forschungsleiter sichtbar.
- Bestehende Illustrationen erhalten; Desktop und schmale Bildschirme prüfen, Modale per Tastatur und mit korrektem Fokus bedienen.

## 8. Verbindliche Abnahme

Kritische Übergänge mit unabhängigen Erwartungswerten prüfen:

1. Startgeneral bleibt genau einmal erhalten. Zweiter kostet 500/500, dritter 2000/2000; vierter bei Standardlimit gesperrt. Mit erhöhtem Limit vierter 4500/4500, fünfter 8000/8000. Formel unabhängig prüfen: Erwerbszähler 1/2/3/4, Exponent 2. Erfolgreicher Kauf erhöht Zähler einmal, fehlgeschlagener gar nicht.
2. Wiederholung, verlorene Antwort, zwei Tabs mit derselben Vorschau, requestId-Payload-Konflikt und Schreibfehler erzeugen keine Doppelzahlung oder Teilbuchung.
3. Fremde General-/Gebäude-IDs, fehlende Kaserne, ungültige Namen/Werte und manipulierte Preise/XP scheitern ohne Teiländerung.
4. A als Bürgermeister, B als Forschungsleiter, C auf Farmzug erlaubt; doppelte Belegung abgewiesen. Bei gleichzeitigem Ernennen und Missionsstart desselben freien Generals nur eine erfolgreiche Bindung.
5. n=2/U=2/F=20: 91 Sekunden; ohne General: 110. Bonuscap bei Führung 50 oder höher, Bonus 0 und echte effektive Führung statt Legacy-Feld prüfen.
6. Zwischen Vorschau und Start geänderte Rolle, Führung, Universitätsstufe oder Konfiguration erkannt. Während Forschung keine Ernennung/Abberufung, kein Bonus nachträglich.
7. Skilländerung, Umbenennen, Universitätsausbau und Neustart verändern laufende Endzeit nicht; nächste Vorschau darf neue Werte verwenden.
8. Offlineabschluss zum richtigen Zeitpunkt, Leiter bleibt im Amt. Wiederholte Abrechnung erzeugt keine doppelte Forschungsstufe, Punkte oder XP.
9. Direkte Migration ab 9 und ältere Kette über 8 → 9 → neue Version. Laufende research-1-provisional-Aufträge unverändert fertigstellen; erneute Migration ohne doppelte Generäle/Kosten.
10. Letzte Universität ohne aktive Forschung abreißen gibt Leiter frei, andere verbleibende Universität erhält Rolle; aktive Abrisssperre und vorhandene Generäle nach Kasernenabriss bewahrt.
11. ENV: Standards, erlaubte Null-Boni, verbotene Null-Preise/Intervalle, Exponentgrenzen, Überlauf, isolierte Serverkonfigurationen und native/Compose-Weitergabe. Limit senken bewahrt Bestand; geänderte Preise entwerten Kaufvorschauen, Bewerberwerte und laufende Forschung bleiben erhalten. Intervallwechsel respektiert gespeicherten Pooltermin.
12. Bürgermeister-Nahrungsproduktion, Forschungseffekte, Hungerfristen, Punkte, Beute und Erstaufklärungsbelohnung regressionsfrei. Keine neue passive XP-Quelle und kein militärisches Führungslimit.

13. Drei verschiedene Profile, gleiche Grundwertsumme 30, zulässige Variation; Grundwerte unverändert bei Vorschau, Kauf, Umbenennen, Levelaufstieg und Neustart. Skillkosten beginnen ungeachtet Grundwertbudget bei vorhandenem ersten Skillpreis.
14. Poolverbrauch erlaubt genau einen Kauf, auch bei zwei verschiedenen Kandidaten/Request-IDs gleichzeitig. Neuladen, Rekonnektion, mehrere Tabs und Kasernenabriss/-neubau würfeln nicht neu. Fehlgeschlagene Zahlungen verbrauchen keinen Kandidaten.
15. Vor Ablauf alter Pool gültig, exakt am Ablauf ungültig. Viele Offlineintervalle erzeugen nur aktuellen Pool, keine Ansammlung. Dieselbe gespeicherte Auswahl bei wiederholter Abfrage im selben Fenster. Verschiedene Spieler können keine Kandidaten des anderen kaufen.
16. Neue Farmmission mit Grundangriff 15 plus 2 Skills speichert 34 Prozent, ohne Skills 30. Grenze und Verteilung berücksichtigen Grundwerte ohne Doppelzählung; Altgeneräle und überzählige alte Skills erhalten. Version-1/2-Missionen und Berichte bleiben unverändert, Version 3 nutzt neue Grundwerte. XP- und Punktebelohnungen nicht doppelt vergeben.

npm test und npm run build ausführen; betroffene Start-/Containerprüfung gemäß CI durchführen. Manuellen Ablauf dokumentieren: aus zwei aufeinanderfolgenden Bewerberpools je einen General rekrutieren (Testuhr oder temporär verkürztes dokumentiertes Testintervall, keine produktiven Gratisneuwürfe) → A Bürgermeister → B Forschungsleiter → C Farmzug → Forschung starten → Login/Neustart → Forschung endet, B bleibt Leiter → B abberufen → B kann einen Einsatz führen. Tatsächlich ausgeführte Tests und nicht prüfbare Fälle klar unterscheiden.

## 9. Lieferung und nächste Etappen

Liefere Umsetzung, Tests, Migration und aktualisierte README, docs/WEBSOCKET.md, docs/PROJECT.md, docs/DEVELOPMENT.md und .env.example. Im PR Verhalten, provisorische Balance, Datenmigration und Testergebnisse knapp erklären; nachvollziehbare Teilcommits.

Noch nicht Teil dieses Auftrags: zusätzliche Technologien, Forschungs-XP, Respec, Generalentlassung/-tod, Forschungswarteschlange, LKWs, Öl, PvP, Bündnisse oder aktive Matrix-Föderation. Nach dieser Etappe Forschungsfreischaltungen gezielt mit Ölraffinerie, Fahrzeugproduktion und Transport verbinden.
