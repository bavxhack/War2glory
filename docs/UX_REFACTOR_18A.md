# UX-Audit und Konzept: Zwischenauftrag 18a

Stand: 28.10.2026. Ausgangspunkt: [main af290a5](https://github.com/bavxhack/War2glory/tree/af290a51bd27486ca436aa01bd878f1f85713cfe). Auftrag 18 ist integriert und vom Nutzer als abgeschlossen bestätigt. **18a ist eine Spezifikation, noch keine implementierte Oberfläche.** Auftrag 19 wird erst nach diesem Zwischenauftrag fortgesetzt.

## Prüfgrundlage und Grenzen

Der Planungschat hat sämtliche React-Ansichten unter apps/client/src, den WebSocket-Transport, relevante Styles, die serverseitigen Ereigniszweige sowie die Dokumentation zu Auftrag 16 und 18 gelesen. Das ist ein statischer Audit der Aktionswege; keine neu ausgeführte Browserprüfung und kein Nutzertest. Die vorhandenen Browsernachweise in TASKS_SUPPLY_VALIDATION.md stammen aus Auftrag 18. Sie belegen keine Umsetzung von 18a.

Quellen im geprüften Stand:
- [App.jsx](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/App.jsx): Navigation, Stadtkontext, Portale, Dialoge, globaler dirty-Zustand und Versorgungshilfe.
- [CityView.jsx](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/CityView.jsx), [MilitaryView.jsx](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/MilitaryView.jsx): Auswahlkacheln und getrennte Aktionen.
- [ResearchView.jsx](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/ResearchView.jsx), [LogisticsView.jsx](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/LogisticsView.jsx): verteilte Formulare, manuelle Vorschau und Bestätigung.
- [WorldView.jsx](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/WorldView.jsx), [IsometricMap.jsx](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/IsometricMap.jsx), [MapCompass.jsx](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/MapCompass.jsx): Feldaktionen und Kamerabedienung.
- [GeneralsView.jsx](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/GeneralsView.jsx), [GeneralDialog.jsx](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/GeneralDialog.jsx), [Recruitment.jsx](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/Recruitment.jsx): Rollen, Entwicklung, Rekrutierung.
- [TasksSupply.jsx](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/TasksSupply.jsx), [SidebarStatus.jsx](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/SidebarStatus.jsx), [Mailbox.jsx](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/Mailbox.jsx): Aufgaben, Versorgung, Aktivitäten, Berichte.
- [transport.js](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/transport.js), [ui.jsx](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/src/ui.jsx), [style.css](https://github.com/bavxhack/War2glory/blob/af290a51bd27486ca436aa01bd878f1f85713cfe/apps/client/style.css): Verbindung, gemeinsame Komponenten, responsive Regeln.

Die folgende Bewertung beschreibt aus dem Code nachvollziehbare Umwege und daraus abgeleitete Designentscheidungen. Klickzahlen sind dort ausdrücklich als abgeleitete Wege oder neue Abnahmeziele gekennzeichnet; keine erfundenen Messwerte.

## Kernbefunde

1. **Auswahl und Aktion sind räumlich getrennt.** Grundstücke sind Auswahlbuttons; Ausbau und Neubau liegen im SidebarActions-Portal. Unter 1280 px ist dafür zusätzlich ein Kontextdialog nötig. Eine Auswahl allein führt den Spieler nicht zur Aktion.
2. **Forschung verlangt eine Auswahl ohne unmittelbaren Nutzen.** „Technologie auswählen“ setzt einen Zustand. „Forschung prüfen“ befindet sich erst im Panel, der Start danach in einem weiteren Dialog. Preis, Dauer und Voraussetzungen sind teilweise hinter Details verborgen.
3. **Logistik trennt Formular und Absenden.** Die eigentliche Seite sagt ausdrücklich, im Aktionenpanel zu prüfen. Mobile Spieler müssen zwischen Formular, Panel und Vorschau wechseln.
4. **Rekrutierung liegt außerhalb des General-Hauptbereichs.** Die Verwaltung zeigt die Generäle, Bewerber erscheinen im Portal. Nach Verpflichtung wird automatisch der Eigenschaftsdialog des neuen Generals geöffnet.
5. **Aufgaben kennen nur allgemeine Seitensprünge.** TasksView übergibt t.action, App navigiert zur Hauptansicht. Das konkrete Gebäude, der Truppentyp oder die Forschung bleibt erneut zu suchen.
6. **„Alle anzeigen“ erfüllt sein Versprechen nicht zuverlässig.** SidebarStatus schneidet Bewegungen und Ausbildung auf drei Einträge ab. „Alle Bewegungen anzeigen“ führt in eine Logistikliste, die Lieferungen und Verlegungen zeigt; „Alle Bauaufträge anzeigen“ öffnet die Stadtansicht. Eine vollständige, gezielt geöffnete Liste ist damit nicht durchgängig vorhanden.
7. **Entwurfsschutz ist zu grob und zugleich lückenhaft.** onInput auf workspace-content setzt global dirty, auch für Suche/Filter. navigate setzt dirty zurück und kann lokale Formularzustände unmounten. Eingaben in portalierten Aktionen werden von diesem DOM-Handler nicht zuverlässig abgedeckt. Generalentwürfe und Nachrichten benötigen eigene Behandlung.
8. **Versorgungshilfe legt eine missverständliche Richtung fest.** App.helpCity behandelt delivery und transfer gleich: Die angeklickte Stadt wird Ziel. Für das Entlasten einer Hungerstadt ist dagegen „Truppen aus dieser Stadt verlegen“ erforderlich.
9. **Rückmeldung liegt oft fern der Aktion.** Globale Meldungen am Seitenende und generisches „Auftrag wurde gespeichert“ erschweren die Zuordnung zu Gebäude, Stadt und Auftrag.
10. **Einige Darstellungstexte passen nicht zum aktuellen Kontext.** NPC-Aufklärung nennt fehlende „Aufklärungsflugzeuge“, obwohl der Auftrag Späher verwendet. Bericht zeigt teils interne originCityId. Gebäudetext leitet Produktion pauschal aus Stufe ab; Generaldialog berechnet Bürgermeistereffekte mit festen Werten und dem ausgewählten Stadt-Supply, auch wenn ein anderer Generalstandort betrachtet wird. Die Darstellung muss vorhandene autoritative Daten nutzen.
11. **Dialoghierarchie kann sich stapeln.** Ressourcen-Dialog enthält Ressourcenbuttons, die weitere Dialoge öffnen; Aktionen im mobilen Kontextdialog öffnen ebenfalls Fachdialoge. Eine einfache Hierarchie ist besser nachvollziehbar.
12. **Viele wenige Sekunden lange und sehr lange Zeitspannen werden nur als Sekunden ausgegeben.** Preise und Folgen konkurrieren mit langen Erklärungen. Wesentliches muss vor dem Start sichtbar bleiben; Detailtexte können aufklappbar bleiben.

## Zielbild

**Objekt → passende Aktion → sichtbares Ergebnis.** Ein Benutzer darf nicht erst herausfinden müssen, in welchem anderen Bildschirmbereich der ausgewählte Gegenstand bedient wird.

Die sieben Hauptbereiche bleiben erhalten: Stadt, Weltkarte, Militär, Logistik, Generäle, Forschung, Postbox. Keine neue Navigationshierarchie und keine zusätzliche Spielmechanik.

- Der Stadtkopf zeigt aktuelle Stadt, Wechsel, Ressourcen und dringende Warnungen.
- Im Hauptbereich liegen Objekte UND ihre Aktionen.
- Ein optionales Statuspanel zeigt laufende Aktivitäten/Versorgung. Keine primäre Aktion ist ausschließlich dort verfügbar. Ein globaler „Aktionen“-Drawer wird überflüssig.
- Sichtbare Buttons verwenden klare Verben: „Ausbauen“, „Ausbilden“, „Liefern“, „Verlegen“, „Forschen“, „Aufklären“, „Angriff planen“.
- Ein kompakter Hauptbutton pro Karte, wenige kontextgerechte Nebenaktionen. Abriss und andere seltene Aktionen unter einem beschrifteten „Mehr“-Menü.
- Bestehende Gebäude-/General-/Forschungsbilder und die militärische Farbwelt weiterverwenden. Ausreichend Kontrast, einheitliche Abstände, ruhige Statusfarben, eindeutige Typografie. Kein neues Grafikpaket nötig.
- Auswahl, Erklärungen und normale Navigation sind keine Bestätigungsdialoge. Folgenreiche Aktionen behalten eine verständliche explizite Auslösung.
- Kein Versprechen, alle Inhalte ohne Scrollen darzustellen. Lange Listen und Erklärungen dürfen scrollen; eine Aktion darf keinen Wechsel in eine zweite Scrollfläche verlangen.

## Vollständige Aktionszuordnung

Die Tabelle definiert den Mindestumfang. Codex ergänzt vor dem Umbau alle im dann aktuellen Repository zusätzlich gefundenen Bedienelemente und ordnet jedem bestehenden Spielbefehl einen erreichbaren Einstieg zu.

| Bereich / Aktion | Heutiger Weg oder Befund | Vorgesehener Einstieg und Ablauf |
| --- | --- | --- |
| Anmelden / Registrieren | Gemeinsames Formular mit zwei Submit-Aktionen, Stadtname immer sichtbar | Klar gewählter Modus, passende Felder/Autofill und eindeutiger Submit; Enter löst die sichtbare Hauptaktion aus |
| Abmelden | Kontobereich bzw. mobiles Menü | Beibehalten; nur echte ungesendete Entwürfe vor Verlust schützen |
| Stadt wechseln | Stadtbutton → Dialog → Stadt | Kompakter Stadtwähler mit aktiver Stadt und Warnstatus; zwei Interaktionen weiterhin akzeptabel, keine zusätzliche Rückfrage ohne Entwurf |
| Ressourcen ansehen | Ressource → Details; mobil möglicher Dialog im Dialog | Ein Ressourcenbereich mit direkt umschaltbaren Detailreitern; kein verschachteltes Modal |
| Freien zivilen Platz bebauen | Kachel wählen → Sidebar suchen → Gebäude bauen | „Bauen“ auf Kachel → lokaler Baukatalog → eindeutig bepreisten Gebäudebutton betätigen |
| Ziviles Gebäude ausbauen | Kachel wählen → Panel → Ausbau | „Ausbauen · Stufe X“ direkt auf Kachel; Kosten, Dauer und wesentlicher Nutzen davor sichtbar |
| Gebäudeinformationen | Auswahl füllt Panel | Eigener „Details“-Einstieg; optionale Details nötig für volle Aufschlüsselung, nicht für Routineausbau |
| Gebäude abreißen | Auswahl → Panel → Vorschau → Bestätigen | „Mehr → Abreißen“ am Gebäude → eine serverseitige Folgenvorschau → ausdrücklich endgültig bestätigen |
| Universität nutzen | Gebäude wählen → Panel → Forschung | „Forschen“ auf Universitätskachel; Stadt und genau diese Universität übernehmen |
| Militärbauplatz bebauen | Auswahl → Panel mit Kaserne/Fabrik | Gleiche Baukachelbedienung; weiterhin ausschließlich Militärgebäude |
| Kaserne/Fabrik ausbauen/abreißen | Panel | Gemeinsame Gebäudekomponenten; Queue-/Sperrgründe direkt sichtbar |
| Truppen/LKWs ausbilden | Gebäude wählen → Panel → Menge → Prüfen → Start | „Ausbilden“/„LKWs herstellen“ auf Kachel → kompaktes Formular mit automatischer Vorschau → Start |
| Truppenbestand prüfen | Große Übersicht im Aktionspanel | Kompakte Bestandskarten im Militär-Hauptbereich: stationiert, unterwegs, Ausbildung |
| Bau-/Ausbildungsqueues | Statuspanel, teilweise nur erste drei | Zusammenfassung am Objekt; „Alle“ öffnet wirklich vollständige passende Liste mit Stadt-/Gebäudefilter |
| Forschung starten | Technologie wählen → Panel prüfen → Bestätigungsdialog | „Forschen“ auf Technologie → kompakte Planungsansicht mit geladener Vorschau → bezahlen/starten |
| Universität / Forschungsleitung wählen | Seitliches Panel, Generalwechsel sendet sofort | Im Forschungskopf oder Planungsformular; vorhandene Ortsbindung und Rollensperren deutlich |
| Generäle ansehen / filtern | Karten → langer Dialog | Standort, Rolle und freie Skills auf Karte; Filter nach Stadt/Rolle; gezielter Einstieg in Rolle oder Entwicklung |
| General umbenennen | Name im großen Dialog, Speichern weit entfernt | „Umbenennen“ im Generaldetail, Eingabe und Speichern beieinander |
| Bürgermeister ernennen/abberufen | Fußbereich des Eigenschaftsdialogs | „Rolle ändern“/„Bürgermeister“ mit ausdrücklich genannter Stadt und bestehender Besetzung |
| Forschungsleitung ernennen/abberufen | Forschungsseite bzw. Detailbutton | Gemeinsame Rollenbedienung, auch aus Generaldetail; keine neue zulässige Rolle oder Ortsumgehung |
| General verlegen | Über allgemeines Logistikformular | „Verlegen“ am freien General → bestehendes Formular mit General und tatsächlicher Quelle |
| XP in Skillpunkte umwandeln | Menge → Kauf prüfen → Kauf bestätigen | Ein Entwicklungsbereich, automatische Vorschau und ausdrücklicher „Für X XP kaufen“-Button |
| Skillpunkte verteilen | Plus je Punkt → Prüfen → Speichern | Mengen direkt eingeben UND Stepper; live aktualisierte Vorschau → irreversible Verteilung ausdrücklich speichern |
| General rekrutieren | Bewerber im Panel → Prüfen → Dialog → automatischer weiterer Dialog | Sichtbarer Reiter „Rekrutieren“ bei Generälen → Kandidat → Name/Preis/Folgen → Verpflichten; Erfolg inline |
| Karte bewegen / zentrieren / suchen | Windrose und optionale Werkzeuge | Bewahren, keine neue Kamera- oder Zoompflicht |
| NPC aufklären / Farmzug | Kartenobjekt → Sidebar → Dialog → Prüfen → Start | Auswahl zeigt unmittelbar eine kompakte Aktionskarte; Aufklärung/Angriffsplanung direkt dort öffnen |
| Freies Feld aufklären / erobern / gründen | Im Kartenpanel, jeweilige Prüfbuttons | Dieselbe Aktionskarte mit verständlichen Stufen und Rückkehr-/Berichtszustand; nur aktuelle zulässige Aktion primär |
| Eigene/fremde Stadt auf Karte | Details ohne durchgängige Folgelinks | Eigene „Stadt öffnen“, „Liefern“, zulässige „Verlegung planen“; fremde „Liefern“/„Nachricht“; kein PvP ergänzen |
| Lieferung | Formular → anderes Panel prüfen/starten | Quelle, Ziel, Ladung und Start in einem Formular; laufende Servervorschau; optionaler General bleibt optional |
| Truppen-/Generalverlegung | Ähnlich Lieferung | Expliziter eigener Modus, Richtung und dauerhafte Stationierung deutlich; ein zusammenhängender Ablauf |
| Liefer-/Verlegungsstatus | Eigene Logistikliste | Erhalten, gezielte Links zu Stadt, Mission und verfügbarem Bericht; keine neuen Abbruchbefehle |
| Versorgungshilfe | Zusatzdialog Quelle → Formular; Transferziel ist angeklickte Stadt | „Nahrung hierher liefern“ öffnet direkt Formular mit Ziel; „Truppen von hier verlegen“ setzt Quelle |
| Aufgaben fortsetzen | Aufgabe → allgemeine Seite | Direkter Kontextlink zum geeigneten Gebäude, passenden Forschungsangebot, Training oder Zieltyp |
| Belohnung abholen | Aufgabe → Dialog Zielstadt → Bestätigen | Zielstadt und vollständige Belohnung auf Aufgabenansicht sichtbar; ein eindeutiger Abholbutton reicht |
| Bericht lesen | Ordner → Zeile → langer Detailbereich | Wesentliche Ergebnisse zuerst, Bilanzen darunter; „Auf Karte zeigen“ und vorhandene Planung mit Zielkontext |
| Nachricht schreiben / antworten | Listen-/Detailbereich | Beibehalten, lokale Rückmeldung, explizites Senden und Schutz echter Textentwürfe; Empfänger von Stadtlink übernehmen |
| Postbox suchen / filtern / blättern | Filter und Auswahl, keine direkte Rückkehrführung | Zustand bei Detailrückkehr erhalten; Filter sind keine ungesendete Spielaktion |
| Einführung ausblenden / wiederfinden | Karte und localStorage | Beibehalten; keine Fortschritts- oder Belohnungsänderung |
| Offline / Wiederverbindung | Globaler Hinweis, uneinheitliche Buttons | Veralteten Stand zeigen, schreibende Aktionen sperren; Navigation und Lesen weiter erlauben; Ergebnis unklar getrennt behandeln |

## Konkretes Interaktionsdesign

### Gebäude: direkte Kachelaktionen

Eine Gebäudekachel wird zu einem semantischen Container mit separaten echten Buttons. Keine Buttons in einen bereits klickbaren Button verschachteln.

Zivile Produktionsgebäude und Lagerhaus:
- Bild, Name, abgeschlossene Stufe.
- Nächster Ausbau: kompakte Kosten, Dauer und wesentlicher Effekt.
- Direkter Button „Ausbauen · Stufe X“.
- „Details“ und „Mehr“ als untergeordnete Aktionen.

Universität:
- „Forschen“ und „Ausbauen“ direkt zugänglich, ohne dieselbe primäre Gewichtung für alle Buttons.
- Universitäts-ID und Stadt beim Einstieg bewahren.

Kaserne/Fabrik:
- „Ausbilden“ bzw. „LKWs herstellen“ primär, „Ausbauen“ sekundär.
- Aktiver Auftrag und Queuebelegung, „Alle Aufträge“ erreichbar.

Leerer Platz:
- „Bauen“ öffnet den Katalog an genau diesem Platz.
- Nur zulässige zivile bzw. militärische Typen.
- Angebote zeigen Preis, Dauer, Freischaltung und konkreten Fehlbetrag; nicht nur graue Buttons.

Laufende Aufträge zeigen Zielstufe, Status und verbleibende Zeit. Bereits eingeplanter Ausbau wird nicht noch einmal angeboten. Nicht vorhandene Abbruch-/Beschleunigungsmechaniken nicht erfinden.

Ausbau darf direkt ausgelöst werden, wenn das aktuelle serverseitige Angebot davor sichtbar ist. Es kommt keine neue Bestätigung hinzu. Server prüft weiterhin vollständig; Stufen-/Regelkonflikt aktualisiert die Kachel und verlangt eine erneute bewusste Auslösung.

Abriss bleibt im Mehr-Menü und benötigt genau eine abschließende Folgenbestätigung. Rückerstattung, Lager-/Produktions-/Punktefolge und betroffene Stadt nicht verbergen.

### Planung: automatische Vorschau, ein bewusster Start

Ein manueller „Prüfen“-Klick entfällt dort, wo das vorhandene read-only Preview automatisch geladen werden kann.

- Bei Öffnen mit gültigen Daten und nach Änderungen gebündelt anfordern.
- Während unvollständiger Eingaben keine ungültige Anfragenflut.
- Vorschauzustände: unvollständig, lädt, gültig, ungültig, veraltet/Verbindung fehlt.
- Alte Antworten niemals auf einen neueren Entwurf anwenden. Bindung an Spieler, Stadt, Objekt/Ziel, Eingaben und relevante Versionen.
- Start bleibt bis zur passenden Vorschau gesperrt.
- Kosten/Öl, Dauer, Quelle/Ziel, Rolle und wesentliche Folgen vor Start im selben sichtbaren Bereich.
- Eine automatisch geänderte materielle Vorschau nicht im Moment eines Klicks unbemerkt übernehmen. Änderungen zeigen und erneut bewusste Bestätigung verlangen; keine „neu prüfen und sofort starten“-Kette.
- Zeiten dürfen normal weiterlaufen; reine Tickänderungen lösen keine Endlosschleife aus.
- Finale Mutation bleibt genau ein bewusster Button. Keine automatische Entsendung, XP-Ausgabe, Rekrutierung oder Forschungsbestellung.

Bestehende Start-/Preview-Verträge und Idempotenz erhalten. Die Oberfläche arbeitet mit bestehenden Serverangeboten, nicht mit erfundenen Clientpreisen.

### Logistik und Versorgung

Quelle und Ziel stehen zusammen am Anfang des Formulars. Bei einem Einstieg aus der Karte oder Übersicht werden bekannte IDs übernommen, aber sichtbar angezeigt. Eine fehlende Quelle lässt sich direkt im Formular wählen; kein vorgeschalteter Dialog mit „Vorhandenes Formular öffnen“.

Lieferung und Verlegung bleiben klar getrennt. „Quelle wechseln“ lädt den passenden Stadtstand; keine alte Truppen-/Ölvorschau weiterverwenden. Die Wahl einer anderen Quelle startet nichts.

Mengenfelder bieten direkte Eingabe und „Verfügbar“ als Eingabehilfe für Einheiten. Ein Button „Maximal laden“ darf nur erscheinen, wenn die tatsächliche gemeinsame Kapazität einschließlich vorhandener Ladung und Betriebsöl zuverlässig berücksichtigt wird. Keine scheinbar genaue Maximalfracht allein aus Lagerbestand ableiten; bei fehlender geeigneter Quelle diese Hilfe weglassen.

Zusammenfassung zeigt Fracht, Betriebsöl, freie Kapazität, Hin-/Rückweg, Ankunft und relevante Versorgung. Tatsächliche Beute und spätere Lagerannahme bleiben ungewiss. Erweiterte Verzögerung und freiwillige Fracht dürfen einklappen, bleiben bei von null abweichenden Werten aber als aktive Zusammenfassung sichtbar.

Versorgungshilfe:
- „Nahrung hierher liefern“: gefährdete Stadt als Ziel; andere Quelle explizit im Lieferformular.
- „Truppen von hier verlegen“: gefährdete Stadt als Quelle; andere eigene Zielstadt wählen; Zielunterhalt zeigen.
- „Bürgermeister einsetzen/verwalten“: richtige Stadt und bestehende Rolle öffnen.
- „Bauernhof ausbauen“: geeignetes vorhandenes Gebäude fokussieren; bei mehreren Auswahl anbieten, ohne kostenpflichtig automatisch zu entscheiden; bei keinem geeigneten Gebäude Baukatalog anbieten.

### Generäle und Rollen

Generalübersicht erhält „Meine Generäle“ und „Rekrutieren“ im Hauptbereich. Karten zeigen Standort, Rolle, wichtigste Werte und freie Skillpunkte, mit direktem „Entwickeln“/„Rolle ändern“. Keine Reihe von sechs gleichgewichteten Buttons pro Karte.

Ein Generaldetail mit sinnvoll getrennten Abschnitten „Übersicht“, „Entwicklung“ und „Rolle“ statt eines langen Universalformulars. Umbenennen neben dem Namen. Alle Einstiege öffnen denselben Detailzustand, keine doppelte Generalverwaltung.

XP-Kauf und Verteilung bleiben zwei getrennte Serveraktionen. Automatische Vorschauen verkürzen beide, dürfen aber keine atomare Kombiaktion vortäuschen. Nach erfolgreichem Kauf und fehlgeschlagener Verteilung sind gekaufte freie Punkte sichtbar erhalten. Kein automatischer Kauf fehlender Punkte.

Standort/Amtswechsel bleiben strikt an vorhandene Regeln gebunden. Ein General aus anderer Stadt wird nicht anhand des gerade ausgewählten Stadt-Supply bewertet. Wenn serverseitig keine verlässliche stadtbezogene Wirkung vorliegt, keine numerische Wirkung erfinden.

### Aufgaben, Berichte und Aktivitäten

Aufgabenlinks erhalten konkrete Navigationsabsichten: Stadt, Slot/Gebäudetyp, Forschung, Einheit, Generalrolle oder Weltziel. Fehlende Voraussetzungen werden benannt und direkt verlinkt. Ein Link startet keine Mutation.

Aufgabenansicht zeigt die Belohnungszielstadt vor dem Abholbutton und bei Platzmangel den Fehlbetrag. Belohnung vollständig anzeigen; Server prüft weiterhin, einmaliger Anspruch bleibt. Kein Sammelabholen in diesem Auftrag.

Eine gemeinsame Aktivitätenansicht mit Filtern für Bau, Ausbildung, Forschung und alle Reisen schließt die Lücken der „Alle“-Links. Sie ist über einen kompakten Statuszugang erreichbar, kein achter Hauptmenüpunkt. In der kurzen Übersicht dürfen drei Einträge stehen, aber der Rest muss erreichbar sein. Nur aus bereits autorisierten Daten ableiten; fehlende Details bei Bedarf im passenden Stadtkontext laden.

Berichtsspitze: Ergebnis, betroffene Städte/Ziel, eigene Verluste, eingelagerte Beute und Zeitpunkt. Historische Detailbilanzen aufklappbar erhalten. Eine neue Planung aus einem Bericht öffnet das aktuelle Ziel und beschafft frische Angebote; historische Werte/Generäle/Einheiten nicht blind als aktuelle Verfügbarkeit übernehmen.

### Navigation, Entwürfe und Rückmeldung

Per Formular unterscheiden:
- Eingabe ohne Spielentwurf: Suche, Filter, Tabs, Kartenkoordinaten. Kein Verwerfen-Dialog.
- Echter ungesendeter Entwurf: Nachricht, Namensänderung, Skillverteilung, Mission/Transport. Vor Verlust schützen.
- Gesendeter Auftrag: Ergebnis abwarten bzw. mit Server abgleichen. Kein ungesendeter Entwurf mehr.

Normale Bereichswechsel dürfen echte Entwürfe im Arbeitsspeicher erhalten. Falls ein Kontextwechsel sie verwerfen muss, eine konkrete Entscheidung „Bleiben“/„Entwurf verwerfen und wechseln“. Nicht bei jedem Klick pauschal warnen. Browser-Neuladen/Abmelden mit echtem Entwurf ebenfalls behandeln, soweit technisch zuverlässig möglich.

Keine Entwürfe oder Vorschauen zwischen Spielern mischen. Bei Stadtwechsel kein Befehl mit alter Auswahl in neuer Stadt. Asynchrone Antworten öffnen keine geschlossene Ansicht erneut.

Erfolg direkt am Auslöser zeigen: „Bauernhof in Nordstadt auf Stufe 3 eingeplant“, plus erreichbarer Queue-Link. Fehler beim Feld/Formular, nicht ausschließlich am unteren Seitenrand. Dialoge bei Serverablehnung nicht mit verlorenem Entwurf schließen.

Verlorene Verbindung nach Absenden bedeutet nicht sicher „fehlgeschlagen“. Bei unbekanntem Ausgang erst Serverstand abgleichen; keinen neuen Request mit neuer ID blind erneut senden. Keine neue allgemeine Offline-Auftragswarteschlange bauen.

## Klickziele und Messmethode

Zählen: jeder Klick/Tap bzw. Tastatur-Aktivierungsschritt, einschließlich Öffnen von Menüs/Drawern und notwendiger Bestätigung. Texteingabe, Serverwartezeit und Scrollwege separat dokumentieren. Startzustand pro Fall festhalten, keine vorselektierten versteckten Zustände zu Gunsten der Messung.

Die Ist-Wege unten sind aus dem geprüften Code abgeleitet, nicht im Browser gemessen. Codex muss sie vor/nach Umbau auf Desktop und Mobil prüfen und korrigieren, falls abweichend.

| Ablauf / Startzustand | Abgeleiteter Ist-Weg | Ziel nach 18a |
| --- | --- | --- |
| Sichtbare, nicht ausgewählte Gebäudekachel ausbauen, genug Ressourcen | Desktop 2: Kachel → Panelbutton; schmal typischerweise 3 mit Aktionsdialog | 1: direkter Ausbau; Kosten vorher sichtbar |
| Sichtbarer leerer Bauplatz bebauen | Platz → ggf. Aktionsdialog → Gebäude | 2: Bauen → bepreistes Gebäude bauen |
| Forschungskarte bei gültiger gewählter Universität | Desktop 3: auswählen → prüfen → starten; schmal zusätzlich Panel | 2: Forschen → im geladenen Review starten |
| Sichtbare Kaserne, ein Ausbildungsauftrag | Gebäude → ggf. Panel → prüfen → starten; Menge separat | 2: Ausbilden → nach Menge und automatischer Vorschau starten |
| Gültig ausgefülltes Logistikformular | prüfen → starten; schmal zusätzlich Panel | 1: nach automatischer Vorschau im selben Formular starten |
| Sichtbares NPC-Feld, gültige Standardauswahl | Feld → ggf. Panel → Aktion → prüfen → starten | 3: Feld → Aufklärung/Angriff planen → nach Vorschau starten |
| Sichtbare abholbare Aufgabe, Zielstadt schon sichtbar gewählt | Abholen → Dialog bestätigen | 1: vollständig angezeigte Belohnung in angezeigter Stadt abholen |
| Stadtwechsel ohne Entwurf | Wähler → Stadt | höchstens 2; keine Zusatzbestätigung |
| Karte → Quelle/Ziel im Lieferformular | keine direkte durchgängige Route | Feld/Stadt wählen → Liefern, Ziel ist übernommen |

Diese Zahlen sind UX-Abnahmeziele, keine behaupteten prozentualen Zeitgewinne. Fehlen Ressourcen, eine Wahl oder eine Voraussetzung, sind zusätzliche Schritte fachlich nötig und separat auszuweisen.

## Responsive und zugängliche Bedienung

- Hauptaktionen auf Kacheln auch ohne Hover sichtbar und per Touch erreichbar.
- Interaktionsflächen als Projektziel mindestens 44 × 44 CSS-Pixel, bei dichter Ansicht Layout ändern statt Buttons unbedienbar verkleinern.
- Bei 320/390 px breite Karten oder passende Zeilen nutzen; 200 % Zoom und lange deutsche Namen berücksichtigen.
- Primäre Buttons in langen Formularen in einer erreichbaren, gegebenenfalls klebenden Fußleiste. Ausreichend Abstand für Bildschirmtastatur, unteren Navigator und Safe Area.
- Pro Workflow nur eine aktive Dialog-/Sheet-Ebene. Ansichten darin wechseln statt Modalstapel. Fokus bleibt darin und kehrt zum Auslöser zurück.
- Weltkarte bekommt auf Feldwahl unmittelbar eine kompakte Aktionskarte: Desktop angedockt am Kartenbereich, mobil kleines Sheet. Windrose bleibt frei bedienbar, keine Kamera-/Maßstabsänderung durch die Auswahl. Karte muss ohne Zoom und Seitenscrollen navigierbar bleiben.
- Formulare behalten Preis, Start und Fehler im selben Bereich. Keine quer über die Seite verteilten Handlungsflächen.
- Status nicht ausschließlich farblich, alle Buttons benannt, Fokus sichtbar, keine globalen Tastenkürzel in Textfeldern.
- Menschlich lesbare Dauern wie „2 Min. 10 Sek.“; exakte Ankunftszeit bei Bedarf zusätzlich.
- Nur Hilfetexte und technische Einzelheiten einklappen. Preis, ausgewählte Stadt, aktive Verzögerung, Pflichtvoraussetzung und Risiko vor Start sichtbar.
- Reduzierte Bewegung beachten. Keine Daueranimation für normale Benachrichtigungen.

## Umsetzung und Nachweis

CODEX_PROMPT.md ist die verbindliche Arbeitsanweisung für 18a. Fachlogik, Preise, Regelversionen, Schema 18/4 und Spielzustände sollen unverändert bleiben. Notwendige Änderungen an UI-Datenprojektionen oder Ereigniszuordnung klein halten, begründen und gezielt prüfen.

Vorhandene gemeinsame UI-Bausteine weiterentwickeln: Gebäudekarte, Angebot/Zustand, Aktionsformular mit Summary, Status-/Fehleranzeige, Mengenfeld und konkrete Navigationsziele. Kein Frameworkwechsel und kein neuer allumfassender Komponentenbaukasten.

Codex liefert docs/UX_REFACTOR_18A_VALIDATION.md mit vollständig abgearbeiteter Aktionsliste, Vorher-/Nachher-Wege, tatsächlichen Tests, Screenshots und offenen Grenzen. Eine hübschere Oberfläche allein genügt nicht: alle bisherigen Funktionen müssen zugänglich bleiben, Hauptwege sollen die oben definierten Ziele erreichen.
