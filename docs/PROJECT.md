# Projektziel und Arbeitsplan

## Ziel

Ein dauerhaftes Browserstrategiespiel mit eigenständiger Implementierung. Spielcode im Browser und auf dem Server wird in JavaScript geschrieben. HTML und CSS übernehmen Struktur und Darstellung. Jeder soll später eine eigene Instanz betreiben können. Die Teilnahme an einer Föderation bleibt optional. Blockchain und eine zentrale Pflichtregistrierung sind nicht vorgesehen.

## Etappen

| Etappe | Ergebnis | Status |
| --- | --- | --- |
| 0 | Startbarer Server, lokale Demo-Stadt, Rohstoffe, Ausbau, Speichern, Tests | Implementiert |
| 1 | Stadtkarte, feste Bauplätze, Errichten/Ausbauen und Warteschlange | Implementiert |
| 1b | Stufenabhängige Lagerkapazitäten, ausbaubares Lagerhaus und Gebäudeabriss mit Teilrückerstattung | Geplant; eigene spätere Ausbauetappe |
| 2 | Konten, eigene Stadt pro Spieler, Berechtigungen und JSON-Migrationen | Implementiert (JSON-Prototyp) |
| 3a | Sichtbare quadratische Weltkarte, Spielerpositionen, gemeinsame NPC-Städte und Entfernungen | Implementiert laut aktuellem Projektstand |
| P | Kommandantenpunkte aus Gebäuden, Forschung und Kämpfen einschließlich Niederlagen | Grundsystem in Auftrag 4; Gebäude-Testregel vorgeschlagen, Forschung/Kämpfe später |
| 3b | Aufklärung und Truppenbewegung auf Grundlage der späteren Armeen | NPC-Aufklärung in Auftrag 4; noch nicht implementiert |
| 4a | Universitäten und Forschung, Truppen sowie Generäle mit Erfahrung, Leveln und Truppenzuweisung | Generäle laut Nutzer angelegt; Mehrfachverwaltung/Skillgrundlage in Abschnitt E von Auftrag 4; Forschung weiterhin später |
| 4b | Kämpfe, NPC-Farmzüge, Beute, Rückkehr, General-Erfahrung und Berichte | Geplant |
| 5 | Bündnisse, Unterstützung und Handel innerhalb einer Welt | Geplant |
| 6 | Matrix-Anbindung, Identitätszuordnung, Vertrauensregeln und Spielereignisse zwischen zwei Instanzen | Geplant |
| 7 | Serverübergreifende Bündnisse und abgegrenzte gemeinsame Gefechte | Geplant |
| 8 | Betrieb, Backups, Missbrauchsschutz, Community und Veröffentlichung | Geplant |

Vor jeder Etappe definieren wir einen konkreten Spielablauf und dessen Erfolgskriterien. Keine Zeit- oder Aufwandszusage für das vollständige Spiel: Umfang und Detailtreue sind noch offen.

## Implementierter Stand von Etappe 1

- Die lokale Demo-Stadt besitzt neun feste, auswählbare Bauplätze. Drei beginnen mit den bisherigen Produktionsgebäuden, sechs sind frei.
- Sägewerk, Steinbruch und Bauernhof können auf freien Plätzen errichtet und bestehende Exemplare bis Stufe 10 ausgebaut werden.
- Bis zu drei Aufträge werden serverseitig in fester Reihenfolge abgearbeitet. Ein Platz kann nicht gleichzeitig widersprüchlich verplant werden.
- Kosten und Dauer stammen aus Angeboten der Spiellogik; der Browser berechnet keine eigenen Preise. Kosten werden bei Annahme einmalig abgezogen. Auftrags-IDs verhindern eine doppelte Abbuchung bei wiederholter Übermittlung.
- Mehrere während einer Abwesenheit beendete Aufträge werden chronologisch verrechnet. Die Produktion ändert sich jeweils zum tatsächlichen Fertigstellungszeitpunkt.
- Schema 1 wird beim Laden ausdrücklich auf Schema 2 migriert. Identität, Rohstoffe, Gebäude und ein laufender Altauftrag bleiben erhalten; unbekannte Versionen werden ohne Überschreiben abgewiesen.

Die Obergrenze von drei Aufträgen, neun Bauplätze sowie alle Kosten und Bauzeiten sind vorläufige eigene Balancewerte. Abbruch, Rückerstattung und weitere Gebäudetypen sind nicht Teil dieser Etappe.

## Implementierter Stand von Etappe 2

- Registrierung und Anmeldung verwenden gesalzene `scrypt`-Kennworthashes; zufällige, ablaufende und widerrufbare Sitzungen ermöglichen den Wiederbeitritt.
- Jede Identität besitzt eine eigene atomar gespeicherte JSON-Stadt. Mehrere Verbindungen werden serialisiert und gemeinsam aktualisiert.
- Private Zustände und Befehle laufen über ein versioniertes WebSocket-Protokoll; alte HTTP-Spielendpunkte liefern keine Spielstände mehr.
- Die responsive Stadtlandschaft verwendet selbst erstellte CSS-Gebäude, Wege und sichtbare Baustellen.
- Die alte Demo-Stadt wird nur durch einen ausdrücklichen Betreiberbefehl einem gewählten Konto zugeordnet.

Datenbank, Passwortwiederherstellung, E-Mail-Verifikation und produktiver Mehrprozessbetrieb bleiben geplant. Matrix-Föderation, NPC-Städte und Generäle gehören weiterhin zu späteren Etappen.

## Implementierter Stand von Etappe 3a

- Jede Serverwelt besitzt eine einmal erzeugte, versionierte 24×24-Karte. Gelände, 18 NPC-Identitäten und Spielerpositionen bleiben in `world.json` stabil.
- Registrierung und Migration wählen unter der serialisierten Weltsperre zufällig aus allen freien, nicht als Wasser markierten Feldern. Dadurch entstehen neue Städte nicht systematisch direkt nebeneinander; bereits belegte Felder bleiben ausgeschlossen. Stadt-IDs bleiben unabhängig von ihren Koordinaten stabil.
- Angemeldete Spieler laden begrenzte Ausschnitte per WebSocket, suchen Koordinaten, verschieben die Karte durch Ziehen mit Maus oder Touch sowie über Richtungstasten und zoomen die Karte. Neue Spielerstädte erscheinen per Push.
- Öffentliche Antworten enthalten Gelände, Namen, Stadtart, Kommandantenname beziehungsweise NPC-Schwierigkeit und euklidische Luftlinienentfernung. Interne NPC-Vorräte sowie fremde Stadt-, Konto- und Baudaten werden nicht übertragen.
- Das interne NPC-Modell sieht Nahrung, Kapazität, Regenerationsrate und Zeitstempel vor. Regeneration, Plünderung, Garnison, Marsch und Kampf sind ausdrücklich noch nicht aktiv.

Kartengröße, NPC-Anzahl, Schwierigkeitsstufen und interne Vorratswerte sind reversible eigene Prototypwerte und keine bestätigten War2Glory-Werte.

## Aktueller Codex-Auftrag vom 28.09.2026: Punkte und erste NPC-Einsätze

Die Weltkarte ist laut Nutzer und Repository umgesetzt. Der Nutzer möchte weitere Arbeitsanweisungen, damit dort sinnvolle Aktionen möglich werden. CODEX_PROMPT.md enthält dafür Auftrag 4 mit folgenden zusammenhängenden Teilen:

1. Kommandantenpunkte, zunächst aus fertiggestellten Gebäuden; spätere Forschungs- und Kampfbeiträge getrennt vorbereiten.
2. Eigene Militärseite mit getrennten militärischen Bauplätzen, ausbaubarer Kaserne, persistenter Ausbildung von Spähern und Infanterie sowie einem General mit Erfahrung, Level und Führungskapazität.
3. Erste NPC-Aufklärung mit zugewiesenem General und Spähern, Hin-/Rückmarsch und privaten zeitgestempelten Berichten.
4. Neustartfeste JSON-Abläufe, WebSocket-Ereignisse, Migration und gezielte Tests.

Generäle sind laut neuer Nutzerangabe bereits angelegt. Der Umsetzungsstand der übrigen beauftragten Funktionen ist dadurch nicht zusätzlich bestätigt. Echte Angriffe, Verluste und Nahrung als Beute sind der nächste separate Schritt.

### Vorläufige Arbeitsvorschläge für den Review

Die folgenden Werte wurden vom Planungschat zur Konkretisierung des Codex-Auftrags vorgeschlagen. Sie sind keine einzeln vom Nutzer bestätigten Balanceentscheidungen und keine Originalwerte von War2Glory. Codex soll sie konfigurierbar umsetzen und im Pull Request ausdrücklich zur Prüfung ausweisen:

- Gebäudepunkte: 10 × Summe der fertiggestellten Gebäudelevel. Drei Gebäude auf Stufe 1 ergeben 30 Punkte; ein Upgrade auf Stufe 2 erhöht die Summe auf 40. Spätere Abrisse entfernen den jeweiligen Gebäudebeitrag.
- Punkteübersicht zunächst nur für den Eigentümer; keine öffentliche Rangliste. Forschungs- und Kampfwertung noch inaktiv, keine erfundenen historischen Beiträge.
- Genau ein kostenloser Startgeneral pro Kommandant. General-Erfahrung bleibt von Kommandantenpunkten getrennt.
- Generallevel L ab insgesamt 50 × L × (L − 1) Erfahrung; vorläufig maximal Level 10. Führungskapazität: 20 × Level Einheiten.
- Erste zurückgekehrte Aufklärung je Kommandant und NPC-ID: 10 Erfahrung für den eingesetzten General; keine erneute Erstbelohnung beim gleichen Ziel.
- NPC-Aufklärung ohne Verlust- oder Entdeckungsrisiko als erste Testfassung, Berichte erst bei Rückkehr. Keine Aufklärung fremder Spielerstädte.
- Einfache Luftlinienreise: je Richtung mindestens 5 Sekunden, ansonsten aufgerundete Entfernung in Feldern × 5 Sekunden. Gelände verhindert in dieser Fassung noch keine Reise.
- Kosten und Ausbildungszeiten für Kaserne/Einheiten werden als günstige, dokumentierte Testwerte zentral festgelegt. Die bisherigen Stadt- und Gebäuderegeln bleiben ansonsten erhalten.

Die endgültige Punktgewichtung, Niederlageneinflüsse, militärische Balance und weitere zuvor offene Produktentscheidungen bleiben abzustimmen. Diese Vorschläge machen den Prototyp prüfbar und ändern nicht den Status offener Langfristentscheidungen.

### Weitere Arbeitsfolge nach Auftrag 4

- Zunächst Generalverwaltung und Skillgrundlage gemäß Ergänzung vom 28.09.2026 und Abschnitt E des Codex-Auftrags erweitern; offene Balance- und Rekrutierungsregeln anschließend gemeinsam festlegen.
- NPC-Farmzüge mit echter Garnison, Kampf, Verlusten, Beutetransport und allmählicher Regeneration der gemeinsam genutzten Nahrungsvorräte. Dabei Kampf- und Niederlagenpunkte anschließen.
- Stufenabhängige Lagerkapazität, Lagerhaus und Gebäudeabriss nach Klärung der offenen Regeln.
- Universitäten/Forschung einschließlich Forschungspunkten; weitere Truppen und Waffensysteme.
- Anschließend Bündnisse, Handel und Matrix-Föderation gemäß den bestehenden Zielen.

## Generalverwaltung und Skillpunkte: Ergänzung vom 28.09.2026

Laut Nutzer sind Generäle bereits angelegt. Diese Angabe bestätigt nicht automatisch alle übrigen Teile von Auftrag 4. Der nächste Projektschritt erweitert die Generalverwaltung; Abschnitt E in CODEX_PROMPT.md enthält die Arbeitsanweisungen.

### Bestätigte Anforderungen

- Ein Kommandant soll mehrere Generäle besitzen können. Wann weitere Generäle erzeugt werden können, entscheiden wir später.
- Jeder General erhält später durch Kämpfe eigene Erfahrung.
- Erfahrung wird in Skillpunkte umgerechnet, die auf Eigenschaften verteilt werden und deren Bonuswirkungen erhöhen.
- Der Erfahrungsbedarf je zusätzlichem Skillpunkt steigt mit der bereits erreichten Skillpunktzahl.
- Jeder General kann einen eigenen Namen erhalten. Name und Eigenschaften werden in einem Modal bearbeitet.
- Erfahrung, Skillpunkte, Eigenschaften und Einsätze gehören zum jeweiligen General und bleiben dauerhaft gespeichert.
- Führung, Angriff und Verteidigung sind als Eigenschaften bestätigt. Ihre konkreten Bonuswirkungen sind noch offen.
- Als spätere Einsatzrollen sind Truppengeneral, Bürgermeister in einer Stadt und Forschungsgeneral vorgesehen. Die Generalverwaltung soll diese unterschiedlichen Aufgaben ermöglichen.

### Ausführbarer nächster Schritt

- Bestehende Generäle verlustfrei als Sammlung mit stabilen IDs verwalten, im Militärbereich anzeigen und für Einsätze auswählen.
- Namen bearbeiten und ein Modal mit Fortschritt, Eigenschaften und vorgesehener Punkteverteilung ergänzen.
- Skillberechnung und Speicherung konfigurierbar vorbereiten und mit isolierten Testregeln prüfen. Echte Umrechnung und Bonusvergabe erst nach Festlegung der offenen Regeln aktivieren.
- Mehrere Generäle mit Testdaten prüfen; keine frei verfügbare Rekrutierung oder zusätzlichen kostenlosen Generäle für bestehende Konten erfinden.
- Bestehende Erfahrung, Level und aktive Einsätze erhalten; Änderungen über WebSocket mit serverseitiger Prüfung und privater JSON-Speicherung.
- Eigenschaften und Einsatzrolle getrennt modellieren. Eine erweiterbare Rollenzuweisung ist der technische Vorschlag; Bürgermeister- und Forschungswirkungen werden jetzt noch nicht aktiviert.

### Noch gemeinsam festzulegen

- Startkosten und Verlauf der steigenden Erfahrungskosten; automatische Umrechnung oder bewusster Spielerbefehl.
- Bonuswirkungen der bestätigten Eigenschaften Führung, Angriff und Verteidigung, Grenzen und Zusammenspiel mit Level und Führungskapazität.
- Wirkung dieser Eigenschaften in den Rollen Truppengeneral, Bürgermeister und Forschungsgeneral; Rollenplätze, Voraussetzungen, Wechsel und mögliche gleichzeitige Aufgaben.
- Erfahrungserwerb in zivilen Rollen und Wirkung von Rollenwechseln auf laufende Vorgänge. Bürgermeister und Forschungsgeneral bleiben spätere Implementierungsaufträge.
- Rekrutierungsbedingungen, mögliche Anzahlgrenzen und spätere Rücksetzung verteilter Punkte.
- Kampf-Erfahrungsbelohnungen und Verteilung bei mehreren beteiligten Generälen; künftige Rolle von Aufklärungs-Erfahrung.

Technischer Vorschlag für die Kostenbasis: insgesamt erworbene Skillpunkte einschließlich bereits verteilter Punkte. Das Ausgeben freier Punkte soll den nächsten Punkt nicht billiger machen. Insgesamt verdiente und bereits umgerechnete Erfahrung sowie freie und verteilte Skillpunkte werden getrennt nachvollziehbar geführt. Diese Auslegung und alle konkreten Balancewerte sind noch keine einzeln bestätigten Nutzerentscheidungen.

## Entscheidungen für diesen Prototyp

- Kleine Module, keine Framework- oder Datenbankabhängigkeiten zum Einstieg.
- Der Server entscheidet über Regeln, Zeit, Kosten und Zustandsänderungen.
- Reine Spiellogik mit explizitem Zeitparameter als Grundlage für spätere wiederholbare Simulationen.
- Föderation nach dem Matrix-Modell ist gewünscht. Bevorzugter technischer Ansatz: ein versioniertes Spielprotokoll auf Matrix; Machbarkeit in einer eigenen Etappe prüfen. Details in FEDERATION.md.
- Eigene Demo-Wirtschaft. Die Originalregeln von War2Glory wurden nicht vollständig erhoben oder verifiziert.
- MIT-Lizenz für den enthaltenen eigenen Code. Die gewünschte Lizenzpolitik für künftige Community-Beiträge ist noch abzustimmen.

## Bestätigte Ergänzungen vom 27.09.2026

- Die bisherige Entwicklungsreihenfolge bleibt bestehen.
- NPC-Städte sind ein Kernbestandteil: Spieler sollen sie angreifen können, um Nahrung zu farmen.
- Generäle sind ein Kernbestandteil: Sie befehligen Truppen und werden über ein Levelsystem aufgewertet.
- Dezentralisierung soll wie bei Matrix funktionieren; das Matrix-Protokoll darf dafür eingesetzt werden.
- Codex und GitHub werden für die Weiterentwicklung verwendet. Gewähltes Repository: https://github.com/bavxhack/War2glory. Der Nutzer richtet die zusätzliche Codex-Umgebung selbst ein; deren Einrichtung wurde hier nicht überprüft.

## Bestätigte Weltkartenregeln vom 27.09.2026

- Quadratische Felder mit Koordinaten.
- Gelände und Stadtpositionen sind von Anfang an vollständig sichtbar.
- Genaue Informationen zu fremden Städten werden erst in einer späteren Etappe durch Aufklärung zugänglich. Sie dürfen vorher auch nicht in öffentlichen Serverantworten enthalten sein.
- Alle Spieler einer Welt teilen dieselben NPC-Städte und deren Ressourcenbestände.
- Nach späteren Farmangriffen füllen sich diese Bestände allmählich bis zu einer Obergrenze wieder auf.
- Der Weltkartenschritt mit dauerhaften Stadtpositionen, öffentlichen Details und gemeinsamen NPC-Identitäten ist laut aktuellem Projektstand umgesetzt. Auftrag 4 ergänzt erste Truppen/Generäle und NPC-Aufklärung; Kämpfe, Beuteentnahme und aktive Regeneration folgen danach.
- Eine gemeinsame Karte pro Serverwelt dient als Ausgangspunkt. Die spätere Verbindung von Welten über Matrix ist damit noch nicht festgelegt.
- In diesem Planungschat entstehen nur Codex-Anweisungen; die Umsetzung und ihre Prüfungen übernimmt Codex.

## Bestätigte Trennung von Stadt- und Militärbauplätzen vom 28.09.2026

Diese Anforderung ergänzt den aktuellen Auftrag 4 und ist noch nicht als implementiert bestätigt.

- Militärgebäude erhalten zusätzliche, eigene Bauplätze, vorzugsweise auf einer zweiten Seite. Auftrag 4 setzt dies als Seite „Militär“ neben „Stadt“ und „Weltkarte“ um.
- Auf Militärbauplätzen dürfen keine Ressourcengebäude stehen. Kaserne und künftige Militärgebäude gehören in den Militärbereich; die bisherigen neun Bauplätze bleiben der zivile Bereich.
- Die Trennung gilt im gespeicherten Spielmodell und in der serverseitigen Bauprüfung, nicht allein in der Darstellung.
- Beide Bereiche gehören zur gleichen Stadt und teilen Ressourcen und Kommandantenpunkte. Bestehende Gebäude, Ausbaustufen und bezahlte Aufträge bleiben bei Migration erhalten.
- Falls bereits militärische Gebäude auf bisherigen Plätzen existieren, werden sie mit ihren Aufträgen verlustfrei auf Militärplätze übernommen; die bisherigen Plätze werden frei.
- Die genaue Zahl der Militärbauplätze ist noch offen. Codex verwendet zunächst eine zentral konfigurierbare, ausdrücklich vorläufige Zahl.
- Als technische Fortführung bleibt für Auftrag 4 die bisherige gemeinsame Bauwarteschlange bestehen. Zusätzliche parallele Bauwarteschlangen sind nicht beschlossen. Die Kasernenausbildung besitzt die im Auftrag vorgesehene eigene Warteschlange.
- Die spätere Zuordnung von Lagerhaus und Universität wird in deren jeweiliger Spezifikation festgelegt.

## Bestätigte Gebäude- und Lageranforderungen vom 27.09.2026

Diese Anforderungen sind für eine spätere Ausbauetappe aufgenommen. Sie sind noch nicht umgesetzt und gehören nicht zum aktuellen Auftrag 4.

### Lagerkapazität durch Gebäudeausbau

- Mit höherer Ausbaustufe eines Produktionsgebäudes wächst auch die Lagerkapazität der zugehörigen Ressource: Sägewerk → Holz, Steinbruch → Stein, Bauernhof → Nahrung.
- Lagerkapazität und Produktionsrate sind getrennte Gebäudewirkungen; die bisherige Produktionssteigerung bleibt bestehen.
- Die Kapazität muss künftig pro Ressource betrachtet werden. Konkrete Grundkapazitäten, Beiträge pro Stufe und die Verrechnung mehrerer Gebäude werden vor dieser Etappe abgestimmt.
- Die bisherige feste Lagergrenze ist ein Prototypwert und noch keine Umsetzung dieser Anforderung.

### Neuer Gebäudetyp Lagerhaus

- Ein Lagerhaus erhöht die Lagerkapazität aller Ressourcen.
- Es kann auf einem freien Bauplatz errichtet und über mehrere Stufen ausgebaut werden.
- Höhere Lagerhausstufen erhöhen dessen Kapazitätswirkung.
- Das Lagerhaus erhöht die speicherbare Menge, nicht automatisch die vorhandenen Rohstoffbestände oder deren Produktion.
- Baukosten, Bauzeiten, maximale Stufe, Kapazitätswerte und zulässige Anzahl sind noch festzulegen.

### Gebäudeabriss und Rückerstattung

- Spieler sollen eigene Gebäude später vollständig entfernen und den Bauplatz wieder nutzen können.
- Beim Abriss erhalten sie einen kleinen Anteil der Ressourcen zurück, die bis zur erreichten Gebäudestufe in dieses Gebäude investiert wurden.
- Die Rückerstattung bezieht sich auf die kumulierten Investitionen aus Neubau und abgeschlossenen Ausbaustufen; sie darf nicht allein aus den Kosten der letzten Stufe abgeleitet werden.
- Der genaue Rückerstattungsanteil ist noch nicht festgelegt. Es wird hier kein Prozentsatz vorgegeben.
- Bei der späteren Umsetzung müssen Investitionen je Gebäude und Ressourcenart nachvollziehbar bleiben. Änderungen an Baukosten dürfen keine rückwirkend erfundenen Zahlungen erzeugen. Für Altbestände ohne Investitionshistorie ist eine ausdrücklich dokumentierte Migrationsregel abzustimmen.
- Mit Entfernung eines Gebäudes entfallen auch dessen Produktions- und Kapazitätswirkungen. Ob der Abriss sofort oder nach einer Zeitspanne erfolgt, ist noch offen.
- Vor Umsetzung sind Regeln für volle Lager bzw. Überbestände nach Kapazitätsverlust, die Aufnahme der Rückerstattung und Gebäude mit aktiven oder wartenden Bauaufträgen festzulegen. Bestehende Vorräte dürfen nicht ohne eine abgestimmte Regel stillschweigend verschwinden.
- Abriss und Rückerstattung müssen später serverseitig geprüft, gemeinsam dauerhaft gespeichert und bei wiederholten Befehlen nur einmal ausgeführt werden. Die Oberfläche soll vor Bestätigung den Rückerstattungsbetrag und die Kapazitätsfolgen anzeigen.

Die konkrete Ausgestaltung dieser Ausbauetappe bleibt abzustimmen. Der aktuelle Auftrag 4 ergänzt Punkte, erste Armeen und NPC-Aufklärung.

## Bestätigte Forschungsanforderungen vom 27.09.2026

Forschung wird als spätere Ausbauetappe über den neuen Gebäudetyp Universität zugänglich. Sie ist noch nicht implementiert und gehört nicht zum aktuellen Auftrag 4.

### Universität und Forschungsbereiche

- Spieler können in Universitäten Forschungen durchführen.
- Wirtschaftsforschung kann die Förderung bzw. Produktion von Ressourcen erhöhen.
- Lagerforschung kann die Lagerkapazität erhöhen und ergänzt die bereits geplanten Kapazitätswirkungen von Produktionsgebäuden und Lagerhäusern.
- Militärforschung soll später Einfluss auf Waffensysteme und Truppengattungen haben. Welche Technologien neue Systeme freischalten und welche vorhandene Werte verbessern, wird bei deren Spezifikation festgelegt.
- Forschung soll später weitere Gebäudetypen zugänglich machen, die zusätzliche Verbesserungen ermöglichen. Die konkreten Gebäude und Wirkungen sind noch offen.
- Forschung erhöht nicht automatisch bereits vorhandene Ressourcenbestände: Produktionsverbesserungen betreffen den Ertrag, Lagerverbesserungen die speicherbare Menge.

### Vor der Umsetzung abzustimmen

- Konkrete Forschungen, Voraussetzungen und Abhängigkeiten; ein Forschungsbaum ist ein möglicher Darstellungs- und Strukturierungsvorschlag, noch keine fertig definierte Technologieauswahl.
- Forschungsstufen, Kosten, Dauer und maximale Verbesserungen.
- Universitätsausbau und dessen Einfluss, etwa auf verfügbare Forschungen, Forschungsgeschwindigkeit oder parallele Forschungsplätze.
- Eine oder mehrere gleichzeitig laufende Forschungen, Warteschlange sowie Abbruch- und Rückerstattungsregeln.
- Gültigkeit abgeschlossener Forschung pro Stadt oder für das gesamte Spielerkonto innerhalb einer Welt.
- Auswirkungen eines Universitätsabrisses auf laufende Forschung, abgeschlossene Erkenntnisse und bereits freigeschaltete Gebäude/Einheiten.
- Verrechnung von Forschungsboni mit Gebäudestufen und anderen Verbesserungen, einschließlich Rundung und etwaigen Grenzen. Keine Prozentwerte oder additive/multiplikative Formel sind bislang beschlossen.
- Ob militärische Verbesserungen bereits vorhandene Truppen betreffen und wie Freischaltungen mit Rekrutierung und Gebäudevoraussetzungen zusammenwirken.

### Leitplanken für die spätere Codex-Umsetzung

- Forschungsvoraussetzungen, Kosten, Abschluss und Freischaltungen werden serverseitig geprüft. Eine nur visuell gesperrte Bau- oder Rekrutierungsoption reicht nicht.
- Laufende und abgeschlossene Forschungen werden dauerhaft gespeichert und nach Abwesenheit bzw. Neustart korrekt fortgesetzt oder abgeschlossen. Bereits bezahlte Forschung darf nicht doppelt abgerechnet werden.
- Produktions- und Kapazitätsänderungen gelten ab dem tatsächlichen Forschungsabschluss; Offline-Erträge müssen davor und danach getrennt korrekt berechnet werden.
- Gebäudewirkungen und Forschungswirkungen bleiben nachvollziehbar getrennt. Die Oberfläche soll Voraussetzungen sowie aktuelle und kommende Effekte verständlich anzeigen.
- Forschungsabhängigkeiten dürfen keinen unerreichbaren Einstieg erzeugen; insbesondere muss eine erste Universität ohne die Forschung errichtbar sein, die sie selbst erst ermöglichen würde.
- Forschungsdaten gehören zum privaten Spieler-/Stadtzustand und dürfen nicht ohne eine später festgelegte Berechtigung öffentlich übertragen werden.
- Universität, Forschung, Lagerausbau, weitere Gebäude und das spätere Truppensystem werden vor ihrem jeweiligen Implementierungsauftrag gemeinsam aufeinander abgestimmt.

## Kommandanten-Punktesystem: hohe Priorität

Anforderung vom 27.09.2026: Für jeden Kommandanten soll eine Punktezahl berechnet werden. Gebäude, Forschung, Kämpfe und Niederlagen beeinflussen diesen Wert. Das System soll zeitnah eingeführt werden. Sein Grundsystem ist deshalb der erste Teil von Auftrag 4; Forschungs- und Kampfbeiträge folgen mit den jeweiligen Spielsystemen. Es ist noch nicht implementiert.

### Umfang und schrittweise Einführung

- Die Punkte gehören zum Kommandanten. Sie sind von Erfahrungspunkten und Leveln einzelner Generäle zu unterscheiden.
- Die Berechnung berücksichtigt getrennt Gebäudeentwicklung, Forschungsfortschritt und bestätigte Kampfergebnisse einschließlich Niederlagen.
- Das Grundsystem kann zuerst mit den bereits vorhandenen Gebäuden eingeführt werden. Forschungs- und Kampfbeiträge werden mit Einführung dieser Spielsysteme angeschlossen. Es dürfen keine nicht gespielten Gefechte oder nicht abgeschlossenen Forschungen erfunden werden.
- Der Spieler soll seine Gesamtpunkte und deren nachvollziehbare Zusammensetzung sehen. Ob Gesamtpunkte öffentlich auf der Weltkarte oder in einer Rangliste erscheinen, ist noch abzustimmen. Private Gebäude-, Forschungs- und Kampfdaten bleiben dabei geschützt.
- Zunächst gilt die Bewertung innerhalb einer Serverwelt. Eine spätere serverübergreifende Wertung benötigt eigene Vertrauensregeln und gehört nicht zu dieser ersten Umsetzung.

### Berechnungsmodell vor der Umsetzung abstimmen

Als Diskussionsgrundlage, noch nicht beschlossen: Gesamtpunkte setzen sich aus Gebäudepunkten, Forschungspunkten und Kampfpunkten zusammen; Niederlagen können innerhalb der Kampfwertung einen Abzug erzeugen. Konkrete Zahlen, Gewichtungen und Abzugsregeln sind noch offen.

- Gebäude: Bewertung nach Typ und erreichter Stufe oder nach nachvollziehbaren Investitionen? Zählen vorhandene Gebäude oder dauerhaft erworbene Bauleistungen? Welche Wirkung haben Abriss, Wiederaufbau und abgebrochene Aufträge?
- Forschung: Bewertung abgeschlossener Technologien und Stufen; laufende Aufträge nicht mit abgeschlossenen Forschungen verwechseln. Gültigkeit pro Stadt oder Konto berücksichtigen, damit dieselbe Forschung nicht mehrfach zählt.
- Kämpfe: Bewertung nach Sieg, Gegnerstärke, erbrachter Leistung oder Verlusten? NPC- und Spielerkämpfe gegebenenfalls unterschiedlich behandeln.
- Niederlagen: Fester oder variabler Einfluss, etwa abhängig von eigenen Verlusten? Verhindern, dass derselbe Verlust ungewollt sowohl über eine Ergebnisstrafe als auch über verlorene Einheiten doppelt abgezogen wird.
- Untergrenze: Darf die Gesamtwertung negativ werden oder gibt es eine Mindestpunktzahl?
- Zeitpunkt, Rundung, Gleichstände sowie eine mögliche spätere Rangliste sind vor dem ausführbaren Codex-Auftrag festzulegen.

### Anforderungen an die spätere Codex-Umsetzung

- Der Server berechnet alle Punkte aus verbindlichen Zuständen und bestätigten Ereignissen. Clients dürfen weder Punkte setzen noch Kampfergebnisse selbst bestätigen.
- Punktregeln werden zentral und versioniert definiert. Die angezeigte Summe muss aus denselben Regeln stammen wie die gespeicherte bzw. abgeleitete Wertung.
- Ergebnisabhängige Beiträge werden anhand stabiler Ereignis-IDs nur einmal verbucht; Wiederverbindung, Wiederholung und Neustart dürfen keine Punkte vervielfachen.
- Punkte, Begründungen und notwendige Ereignisnachweise bleiben im JSON-Speichermodell nachvollziehbar. Speicherung und Wiederherstellung müssen zum zugrunde liegenden Bau-, Forschungs- oder Kampfabschluss konsistent sein.
- Vorhandene Gebäude können gemäß der später vereinbarten Regel als Ausgangsbewertung übernommen werden. Fehlende historische Kampf- oder Forschungsdaten werden nicht geschätzt oder erfunden.
- Änderungen werden über WebSocket an die berechtigten Spieler übertragen. Für private Aufschlüsselungen gelten dieselben Zugriffsgrenzen wie für sonstige private Spielzustände.
- Prüfe später insbesondere Neuberechnung, Migration, Reihenfolge und Wiederholung von Ereignissen, Kontentrennung, Neustart und die vereinbarten Regeln für Abriss sowie Niederlagen.
- Mehrfaches Bauen/Abreißen oder wiederholte Abrechnung desselben Gefechts darf keinen unbeabsichtigten Punktegewinn erzeugen. Regeln gegen gezieltes gegenseitiges Punktefarmen sind mit dem Kampfsystem zu definieren.

## Weitere vorgeschlagene Spielregeln, noch abzustimmen

**NPC-Städte:** Gemeinsame Nutzung und allmähliche Ressourcenregeneration nach dem Farmen sind bestätigt. Stufen, Garnisonen, konkrete Vorratsgrößen und Regenerationsraten bleiben auszugestalten. Farmzüge brauchen Marschzeit, Kampfauswertung, Traglast und Rückkehr. Nahrung wird erst nach erfolgreicher Rückkehr gutgeschrieben. Gleichzeitige Angriffe dürfen denselben Vorrat nicht mehrfach plündern. Weitere Rohstoffe als Beute bleiben eine offene Entscheidung.

**Generäle:** Rekrutierung, Name, Erfahrungspunkte, Level, Attribute und Zuweisung zu einer Armee. Bestätigte Attribute: Führung, Angriff und Verteidigung; deren konkrete Bonusformeln bleiben offen. Bestätigte spätere Einsatzrollen: Truppengeneral, Bürgermeister und Forschungsgeneral. Eine vorgeschlagene Führungskapazität begrenzt die befehligten Truppen. Ein General kann nur einen aktiven Marsch gleichzeitig befehligen. Erfahrungsbelohnungen werden aus bestätigten Gefechten abgeleitet und nur einmal vergeben. Levelkurve, Obergrenze, Attributpunkte, Verwundung und Niederlagenfolgen sind offen; keine Originalwerte werden behauptet.

**Erster vollständiger PvE-Ablauf:** General zuweisen → Truppen wählen → NPC-Stadt angreifen → Kampfbericht erhalten → mit Nahrung zurückkehren → Erfahrung und möglichen Levelaufstieg anzeigen.

## Noch gemeinsam entscheiden

1. Wie eng soll sich das Spiel an War2Glory orientieren: Setting, Optik, Gebäude, Einheiten, Kampfsystem?
2. Matrix legt die Kartenstruktur nicht fest: unabhängig verwaltete Welten oder eine dauerhaft verbundene Weltkarte?
3. Welche genaue General- und NPC-Mechanik soll aus deiner Erinnerung übernommen werden?

Öffentliche Beschreibungen als Ausgangspunkt zur späteren Anforderungsaufnahme: https://www.browsergames.de/war2/ und https://www.mmogames.com/game/war2-glory/. Diese ersetzen keine vollständige Spezifikation.
