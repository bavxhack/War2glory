# Codex-Auftrag 17: Forschungsbaum, Bau-, Ausbildungs- und Ladetechnik

## Ziel und Ausgangspunkt

Erweitere den vorhandenen Forschungskatalog um drei spielbare Technologien und eine verständliche Forschungsansicht. Der Ablauf soll sein: Voraussetzungen prüfen → in einer eigenen Universität forschen → Abschluss in allen eigenen Städten wirksam → beim nächsten Bau-, Ausbildungs- oder Transportauftrag den konkreten Vorteil sehen.

Auftrag 16 ist im aktuell gelesenen Repository als implementiert dokumentiert: Lieferungen, dauerhafte Verlegung, Generalstandorte und neuer Spielrahmen. Ausgangspunkt dieser Spezifikation ist main vom 17.10.2026, Commit 4e2f6f50255251d3d1f9ae635a8807416b7c579e. Der Planungschat hat Dokumentation und relevante Kernmodule gelesen, aber keine Laufzeittests ausgeführt. Prüfe beim Arbeitsbeginn den tatsächlichen Stand und erhalte zwischenzeitliche Änderungen.

Lies AGENTS.md, README.md, docs/PROJECT.md, docs/RESEARCH_REFERENCE.md und docs/WEBSOCKET.md. Beachte die bestehenden Prüfbelege für Mehrstadtbetrieb, Fracht und Auftrag 16. Der frühere Auftrag 16 bleibt im [Git-Verlauf](https://github.com/bavxhack/War2glory/blob/65a8eb546a5e864396755204b8ef382a2ce77c9e/CODEX_PROMPT.md) erhalten.

Historisch belegt sind Forschungsthemen, nicht der vollständige originale Abhängigkeitsbaum oder seine Zahlen. Alle nachfolgenden neuen Voraussetzungen, Kosten und Wirkungszahlen sind eigene vorläufige Projektentscheidungen. Setze sie als prüfbare Standardwerte um; behaupte keine Originaltreue.

## 1. Vorhandene Regeln bewahren

- JavaScript/ES-Module, React, bestehender WebSocket und serverseitige JSON-Persistenz bleiben die Grundlage. Keine neue Engine und kein Frontend-Neuaufbau.
- Forschung bleibt spielerweit: ein gemeinsamer Wissensstand und höchstens ein laufender Forschungsauftrag pro Kommandant, auch bei fünf Städten. Kein Auftrag je Universität und keine zusätzliche Forschungswarteschlange.
- Forschung wird aus der ausdrücklich gewählten eigenen Stadt bezahlt. Universität und Forschungsleitung müssen nach den bestehenden Standort-/Rollenregeln dort verfügbar sein.
- Sechs vorhandene IDs und ihre bisherigen Effekte/Voraussetzungen/Kosten erhalten: forestry, masonry, agriculture, logistics, oilProcessing, motorization.
- Bereits erreichtes Wissen bleibt nach Universitätsabriss bestehen. Punkte, Generalskills, Bürgermeister, Öl, Nahrung, Abrissrückerstattung und zivile/militärische Bauplätze bleiben unverändert, soweit unten kein neuer Forschungseffekt beschrieben ist.
- Lagerlogistik vergrößert Stadtlager. Ladetechnik vergrößert den gemeinsamen Frachtraum einer Reisegruppe. Diese zwei Effekte nicht vermischen.
- Generäle werden weiterhin weder kostenlos erzeugt noch durch Forschung umstationiert. Lieferung ohne General und dauerhafte Verlegung aus Auftrag 16 müssen funktionieren.

## 2. Versionierter Forschungskatalog

Erweitere die vorhandene Kernstruktur, statt parallel einen zweiten Katalog anzulegen. Jede aktive Technologie benötigt eine stabile ID, Anzeigenamen, Kategorie, Maximalstufe, Kosten-/Zeitregel, Universitätsanforderung, explizite Forschungsvoraussetzungen, klaren Wirkungstyp und eine Regelversion. Die Informationen müssen sowohl der serverseitigen Prüfung als auch der UI zugrunde liegen.

- Bestehende Definitionen ohne Bedeutungsänderung übernehmen, einschließlich der unterschiedlichen Stufengrenzen von Freischaltungen und Wirtschaftsforschungen.
- Voraussetzungen auf bekannte IDs, zulässige Stufen und Zyklen prüfen. Universitätsanforderungen dürfen vom Ziellevel abhängen.
- Effekte gezielt nach ihrem Typ anwenden: Ressourcenproduktion, Lagerkapazität, Freischaltung, Baugeschwindigkeit, Ausbildungsgeschwindigkeit, Traglast. Kein pauschaler Forschungsfaktor für jede Spielgröße.
- Forschungsangebote liefern strukturierte Sperrgründe, insbesondere fehlende Universität/Stufe, Vorgängerforschung, Ressourcen, laufender Auftrag und bereits erreichte Maximalstufe. Relevante Gründe gemeinsam anzeigen.
- Nur tatsächlich wirksame Technologien sind erforschbar. Die übrigen historisch recherchierten Themen bleiben im Projektplan, ohne kaufbare Platzhalter.
- Katalog-/Regeländerungen müssen veraltete Vorschauen erkennbar machen. Stabile IDs nicht umbenennen, um Beschriftungen anzupassen.

## 3. Drei neue Technologien

Folgende eigene Standardwerte verwenden:

| Technologie | Stabile ID | Forschungsvoraussetzung | Universität in der zahlenden Stadt | Maximum | Effekt je Stufe |
| --- | --- | --- | --- | --- | --- |
| Bautechnik | constructionEngineering | Steinverarbeitung (masonry) Stufe 1 | mindestens max(2, Zielstufe) | 5 | +5 % Baugeschwindigkeit |
| Ausbildungstechnik | trainingTechniques | keine zusätzliche Forschung | mindestens max(2, Zielstufe) | 5 | +5 % Ausbildungs-/Herstellungsgeschwindigkeit |
| Ladetechnik | loadingTechniques | Lagerlogistik (logistics) Stufe 1 | mindestens max(2, Zielstufe) | 5 | +5 % Traglast |

Für diese drei neuen Technologien gilt je Zielstufe L:
- Kosten: 150 × L Holz und 150 × L Stein; keine weiteren Ressourcen.
- Basisforschungsdauer: 90 × L Sekunden, anschließend vorhandenen Universitäts- und Forschungsleitungsbonus wie bisher anwenden und nach der vorhandenen Forschungszeitregel runden.
- Vorhandene Forschungswertung: 10 Punkte je abgeschlossener Stufe, einmal je Kommandant. Neue IDs mit Stufe 0 erzeugen keine Punkte.
- Immer genau die nächste Stufe erforschen. Freigeschaltete Truppen/Gebäude und vorhandene Produktionsforschungen erhalten keine zusätzlichen Voraussetzungen.
- Ausbildungstechnik gilt für alle aktuell über die Ausbildungsqueue erzeugten Einheiten, einschließlich LKW-Herstellung. Keine neue Kampfkraft und kein niedrigerer Unterhalt.

### Konfiguration

Kosten, Grunddauer, Maximalstufen und Voraussetzungen zentral im versionierten Katalog definieren. Die drei neuen Bonusstärken zusätzlich über validierte ENV konfigurierbar machen:

| ENV | Standard | Bedeutung |
| --- | --- | --- |
| RESEARCH_CONSTRUCTION_BONUS_BPS | 500 | Basis­punkte Baugeschwindigkeit je Stufe |
| RESEARCH_TRAINING_BONUS_BPS | 500 | Basispunkte Ausbildungsgeschwindigkeit je Stufe |
| RESEARCH_LOADING_BONUS_BPS | 500 | Basispunkte Traglast je Stufe |

100 Basispunkte entsprechen 1 %. Zulässig sind ganze Zahlen von 0 bis 2000; ungültige Werte beim Serverstart mit verständlicher Meldung ablehnen. Fehlende Variablen verwenden den Standard, ausdrücklich 0 deaktiviert den jeweiligen Bonus. .env.example dokumentieren.

Konfiguration ausschließlich serverseitig lesen und normalisierte Regeln in den unabhängigen Kern übergeben. Vorhandenes Verfahren für gespeicherte Weltregeln/Regelwechsel nutzen, ohne neue Umgebungsvariablen direkt in Kern- oder Browsercode auszuwerten. Änderungen gelten ab ihrem gespeicherten Aktivierungszeitpunkt für neu angenommene Aufträge; bereits bezahlte Aufträge/Reisen behalten ihre gespeicherten Werte. Es ist keine allgemeine Laufzeit-Konfigurationsoberfläche beauftragt.

## 4. Bau und Ausbildung: Wirkung beim Annehmen eines Auftrags

Mit Forschungsstufe L und Bonus b in Basispunkten gilt der Geschwindigkeitsfaktor:

F = (10000 + b × L) / 10000.

Neue effektive Arbeitsdauer = max(1, ceil(bisherige berechnete Arbeitsdauer in Millisekunden / F)).

- Die bisherige berechnete Arbeitsdauer enthält bereits vorhandene Gebäudestufen-/Mengenfaktoren. Forschung genau einmal darauf anwenden.
- Beispiel: 60000 ms ohne Forschungsbonus werden bei Stufe 5 und Standardbonus zu 48000 ms. Das sind +25 % Geschwindigkeit beziehungsweise 20 % weniger Zeit, nicht 25 % weniger Zeit.
- Bautechnik betrifft Neubau und Ausbau sämtlicher aktueller ziviler und militärischer Gebäude. Sofortiger Abriss, Forschungsdauer und Reisezeit werden nicht verkürzt.
- Ausbildungstechnik betrifft neue Ausbildungs-/Herstellungsgruppen in Kaserne und Fahrzeugfabrik. Mengen, Kosten, Unterhalt und Kampfdaten bleiben gleich.
- Wirkung wird bei serverseitiger Annahme und Bezahlung in die Queue festgeschrieben, auch für wartende Aufträge. Ein späterer Forschungsabschluss verkürzt weder den aktiven noch bereits wartende Aufträge.
- Speichere nachvollziehbar Regelversion, angewendete Forschungsstufe, Bonus, Dauer ohne diesen Bonus und effektive Arbeitsdauer. Vorhandene Zahlungen und Termine nicht nachträglich rekonstruieren.
- Hungerpausen bleiben erhalten: Ausbildung steht während der Pause und setzt dieselbe Restarbeit fort. Pausenzeiten dürfen Termine wie bisher verschieben; Forschung verändert diese Restarbeit nicht rückwirkend.
- Neue Vorschau und tatsächliche Annahme verwenden denselben Kernpfad. Ändert sich die relevante Forschungsstufe/Regel zwischen beiden, muss der Nutzer die aktualisierte Vorschau sehen, bevor bezahlt wird. Keine Laufzeit vom Client übernehmen.

## 5. Ladetechnik: gemeinsame Frachtkapazität und Betriebsöl

Die effektive Kapazität je Einheit wird einmalig berechnet:

effektiveTypkapazität = floor(Basiskapazität × (10000 + b × L) / 10000).

Gruppenkapazität = Summe aus Anzahl je Typ × effektiver Typkapazität.

- Je Typ zuerst abrunden, danach mit der Anzahl multiplizieren und summieren. Mit sicheren Ganzzahlen/rationalen Zwischenwerten arbeiten; keine schleichenden Rundungs- oder Doppelbonusfehler.
- Standardbeispiele: Infanterie trägt auf Stufe 0 weiterhin 20, auf Stufe 1 genau 21 und auf Stufe 5 genau 25. Ein LKW trägt 200/210/250. Vier LKW tragen auf Stufe 5 insgesamt 1000 statt 800.
- Es gelten die tatsächlich konfigurierten Basiskapazitäten. Niemals dauerhaft die Basiswerte im Weltregelsatz oder Einheitenkatalog mit dem Bonus überschreiben.
- Späher behalten Güterkapazität 0. Ihre separaten Betriebsöltanks und die Tanks reiner General-Diensttransporte erhalten keinen Ladetechnikbonus.
- Alle neuen Bewegungen mit normalem Frachtraum berücksichtigen Ladetechnik: NPC-Farmzüge, Feld-Eroberungszüge, Ressourcenlieferungen und entsprechende Truppenverlegungen. Reine Späh- und Generalreisen behalten ihre bisherigen Tankgrenzen.
- Eigene Güter, freiwillige Ölladung und Betriebsöl belegen weiterhin gemeinsam die passenden Plätze. Mehr Traglast kann die Reichweite normaler Frachteinheiten erhöhen, erzeugt aber weder Öl noch freie Reserve.
- Ölrate, Verbrauchsformel, Ankunftsverzögerung und normale Rückfahrt bleiben unverändert. Das gesamte bezahlte Betriebsöl wird nach den bestehenden Regeln verbraucht; kein Bonusrefund und kein zweiter Stadtabzug.
- Bei Missionstart die effektiven Typkapazitäten, Forschungsstufe und Bonusregeln speichern. Die serverseitige Vorschau bindet dieselben Werte.
- Kampfverluste verwenden für überlebende Einheiten die beim Start gespeicherten Typkapazitäten. Kein Wechsel auf den aktuellen Forschungsstand bei Kampf, Rückreise, Neustart oder Zustellung.
- Weiterhin: Rückwegreserve vor eigener Ladung vor neuer Beute. Neue Beute höchstens nach freier Kapazität und tatsächlichem NPC-Vorrat; kein höherer Plünderertrag ohne freie Plätze.
- Empfängerforschung verändert niemals die Transportkapazität einer fremden Lieferung. Die Annahme von Gütern richtet sich dagegen wie bisher nach dem tatsächlichen Lagerbestand und der aktuellen Lagerkapazität der Zielstadt bei Zustellung.
- Dauerhafte Verlegung bleibt ohne freiwillige Ressourcenfracht und ohne Rückfahrt. Nach Ankunft verwenden erst künftig gestartete Aufträge die dann geltende Forschung des Besitzers.

Rechenprobe für den vorhandenen Kampffall: 20 Infanteristen und 4 LKW haben mit Ladetechnik 5 insgesamt 1500 Plätze. Nach 5 Infanterie- und 1 LKW-Verlust bleiben 1125. Bei 22,5 Rückwegöl stehen floor(1125 − 22,5) = 1102 Güterplätze bereit; mit 300 eigener Ladung maximal 802 neue Beute, sofern der NPC sie besitzt. Dies ändert weder den Kampf noch seine Ölberechnung.

## 6. Zeitpunkt, Mehrstadtbetrieb und Migration

- Forschung ist genau zum gespeicherten Abschlusszeitpunkt wirksam. Vor jedem neuen Befehl alle fälligen Ereignisse bis einschließlich Befehlszeit abrechnen.
- Alle eigenen Städte profitieren ab diesem Zeitpunkt, auch nicht geöffnete und später gegründete. Für Bau-/Ausbildungsgeschwindigkeit betrifft dies nur danach angenommene Aufträge.
- Eine laufende Forschung bleibt an ihre zahlende Stadt, Universität und dortige Forschungsleitung gebunden. Stadtwechsel im Client verlagert nichts.
- Bei gleichen Zeitstempeln die bestehende deterministische Ereignisreihenfolge erhalten und dokumentieren. Offline-Abrechnung in einem großen Schritt und in vielen kleinen Schritten muss dasselbe Ergebnis ergeben.
- Ausgangspunkt ist aktuell Spielerschema 17 und Weltschema 4. Vor Änderung die tatsächlichen Versionen prüfen und nur nötige neue Versionen vergeben; bestehende Migrationsketten erhalten.
- Neue Forschungs-IDs beginnen bei 0. Bestehende Forschung, Kosten, Universitäten, Standorte, Generäle, Queues, Städte, Punkte und Berichte bleiben erhalten.
- Aktuell ist research-3-logistics-provisional aktiv; research-1-provisional und research-2-leadership-provisional werden ebenfalls für Altaufträge unterstützt. Auch nach Einführung einer neuen Version müssen alle bereits akzeptierten Forschungsaufträge korrekt abschließen.
- Historische Bau-/Ausbildungsaufträge ohne Forschungsmetadaten behalten ihre gespeicherten Arbeitszeiten und Zahlungen; keine rückwirkenden Boni oder Neugebühren.
- Historische Reisen verwenden ihre vorhandenen Kapazitäts-/Öl-/Ladungsregeln. Fehlende Forschungsmetadaten dürfen nicht aus heutigen Forschungsstufen ergänzt werden.
- Keine unbekannten Datensätze stillschweigend zurücksetzen. Fehler müssen sichtbar bleiben, ohne den gespeicherten Originalstand zu überschreiben.
- Forschungspunkte einmal spielerweit ableiten, auch bei fünf Städten. Wiederaufnahme/Restart darf keinen Abschluss oder Punktgewinn verdoppeln.

## 7. Forschungsoberfläche im Spielrahmen von Auftrag 16

Die vorhandene Seite „Forschung“ ausbauen, ohne neue Hauptmenüpunkte oder lange zusätzliche Seitenleisten.

- Zeige die neun aktiven Technologien in übersichtlichen Gruppen, mit nachvollziehbaren Abhängigkeiten. Ein vollständig bedienbarer Karten-/Listenmodus genügt; keine zusätzliche Graph-Engine erforderlich.
- Jede Technologie zeigt aktuelle/Maximalstufe, Wirkung jetzt und nach dem nächsten Upgrade sowie den Zustand verfügbar, gesperrt, läuft oder maximal.
- Detailbereich oder zugängliches Modal: konkrete fehlende Voraussetzungen, zahlende Stadt, passende Universität, Forschungsleitung, Ressourcenpreis, Dauer und Aktion.
- Wissensstand klar als spielerweit kennzeichnen; Zahlungs- und Forschungsort klar als Stadtbezug. Beim Stadtwechsel ungültige lokale Auswahl/Vorschau verwerfen, laufende Forschung sichtbar lassen.
- Laufender Auftrag zeigt Technologie, Zielstufe, Ausgangsstadt und verbleibende Zeit. Fortschritt darf angezeigt werden, Abschluss wird ausschließlich vom Server bestätigt.
- Bau- und Ausbildungsangebote zeigen tatsächliche Dauer und nachvollziehbaren Forschungsbonus. Alte Queueeinträge bei Bedarf als „Werte bei Auftragserteilung“ erklären.
- Einsatz-/Liefer-/Verlegungsdialoge zeigen effektive Traglast, Ladetechnikanteil, Betriebsöl, eigene Ladung und freie Plätze; getrennte Tanks verständlich darstellen.
- Bei +25 % Geschwindigkeit eine Zeitersparnis von 20 % korrekt beschriften. Keine pauschale Anzeige „25 % schneller fertig“.
- Desktop und schmale Mobilansicht prüfen, Tastatur/Fokus/Schließen unterstützen; Information nicht ausschließlich über Farbe, Hover oder Verbindungslinien vermitteln.
- Nach Wiederverbindung den autoritativen Zustand laden. Keine Forschung allein im Browser freischalten.

## 8. WebSocket, Befehle und Persistenz

- Alle Spielaktionen, Angebote und Zustandsänderungen über die vorhandene WebSocket-Verbindung. Statische Dateien dürfen wie bisher per HTTP ausgeliefert werden.
- Vorhandene Forschungsereignisse erweitern, statt einen konkurrierenden Transport oder REST-Spielendpunkte anzulegen.
- Server prüft Eigentum, cityId, Universität, Generalstandort/-rolle, nächste Forschungsstufe, Voraussetzungen, Bezahlung und gemeinsame Queue.
- Relevante Forschungs-/Regelstände in Vorschauen von Forschung, Bau, Ausbildung und Reisen einbinden. Bei veralteten Werten keine Abbuchung; aktualisierte Vorschau und verständlichen Grund liefern.
- Befehls-IDs bleiben idempotent: doppelte Nachricht oder Wiederholung nach Reconnect darf weder doppelt bezahlen noch erneut einreihen oder belohnen.
- Zustandsänderung, Zahlung und Wiederholungsbeleg atomar speichern; vorhandene Welt-/Spieler-Journale erhalten.
- Nur Eigentümer-Sitzungen erhalten private Forschungsstände. Kein Leck fremder Forschung über Karten, Transportdialoge oder Broadcasts.

## 9. Umsetzung und Abnahme

Arbeite in überprüfbaren Schritten: Bestand prüfen → Katalog/Migration → Bau/Ausbildung → Frachtintegration → Forschungs-UI → gezielte Integration und Dokumentation. Halte den Auftrag bis zum beschriebenen spielbaren Ablauf zusammen; reine Datenstruktur ohne Effekte erfüllt ihn nicht.

Mindestens folgende Risiken mit gezielten automatisierten Tests abdecken:

1. Alle sechs alten Technologien behalten Voraussetzungen, Preise und Effekte; drei neue starten bei 0. Fehlende Vorgänger/Universität, falsche Stufe, fehlende Mittel und parallele Forschung in einer anderen Stadt werden abgewiesen.
2. Neues Wissen wirkt einmal in allen fünf Städten. 10 Forschungspunkte je abgeschlossener neuer Stufe, keine Punkte aus Migration, Vorschau oder bloßem Start.
3. Bau-/Ausbildungsdauer bei Stufen 0, 1 und 5, mit vorhandenen Gebäude-/Mengenfaktoren; zivile und militärische Bauten sowie alle vorhandenen Einheitentypen.
4. Aktive und wartende Altaufträge überstehen Forschungsabschluss und Neustart unverändert. Neue Aufträge nutzen den Bonus; Hungerpause erhält ihre Restarbeit.
5. Traglast je Typ und Gruppe einschließlich abweichender konfigurierter Basiskapazität; Boni genau einmal. Späher-/Generaltanks unverändert. Kosten-/Kapazitätsgrenzen und zu schwere Ladung prüfen.
6. Fracht-Rechenprobe aus Abschnitt 5 einschließlich Verluste, Reserve und Beute; laufende Mission behält beim Forschungsabschluss ihre alten Kapazitäten.
7. Lieferung an eigene und fremde Stadt, dauerhafte Verlegung, reine General- und Späherreise; Empfängerforschung verändert keinen Frachtraum. Bestehende Unterhalts-/Ölregeln bleiben erhalten.
8. Offline-Zeitfortschritt, simultane Abschlüsse, Restart sowie Migration bestehender Forschungsversionen und Missionen; Vergleich großer mit kleinen Zeitschritten.
9. Veraltete Vorschau, wiederholte Befehls-ID und zwei gleichzeitige Sitzungen: genau eine zulässige Zahlung/Änderung; keine fremden privaten Forschungsdaten.
10. ENV-Standard, 0, Obergrenze und ungültige Werte; gespeicherter Regelwechsel ändert nur neue Aufträge.

Führe npm test und den vorhandenen Client-Build aus; ergänze Browserprüfung des Spielablaufs auf Desktop und Mobilansicht. Dokumentiere ausgeführte Befehle, Ergebnisse und tatsächliche Grenzen. Keine nicht ausgeführten Tests als bestanden angeben.

Spielbarer Abnahmepfad:
- Zwei eigene Städte, Universität mit erreichbaren Voraussetzungen und dortige freie Forschungsleitung.
- Vor dem Forschungsabschluss mindestens einen Bau-/Ausbildungsauftrag und einen Transport starten.
- Eine neue Technologie erforschen; alte Aktionen laufen mit alten Werten weiter.
- Neue passende Aktion in der anderen eigenen Stadt erhält den Bonus; Anzeige und Server stimmen überein.
- Für alle drei Technologien wiederholen, Sitzung neu verbinden und Server neu starten.
- Bestehende Spielstände ohne Reset weiterspielen.

Aktualisiere README.md, docs/PROJECT.md, docs/WEBSOCKET.md und .env.example passend zum tatsächlich implementierten Stand. Erstelle docs/RESEARCH_EXPANSION_VALIDATION.md mit Balanceformeln, Migrationsverhalten, ausgeführten Tests, Browsernachweisen und bekannten Grenzen. Die Quellenabgrenzung in docs/RESEARCH_REFERENCE.md bewahren. PR-Beschreibung erklärt Nutzen, Verhalten, Migration und Prüfung.

## 10. Abgrenzung und danach

Dieser Auftrag implementiert keine vollständige Kopie der 19 historischen Forschungsthemen. Keine neuen Kampfboni, Truppenarten, Flugzeuge, Raketen, Bevölkerung, Gold/Stahl, Generalsausrüstung, Bündnisse, PvP oder Föderation.

Anschließend als eigenen Auftrag vorschlagen: Einführung/Aufgaben mit einmaligen Belohnungen und einer stadtübergreifenden Versorgungsübersicht. Danach Bündnisse/Unterstützung, geregelter Handel und PvP-Vorbereitung weiter konkretisieren. Matrix bleibt ein eigener Entwicklungsstrang.

Erwartetes Ergebnis: ein erweiterbarer, verständlicher Forschungskatalog mit drei nachweislich funktionierenden Verbesserungen und unverändert nutzbaren bestehenden Spielständen.
