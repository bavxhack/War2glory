# Codex-Auftrag 12: Weitere Generäle und Forschungsleitung

## Auftrag und Ausgangspunkt

Der Nutzer bestätigt Auftrag 11 am 08.10.2026 als fertig und beauftragt den nächsten Schritt. Implementiere den Ablauf: zusätzliche Generäle rekrutieren, einen General als Forschungsleiter einsetzen und schneller forschen, während andere Generäle Bürgermeister bleiben oder NPC-Einsätze führen.

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

## 2. Rekrutierung zusätzlicher Generäle

Vorläufiger Einstieg:
- Kostenloser Startgeneral unverändert und weiterhin idempotent.
- Standardmäßig insgesamt höchstens drei Generäle je Spieler in dieser Welt. Alle vorhandenen Generäle zählen, unabhängig von Rolle/Einsatz.
- Weitere Rekrutierung benötigt mindestens eine eigene fertige Kaserne auf einem Militärbauplatz. Keine neue Gebäudeart oder Forschungsvoraussetzung.
- Nach serverseitiger Vorschau und bewusster Bestätigung sofort rekrutieren. Keine Warteschlange, zusätzliche Rekrutierungsdauer oder laufende General-Unterhaltskosten.
- Bei k bereits vorhandenen Generälen kostet der nächste k × 500 Holz und k × 500 Stein. Zweiter General: 500/500, dritter: 1000/1000. Keine Nahrung oder XP.
- Beim Bestätigen aktuellen Bestand, Limit, Kaserne, Kosten und Ressourcen erneut prüfen.
- Name im Rekrutierungsdialog; bestehende Validierung verwenden: getrimmt 1–40 Unicode-Codepunkte, keine Steuerzeichen, gleiche Anzeigenamen erlaubt.
- Server vergibt eine eindeutige stabile ID und ownerId. Neue Generäle beginnen frei, Version initial, Erfahrung 0, Level 1, Führung 20, Angriff/Verteidigung 0 und leeren Skillzählern. Vorhandene Normalisierung verwenden.
- Erwerbszeit, Regelkennung und tatsächlich bezahlte Kosten speichern. Keine historischen Erwerbskosten für Altgeneräle erfinden.
- Keine Zufallswerte, kostenlosen Neuwürfe, automatische zweite/dritte Vergabe, Entlassung oder Verkauf.
- Rekrutierung gibt weder Kommandantenpunkte noch General-XP. Bestehende Erfahrungsquellen erhalten; Erstaufklärungsbelohnung je Kommandant/NPC nicht pro neuem General zurücksetzen.
- Kasernenabriss entfernt keine vorhandenen Generäle; er kann nur weitere Rekrutierung verhindern.

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
- Angriff/Verteidigung behalten bestehende Wirkungen. Bürgermeisterbonus gilt nur bei tatsächlicher Bürgermeisterrolle.
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
| GENERAL_RECRUIT_WOOD | 500 | Holzpreis je bereits vorhandenem General |
| GENERAL_RECRUIT_STONE | 500 | Steinpreis je bereits vorhandenem General |
| RESEARCH_LEADERSHIP_PERCENT | 1 | Geschwindigkeitsbonus je effektivem Führungspunkt in Prozent |
| RESEARCH_BONUS_CAP_PERCENT | 50 | Obergrenze des Geschwindigkeitsbonus in Prozent |

- Generalzahl als Ganzzahl 1–100, Preise als Ganzzahlen 0–1.000.000, Prozent je Punkt als endliche Dezimalzahl 0–10 und Bonusobergrenze 0–100 validieren.
- Explizites 0 für Preise/Bonus erlauben, fehlende Werte nutzen Standards. Leere oder ungültige Werte vor Spielstandänderungen abweisen.
- .env.example, natives Laden, Prozessvorrang, Compose-Weitergabe und Dokumentation ergänzen. Nur freigegebene effektive Regeln zum Client übertragen; kein Frontend-Neubuild.
- Spielkern erhält wirksame Konfiguration pro Welt/Server explizit. Stabile Regelkennung für Angebote und Auftragssnapshots verwenden.
- Nach Neustart gelten neue Werte für neue Rekrutierungen und neue Forschung. Alte Erwerbskosten, Skillpunkte und laufende Aufträge unverändert erhalten.
- Nach Senken des Limits überzählige Altgeneräle behalten und weiter verwenden lassen; nur weitere Rekrutierung sperren.
- Alte Forschungssnapshots müssen ohne alte ENV-Dateien abschließbar bleiben. Unterhalts-/Kartenregeln und deren Historie aus Auftrag 11 erhalten; die neuen Parameter lösen keinen rückwirkenden Wirtschaftswechsel aus.

## 6. WebSocket, Atomarität und Migration

- Privates Spiel ausschließlich über bestehenden WebSocket/Transport. Beispielsweise general.recruit.preview, general.recruit, general.researcher und erweiterte research.preview/start; bestehende Namenskonventionen beachten.
- Client setzt niemals Preise, Grundwerte, XP, Besitzer, neue General-IDs, Dauer oder Bonus.
- Rekrutierungsvorschau an erwarteten Generalbestand bzw. Roster-Version und Regeln binden. Zwei identische Vorschauen dürfen nicht unbemerkt erst den zweiten und anschließend den teureren dritten General kaufen.
- Bestehende requestId-/Payload-Deduplizierung verwenden: gleicher Inhalt wirkt einmal, widersprüchlicher Inhalt wird abgelehnt.
- Zahlung, neuer General, Erwerbsnachweis und Deduplizierungsbeleg gemeinsam vor Erfolgsantwort speichern. Schreibfehler darf weder Ressourcenverlust noch nur im Arbeitsspeicher vorhandenen General hinterlassen.
- Rollenwechsel speichert alte/neue Status, Referenz, Konfliktversionen und Wiederholungsbeleg gemeinsam.
- Gleichzeitige Befehle aus mehreren Tabs müssen dieselben verbindlichen Generalbindungen beachten. Relevant sind auch konkurrierende unterschiedliche Befehle, etwa Missionsstart gegen Ernennung.
- Vor Befehlen fällige Wirtschafts-/Forschungs-/Versorgungs- und Missionsereignisse bis Serverzeit abrechnen. Ist Forschung exakt jetzt fertig, wird sie vor Rollenwechsel abgeschlossen.
- Forschungsabschluss lässt General in seiner Forschungsrolle. Missionsrückkehr darf nicht die Rolle eines anderen Generals verändern.
- Chronologische Verarbeitung und Journal weiterverwenden; kein zweiter autoritativer Timer.
- Schema 9 ausdrücklich auf nächste Version migrieren, ältere Ketten vollständig über 9 führen. Journal zuerst wiederherstellen.
- Altgeneräle, Namen, IDs, Rollen, XP, Skills, Missionen, bezahlte Forschung, Ressourcen, Kartenpositionen und Versorgung erhalten. Fehlende Forschungsleitung als null ergänzen, keine neuen Generäle automatisch erzeugen.
- Bestände oberhalb Limit erhalten. Inkonsistente Referenzen oder unbekannte Versionen konkret melden, nicht still Daten zurücksetzen.
- Keine privaten General-/Forschungsdaten anderer Spieler auf öffentlicher Karte offenlegen. Namen als Text rendern.

## 7. React-Oberfläche

- Bestehende Generalverwaltung/Modal erweitern. Alle Generäle mit Name, Level, verfügbaren XP/Skillpunkten und Rolle zeigen.
- Rekrutierung zeigt Bestand/Limit, Kaserne, Kosten, Name, Vorschau und Bestätigung; verständliche Sperrgründe.
- Nach Kauf neuen General sichtbar auswählen; bestehendes Namens-/Skillmodal verwenden.
- Forschungsansicht zeigt Leiter, Führung, Geschwindigkeit, Einsetzen/Wechseln/Abberufen und Sperre während laufender Forschung.
- Generalmodal und Auswahl für Bürgermeister, Forschung und Einsätze verwenden den gesamten passenden Bestand, nicht generals[0].
- Lokale Skillentwürfe nicht durch Push unbemerkt verwerfen. Bei Konflikt aktuelle Daten und neue bewusste Bestätigung anbieten.
- Laufendes Projekt zeigt gespeicherten Bonus und Bindung; nach Abschluss bleibt Forschungsleiter sichtbar.
- Bestehende Illustrationen erhalten; Desktop und schmale Bildschirme prüfen, Modale per Tastatur und mit korrektem Fokus bedienen.

## 8. Verbindliche Abnahme

Kritische Übergänge mit unabhängigen Erwartungswerten prüfen:

1. Startgeneral bleibt genau einmal erhalten. Zweiter kostet standardmäßig 500/500, dritter 1000/1000, vierter wird ohne Abbuchung abgelehnt. IDs bleiben nach Neustart gleich.
2. Wiederholung, verlorene Antwort, zwei Tabs mit derselben Vorschau, requestId-Payload-Konflikt und Schreibfehler erzeugen keine Doppelzahlung oder Teilbuchung.
3. Fremde General-/Gebäude-IDs, fehlende Kaserne, ungültige Namen/Werte und manipulierte Preise/XP scheitern ohne Teiländerung.
4. A als Bürgermeister, B als Forschungsleiter, C auf Farmzug erlaubt; doppelte Belegung abgewiesen. Bei gleichzeitigem Ernennen und Missionsstart desselben freien Generals nur eine erfolgreiche Bindung.
5. n=2/U=2/F=20: 91 Sekunden; ohne General: 110. Bonuscap bei Führung 50 oder höher, Bonus 0 und echte effektive Führung statt Legacy-Feld prüfen.
6. Zwischen Vorschau und Start geänderte Rolle, Führung, Universitätsstufe oder Konfiguration erkannt. Während Forschung keine Ernennung/Abberufung, kein Bonus nachträglich.
7. Skilländerung, Umbenennen, Universitätsausbau und Neustart verändern laufende Endzeit nicht; nächste Vorschau darf neue Werte verwenden.
8. Offlineabschluss zum richtigen Zeitpunkt, Leiter bleibt im Amt. Wiederholte Abrechnung erzeugt keine doppelte Forschungsstufe, Punkte oder XP.
9. Direkte Migration ab 9 und ältere Kette über 8 → 9 → neue Version. Laufende research-1-provisional-Aufträge unverändert fertigstellen; erneute Migration ohne doppelte Generäle/Kosten.
10. Letzte Universität ohne aktive Forschung abreißen gibt Leiter frei, andere verbleibende Universität erhält Rolle; aktive Abrisssperre und vorhandene Generäle nach Kasernenabriss bewahrt.
11. ENV: Standards, explizite Nullen, ungültige Werte, getrennte Serverkonfigurationen, native Starts und tatsächliche Compose-Weitergabe. Niedrigeres Limit bewahrt Bestand, Bonuswechsel bewahrt laufende Aufträge.
12. Bürgermeister-Nahrungsproduktion, Forschungseffekte, Hungerfristen, Punkte, Beute und Erstaufklärungsbelohnung regressionsfrei. Keine neue passive XP-Quelle und kein militärisches Führungslimit.

npm test und npm run build ausführen; betroffene Start-/Containerprüfung gemäß CI durchführen. Manuellen Ablauf dokumentieren: zwei Generäle rekrutieren → A Bürgermeister → B Forschungsleiter → C Farmzug → Forschung starten → Login/Neustart → Forschung endet, B bleibt Leiter → B abberufen → B kann einen Einsatz führen. Tatsächlich ausgeführte Tests und nicht prüfbare Fälle klar unterscheiden.

## 9. Lieferung und nächste Etappen

Liefere Umsetzung, Tests, Migration und aktualisierte README, docs/WEBSOCKET.md, docs/PROJECT.md, docs/DEVELOPMENT.md und .env.example. Im PR Verhalten, provisorische Balance, Datenmigration und Testergebnisse knapp erklären; nachvollziehbare Teilcommits.

Noch nicht Teil dieses Auftrags: zusätzliche Technologien, Forschungs-XP, Respec, Generalentlassung/-tod, Forschungswarteschlange, LKWs, Öl, PvP, Bündnisse oder aktive Matrix-Föderation. Nach dieser Etappe Forschungsfreischaltungen gezielt mit Ölraffinerie, Fahrzeugproduktion und Transport verbinden.
