# Projektziel und Arbeitsplan

## Ziel

Ein dauerhaftes Browserstrategiespiel mit eigenständiger Implementierung. Spielcode im Browser und auf dem Server wird in JavaScript geschrieben. HTML und CSS übernehmen Struktur und Darstellung. Jeder soll später eine eigene Instanz betreiben können. Die Teilnahme an einer Föderation bleibt optional. Blockchain und eine zentrale Pflichtregistrierung sind nicht vorgesehen.

## Etappen

| Etappe | Ergebnis | Status |
| --- | --- | --- |
| 0 | Startbarer Server, lokale Demo-Stadt, Rohstoffe, Ausbau, Speichern, Tests | Implementiert |
| 1 | Stadtkarte, Bauplätze, weitere Gebäudetypen, Warteschlange | Geplant |
| 2 | Konten, mehrere Städte/Spieler, Berechtigungen, Datenbankmigrationen | Geplant |
| 3 | Weltkarte, NPC-Städte mit Stufen und Nahrungsvorräten, Entfernungen, Bewegung und Erkundung | Geplant |
| 4a | Forschung, Truppen und Generäle mit Erfahrung, Leveln, Aufwertungen und Truppenzuweisung | Geplant |
| 4b | Kämpfe, NPC-Farmzüge, Beute, Rückkehr, General-Erfahrung und Berichte | Geplant |
| 5 | Bündnisse, Unterstützung und Handel innerhalb einer Welt | Geplant |
| 6 | Matrix-Anbindung, Identitätszuordnung, Vertrauensregeln und Spielereignisse zwischen zwei Instanzen | Geplant |
| 7 | Serverübergreifende Bündnisse und abgegrenzte gemeinsame Gefechte | Geplant |
| 8 | Betrieb, Backups, Missbrauchsschutz, Community und Veröffentlichung | Geplant |

Vor jeder Etappe definieren wir einen konkreten Spielablauf und dessen Erfolgskriterien. Keine Zeit- oder Aufwandszusage für das vollständige Spiel: Umfang und Detailtreue sind noch offen.

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

## Vorgeschlagene Spielregeln, noch abzustimmen

**NPC-Städte:** Stufe, Garnison, Nahrungsvorrat und begrenzte Regeneration. Farmzüge brauchen Marschzeit, Kampfauswertung, Traglast und Rückkehr. Nahrung wird erst nach erfolgreicher Rückkehr gutgeschrieben. Gleichzeitige Angriffe dürfen denselben Vorrat nicht mehrfach plündern. Weitere Rohstoffe als Beute bleiben eine offene Entscheidung.

**Generäle:** Rekrutierung, Name, Erfahrungspunkte, Level, Attribute und Zuweisung zu einer Armee. Vorgeschlagene Attribute: Führung, Angriff und Verteidigung. Eine vorgeschlagene Führungskapazität begrenzt die befehligten Truppen. Ein General kann nur einen aktiven Marsch gleichzeitig befehligen. Erfahrungsbelohnungen werden aus bestätigten Gefechten abgeleitet und nur einmal vergeben. Levelkurve, Obergrenze, Attributpunkte, Verwundung und Niederlagenfolgen sind offen; keine Originalwerte werden behauptet.

**Erster vollständiger PvE-Ablauf:** General zuweisen → Truppen wählen → NPC-Stadt angreifen → Kampfbericht erhalten → mit Nahrung zurückkehren → Erfahrung und möglichen Levelaufstieg anzeigen.

## Noch gemeinsam entscheiden

1. Wie eng soll sich das Spiel an War2Glory orientieren: Setting, Optik, Gebäude, Einheiten, Kampfsystem?
2. Matrix legt die Kartenstruktur nicht fest: unabhängig verwaltete Welten oder eine dauerhaft verbundene Weltkarte?
3. Welche genaue General- und NPC-Mechanik soll aus deiner Erinnerung übernommen werden?

Öffentliche Beschreibungen als Ausgangspunkt zur späteren Anforderungsaufnahme: https://www.browsergames.de/war2/ und https://www.mmogames.com/game/war2-glory/. Diese ersetzen keine vollständige Spezifikation.
