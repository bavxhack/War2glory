# Projektziel und Arbeitsplan

## Ziel

Ein dauerhaftes Browserstrategiespiel mit eigenständiger Implementierung. Spielcode im Browser und auf dem Server wird in JavaScript geschrieben. HTML und CSS übernehmen Struktur und Darstellung. Jeder soll später eine eigene Instanz betreiben können. Die Teilnahme an einer Föderation bleibt optional. Blockchain und eine zentrale Pflichtregistrierung sind nicht vorgesehen.

## Etappen

| Etappe | Ergebnis | Status |
| --- | --- | --- |
| 0 | Startbarer Server, lokale Demo-Stadt, Rohstoffe, Ausbau, Speichern, Tests | Implementiert |
| 1 | Stadtkarte, feste Bauplätze, Errichten/Ausbauen und Warteschlange | Implementiert |
| 1b | Stufenabhängige Lagerkapazitäten, ausbaubares Lagerhaus und Gebäudeabriss mit Teilrückerstattung | Implementiert als Prototyp; Balance und Altbestandsregel bleiben zu prüfen |
| 2 | Konten, eigene Stadt pro Spieler, Berechtigungen und JSON-Migrationen | Implementiert (JSON-Prototyp) |
| UI | React-/Vite-Migration der vorhandenen Oberfläche bei unveränderter Spiellogik | Implementiert mit Auftrag 6 |
| 3a | Sichtbare quadratische Weltkarte, Spielerpositionen, gemeinsame NPC-Städte und Entfernungen | Implementiert laut aktuellem Projektstand |
| P | Kommandantenpunkte aus Gebäuden, Forschung und Kämpfen einschließlich Niederlagen | Gebäudepunkte laut README umgesetzt; Forschung/Kämpfe später |
| 3b | Aufklärung und Truppenbewegung auf Grundlage der späteren Armeen | NPC-Aufklärung laut README als Prototyp umgesetzt |
| 4a | Universitäten und Forschung, Truppen sowie Generäle mit Erfahrung, Leveln und Truppenzuweisung | Startgeneral/Mehrfachverwaltung umgesetzt; manuelle Skills und begrenzte Wirkungen mit Auftrag 10 implementiert; Forschung weiterhin später |
| 4b | Kämpfe, NPC-Farmzüge, typabhängige Traglast, Beute, Rückkehr, General-Erfahrung und Berichte | Als vorläufiger Prototyp mit Auftrag 8 implementiert; Balance im Review, Nahrungsunterhalt als Folgeschritt |
| V | Nahrungsunterhalt, Hungerverluste nach Schonfrist und führungsabhängiger Bürgermeisterbonus | Als vorläufiger Prototyp mit Auftrag 9 implementiert |
| 4c | LKWs, Ölraffinerien, Ölwirtschaft und typabhängiger Ölbedarf zur Mobilmachung | Geplant; nach dem ersten Farmkreislauf empfohlen |
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

## Vorheriger Codex-Auftrag 4: Punkte und erste NPC-Einsätze

Die Weltkarte ist laut Nutzer und Repository umgesetzt. Der Nutzer möchte weitere Arbeitsanweisungen, damit dort sinnvolle Aktionen möglich werden. Der vorherige Auftrag 4 (im Git-Verlauf von CODEX_PROMPT.md) umfasst folgende zusammenhängende Teile:

1. Kommandantenpunkte, zunächst aus fertiggestellten Gebäuden; spätere Forschungs- und Kampfbeiträge getrennt vorbereiten.
2. Eigene Militärseite mit getrennten militärischen Bauplätzen, ausbaubarer Kaserne, persistenter Ausbildung von Spähern und Infanterie sowie einem General mit Erfahrung, Level und Führungskapazität.
3. Erste NPC-Aufklärung mit zugewiesenem General und Spähern, Hin-/Rückmarsch und privaten zeitgestempelten Berichten.
4. Neustartfeste JSON-Abläufe, WebSocket-Ereignisse, Migration und gezielte Tests.

Diese Grundfunktionen werden in der aktuellen README als Prototyp beschrieben. Der Nutzer bestätigt Schritt 1 der zuletzt vorgeschlagenen Reihenfolge als umgesetzt. Der Planungschat hat keine Laufzeittests durchgeführt. Mehrfachverwaltung/Skills, Kämpfe, Verluste und Nahrung als Beute sind dadurch nicht zusätzlich als implementiert bestätigt.

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

## Umgesetzter Auftrag 5: Lagerwirtschaft und Abriss

Dies entspricht Schritt 2 der zuletzt vorgeschlagenen Reihenfolge. Ressourcenspezifische Lagerkapazitäten, ausbaubare zivile Lagerhäuser, Investitionsnachweise und Gebäudeabriss sind als spielbarer Prototyp implementiert. Die folgenden Werte bleiben ausdrücklich vorläufig; unbekannte Altinvestitionen werden nicht rekonstruiert und können deshalb zu einer Rückerstattung von null führen.

### Vorläufige Arbeitsvorschläge, keine endgültigen Nutzerentscheidungen

- Bisherige Grundkapazität je Ressource erhalten (laut README 2000).
- Produktionsgebäudebeitrag: 250 × max(0, Stufe − 1) zur eigenen Ressource. Lagerhausbeitrag: 500 × Stufe zu jeder aktiven Ressource. Mehrere Beiträge addieren sich.
- Beispiel: Grundkapazität 2000 plus Sägewerk Stufe 3 (500) plus Lagerhaus Stufe 2 (1000) ergibt 3500 Holzkapazität.
- Lagerhaus nutzt zunächst die vorhandene zivile Baukosten-/Zeitkurve und Stufenobergrenze.
- Vollständiger sofortiger Abriss nach Vorschau und Bestätigung; bei laufenden/wartenden Bau- oder zugehörigen Ausbildungsaufträgen gesperrt.
- Je Ressource abgerundet 10 Prozent der nachweislich bezahlten Investitionen in abgeschlossene Stufen zurückgeben. Beispiel: 240 Holz und 180 Stein ergeben 24 Holz und 18 Stein.
- Unbekannte Altinvestitionen ausdrücklich markieren und nicht aus heutigen Preisen erfinden. Vorläufig nur belegte Beträge erstatten; bei fehlender Historie kann die Rückerstattung null sein. Diese Einschränkung vor Abriss anzeigen und im PR zur Prüfung ausweisen.
- Vorhandene Vorräte und Abrissrückerstattungen bleiben bei Kapazitätsverlust erhalten. Überbestand blockiert positive Produktion der betroffenen Ressource, bleibt ausgebbar und wird nicht stillschweigend vernichtet.
- Neue Bauinvestitionen mit tatsächlichen Zahlungen dokumentieren; Migration, Offline-Abrechnung und wiederholte Befehle müssen konsistent bleiben.
- Die Details in Auftrag 5 konkretisieren den Prototyp. Sie stellen die zuvor offenen Regeln nicht als endgültig vom Nutzer beschlossen dar.

## Umgesetzter Auftrag 6: React-Refactoring

Nutzerentscheidung vom 28.09.2026: Nach Umsetzung des Lagerhauses soll die empfohlene schrittweise Umstellung auf React beginnen. README und der obige Projektstand beschreiben auch Lagerwirtschaft und Abriss als umgesetzt; dies wurde vom Planungschat nicht durch Laufzeittests überprüft.

- Auftrag 6 (im Git-Verlauf von CODEX_PROMPT.md) beschreibt die Migration der vorhandenen Spieloberfläche auf React mit JavaScript/JSX und Vite.
- Die Migration erfolgt in überprüfbaren Abschnitten: App-Grundlage und gemeinsame Anzeigen/Dialoge, Stadt/Lager/Abriss, Militär/Ausbildung, Weltkarte/Einsätze/Berichte.
- Bestehende Funktionen, Gestaltung und mobile Bedienung bleiben erhalten. Keine zusätzlichen Spielmechaniken oder Balanceänderungen.
- Spielregeln und JSON-Persistenz bleiben serverseitig; packages/game-core bleibt unabhängig von React.
- Eine zentrale WebSocket-Schicht je Browsertab versorgt den Clientzustand. Sitzungen, Eigentumsgrenzen, Wiederverbindung und Deduplizierung bleiben erhalten.
- Vite dient Entwicklung und Build; der vorhandene Node-Server liefert im normalen Betrieb die gebauten Assets aus. Docker, CI und Dokumentation werden passend aktualisiert.
- Die Migration ist laut bisherigem Projektstand umgesetzt und automatisiert geprüft. Am 29.09.2026 bestätigt der Nutzer, dass sie funktioniert. Der Planungschat hat diese Laufzeittests nicht selbst ausgeführt.

## Umgesetzter Auftrag 7: Generalverwaltung und Skillgrundlage

Der Nutzer bestätigt am 29.09.2026 die Umsetzung der Generäle. README und Protokolldokumentation beschreiben Generalverwaltung, Namensbearbeitung, gezielte Einsatzwahl und eine getestete, noch deaktivierte Skillgrundlage. Der frühere Auftrag 7 ist im Git-Verlauf von CODEX_PROMPT.md enthalten. Der Planungschat hat keine eigenen Laufzeittests ausgeführt.

- Aktiver Umfang: mehrere Generäle im Datenmodell, verlustfreie Migration, Generalübersicht im Militärbereich, Namensbearbeitung im React-Modal und eindeutige Generalwahl für vorhandene Aufklärung.
- Keine zusätzlichen Gratisgeneräle und keine frei nutzbare Erzeugungsaktion. Mehrfachbesitz wird mit isolierten Testspielständen geprüft; Rekrutierungsbedingungen bleiben offen.
- Führung, Angriff und Verteidigung sind bestätigt. Ihre Daten-/Modalgrundlage sowie konfigurierbare XP-Umrechnung und Skillverteilung werden implementiert und mit isolierten Testregeln geprüft.
- Echte Umrechnung und neue Bonuswirkungen bleiben im regulären Spiel serverseitig deaktiviert, bis Kostenkurve, Umrechnungsart und Wirkungen festgelegt sind. Das blockiert nicht die aktive Generalverwaltung.
- Vorhandene XP, Level, Führungskapazitäten, aktive Einsätze und die bisherige Erstzielbelohnung je Kommandant/NPC bleiben erhalten.
- Daten bleiben privat, serverseitig geprüft, über WebSocket übertragen und in JSON gespeichert. Keine erneute Frontendmigration.
- Codex liefert neben Implementierung und Prüfungen einen getrennten Vorschlag für die noch offenen Skillregeln. Bürgermeister, Forschungsgeneral und Kampferfahrung bleiben spätere Aufgaben.

## Umgesetzter Auftrag 8: NPC-Farmzüge

Der Farmkreislauf ist laut Repository-Dokumentation als vorläufiger Prototyp implementiert: Infanterie mit General entsenden, gemeinsame NPC-Garnison bekämpfen, Nahrung nach verbleibender Traglast laden und bei Rückkehr Bericht, Beute und Erfahrung erhalten. Am 29.09.2026 meldet der Nutzer einen erfolgreichen ersten Farmzug. Das ist keine Bestätigung aller Parallelitäts-/Neustarttests durch den Planungschat.

### Umfang

- Angriffe nur auf NPCs, vorhandene Infanterie als erste Farmtruppe; bestehende Aufklärung bleibt erhalten und zeigt künftig tatsächliche historische Garnisonsdaten.
- NPC-Garnison und Nahrung werden von allen Spielern geteilt und wachsen allmählich nach.
- Ganze Welt chronologisch verarbeiten, einschließlich offline befindlicher Spieler und Aufklärungen zwischen Gefechten.
- Zusammengehörige Welt-/Spieleränderungen absturzsicher protokollieren und wiederherstellen. Einzeldatei-Atomarität allein genügt nicht.
- General-XP, Kommandanten-Kampfbeiträge und private Kampfberichte einmalig bei Rückkehr verbuchen.
- Kein PvP, keine Eroberung, keine LKWs/Ölwirtschaft oder Nahrungsunterhaltsaktivierung. Skillumrechnung und neue Boni bleiben deaktiviert.

### Vorläufige Regeln für den Review

Dies sind neue Arbeitsvorschläge des Planungschats, keine einzeln bestätigten Nutzerentscheidungen oder War2Glory-Originalwerte. Sie werden als konfigurierbarer Prototyp im PR zur Prüfung vorgelegt. Die Details und Tests stehen im früheren Auftrag 8 im Git-Verlauf von CODEX_PROMPT.md.

- Garnisonsmaximum: 5 × NPC-Schwierigkeitsstufe; Wiederaufbau ein Verteidiger je 300 Sekunden bis zum Maximum. Vorhandene Nahrungsraten und Kapazitäten erhalten und aktivieren.
- Einfaches Mengenmodell mit A angreifenden Infanteristen und D Verteidigern: bei A > D Sieg, D NPC-Verluste und ceil(D/2) eigene Verluste; bei A <= D und D > 0 Niederlage, A eigene Verluste und floor(A/2) NPC-Verluste. Bei D = 0 keine Verluste und keine Kampfbelohnung.
- General überlebt vorläufig jede Niederlage und kehrt nach normaler Rückreise allein zurück; verlorene Einheiten werden nicht ersetzt.
- Für Aufklärung und Farmzüge ist derzeit kein Führungslimit aktiv. Einheiten müssen stationiert und ungebunden sein; der Führungswert bleibt bis zu einem später abgestimmten Regelsatz rein informativ.
- Pro Einsatz gilt ein serverseitiges Maximum von insgesamt 10.000 entsendeten Einheiten über alle beteiligten Typen. Die später vorgesehene Reichweitenbegrenzung durch Nahrung ist noch nicht implementiert.
- Infanterie trägt 20 Nahrung je Überlebendem. Späher/Aufklärungsflugzeuge tragen 0 und sind für Farmangriffe nicht zugelassen; LKWs folgen später.
- Beute = Minimum aus verbleibender Traglast und abgerundetem tatsächlichen NPC-Vorrat, nur bei Sieg.
- Beispiel: 10 Angreifer gegen 5 Verteidiger verlieren 3 eigene Einheiten; 7 Überlebende tragen höchstens 140 Nahrung.
- Bei Rückkehr nur freien Lagerplatz befüllen. Nicht eingelagerte Beute wird mit genauer Menge im Bericht als verfallen ausgewiesen. Bestehende heimische Überbestände bleiben erhalten; diese werden nicht gekürzt.
- General-XP = 2 × vernichtete NPC-Verteidiger. Kampfbeitrag = vernichtete NPC-Verteidiger minus eigene verlorene Infanterie. Beispiel 10 gegen 5: 10 XP und +2 Punkte; 4 gegen 5: 4 XP und −2 Punkte.
- Negativen kumulierten Kampfbeitrag erhalten; nur die Gesamtanzeige aus Gebäude- und aktiven weiteren Beiträgen auf mindestens null begrenzen. Keine doppelte Niederlagenstrafe.
- Alle regelabhängigen Ergebnisse versionieren und nur einmal abrechnen. Gegnerdetails und Kampfresultat bleiben bis zur vorgesehenen Berichtsfreigabe privat.

## Umgesetzter Auftrag 9: Versorgung und Bürgermeister

Der Nutzer bestätigt: Nach einer Schonfrist gehen Truppen bei Nahrungsmangel verloren. Außerdem kann ein General Bürgermeister werden und anhand seiner Eigenschaft Führung die Nahrungsproduktion erhöhen. Der Bürgermeister wird deshalb gegenüber der vorherigen Reihenfolge vorgezogen.

Am 08.10.2026 bestätigt der Nutzer Auftrag 9 als abgeschlossen. README und Protokolldokumentation beschreiben Versorgung, Hungerverluste und Bürgermeister als implementiert. Der Planungschat hat keine eigenen Laufzeittests durchgeführt. Der frühere Auftrag 9 ist im Git-Verlauf von CODEX_PROMPT.md erhalten.

### Bestätigte Anforderungen

- Laufender Nahrungsbedarf unterscheidet sich je Truppentyp und verringert die Nettoproduktion bzw. den Vorrat.
- Eine anhaltende Unterversorgung führt nach Schonfrist zu tatsächlichen Truppenverlusten.
- Plünderungen liefern bei Rückkehr Nachschub; negative laufende Bilanz bedeutet weiterhin keine negativen Lagerbestände.
- Ein eingesetzter Bürgermeister erhöht die Nahrungsproduktion abhängig von Führung.
- Regeln bleiben serverseitig, ereignisbasiert und dauerhaft gespeichert.

### Vorläufige Vorschläge für den Review

Die folgenden Werte und Detailregeln stammen vom Planungschat. Sie sind keine einzeln bestätigten Nutzerentscheidungen oder Originalwerte:

- Infanterie verbraucht 0,10 Nahrung pro Einheit/Sekunde, Späher 0,05. Generäle selbst haben zunächst keinen zusätzlichen Unterhalt.
- Heimatstadt versorgt alle lebenden eigenen Einheiten, stationiert und unterwegs, genau einmal. Noch nicht fertige Ausbildungsgruppen zählen nicht.
- 30 Minuten tatsächlich unversorgte Zeit bis zur ersten Verlustwelle; anschließend alle 5 Minuten weiterer Mangelzeit.
- Je Welle gehen aufgerundet 5 Prozent der lebenden Einheiten verloren, mindestens eine bei nicht leerer Armee. Verluste proportional über Typen und Aufenthaltsgruppen verteilen; kein Aufrunden je Einzelgruppe.
- Zwischenversorgung pausiert die Mangelzeit; erst 60 Sekunden stabile Versorgung setzen den Mangelzyklus zurück. Verhindert vollständiges Zurücksetzen durch kleinste kurzzeitige Nahrungsgutschriften.
- Ausbildung bei tatsächlichem Mangel pausieren, Restzeit und Zahlungen erhalten. Farmzüge und Bau bleiben möglich.
- Hunger kann marschierende Einheiten und damit Kampfstärke/Traglast verringern. Nicht mehr transportierbare Beute wird als unterwegs verloren dokumentiert; General kehrt auch bei vollständigem Truppenverlust zurück.
- Ein Bürgermeister je Stadt; General kann nicht gleichzeitig Bürgermeister und Missionsführer sein. Ernennung, Wechsel und Abberufung gelten ab tatsächlichem Zeitpunkt, auch offline.
- Bürgermeisterbonus = min(50 Prozent, Führung × 1 Prozent). Nur vorhandenen serverseitigen Eigenschaftswert verwenden, nicht das frühere Führungslimit als Ersatz. Keine neue Skillvergabe.
- Beispiel: Führung 10 ergibt 10 Prozent mehr Nahrung. Grundproduktion 2 Nahrung/Sekunde wird 2,2. Mit 30 Infanteristen (Verbrauch 3) beträgt die Bilanz −0,8 pro Sekunde; 480 Nahrung reichen bei unveränderten Raten 600 Sekunden.
- Bonus wirkt auf Produktion, nicht Beute, Lagerkapazität oder andere Rohstoffe. Skillumrechnung, militärische Skillboni und Forschungsgeneral bleiben deaktiviert.
- Kein Wiederherstellen des inzwischen entfernten Führungslimits; vorhandene Grenze von insgesamt 10.000 Einheiten je Einsatz bleibt.
- Bestehendes Transaktionsjournal und globale Ereignisreihenfolge erweitern. Keine rückwirkenden Unterhaltskosten vor dauerhaft festgehaltenem Einführungszeitpunkt.

## Umgesetzter Auftrag 10 vom 08.10.2026: General-Skills aktivieren

Nach Abschluss von Auftrag 9 folgt die Aktivierung der vorhandenen Skillgrundlage. CODEX_PROMPT.md enthält den neuen Arbeitsauftrag. Implementiert und mit Regel-, Speicher-, WebSocket-Tests und Frontend-Build geprüft. Die unten genannten Balancewerte bleiben vorläufig; Browserprüfung und Grenzen werden im PR ausgewiesen.

### Umfang

- Manuelle Umrechnung verfügbarer Erfahrung in Skillpunkte im bestehenden React-Generalmodal.
- Verteilung auf Führung, Angriff und Verteidigung mit nachvollziehbarer Vorschau, serverseitiger Prüfung und dauerhafter Speicherung.
- Führung wirkt auf den bereits bestehenden Bürgermeisterbonus. Angriff und Verteidigung erhalten begrenzte Wirkungen bei neuen NPC-Farmmissionen.
- Aktive Missionen behalten die beim Start geltende Regelversion und Boni; historische Ergebnisse bleiben erhalten.
- Kein Wiedereinführen eines militärischen Führungslimits, keine automatische Rekrutierung, kein Respec und keine zusätzliche Erfahrungsquelle.

### Vorläufiger Regelsatz für den Review

Diese Werte sind neue Arbeitsvorschläge des Planungschats bzw. greifen den bestehenden Vorschlag auf. Sie sind keine einzeln bestätigten Nutzerentscheidungen oder War2Glory-Originalwerte. Auftrag 10 ist der eigene Aktivierungsauftrag für diesen Prototyp; seine Regeln ersetzen im aktuellen Umfang die frühere Vorgabe, Skills nur deaktiviert vorzubereiten.

- Der n-te insgesamt erworbene Punkt kostet 10 × n XP. Die ersten drei kosten 10 + 20 + 30 = 60; bei 75 verfügbaren XP bleiben 15. Bereits verteilte Punkte zählen für den nächsten Preis weiter.
- Ein Skillpunkt erhöht eine Eigenschaft um eins. Gesamt-XP und Level bleiben beim Umrechnen unverändert; verwendete XP werden getrennt geführt.
- Führung nutzt Grundwert plus bestätigte Zuweisung im bestehenden Bürgermeistermodell: ein Prozent Nahrungsbonus je Führungspunkt, maximal 50 Prozent.
- Für militärische Boni zählt zunächst der verteilte Skillanteil, nicht ein bislang wirkungsloser Altgrundwert. Angriff: 2 Prozent zusätzliche Vergleichsstärke pro zugewiesenem Punkt, höchstens 50 Prozent. Verteidigung: 2 Prozent geringere eigene Kampfverluste je Punkt, höchstens 50 Prozent.
- Neue Zuweisungen oberhalb der Wirkungsschranken blockieren; vorhandene Altgrundwerte erhalten. Maximal 25 zugewiesene Angriffspunkte und 25 Verteidigungspunkte im vorläufigen Regelsatz.
- Neue Farmversion: Angriffsstärke S = lebende Angreifer N × (1 + Angriffsbonus). Sieg bei S > tatsächlichen Verteidigern D, Gleichstand bleibt Niederlage.
- Sieg: alle D Verteidiger fallen; eigene Verluste = min(N, ceil((D/2) × (1 − Verteidigungsbonus))).
- Niederlage: NPC-Verluste = min(D, floor(S/2)); eigene Verluste = min(N, ceil(N × (1 − Verteidigungsbonus))). Überlebende kehren ohne Beute zurück.
- Ohne zugewiesene militärische Punkte sind die Ergebnisse identisch zur bisherigen Kampfversion. Leere Ziele, fehlende Angreifer, Hunger, Beute, XP und Punkte weiterhin nach ihren vorhandenen Regeln behandeln.
- Bürgermeister-Führung wirkt ab Speicherzeitpunkt mit vorheriger korrekter Wirtschaftsabrechnung. Neue militärische Zuweisung wirkt erst auf anschließend gestartete Einsätze.
- Beispiel: 10 Angreifer gegen 10 Verteidiger verlieren bisher; mit 5 Angriffspunkten beträgt die Vergleichsstärke 11 und sie gewinnen mit 5 eigenen Verlusten.
- Beispiel: 10 Angreifer gegen 20 Verteidiger verlieren weiterhin; mit 10 Verteidigungspunkten gehen 8 statt 10 Angreifer verloren, 2 kehren ohne Beute zurück.
- Die konkreten Formeln, Rundungen, Migrationsregeln und Tests stehen in CODEX_PROMPT.md und werden im PR zur Prüfung dokumentiert.

### Weitere Reihenfolge

1. Auftrag 10 ist implementiert; Skillumrechnung, Verteilung und begrenzte Bürgermeister-/Kampfwirkungen bleiben als Prototyp im Review.
2. Universität und erste Wirtschafts-/Lagerforschung, einschließlich Forschungspunkten.
3. Forschungsgeneral, weitere Forschungen/Freischaltungen und separate Regeln für zusätzliche Generäle.
4. LKWs und Ölwirtschaft, zusätzliche Einheiten und Waffensysteme; Forschungsvoraussetzungen separat festlegen.
5. Bündnisse, Handel, Unterstützung, PvP und aktive Matrix-Föderation gemäß bisherigen Zielen.

## Generalverwaltung und Skillpunkte: Ergänzung vom 28.09.2026

Laut Nutzer sind Generäle bereits angelegt. Diese Angabe bestätigt nicht automatisch alle übrigen Teile von Auftrag 4. Die Generalverwaltung und Skillgrundlage sind mit Auftrag 7 laut Nutzer und Repository-Dokumentation umgesetzt; die Aktivierung als vorläufiger Regelsatz ist jetzt Gegenstand des eigenen Auftrags 10. Die Anforderungen aus Abschnitt E des vorherigen Auftrags 4 sind hier festgehalten und im Git-Verlauf von CODEX_PROMPT.md nachlesbar.

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
- Skillgrundlage ist implementiert. Auftrag 10 aktiviert manuelle Umrechnung, Verteilung und begrenzte Effekte mit den dort ausdrücklich vorläufig festgelegten Regeln.
- Mehrere Generäle mit Testdaten prüfen; keine frei verfügbare Rekrutierung oder zusätzlichen kostenlosen Generäle für bestehende Konten erfinden.
- Bestehende Erfahrung, Level und aktive Einsätze erhalten; Änderungen über WebSocket mit serverseitiger Prüfung und privater JSON-Speicherung.
- Eigenschaften und Einsatzrolle getrennt modellieren. Bürgermeister wird in Auftrag 9 mit führungsabhängiger Nahrungswirkung aktiviert; Forschungsgeneral bleibt später.

### Noch gemeinsam festzulegen

- Startkosten und Verlauf der steigenden Erfahrungskosten; automatische Umrechnung oder bewusster Spielerbefehl.
- Bonuswirkungen der bestätigten Eigenschaften Führung, Angriff und Verteidigung, Grenzen und Zusammenspiel mit Level und Führungskapazität.
- Wirkung dieser Eigenschaften in den Rollen Truppengeneral, Bürgermeister und Forschungsgeneral; Rollenplätze, Voraussetzungen, Wechsel und mögliche gleichzeitige Aufgaben.
- Erfahrungserwerb in zivilen Rollen bleibt offen. Bürgermeister und seine zeitlich korrekte Produktionswirkung werden in Auftrag 9 vorgezogen; Forschungsgeneral bleibt später.
- Rekrutierungsbedingungen, mögliche Anzahlgrenzen und spätere Rücksetzung verteilter Punkte.
- Kampf-Erfahrungsbelohnungen und Verteilung bei mehreren beteiligten Generälen; künftige Rolle von Aufklärungs-Erfahrung.

Technischer Vorschlag für die Kostenbasis: insgesamt erworbene Skillpunkte einschließlich bereits verteilter Punkte. Das Ausgeben freier Punkte soll den nächsten Punkt nicht billiger machen. Insgesamt verdiente und bereits umgerechnete Erfahrung sowie freie und verteilte Skillpunkte werden getrennt nachvollziehbar geführt. Diese Auslegung und alle konkreten Balancewerte sind noch keine einzeln bestätigten Nutzerentscheidungen.

## Geplante Logistik: Traglast, LKWs und Öl

Nutzerergänzung vom 28.09.2026. Typabhängige Traglast ist laut Repository-Dokumentation mit Auftrag 8 eingeführt. Auftrag 9 ergänzt ihre Verringerung bei Hungerverlusten unterwegs. LKWs und Öl bleiben spätere Erweiterungen.

### Bestätigte Anforderungen

- Jeder Truppentyp erhält eine eigene Transportkapazität je Einheit. Plünderbare Beute ist durch die verfügbare Transportkapazität der entsandten Truppen begrenzt.
- LKWs sind spätere Transporteinheiten mit hoher Transportkapazität und ohne Kampfkraft. Ihre konkreten Werte sind noch offen.
- Öl wird als weitere Ressource eingeführt. Der neue Gebäudetyp Ölraffinerie produziert Öl.
- Öl wird für die Mobilmachung benötigt; unterschiedliche Truppentypen benötigen unterschiedliche Mengen. Zeitpunkt, Berechnungsgrundlage und konkrete Verbrauchswerte sind noch festzulegen.

### Einordnung in die Entwicklung

- Empfehlung des Planungschats: typabhängige Traglast bereits beim ersten NPC-Farmzug umsetzen. LKWs, Ölraffinerie und Ölverbrauch gemeinsam in einer späteren Etappe für motorisierte Einheiten ergänzen.
- Jetzt bei ohnehin anstehenden Arbeiten Einheitenwerte und Ressourcen erweiterbar halten: Transportkapazität, Kampfkraft und späterer Ölbedarf sind getrennte Größen. Keine unnötige vollständige Umstellung und keine Ölpflicht für bisherige Märsche.
- Lager, Produktion, Baukosten, Forschungswirkungen, WebSocket-Daten und JSON-Speicherung dürfen nicht dauerhaft auf genau drei Ressourcen festgelegt werden. Bestehende Spielstände und Regeln bleiben bei späterer Einführung von Öl erhalten.
- Die Ölraffinerie ist ein Ressourcenproduktionsgebäude und gehört gemäß der bestätigten Bereichstrennung auf zivile Bauplätze, nicht auf Militärbauplätze.
- Die stufenabhängige ressourcenspezifische Lagerwirkung von Produktionsgebäuden soll auch für Öl gelten; das Lagerhaus umfasst später ebenfalls Öl. Konkrete Werte im Öl-Auftrag festlegen.
- Keine zusätzliche Rohöl-Ressource oder Verarbeitungskette erfinden: bislang bestätigt ist nur die Ölproduktion durch Raffinerien.

### Vor dem ersten Farmzug konkret festlegen

- Gesamttraglast ergibt sich aus der Summe: transportfähige Anzahl je Truppentyp × dessen Kapazität. Dieselbe Kapazität darf bei mehreren Beuteressourcen nicht mehrfach genutzt werden.
- Technischer Vorschlag: Beute nach dem Kampf anhand der überlebenden, zum Transport fähigen Truppen begrenzen. Verlust- und Rückkehrregeln müssen vor Umsetzung festlegen, was mit Ladung bei späterem Kapazitätsverlust geschieht.
- Beute darf weder die verfügbare Traglast noch den tatsächlich verfügbaren plünderbaren NPC-Vorrat überschreiten. Ohne Transportkapazität keine Beute.
- In der ersten Nahrungsetappe kann die Nahrung innerhalb dieser beiden Grenzen geladen werden. Ressourcengewichte und Verteilungsprioritäten bei mehreren Beuteressourcen sind später gesondert festzulegen.
- Der Server berechnet die Beute verbindlich. Entnahme aus dem gemeinsamen NPC-Bestand und Zuordnung zur Mission erfolgen konsistent und nur einmal; gleichzeitige Angriffe dürfen denselben Vorrat nicht mehrfach erhalten.
- Beute bleibt während der Rückreise an die Mission gebunden und wird erst bei Rückkehr gutgeschrieben. Volle Heimatlager benötigen die zuvor vereinbarte Überbestandsregel.
- Einsatzdialog und Bericht zeigen Traglast und tatsächliche Ladung. Unaufgeklärte gegnerische Vorräte dürfen dadurch vor dem Angriff nicht offengelegt werden.
- Prüfe gemischte Truppen, fehlende Traglast, Verluste, knappe Vorräte, gleichzeitige Angriffe, Neustart und einmalige Rückkehrgutschrift.

### Vor Einführung von LKWs und Öl konkret festlegen

- Werte, Freischaltung, Herstellungsort, Kosten, Reisegeschwindigkeit und Schutzbedarf von LKWs. Keine Kampfkraft bedeutet nicht Unverwundbarkeit; Regeln für Beschädigung, Verlust oder Erbeutung sind noch offen.
- Ob LKWs beim Transport die Führungskapazität eines Generals belegen und ob unbegleitete Transporte zulässig sind.
- Ölbedarf je Truppentyp und Bedeutung von Mobilmachung: einmalige Kosten beim Entsenden oder eine andere Regel; außerdem Entfernungsabhängigkeit sowie Versorgung von Hin- und Rückweg.
- Ölbedarf zur Mobilmachung ist von dem separat bestätigten laufenden Nahrungsunterhalt zu unterscheiden. Zusätzlicher laufender Ölunterhalt oder Öl als Rekrutierungskosten sind nicht bestätigt.
- Zeitpunkt der Reservierung bzw. Abbuchung, Verhalten bei fehlendem Öl sowie mögliche Rückerstattung bei späterem Abbruch. Der Server muss Doppelverbrauch verhindern und einen begonnenen Einsatz nach Neustart konsistent fortsetzen.
- Raffineriekosten, Ausbaustufen, Produktions- und Lagerwerte sowie ein erreichbarer Einstieg in die Ölwirtschaft. Die erste Raffinerie darf nicht Öl voraussetzen, das ohne sie noch nicht beschafft werden kann.
- Bestehenden Armeen bei einer Migration keine rückwirkenden Ölrechnungen auferlegen. Laufende Einsätze bleiben an ihre beim Start geltenden Regeln gebunden.

## Geplanter Nahrungsunterhalt der Truppen

Nutzeranforderung vom 28.09.2026, konkretisiert am 29.09.2026: Truppen gehen nach einer Schonfrist bei Nahrungsmangel verloren. Ein Bürgermeister erhöht anhand von Führung die Nahrungsproduktion. Auftrag 9 ist laut Nutzer am 08.10.2026 abgeschlossen; die implementierten Verbrauchs-, Frist-, Verlust- und Bonuswerte bleiben als Prototypregeln dokumentiert.

### Bestätigte Anforderungen und Berechnung

- Truppen verbrauchen fortlaufend Nahrung. Der Verbrauch pro Einheit und Zeit unterscheidet sich je Truppentyp.
- Der Verbrauch wird regelmäßig verrechnet beziehungsweise als Abzug von der Nahrungsproduktion berücksichtigt. Dies sind zwei mögliche Darstellungen derselben Belastung, keine zwei getrennten Kosten.
- Gesamtverbrauch pro Zeiteinheit = Summe aus versorgter Einheitenanzahl je Truppentyp × dessen Nahrungsbedarf pro Einheit und Zeiteinheit.
- Nahrungsbilanz pro Zeiteinheit = tatsächliche Nahrungsproduktion minus Gesamtverbrauch. Eine negative Bilanz verbraucht vorhandene Vorräte; erfolgreiche Plünderungen sollen dieses Defizit ausgleichen können.
- „Negative Nahrung“ wird hier als negative laufende Bilanz verstanden. Negative Lagerbestände oder Nahrungsschulden sind damit nicht beschlossen.
- Nahrung aus einem Farmzug steht gemäß den bisherigen Regeln erst bei Rückkehr zur Verfügung. Erwartete Beute darf vorher keinen Verbrauch decken.
- Nahrungsunterhalt ist unabhängig vom späteren Ölbedarf zur Mobilmachung. Beide Kostenarten werden getrennt konfiguriert und angezeigt.

### Empfohlene Reihenfolge und noch offene Regeln

- Empfehlung: Datenmodell und Wirtschaftsberechnung beim Lagerausbau vorbereiten; tatsächlichen Nahrungsunterhalt zusammen mit oder unmittelbar nach dem ersten funktionierenden NPC-Farmkreislauf aktivieren. Vor Aktivierung Verbrauchswerte und Verhalten bei leerem Lager festlegen.
- Noch offen: konkrete Verbrauchswerte, Zeiteinheit, kontinuierliche Verrechnung oder feste Intervalle einschließlich Rundung.
- Bestätigte Folge bei anhaltend aufgebrauchter Nahrung: Truppenverluste nach Schonfrist. Auftrag 9 schlägt konkrete Frist und Verlustwellen vor. Keine Nahrungsschulden oder zusätzliche pauschale Kampfschwächung.
- Auftrag 9 versorgt als vorläufige Regel stationierte und marschierende eigene Einheiten aus der Heimatstadt. Spätere Unterstützungstruppen und LKWs benötigen eigene Regeln. Keine doppelte Verrechnung oder unbeabsichtigte Unterhaltsbefreiung durch Entsenden.
- Noch offen: Verbrauchsbeginn bei Ausbildung und Behandlung späterer Verluste, Entlassungen oder Besitzwechsel. Technischer Vorschlag: ausgebildete Einheiten ab tatsächlicher Fertigstellung zählen, Verluste ab dem bestätigten Verlustzeitpunkt.
- Verbrauch, Produktion, Marschzeiten und NPC-Regeneration müssen zusammen einen erreichbaren Versorgungskreislauf ermöglichen. Konkrete Balancewerte werden separat festgelegt.

### Leitplanken für die spätere Codex-Umsetzung

- Zeige Bruttoproduktion, Truppenverbrauch, Nettobilanz und Vorrat getrennt an. Bei negativem Nettoertrag optional die voraussichtliche Restversorgungsdauer anzeigen: Vorrat geteilt durch den Betrag des Nettoverbrauchs, mit Hinweis auf unveränderte aktuelle Raten.
- Berechne den Verbrauch serverseitig auch bei Abwesenheit und Neustart. Browser-Timer oder offene Verbindungen bestimmen keine Kosten.
- Verrechne Ereignisse chronologisch: Produktionsänderung, Ausbildungsabschluss, Truppenverlust, Rückkehr mit Nahrung sowie Erreichen eines leeren oder vollen Lagers. Ein zwischenzeitlich leeres Lager darf nicht durch später eintreffende Beute rückwirkend als versorgt gelten.
- Für unveränderte Raten gilt innerhalb eines Zeitabschnitts: Bestandsänderung = Nettobilanz × verstrichene Zeit in der vereinbarten Zeiteinheit. Lagergrenzen und das spätere Mangelverhalten sind an ihren tatsächlichen Eintrittszeitpunkten anzuwenden.
- Persistiere Verrechnungszeitpunkt und erforderliche Rundungsreste bzw. rechne mit hinreichender Genauigkeit. Häufigere Aktualisierungen, Reconnects oder mehrere Verbindungen dürfen weder zusätzlichen Verbrauch noch kostenlose Nahrung erzeugen.
- Verrechne Unterhalt genau einmal: nicht zugleich als reduzierte Produktion und als zusätzliche volle Abbuchung.
- Aktiviere Unterhalt mit dokumentiertem Startzeitpunkt und versionierter Migration. Bestehende Truppen erhalten keine rückwirkende Rechnung für Zeiten vor Einführung der Regel.
- Zustandsänderungen werden dauerhaft im privaten JSON-Spielstand gespeichert und über WebSocket an berechtigte Verbindungen gemeldet.
- Prüfe verschiedene Truppentypen, positive/null/negative Nettobilanz, Lagergrenzen, chronologische Ratenwechsel, Offlinebetrieb, kleine gegenüber großen Zeitschritten, Neustart und einmalige Beutegutschrift. Tests für Nahrungsmangel folgen den erst noch festzulegenden Regeln.

## Entscheidungen für diesen Prototyp

- Kleine Module; Einstieg ursprünglich ohne Framework- oder Datenbankabhängigkeiten. Die am 28.09.2026 beauftragte Umstellung auf React mit JavaScript/JSX und Vite ist laut Nutzer am 29.09.2026 abgeschlossen. Server und Spielkern bleiben davon unabhängig; keine Datenbankumstellung in diesem Schritt.
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

Die Trennung wurde in Auftrag 4 verlangt und wird inzwischen in der README beschrieben; der Nutzer bestätigt den zugehörigen Schritt 1 als umgesetzt.

- Militärgebäude erhalten zusätzliche, eigene Bauplätze, vorzugsweise auf einer zweiten Seite. Auftrag 4 setzt dies als Seite „Militär“ neben „Stadt“ und „Weltkarte“ um.
- Auf Militärbauplätzen dürfen keine Ressourcengebäude stehen. Kaserne und künftige Militärgebäude gehören in den Militärbereich; die bisherigen neun Bauplätze bleiben der zivile Bereich.
- Die Trennung gilt im gespeicherten Spielmodell und in der serverseitigen Bauprüfung, nicht allein in der Darstellung.
- Beide Bereiche gehören zur gleichen Stadt und teilen Ressourcen und Kommandantenpunkte. Bestehende Gebäude, Ausbaustufen und bezahlte Aufträge bleiben bei Migration erhalten.
- Falls bereits militärische Gebäude auf bisherigen Plätzen existieren, werden sie mit ihren Aufträgen verlustfrei auf Militärplätze übernommen; die bisherigen Plätze werden frei.
- Die genaue Zahl der Militärbauplätze ist noch offen. Codex verwendet zunächst eine zentral konfigurierbare, ausdrücklich vorläufige Zahl.
- Als technische Fortführung bleibt für Auftrag 4 die bisherige gemeinsame Bauwarteschlange bestehen. Zusätzliche parallele Bauwarteschlangen sind nicht beschlossen. Die Kasernenausbildung besitzt die im Auftrag vorgesehene eigene Warteschlange.
- Die spätere Zuordnung von Lagerhaus und Universität wird in deren jeweiliger Spezifikation festgelegt.

## Bestätigte Gebäude- und Lageranforderungen vom 27.09.2026

Diese bestätigten Anforderungen sind laut README und Projektstand mit Auftrag 5 als Prototyp umgesetzt. Die folgende ursprüngliche Anforderungsliste bleibt erhalten; vorläufige Zahlen und Grenzfallregeln stehen im Abschnitt „Umgesetzter Auftrag 5“. Der frühere Auftrag ist im Git-Verlauf von CODEX_PROMPT.md nachlesbar.

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

Auftrag 5 konkretisiert die Ausbauetappe mit ausdrücklich vorläufigen Arbeitsvorschlägen. Diese ersetzen keine endgültige Abstimmung der Balance und Altbestandsregeln.

## Herkunft des Skillvorschlags und verbleibende Entscheidungen

Der nach Auftrag 7 dokumentierte Vorschlag einer manuellen Umrechnung mit 10 × n XP wird in Auftrag 10 als vorläufiger Regelsatz aufgegriffen. Führung wirkt bereits seit Auftrag 9 beim Bürgermeister; Auftrag 10 ergänzt den Beitrag zugewiesener Punkte und begrenzte militärische Boni.

Noch offen bleiben endgültige Balance, Rücksetzung/Umverteilung, Rekrutierung zusätzlicher Generäle und Wirkungen zukünftiger Forschungs-/Waffensysteme. Das aufgehobene militärische Führungslimit wird nicht wiederhergestellt. Die ursprüngliche Vorschlagsfassung bleibt im Git-Verlauf erhalten.

## Bestätigte Forschungsanforderungen vom 27.09.2026

Forschung wird als spätere Ausbauetappe über den neuen Gebäudetyp Universität zugänglich. Sie ist noch nicht implementiert und gehört nicht zum aktuellen Skillauftrag 10.

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

Anforderung vom 27.09.2026: Für jeden Kommandanten soll eine Punktezahl berechnet werden. Gebäude, Forschung, Kämpfe und Niederlagen beeinflussen diesen Wert. Das System soll zeitnah eingeführt werden. Sein Gebäude-Grundsystem wurde in Auftrag 4 eingeführt und wird in der README als implementiert beschrieben; Forschungs- und Kampfbeiträge folgen mit den jeweiligen Spielsystemen.

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
