# Codex-Zwischenauftrag 18a: UI-/UX-Refactoring vor Auftrag 19

## Auftrag

Überarbeite die gesamte bestehende Bedienung so, dass Aktionen dort erreichbar sind, wo der Spieler das zugehörige Objekt sieht. Verkürze unnötige Auswahl-, Sidebar-, Prüf- und Dialogschritte.

Der Nutzer hat Auftrag 18 als fertig bestätigt. Vor Auftrag 19 soll dieses Refactoring vollständig umgesetzt werden. Auftrag 19 und neue Spielmechaniken bleiben zurückgestellt.

Verbindliches Konzept und statischer Audit: [docs/UX_REFACTOR_18A.md](docs/UX_REFACTOR_18A.md).

Lies außerdem AGENTS.md, README.md, docs/PROJECT.md sowie die bestehenden UI-/Logistik-/Forschungs-/Aufgaben-/Karten-Prüfbelege. Das Konzept von Auftrag 16 bleibt historische Grundlage; dessen Pflicht zur Bedienung im rechten Aktionenpanel wird durch 18a ausdrücklich ersetzt.

Gelesener Ausgangspunkt: main af290a51bd27486ca436aa01bd878f1f85713cfe, Auftrag 18 integriert, Spielerschema 18 / Weltschema 4. Der Planungschat hat Quellcode und Dokumentation geprüft, keine neuen Browser- oder Laufzeittests ausgeführt. Prüfe den tatsächlichen Arbeitsstand und erhalte zwischenzeitliche Änderungen. Der vorherige Auftrag 18 bleibt im [Git-Verlauf](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/CODEX_PROMPT.md) erhalten.

Falls der Repository-Abruf in deiner Umgebung scheitert, behaupte keinen erfolgreichen Fetch. Nutze den verfügbaren lokalen Stand, sofern die benötigte Implementierung vorhanden ist, und dokumentiere die Einschränkung. Fehlende Fachfunktionen nicht durch UI-Platzhalter vortäuschen.

## 1. Zuerst alle Aktionen erfassen

Vor dem Umbau bestehende Oberfläche tatsächlich starten und die im Konzept enthaltene Aktionsliste vervollständigen. Nutze isolierte Testspieler/-welten, keine echten Spieleraktionen.

Erfasse für jede Aktion:
- Einstieg und Objekt-/Stadtkontext;
- Desktop- und Mobilweg;
- Auswahl-, Menü-, Dialog- und Bestätigungsschritte;
- notwendige Eingaben und Scroll-/Bereichswechsel getrennt;
- heutige Sperren und Rückmeldungen;
- neuen Einstieg;
- späteren Prüfbeleg.

Abdecken:
Anmeldung/Registrierung/Abmeldung, Stadtwechsel, Ressourcendetails, alle zivilen/militärischen Gebäudeaktionen, Ausbildung, Queues, Forschung und Forschungsleitung, Generäle/Rekrutierung/Name/Rollen/XP/Skills, sämtliche Karten- und Feldaktionen, Transporte/Verlegung, Aufgaben/Belohnungen/Einführung, Versorgungshilfe, alle Aktivitäten, Postbox/Berichte/Nachrichten sowie Verbindungs- und Fehlerzustände.

Gleiche die sichtbaren Aktionen mit den bestehenden Serverbefehlen ab. Keine bisherige Funktion beim Umbau verlieren. Aus Quellcode abgeleitete Klickzahlen sind keine Browsermessung; dokumentiere diese Unterscheidung.

## 2. Neuer Spielrahmen

Erhalte die sieben Hauptbereiche:
Stadt, Weltkarte, Militär, Logistik, Generäle, Forschung, Postbox.

Unter Stadt bleiben Stadtansicht, Alle Städte und Aufgaben.

- Kompakter Stadtkopf mit aktueller Stadt, Stadtwechsel, Ressourcen und wichtigen Warnungen.
- Hauptaktionen direkt auf Objektkarten oder im zugehörigen Formular.
- Das rechte Panel wird optionaler Status-/Aktivitätsbereich; keine exklusive Heimat von Bau-, Forschungs-, Rekrutierungs- oder Transportaktionen.
- Auf Mobilgeräten kein allgemeiner „Aktionen“-Dialog als zusätzlicher Pflichtschritt.
- Navigation und fachliche Inhalte klar trennen; kein neues Großmenü.
- Bestehende Illustrationen, Porträts und militärische Farbwelt erhalten; Abstände, Kontrast und Gewichtung vereinheitlichen.
- Keine pauschale Forderung „alles ohne Scrollen“. Lange Inhalte dürfen scrollen; eine Aktion darf keinen Ausflug in eine zweite Scrollfläche verlangen.

## 3. Gebäude direkt bedienen

Ersetze reine Auswahlkacheln durch Karten mit getrennten echten Buttons. Keine verschachtelten Buttons.

Produktionsgebäude/Lagerhaus:
- Name, Bild, aktuelle Stufe.
- Nächste Stufe mit Kosten, Dauer und wesentlichem Nutzen.
- Direkt sichtbarer Button „Ausbauen · Stufe X“.
- Details optional, seltene Aktionen unter „Mehr“.

Universität:
- „Forschen“ direkt auf Kachel.
- Richtige Stadt und konkrete Universität im Forschungsformular übernehmen.
- „Ausbauen“ weiterhin direkt erreichbar.

Kaserne/Fahrzeugfabrik:
- „Ausbilden“ bzw. „LKWs herstellen“ direkt.
- „Ausbauen“ und „Mehr“ mit Abriss.
- Queuebelegung und aktiver Auftrag direkt sichtbar.

Freier Bauplatz:
- „Bauen“ → kompakter Katalog für genau diesen Platz.
- Bauart, Kosten, Dauer, fehlende Voraussetzung und konkreter Ressourcenfehlbetrag sichtbar.
- Ein bepreister „Bauen“-Button pro Angebot.
- Zivile und militärische Bauplätze strikt getrennt lassen.

Ein verfügbarer Ausbau startet mit einem Klick auf den Kachelbutton, wenn das aktuelle Angebot bereits sichtbar ist. Keine zusätzliche allgemeine Bestätigung einführen.

Bei laufendem Auftrag, fehlenden Ressourcen, Maximalstufe oder anderer Sperre den konkreten Grund zeigen. Vorhandene Regeln nicht lockern.

Abriss:
„Mehr → Abreißen“ → vorhandene serverseitige Vorschau → eine explizite endgültige Bestätigung. Rückerstattung und Folgen für Lager, Produktion, Punkte und Stadt vor Bestätigung zeigen. Keine neuen Abbruch-/Beschleunigungsfunktionen.

## 4. Zusammenhängende Formulare und automatische Vorschauen

Bei Ausbildung, Forschung, Rekrutierung, XP-Kauf/-Verteilung, Einsätzen, Gründung und Transporten manuelle reine „Prüfen“-Klicks durch automatische vorhandene Servervorschauen ersetzen, wo diese Verträge vorhanden sind.

Vorschau anfordern:
- beim Öffnen mit gültigen Eingaben;
- nach relevanten Eingabeänderungen gebündelt;
- erneut bei fachlich relevanter Zustands-/Versionsänderung.

Nicht bei jedem Tick oder jedem unvollständigen Tastendruck unbegrenzt anfragen. Keine zweite WebSocket-Verbindung und keine neuen HTTP-Spielabfragen.

Jede Vorschau gehört zu genau einem Kontext aus Spieler, Stadt, Objekt/Ziel, Eingaben und relevanten Versionen. Späte Antwort für Entwurf A darf Entwurf B nicht freischalten. Bei Schließen, Ziel-/Stadtwechsel und Verbindungswechsel veraltete Ergebnisse verwerfen.

Zustände sichtbar machen:
unvollständig, wird berechnet, gültig, ungültig, veraltet, Verbindung fehlt.

Kosten, Dauer, betroffene Stadt und wesentliche Folgen vor dem finalen Button im selben Formular zeigen. Noch nicht autoritativ berechnete Werte klar als vorläufig kennzeichnen.

Start bleibt bis zur passenden Vorschau deaktiviert. Die Mutation wird ausschließlich bewusst durch „Ausbilden“, „Forschung starten“, „Lieferung starten“ usw. ausgelöst.

Materiell geänderte Kosten/Werte nicht unsichtbar neu akzeptieren und direkt starten. Bei Konflikt den Entwurf erhalten, aktualisierte Werte zeigen und eine neue bewusste Auslösung verlangen. Bestehende Preview-/Start-Versionierung nicht entfernen.

Finale Buttons befinden sich am Formular, bei langen Formularen in einer gut erreichbaren Zusammenfassung/Fußleiste. Kein Transportbutton im entfernten Sidebar-Portal.

## 5. Ausbildung und Forschung

Ausbildung:
- Einstieg von konkreter Kaserne/Fabrik und aus passender Truppenkarte.
- Gebäude und Einheit übernehmen; bei mehreren möglichen Gebäuden Auswahl im selben Formular.
- Menge direkt eingeben, sinnvolle Mengenhilfen anbieten.
- Preis, Dauer, Warteschlange und Versorgungsfolge anzeigen.
- Automatische Vorschau, danach ein Startbutton.
- Fehlende Forschung, volle Queue und Hungerpause verständlich begründen.
- Stationiert/unterwegs/in Ausbildung im Militär-Hauptbereich zeigen.

Forschung:
- Jede Technologie besitzt einen direkten „Forschen“-Einstieg.
- Nächster Nutzen, Preis, Dauer/fehlende Universität und wichtigste Sperre ohne Aufklappen erkennbar.
- Langbeschreibung und vollständige Voraussetzungen dürfen aufklappbar bleiben.
- Planung übernimmt Technologie, zahlende Stadt und passende explizite Universität.
- Forschungsort und Leitung im Hauptbereich bzw. derselben Planungsansicht.
- Keine getrennte Kette „Technologie auswählen → Sidebar → Prüfen → Dialog“.
- Eine spielerweite Forschung, vorhandene Rollenbindung und eingefrorene Aufträge unverändert erhalten.

## 6. Generäle

„Meine Generäle“ und „Rekrutieren“ als sichtbare Reiter im General-Hauptbereich.

General-Karten:
Standort, Rolle, wichtige Werte, freie Skillpunkte; kompakte Aktionen „Entwickeln“ und „Rolle ändern“, weitere Aktionen im Detail.

Gemeinsames Generaldetail:
- Übersicht mit Umbenennen direkt neben dem Namen;
- Entwicklung mit XP-Kauf und Verteilung;
- Rolle/Standort mit Bürgermeister, Forschungsleitung und Einstieg in Verlegung.

Keine doppelte Verwaltung für dieselbe Funktion. Vom Einstieg aus direkt den passenden Abschnitt öffnen.

XP-Kauf und Skillverteilung bleiben getrennte Serveraktionen. Automatische Vorschauen und direkte Zahleneingabe zusätzlich zu Plus/Minus verkürzen die Bedienung. Irreversible Verteilung deutlich beschriften.

Keine automatische Umwandlung fehlender XP und keine vorgetäuschte atomare Kombination aus Kauf und Verteilung. Bei Teilerfolg bereits gekaufte freie Skillpunkte sichtbar erhalten.

Rollen:
- Betroffene Stadt und vorhandene Besetzung vor Änderung zeigen.
- Standort, Einsatzbindung und Forschungssperren unverändert prüfen.
- Einen anderen Amtsinhaber nicht beiläufig ohne klare Darstellung ersetzen.
- Wirkung anhand des korrekten Stadt-/Regelkontexts zeigen; keine fest codierten Bürgermeisterwerte oder falschen Erträge einer anderen Stadt.

Rekrutierung:
Kandidat → Preis/Name/Profil/Folge für Bewerberpool → ausdrückliche Verpflichtung. Automatische Vorschau. Danach lokale Erfolgsmeldung mit freiwilligem „General öffnen“, kein erzwungener weiterer Dialog.

## 7. Weltkarte und Einsätze

Die bestehende 2,5D-/isometrische Karte, Projektion, Kachelgrößen, Weltkoordinaten, Entfernungen, Sichtbarkeit und Windrose erhalten.

Feld-/Stadtauswahl zeigt sofort eine kompakte zugehörige Aktionskarte:
- Desktop am Kartenbereich;
- mobil kleines nicht blockierendes Sheet;
- kein zusätzlicher „Feldaktionen“-Öffnungsklick;
- Windrose bleibt zugänglich, Auswahl verändert weder Kamera noch Maßstab.

Nur passende Aktionen:
- NPC: Aufklären, Angriff planen.
- Freies Feld: Aufklären, Erobern, bei gültigem Anspruch Gründen.
- Eigene Stadt: Öffnen, Lieferung planen, zulässige Verlegung planen.
- Fremde Spielerstadt: vorhandene Lieferung oder Nachricht vorbereiten; kein PvP.

Formulare übernehmen Ziel und gültigen Kontext. Quelle bleibt sichtbar. General-, Einheiten- und Ölregeln unverändert.

Reisedauer, Öl, Kapazität und wesentliche Risiken vor Start. Erweiterte freiwillige Fracht/Verzögerung dürfen einklappen; gesetzte Werte bleiben in der Zusammenfassung erkennbar.

Alte Aufklärung ist keine aktuelle Garantie. Neue Planung aus Bericht verwendet frische Angebote und echte aktuelle Verfügbarkeit.

Bezeichnung „Aufklärungsflugzeuge“ beim Späherbedarf korrigieren, ohne neue Einheiten einzuführen.

## 8. Logistik und Versorgungshilfe

Ein zusammenhängendes Formular:
Quelle/Ziel → Einheiten/Generäle/Ladung → automatische Vorschau → Start.

Lieferung und dauerhafte Verlegung bleiben getrennt, Rückkehr bzw. dauerhafter Verbleib klar.

Direkte Einstiege von Stadtübersicht, Karte und General übernehmen bekannte IDs. Fehlende Auswahl direkt im Formular, kein vorgeschalteter Dialog mit „Vorhandenes Formular öffnen“.

Quelle wechseln:
passenden bestätigten Stadtstand laden, alte Vorschau invalidieren, mit ungesendeten Eingaben bewusst umgehen.

Mengenhilfen niemals als Umgehung von Kapazität, Betriebsöl oder Ressourcenprüfung implementieren. „Maximal laden“ nur mit verlässlicher gemeinsamer Berechnung; sonst weglassen. LKWs bleiben ohne Kampfkraft, Lieferungen ohne General möglich.

Versorgungshilfe eindeutig richten:
- „Nahrung hierher liefern“ setzt die betroffene Stadt als Ziel.
- „Truppen von hier verlegen“ setzt die betroffene Stadt als Quelle.
- Zielversorgung bei Verlegung sichtbar.
- „Bürgermeister verwalten“ öffnet die passende Stadtrolle.
- „Bauernhof ausbauen“ fokussiert eine geeignete konkrete Kachel oder bietet eine kleine Auswahl; fehlender Bauernhof führt zum Baukatalog.

Keine Auswahl startet automatisch eine Mission.

## 9. Aufgaben, Aktivitäten, Berichte und Nachrichten

Aufgaben:
- Zielgerichtete Navigation mit Stadt, Gebäude, Technologie, Einheit oder Rolle.
- Fehlende Voraussetzungen benennen und passende Aktion anbieten.
- Kein bloßer allgemeiner Seitensprung, wenn das Objekt bekannt ist.
- Auf Aufgabenansicht Belohnungszielstadt ausdrücklich sichtbar wählen.
- Belohnung vor dem direkten Abholbutton vollständig zeigen.
- Ein Klick genügt bei erfüllter Aufgabe und passendem Lager.
- Kein Sammelabholen; dauerhafte Einmaligkeit und Alles-oder-nichts bleiben unverändert.

Aktivitäten:
- Gemeinsame vollständige Ansicht für Bau, Ausbildung, Forschung und alle Reisen, mit geeigneten Filtern.
- Kompakter Statuszugang statt achter Hauptnavigation.
- „Alle Bewegungen“ umfasst auch Aufklärung, Farmzug und Eroberung.
- „Alle Bauaufträge“ und „Alle Ausbildungen“ öffnen tatsächlich die richtige vollständige Liste.
- Gefilterter Stadt-/Gebäudekontext erkennbar; keine zusätzliche private Information fremder Spieler.
- Vorhandene Daten verwenden, fehlende eigene Details gezielt laden.
- Keine nicht implementierten Abbruchbuttons.

Berichte:
- Ergebnis, Ziel/Städte, Verluste, eingelagerte Beute und Zeitpunkt zuerst.
- Lange Ressourcen-/Öl-/Truppenbilanzen bleiben in Details erhalten.
- Namen statt interner IDs, soweit verlässlich auflösbar.
- „Auf Karte zeigen“ bzw. zulässige neue Planung mit Zielkontext.
- Filter, Listenposition und Rückweg erhalten.

Nachrichten:
- Empfänger aus Stadt-/Antwortkontext übernehmen.
- Eingabe, Senden und Fehler zusammenhalten.
- Echte Nachrichtenentwürfe vor Verlust schützen.
- Nichts automatisch senden; bestehende Grenzen und Lesestatusregeln erhalten.

## 10. Einheitlicher Entwurfs- und Verbindungszustand

Ersetze den pauschalen onInput-dirty-Mechanismus durch fachliche Entwurfszustände.

Suche, Filter, Ansichtstabs und Kartenkoordinaten sind keine ungesendeten Spielbefehle.

Echte Entwürfe:
Nachrichten, Umbenennung, Skillverteilung, Transport-/Einsatzplanung usw.

Bei normaler Navigation Entwurf soweit sinnvoll im Arbeitsspeicher erhalten. Falls Kontextwechsel ihn verwerfen muss, gezielt „Bleiben“ oder „Entwurf verwerfen und wechseln“ anbieten. Keine pauschale Rückfrage ohne Änderungen. Abmeldung/Reload angemessen berücksichtigen.

Stadt, Objekt und Vorschau niemals still neu zuordnen. Bei Rollen-/Generalaktionen den tatsächlichen Standort verwenden. Ein später Snapshot darf Fokus, Formular oder Auswahl nicht zurückspringen lassen.

Rückmeldung:
- Während Versand passenden Button gegen Doppelstart sperren.
- Erfolg erst nach Serverbestätigung, direkt beim Objekt/Formular.
- Fehler lokal und mit Lösungshinweis, Eingaben bewahren.
- Kein globales Blockieren sämtlicher lesender Navigation für irgendeinen Pending-Request.
- Bei Offlinezustand schreibende Aktionen sperren, veralteten Stand markieren, Lesen/Navigation ermöglichen.
- Bei Verbindungsverlust nach Versand „Ergebnis noch unklar“ behandeln; erst abgleichen, nicht blind mit neuer Request-ID erneut senden.
- Bestehende Idempotenz bewahren. Keine neue allgemeine Offline-Auftragswarteschlange.

## 11. Responsive und gemeinsame Bausteine

Bestehende React-Struktur und UI-Komponenten refaktorieren. Fachlogik bleibt in game-core.

Gemeinsam verwenden, wo sinnvoll:
Gebäudekarte, Preis-/Daueranzeige, Sperrgrund, Mengenfeld, Vorschauzustand, Formularzusammenfassung, Statusmeldung und konkrete Navigationsabsicht.

Keine neue Engine, kein Frameworkwechsel, kein großes Designsystem-Projekt.

- Touchziele als Projektziel mindestens 44 × 44 CSS-Pixel.
- Keine Pflichtaktion nur bei Hover.
- Keine verschachtelten Dialoge; Inhalt derselben Ebene wechseln.
- Tastatur, Escape, Fokusführung/-rückgabe und verständliche Buttonnamen.
- Ruhige visuelle Zustände, Text/Symbol zusätzlich zu Farbe.
- 320/390 px, Tablet und Desktop nutzbar, 200 % Zoom berücksichtigen.
- Bildschirmtastatur und untere Navigation dürfen den Startbutton nicht verdecken.
- Menschlich lesbare Dauern; Stundenwerte/Preise einheitlich und aus vorhandenen Daten.
- Verwaiste Portalpfade und widersprüchliche CSS-Regeln gezielt entfernen, nachdem Funktionen migriert sind.

Serverpreise, Ressourcen, Punkte, XP, Regeln, Forschungseffekte, Reisen, Persistenz und Schema 18/4 bleiben unverändert. Falls für korrekte Darstellung ein zusätzliches autorisiertes Projektionsfeld oder eine eng begrenzte Transportkorrektur nötig ist, begründen und separat testen. Keine vollständige Backend-Neuentwicklung.

## 12. Verbindliche UX-Abnahme

Klick/Tap/Enter-Aktivierungen zählen; Eingaben, Serverwartezeiten und Scrollwege getrennt protokollieren. Gleiche Ausgangszustände vor/nach Umbau.

Abnahmeziele bei vorhandenen Voraussetzungen:
- Sichtbares Gebäude ausbauen: 1 Klick, Preis vorher sichtbar.
- Leeres Grundstück bebauen: 2 Klicks, Gebäudewahl enthalten.
- Forschungskarte → bestätigter Start: 2 Klicks bei gewählter gültiger Universität.
- Kaserne/Fabrik → Ausbildungsstart: 2 Klicks plus Mengeneingabe.
- Gültig ausgefüllte Lieferung/Verlegung: 1 Startklick nach automatisch geladener Vorschau.
- Sichtbarer NPC → Einsatzstart: 3 Klicks plus nötige Eingaben: auswählen, planen, starten.
- Abholbare Aufgabe bei sichtbar gewählter Zielstadt: 1 Klick.
- Stadtwechsel ohne Entwurf: höchstens 2 Klicks.
- Keine dieser Hauptaktionen verlangt das Öffnen einer allgemeinen Sidebar.

Notwendige fehlende Voraussetzungen nicht durch weniger Klicks umgehen. Abriss, irreversible Skillverteilung, externe Nachricht und verlustträchtiger Einsatz behalten bewusstes endgültiges Auslösen.

Nachweise:
- Vorher-/Nachher-Matrix für sämtliche erfassten Aktionsgruppen.
- Browserdurchläufe bei 1440×900, 1280×800, 768×1024, 390×844 und 320×844.
- Tastaturdurchlauf und 200 % Zoom.
- Kleine Fenster, lange Namen, volle Lager, fehlende Ressourcen, volle Queues, Hunger, keine freie Rolle, kein passender Stadtstand.
- Automatische Vorschau: schnelle Änderungen, vertauschte Antwortreihenfolge, Ziel-/Stadtwechsel, Schließen und Reconnect.
- Keine doppelten Starts bei Doppelklick und unklarer Bestätigung.
- Entwürfe bleiben erhalten oder werden ausdrücklich verworfen; Suche/Filter lösen keine falsche Warnung aus.
- Fünf Städte und zwei Tabs: Rollen, Zahlung, Aufgabenbelohnung und Transport bleiben an richtiger Stadt.
- Alle Listen vollständig; auch vierter/späterer Eintrag erreichbar, sofern entsprechende Daten existieren.
- Windrose in acht Richtungen, Halten/Loslassen, Fokusverlust, Zentrieren und Feldauswahl funktionieren weiterhin; Kamerastand beim Öffnen/Schließen der Aktionskarte erhalten.
- Jede Aktion aus der Inventarliste hat einen funktionierenden neuen Weg.

Bedeutungsvolle Tests für die neuen Übergänge ergänzen, vorhandene relevante Tests weiterführen. npm test und npm run build ausführen. Keine reinen CSS-Snapshotmassen oder Tests, die nur JSX-Struktur nachschreiben.

## 13. Lieferung

Implementiere alle genannten Wege, nicht nur neue Farben oder Gebäudebuttons.

Aktualisiere README.md und docs/PROJECT.md auf den tatsächlich erreichten Stand. docs/UI_CONCEPT_16.md bleibt als Historie erhalten; neuere Regeln klar verlinken.

Erstelle docs/UX_REFACTOR_18A_VALIDATION.md:
- Ausgangscommit und tatsächlich geprüfte Umgebung;
- vollständiges Aktionsinventar mit neuem Ort;
- reale Vorher-/Nachher-Wege, Klicks und Scrollwechsel;
- repräsentative Desktop-/Mobil-Screenshots;
- tatsächlich ausgeführte Tests mit Ergebnissen;
- nachvollziehbare Grenzen und offene Punkte.

Fehlende Browser-/Netzwerkfähigkeiten offen nennen, keine Prüfung erfinden.

Am Ende kurz zusammenfassen, welche Wege einfacher sind, wie alle bisherigen Funktionen erhalten wurden und welche Prüfungen erfolgten. Auftrag 19 erst anschließend als separaten Auftrag behandeln.
