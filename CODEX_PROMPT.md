# Codex-Auftrag 18: Einführung, einmalige Aufgaben und Versorgung aller Städte

## Ziel und Ausgangspunkt

Baue einen spielbaren Einstieg und eine Übersicht, mit der ein Kommandant seine bis zu fünf Städte versorgen kann. Ablauf: nächste sinnvolle Aufgabe sehen → vorhandene Spielaktion ausführen → bestätigten Fortschritt sehen → Belohnung ausdrücklich in einer eigenen Stadt abholen. Parallel zeigt „Alle Städte“, wo Nahrung knapp wird und welche vorhandene Aktion hilft.

Auftrag 17 wurde vom Nutzer am 19.10.2026 als abgeschlossen bestätigt. Im gelesenen main-Stand 7cad05dba65a6c52d570331f1b0cddc40f253204 sind neun Forschungen und die räumliche Weltkarte mit Windrose enthalten. Der Planungschat hat Dateien gelesen, keine Laufzeittests ausgeführt. Prüfe beim Start den tatsächlichen Stand und erhalte zwischenzeitliche Änderungen. Der vorige Auftrag bleibt im [Git-Verlauf](https://github.com/bavxhack/War2glory/blob/7cad05dba65a6c52d570331f1b0cddc40f253204/CODEX_PROMPT.md) erhalten.

Lies AGENTS.md, README.md, docs/PROJECT.md, docs/WEBSOCKET.md und die bestehenden Prüfbelege für Versorgung, Mehrstadtbetrieb, Logistik, Forschung und Weltkarte. Die folgenden Aufgaben und Belohnungen sind eigene vorläufige Projektentscheidungen, keine rekonstruierten War2Glory-Originalwerte.

## 1. Bestehendes Spiel erhalten

- JavaScript/ES-Module, React, serverautoritative Regeln, ein vorhandener WebSocket pro Client und persistente Spieler-JSON beibehalten. Private Spieldaten und Befehle ausschließlich über WebSocket; statische Dateien bleiben HTTP.
- Städte behalten getrennte Ressourcen, Lager, Nahrung, Truppen, Warteschlangen und Bürgermeister. Eine positive Gesamtbilanz versorgt keine andere Stadt automatisch.
- Forschung, Generäle und Kommandantenpunkte bleiben nach bestehenden Regeln spielerweit. Aufgaben vergeben keine zusätzlichen Kommandantenpunkte, General-XP oder Skillpunkte.
- Unterhalt betrifft ausschließlich die nach dem gespeicherten Regelsatz versorgungspflichtigen Gruppen; für aktuelle Regeln sind dies stationierte Truppen. Unterwegs befindliche Einheiten nicht erneut belasten.
- Öl, Fracht, Rückwegreserve, Verzögerungen, Teilannahme von Lieferungen, Verlegung, Hungerverluste und zeitliche Ereignisreihenfolge unverändert anwenden.
- Die zuletzt umgesetzte isometrische Weltkarte einschließlich Windrose, Projektion, Kachelgrößen, Auswahl und Steuerung erhalten. Kein erneuter Kartenumbau.
- Keine neue Pflichtregistrierung, neue Währung, täglichen Aufgaben, automatische Transporte, PvP, Bündnisse oder Matrix-Anbindung in diesem Auftrag.

## 2. Zentraler Aufgabenkatalog

Erstelle einen versionierten, von Netzwerk und Speicherung unabhängigen Katalog in game-core, beispielsweise „tasks-1-provisional“. Stabile IDs, Titel, kurze Erklärung, Voraussetzungen, Ziel, Belohnung und Verweis auf eine vorhandene Spielaktion zentral halten.

Die Einführung besteht aus neun Aufgaben. Drei freiwillige Ausbauaufgaben schließen daran an. Die Tabelle definiert die ersten Werte verbindlich für diesen Prototyp; keine Belohnung wird automatisch ausgezahlt.

| ID | Ziel / serverseitiger Nachweis | Voraussetzung | Belohnung Holz / Stein / Nahrung / Öl |
| --- | --- | --- | --- |
| intro.farm | Ein fertiggestellter Bauernhof mindestens Stufe 2 in einer eigenen Stadt | keine | 100 / 100 / 150 / 0 |
| intro.storage | Ein fertiggestelltes Lagerhaus mindestens Stufe 1 | intro.farm erfüllt | 100 / 100 / 150 / 0 |
| intro.mayor | Ein eigener General ist gültig als Bürgermeister einer eigenen Stadt eingesetzt | intro.farm erfüllt | 50 / 50 / 200 / 0 |
| intro.university | Eine fertiggestellte Universität mindestens Stufe 1 | intro.storage erfüllt | 150 / 150 / 100 / 0 |
| intro.research | Mindestens eine abgeschlossene Forschungsstufe | intro.university erfüllt | 100 / 100 / 150 / 0 |
| intro.oil | Ölverarbeitung mindestens Stufe 1 und eine fertiggestellte Ölraffinerie | intro.research erfüllt | 100 / 100 / 100 / 50 |
| intro.training | Insgesamt 10 Infanteristen durch abgeschlossene eigene Ausbildung hergestellt | intro.oil erfüllt | 100 / 100 / 150 / 50 |
| intro.scout | Eine NPC-Aufklärung ist zurückgekehrt und ihr Bericht freigegeben | intro.oil erfüllt | 100 / 100 / 150 / 50 |
| intro.raid | Ein siegreicher NPC-Farmzug ist zurückgekehrt und mindestens eine Einheit tatsächlich geplünderter Nahrung wurde eingelagert | intro.training und intro.scout erfüllt | 150 / 150 / 150 / 50 |
| expansion.engineering | Bautechnik, Ausbildungstechnik oder Ladetechnik mindestens Stufe 1 | intro.research erfüllt | 200 / 200 / 200 / 0 |
| expansion.city | Mindestens zwei eigene fertig gegründete Städte | intro.raid erfüllt | 200 / 200 / 200 / 0 |
| expansion.supply | Eine eigene Ressourcenlieferung hat mindestens eine Einheit Nahrung in einer anderen eigenen Stadt tatsächlich eingelagert | expansion.city erfüllt | 100 / 100 / 150 / 0 |

„Erfüllt“ bedeutet fachlich abgeschlossen, unabhängig davon, ob die Belohnung abgeholt wurde. So blockiert ein volles Lager nicht den nächsten Schritt. Die Einführung gilt als abgeschlossen, sobald die neun intro-Aufgaben erfüllt sind; die drei Ausbauaufgaben sind dafür nicht nötig.

Die Anleitung muss vorhandene Zwischenvoraussetzungen erklären und zu deren UI führen: Militärbauplatz/Kaserne, freie Einheiten und Generäle, Ölproduktion, Ladung und Rückwegreserve. Keine Voraussetzung umgehen und keine neue Kaserne oder Einheit per Tutorial verschenken. Keine Aussage, dass zehn Infanteristen für jeden NPC ausreichen: erst aufklären, dann tatsächliche Garnison und Kampfvorschau beachten.

## 3. Nachweise, Fortschritt und Bestandsspieler

Speichere Fortschritt spielerweit, nicht je Stadt. Ein Stadtwechsel, eine neue Stadt, ein neues Browserfenster und ein Serverneustart erzeugen keinen neuen Anspruch.

Trenne zwei Arten von Nachweisen:
- Zustandsziele: fertige Gebäude, vorhandene Forschung, gültiger Bürgermeister und gegründete Städte. Diese dürfen beim erstmaligen Aktivieren anhand des tatsächlichen Bestands erfüllt werden.
- Ereignisziele: abgeschlossene Ausbildung, zurückgekehrte Aufklärung, tatsächlich eingelagerte Beute und tatsächlich angenommene Lieferung. Nur serverseitig bestätigte fachliche Übergänge zählen; Enqueue, Reisebeginn, Client-Klicks, Vorschauen oder bloße Truppenbestände sind kein Abschlussbeleg.

Bei Ereignissen vorhandene stabile Auftrags-/Missions-/Transaktions-IDs verwenden. Dieselbe abgeschlossene Ausbildung darf nicht beim nächsten Tick erneut zählen. Transferierte Truppen sind keine Ausbildung; mitgeführte Nahrung und Aufgabenbelohnungen sind keine geplünderte Nahrung. Eine abgewiesene oder vollständig wegen Lagerfüllung zurückgeschickte Lieferung erfüllt keine Versorgungsaufgabe. Eine Lieferung an denselben Ort oder eine fremde Stadt zählt nicht für expansion.supply.

Fortschritt darf schon vor Freischaltung eines Ziels gesammelt werden. Bereits belegte Ziele werden beim Erfüllen ihrer Voraussetzungen ohne Wiederholung abgeschlossen. Das gilt auch für Zustandsziele: einmal serverseitig belegtes Erreichen dauerhaft festhalten. Abriss, Bürgermeisterwechsel, Verluste oder ein Stadtwechsel setzen belegten Fortschritt und erfüllte Aufgaben nicht zurück.

Bei Migration vorhandene, eindeutig auswertbare persistente Berichte/Abschlussbelege einmalig nutzen. Fehlen solche Belege, Ereignisziele ab Aktivierung sammeln und dies verständlich erklären. Keine historischen Ausbildungen aus Garnisonsstärken erraten, keine alten Ressourcenbewegungen erfinden. Vor Aktivierung nachweisbare Zustandsziele können erfüllt werden; bereits verschwundene historische Gebäude werden ohne Beleg nicht unterstellt.

Für spätere Ereignisse Fortschritt in derselben fachlichen Transaktion sichern wie das zugrunde liegende Ergebnis. Verwende begrenzte Zähler und Nachweise statt einer unendlich wachsenden Kopie aller Spielereignisse. Prüfe auch Offline-Abrechnung, Neustart und Journal-Recovery. Aufgabenerfüllung darf nicht davon abhängen, dass die Aufgabenseite geöffnet ist.

## 4. Einmalige Belohnungen und atomare Abholung

Jede Aufgaben-ID ist pro Spieler höchstens einmal auszahlbar. Die fachliche Auszahlungsmarkierung bleibt dauerhaft gespeichert, auch nachdem normale Request-ID-Belege nach 30 Tagen bzw. wegen ihrer Anzahl entfernt wurden.

Zustände klar darstellen: gesperrt, verfügbar, erfüllt/Belohnung abholbar, abgeholt. Beim Erfüllen Belohnungswerte und Katalogversion dauerhaft festhalten. Spätere Katalogänderungen verändern weder bestehende Ansprüche noch bereits erfolgte Auszahlungen. Umbenennen eines Titels erzeugt keine neue Aufgabe.

Die UI lässt eine eigene Zielstadt ausdrücklich auswählen; standardmäßig die aktuell ausgewählte Stadt. Vor Abholung Bestände, Kapazitäten und Belohnung zeigen. Die Vorschau reserviert keinen Platz.

Serverseitiger Ablauf:
1. Sitzung, Aufgaben-ID und Eigentum der Zielstadt prüfen.
2. Bestehende Zeitfortschreibung und fällige Ereignisse bis zum Befehlszeitpunkt in der bisherigen Reihenfolge anwenden.
3. Erfüllung, noch offenen Anspruch und Platz für die vollständige Belohnung jeder Ressource neu prüfen.
4. Nur wenn alles passt: Ressourcen, Abholzeit, Zielstadt, Belohnungsbeleg und Befehlsresultat gemeinsam atomar speichern.
5. Erst nach erfolgreichem Speichern bestätigen und aktualisierten Zustand an alle angemeldeten Verbindungen dieses Spielers senden.

Wenn nicht alles hineinpasst: gesamte Abholung ablehnen, keine Teilgutschrift, kein Verfall und kein „abgeholt“-Status. Fehlende Kapazität je Ressource erklären; andere Stadt wählen oder später versuchen. Schon bestehende Überbestände nicht abschneiden. Kein neues Zwischenlager und keine unbegrenzte Überfüllung durch Aufgaben.

Gleichzeitige Abholversuche aus zwei Tabs mit verschiedenen requestIds dürfen zusammen nur eine Auszahlung erzeugen. Eine identische requestId mit geändertem Inhalt bleibt ungültig. Bei einer Wiederholung eines bereits bestätigten Befehls ursprüngliches Resultat zurückgeben; für einen neuen Befehl auf eine schon abgeholte Aufgabe eindeutig „bereits abgeholt“ ohne Gutschrift melden. Verlust einer Bestätigung, Neustart und Wiederaufnahme bleiben sicher.

Nahrungsbelohnungen verwenden nach Gutschrift die vorhandene Versorgungsprüfung. Sie setzen weder Schonfrist noch Erholungszeit willkürlich zurück und verhindern keine fachlich bereits davor fälligen Verluste.

## 5. Versorgungsübersicht für alle eigenen Städte

Ergänze unter „Stadt“ die Ansichten „Stadtansicht“, „Alle Städte“ und „Aufgaben“. Die vorhandenen sieben Hauptnavigationseinträge bleiben übersichtlich; keine weitere lange Seitenleistenliste.

„Alle Städte“ zeigt je Stadt:
- Namen, Koordinaten, deutlich markierte aktuell ausgewählte Stadt und „Stadt öffnen“.
- Nahrung mit Lagergrenze, Bruttoproduktion, Truppenunterhalt und Nettobilanz, einheitlich pro Stunde beschriftet.
- Versorgungsstatus als Text und Symbol: ausgeglichen/Überschuss, Lager sinkt, Mangel mit Schonfrist, Hungerverluste oder Erholung entsprechend dem tatsächlichen Serverzustand.
- Bei sinkendem Vorrat die geschätzte Zeit bis Lagerleerstand; bei aktivem Mangel verbleibende Schonfrist bzw. Zeitpunkt der nächsten tatsächlich geplanten Verlustwelle.
- Anzahl stationierter Einheiten, verständlicher Hinweis auf pausierte Ausbildung und gegebenenfalls getrennte unterwegs befindliche Einheiten.
- Kompakte Bestände/Kapazitäten der übrigen Ressourcen, bei Platzmangel in einem zugänglichen Detailbereich.

Erzeuge die Übersicht serverseitig aus den vorhandenen Kernfunktionen und einem gemeinsamen Abrechnungszeitpunkt für alle Städte. Insbesondere supplySummary mit dem korrekten Stadt-Kontext und dem globalen Forschungsstand nutzen. Keine zweite Unterhaltsformel im React-Client und keine fälschliche Nutzung der gerade aktiven Stadt für alle Zeilen.

Serverwerte sind verbindlich. Pro Sekunde gespeicherte Raten genau einmal mit 3600 in Stundenwerte umrechnen. Intern nicht vor der Verrechnung runden. Tatsächlich gespeicherte ENV-/Regelversionen, Bürgermeister, Forschung, Rückkehr und Verlegung berücksichtigen. Unterwegs befindliche Gruppen nicht doppelt zählen; General-only-Verlegung erzeugt keine fiktiven Einheiten.

Für unveränderte negative Nettorate gilt:
Zeit bis leer in Sekunden = aktueller Nahrungsbestand / Betrag der Nettorate pro Sekunde.
Bei Nettorate >= 0 keine endliche Leerstandszeit behaupten. Keine Infinity-/NaN-Werte ins JSON schreiben. Bei bereits leerem Lager den echten Mangelszustand anzeigen.

Die Vorhersage ausdrücklich „bei unveränderten Raten“ nennen. Anstehende Ausbildungsabschlüsse, Rückkehr und Rollenwechsel können sie verändern. Keine vollständige Zukunftssimulation in diesem Auftrag. Schonfrist und Verlustzeitpunkte aus dem gespeicherten Versorgungssystem ableiten, nicht beim Öffnen der Seite von vorne starten. Reine Client-Countdowns dürfen Zeiten darstellen, aber keine Spielstände verändern.

Optional bekannte eingehende Nahrungslieferungen mit ETA und geplanter Menge zeigen, deutlich als noch nicht eingelagert. Keine Lagerannahme garantieren und ungeklärte Farmbeute nicht als sichere Versorgung buchen. Bei fremden Absendern nur bereits zulässige Empfängerinformationen verwenden.

Eine Gesamtbilanz darf rein informativ erscheinen, muss aber die getrennten Stadtlager erklären. Ein Überschuss in Stadt A darf den Mangelstatus von Stadt B niemals grün färben.

## 6. Direkte Hilfe mit vorhandenen Aktionen

Bei einer gefährdeten Stadt passende Aktionen anbieten:
- „Nahrung liefern“ öffnet den vorhandenen Lieferdialog mit dieser eigenen Stadt als Ziel. Eine andere eigene Absenderstadt ausdrücklich wählen; verfügbare Nahrung, LKWs, Öl und Reichweite wie bisher prüfen.
- „Bürgermeister verwalten“ führt zur Generalverwaltung im passenden Stadtkontext.
- „Bauernhof ausbauen“ führt zur Stadtansicht und geeigneten vorhandenen Bauaktion.
- „Truppen verlegen“ führt zur vorhandenen eigenen Verlegung; Hinweis auf den Unterhalt am Ziel.

Es werden nur Formulare vorbereitet. Nichts automatisch absenden, keine Ressourcen oder Einheiten automatisch auswählen/umbuchen und keinen erforderlichen General für Kampfaufträge umgehen. Ressourcenlieferungen bleiben ohne General möglich.

Beim Wechsel zwischen Städten bestehende Regeln für ungesendete Formulare beachten. Keine Eingabe stillschweigend auf eine andere Stadt anwenden. Auftragsdaten nennen stets die expliziten Quell-/Zielstadt-IDs.

## 7. Einführung und UI

- Für neue Spieler eine kleine, nicht blockierende Einstiegskarte mit nächstem Ziel und „Zur Aufgabe“. Ausblendbar und jederzeit über „Aufgaben“ wieder erreichbar.
- Bestandsspieler bekommen keinen erzwungenen Rundgang. Aufgaben sind normal zugänglich und nach Migration korrekt eingeordnet.
- Aufgaben zeigen Nutzen, Ziel/Fortschritt, Voraussetzungen, Belohnung und eindeutige Aktion. Gesperrte Aufgaben nennen den fehlenden Schritt. Erfüllte Aufgaben bieten „Belohnung abholen“; abgeholte wandern in einen einklappbaren Bereich.
- Keine Belohnungen für das Anklicken von Hilfetexten oder bloßes Öffnen einer Seite. Ausblenden/erneut Öffnen der Einführung setzt keinen Fortschritt zurück.
- Ein kompakter Badge zeigt abholbare Belohnungen. Keine blinkenden Dauerhinweise und keine neue endlos wachsende Sidebar.
- Desktop: übersichtliche Stadttabelle; Mobilgeräte: gut lesbare Karten mit priorisierten Nahrungswerten, keine notwendige horizontale Seitenverschiebung.
- Texte, Symbole und Tastaturbedienung ergänzen Farben. Fokusführung, Dialogbeschriftung, Escape/Schließen und sichtbare Fokusmarkierung prüfen.
- Bei Verbindungsabbruch letzten Stand mit Zeitpunkt als veraltet markieren; keine erfolgreichen Abholungen vortäuschen. Nach Resume den Serverstand übernehmen.
- Weltkarte, Windrose, Stadtwechsel und bisherige Aktionspanels bleiben unabhängig bedienbar.

## 8. WebSocket, Speicherung und Migration

Erweitere das vorhandene Protokoll minimal. Beispielsweise:
- tasks.claim mit taskId und cityId; Werte der Belohnung kommen ausschließlich vom Server.
- Bestehende city.snapshot/city.updated um spielerweiten Aufgabenstatus und cityOverview mit gemeinsamem asOf-Zeitpunkt ergänzen.
- Eine bestätigte Abholung enthält Aufgabe, tatsächliche Zielstadt und gutgeschriebene Ressourcen. Fehler folgen dem vorhandenen Fehlerformat.

Verwende passende Namen nach Prüfung des aktuellen Protokolls und dokumentiere sie vollständig. Keine zusätzlichen parallelen WebSockets, HTTP-Spielendpunkte oder Client-Polling-Schleifen. Vorhandene serverseitige Ticks/Pushes verwenden; Änderungen an Aufgaben oder Versorgung müssen auch bei nicht ausgewählter Stadt und in allen Tabs ankommen.

Ein dauerhaftes Aufgabenobjekt umfasst Schema-/Katalogversion, Aktivierungszeit, begrenzten Fortschritt, erreichte Ziele, erfüllte Aufgaben samt eingefrorener Belohnung und dauerhafte Abholbelege. Einführungsausblendung getrennt von fachlichem Fortschritt behandeln.

Gelesener Ausgangspunkt: Spielerschema 17, Weltschema 4. Führe eine explizite, idempotente Migration für den neuen persistierten Aufgabenstand ein, im unveränderten Ausgangspunkt 17 → 18. Prüfe sämtliche Schema-Gates, canonicalJSON, Stadtadapter, Validierung, Legacy-Import und neue Konten. Bei zwischenzeitlich erhöhtem Schema eine konfliktfreie nächste Version verwenden. Das Weltschema nur ändern, falls tatsächlich erforderlich.

Bestehende Städte, Aufträge, Missionen, Generäle, Rollen, Forschung, Fracht, Punkte, Regelhistorien, Hungerzähler und Weltpositionen erhalten. Unbekannte/beschädigte Zustände nicht still zurücksetzen. Nachweise dürfen bei Journal-Wiederholung nicht doppelt zählen; fehlgeschlagene Speicherung darf keinen nur im RAM bereits abgeholten Anspruch zurücklassen.

## 9. Abnahme mit gezielten Prüfungen

Automatisierte Tests für die kritischen Übergänge ergänzen und bestehende relevante Tests ausführen:

1. Frischer Spieler kann die neun Einführungsaufgaben mit normalen Spielaktionen erfüllen; keine zirkuläre Voraussetzung. Zwischenvoraussetzungen sind erreichbar und verständlich.
2. Zustandsnachweise berücksichtigen alle eigenen Städte. Ereignisse vor Freischaltung zählen genau einmal; spätere Abrisse/Rollenwechsel löschen keinen belegten Fortschritt.
3. Abgebrochene/ungültige Aktionen, bloß eingeplante Ausbildung, transferierte Truppen und mitgebrachte Nahrung erfüllen keine falschen Aufgaben.
4. Raid: Sieg allein genügt nicht; positive tatsächlich eingelagerte geplünderte Nahrung zählt. Lieferung: Teilannahme mit positiver Nahrung zählt, Nullannahme nicht.
5. Zwei Tabs mit unterschiedlichen requestIds, wiederholte Requests, verlorene Bestätigung und Neustart ergeben exakt eine Belohnung je Aufgabe.
6. Fehlende Kapazität auch nur einer Ressource führt zu keiner Gutschrift; Anspruch bleibt offen. Exakt passender Lagerplatz funktioniert; fremde Zielstadt wird abgewiesen.
7. Migration vorhandener Schema-17-Spieler einschließlich fünf Städten, Forschung, laufenden Missionen und belegbaren alten Berichten erhält Daten und ist wiederholbar.
8. Aufgabenfortschritt und Belege überstehen Offline-Abrechnung und Recovery, ohne Ereignisse erneut zu zählen. Kommandantenpunkte bleiben unverändert.
9. Versorgung: unterschiedliche Bürgermeister/Truppen/Lager in zwei Städten, Stadtwechsel, Ausbildungsabschluss, Rückkehr, Verlegung und Forschungsabschluss ergeben den korrekten Stadtwert. Nahrung pro Stunde ist exakt aus der Kernrate abgeleitet.
10. Defizit trotz positivem Gesamtsaldo wird angezeigt. Unterwegs befindliche Truppen verursachen nach aktuellem Regelsatz keinen Stadtunterhalt. Abholung während Mangel nutzt bestehende Schonfrist-/Erholungsregeln.
11. UI-Nachweis auf Desktop und schmalem Bildschirm: Aufgaben erfüllen/abholen, volles Lager behandeln, gefährdete Stadt erkennen und Lieferdialog korrekt vorbereiten. Tastaturbedienung, Reconnect und zwei Tabs prüfen.
12. Bestehende Weltkarte mit Windrose sowie Forschung, Logistik und Stadtwechsel funktionieren weiterhin.

Nutze kontrollierte Serverzeiten für Zeitgrenzfälle. Keine langen Wartezeiten in Tests und keine Tests, die nur die Implementierung nachschreiben. npm test und npm run build ausführen; nötige Browserprüfungen tatsächlich durchführen und belegen. Fehler beheben oder verbleibende Grenzen offen benennen.

## 10. Dokumentation und Abschluss

README.md, docs/PROJECT.md und docs/WEBSOCKET.md auf den tatsächlichen Stand bringen. Historische Abschnitte als Historie erhalten; widersprüchliche Aussagen zum aktuellen Unterhalt oder Schema im aktuellen Einstieg berichtigen.

Erstelle docs/TASKS_SUPPLY_VALIDATION.md mit tatsächlich ausgeführten Befehlen, Ergebnissen, Migrationsfällen und Desktop-/Mobilnachweisen. Keine behaupteten Prüfungen ohne Ausführung. Provisorische Belohnungswerte und Grenzen der Versorgungsprognose ausdrücklich nennen.

Im Abschluss kurz berichten: spielbarer Ablauf, relevante Dateien, getestete Fälle und offene Einschränkungen. Implementiere diesen Auftrag vollständig; keine zusätzlichen Spielsysteme vorziehen. Anschließend können Bündnisse und Unterstützung innerhalb derselben Welt als eigener Auftrag konkretisiert werden.
