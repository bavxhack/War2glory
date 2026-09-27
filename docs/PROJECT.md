# Projektziel und Arbeitsplan

## Ziel

Ein dauerhaftes Browserstrategiespiel mit eigenständiger Implementierung. Spielcode im Browser und auf dem Server wird in JavaScript geschrieben. HTML und CSS übernehmen Struktur und Darstellung. Jeder soll später eine eigene Instanz betreiben können. Die Teilnahme an einer Föderation bleibt optional. Blockchain und eine zentrale Pflichtregistrierung sind nicht vorgesehen.

## Etappen

| Etappe | Ergebnis | Status |
| --- | --- | --- |
| 0 | Startbarer Server, lokale Demo-Stadt, Rohstoffe, Ausbau, Speichern, Tests | Implementiert |
| 1 | Stadtkarte, feste Bauplätze, Errichten/Ausbauen und Warteschlange | Implementiert |
| 2 | Konten, eigene Stadt pro Spieler, Berechtigungen und JSON-Migrationen | Implementiert (JSON-Prototyp) |
| 3a | Sichtbare quadratische Weltkarte, Spielerpositionen, gemeinsame NPC-Städte und Entfernungen | Als Nächstes; abgestimmt |
| 3b | Aufklärung und Truppenbewegung auf Grundlage der späteren Armeen | Geplant; nach Einführung der Truppen |
| 4a | Forschung, Truppen und Generäle mit Erfahrung, Leveln, Aufwertungen und Truppenzuweisung | Geplant |
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
- Nächster Auftrag: Weltkarte, dauerhafte Stadtpositionen, öffentliche Detailansichten und gemeinsame NPC-Identitäten. Aufklärung, Märsche, Kämpfe, Beuteentnahme und aktive Regeneration folgen nach Einführung der benötigten Truppen-/Generalsysteme.
- Eine gemeinsame Karte pro Serverwelt dient als Ausgangspunkt. Die spätere Verbindung von Welten über Matrix ist damit noch nicht festgelegt.
- In diesem Planungschat entstehen nur Codex-Anweisungen; die Umsetzung und ihre Prüfungen übernimmt Codex.

## Weitere vorgeschlagene Spielregeln, noch abzustimmen

**NPC-Städte:** Gemeinsame Nutzung und allmähliche Ressourcenregeneration nach dem Farmen sind bestätigt. Stufen, Garnisonen, konkrete Vorratsgrößen und Regenerationsraten bleiben auszugestalten. Farmzüge brauchen Marschzeit, Kampfauswertung, Traglast und Rückkehr. Nahrung wird erst nach erfolgreicher Rückkehr gutgeschrieben. Gleichzeitige Angriffe dürfen denselben Vorrat nicht mehrfach plündern. Weitere Rohstoffe als Beute bleiben eine offene Entscheidung.

**Generäle:** Rekrutierung, Name, Erfahrungspunkte, Level, Attribute und Zuweisung zu einer Armee. Vorgeschlagene Attribute: Führung, Angriff und Verteidigung. Eine vorgeschlagene Führungskapazität begrenzt die befehligten Truppen. Ein General kann nur einen aktiven Marsch gleichzeitig befehligen. Erfahrungsbelohnungen werden aus bestätigten Gefechten abgeleitet und nur einmal vergeben. Levelkurve, Obergrenze, Attributpunkte, Verwundung und Niederlagenfolgen sind offen; keine Originalwerte werden behauptet.

**Erster vollständiger PvE-Ablauf:** General zuweisen → Truppen wählen → NPC-Stadt angreifen → Kampfbericht erhalten → mit Nahrung zurückkehren → Erfahrung und möglichen Levelaufstieg anzeigen.

## Noch gemeinsam entscheiden

1. Wie eng soll sich das Spiel an War2Glory orientieren: Setting, Optik, Gebäude, Einheiten, Kampfsystem?
2. Matrix legt die Kartenstruktur nicht fest: unabhängig verwaltete Welten oder eine dauerhaft verbundene Weltkarte?
3. Welche genaue General- und NPC-Mechanik soll aus deiner Erinnerung übernommen werden?

Öffentliche Beschreibungen als Ausgangspunkt zur späteren Anforderungsaufnahme: https://www.browsergames.de/war2/ und https://www.mmogames.com/game/war2-glory/. Diese ersetzen keine vollständige Spezifikation.
