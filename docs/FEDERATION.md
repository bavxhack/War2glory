# Föderation — Entwurf, noch nicht implementiert

## Richtung: Matrix-basierte Föderation

Der Nutzer möchte am 27.09.2026 ein Modell wie Matrix und erlaubt ausdrücklich die Verwendung des Matrix-Protokolls. Der bevorzugte Entwurf ist deshalb ein eigenes Spielprotokoll auf Matrix. Das ersetzt den bisherigen Vorschlag, den gesamten Föderationstransport selbst zu entwickeln. Die Integration ist noch nicht implementiert oder im Betrieb erprobt.

Matrix repliziert erweiterbare JSON-Ereignisse zwischen Homeservern. Die Synchronisierung ist schließlich konsistent: Nachrichten können verspätet eintreffen und konkurrierende Ereignisse bilden keine globale, sofort verbindliche Reihenfolge. Ereignisinhalte müssen durch die Anwendung validiert werden.

Quelle: https://spec.matrix.org/latest/ — Abschnitte Architecture, Events und Event Graphs, geprüft am 27.09.2026.

## Vorgeschlagene Aufteilung

| Komponente | Aufgabe |
| --- | --- |
| Browserclient in JavaScript | Stadt, Karte, Generäle, Befehle und Berichte darstellen |
| Spielserver in Node.js | Städte, Truppen, NPCs, Erfahrung, Nahrung und erlaubte Zustandsänderungen verwalten |
| JavaScript-Matrix-Adapter | Validierte Spielereignisse senden/empfangen und Matrix-Absender Spielinstanzen zuordnen |
| Separater Matrix-Homeserver | Matrix-Konten, Räume und Föderation bereitstellen |
| Lokale Datenbank | Verbindliche Spielstände, reservierte Truppen und bereits verarbeitete Aktionen speichern |

Als Einstieg ist ein Dienstkonto pro Spielinstanz über die Matrix Client-Server API vorgesehen. Ein SDK-Kandidat ist das Matrix.org JS SDK: https://matrix.org/ecosystem/sdks/. Spielcode und Adapter bleiben JavaScript; ein vorhandener Homeserver ist eine zusätzliche Infrastrukturkomponente und muss nicht in JavaScript implementiert sein. Einen eigenen vollständigen Homeserver in JavaScript zu bauen wäre ein separates Großprojekt und ist nicht Teil dieses Vorschlags.

## Vorgeschlagenes Spielmodell

Jede Instanz verwaltet ihre eigene Welt. Betreiber wählen Partnerserver ausdrücklich aus. Lokales Spielen bleibt möglich, wenn Partnerserver offline sind. Zuerst werden Bündnisse und Nachrichten verbunden, danach gemeinsame Gefechte. Ein globales Pflichtverzeichnis ist nicht vorgesehen.

Eine völlig gemeinsame Weltkarte ist eine alternative Produktentscheidung und erfordert zusätzliche Regeln für Gebietsbesitz, Zuständigkeit und Ausfälle. Der Prototyp legt diese Entscheidung noch nicht technisch fest.

## Vertrauen und Fairness

Ein fremder Betreiber kontrolliert seine Datenbank und Spielsoftware. Eine Signatur belegt die Herkunft einer Nachricht, aber nicht, dass deren Inhalt spielerisch ehrlich entstanden ist. Beliebig erzeugte Ressourcen dürfen daher nicht allein wegen einer gültigen Signatur in andere Welten übernommen werden.

Für erste gemeinsame Gefechte schlagen wir begrenzte Szenarien mit gemeinsam vereinbarten Truppenbudgets vor. Ergebnisse werden anhand derselben Regeln und Eingaben nachgerechnet. Regeln zur Ermittlung von Zufallswerten, Streitfällen und Ausfällen müssen vor der Umsetzung spezifiziert werden. Freier Transfer von Ressourcen oder Armeen zwischen Welten bleibt bis zu einer belastbaren Vereinbarung gesperrt.

## Protokollbausteine

| Baustein | Vorgesehene Funktion |
| --- | --- |
| Instanzidentität | Dauerhafter Schlüssel, ausdrücklich bestätigte Gegenstellen, Schlüsselwechsel |
| Spieleridentität | Lokale Spieler-ID zusammen mit Instanzidentität; keine globale zentrale Anmeldung |
| Kompatibilität | Protokollversion, Regelsatzversion und Fähigkeiten abgleichen |
| Nachrichten | Eindeutige ID, Empfänger, Ablaufzeit, Signatur und Größenlimit |
| Zustellung | Persistente Ausgangs-/Eingangslisten, Wiederholung, Deduplizierung |
| Missbrauchsschutz | Ratenlimits, Sperren, Moderation und bewusst freigegebene Netzwerkziele |
| Gefechte | Bestätigte Eingaben, definierte Zuständigkeit, überprüfbarer Ablauf, Timeout-/Abbruchregeln |

Die Spielereignisse sind ein eigener, zu versionierender Anwendungsentwurf auf dem bestehenden Matrix-Protokoll. Ein gewöhnlicher Matrix-Client implementiert dadurch noch keine Spielregeln.

## Zusätzliche Spielregeln über Matrix

- Eigene Eventtypen in einem später festzulegenden projektspezifischen Namespace; der reservierte `m.`-Namensraum wird nicht verwendet.
- Matrix-Raumrechte allein erlauben keine Spielaktion. Absender, Zuständigkeit, Schema, Regelsatz und Aktion müssen zusätzlich geprüft werden.
- Eine eindeutige Spielaktions-ID verhindert Doppelverarbeitung auch dann, wenn dieselbe Aktion in mehreren Matrix-Events ankommt.
- Lokale Transaktionen reservieren Truppen und General vor dem Versand eines Marschauftrags. Nachrichten werden über eine dauerhafte Outbox versendet und über eine Inbox verarbeitet.
- NPC-Nahrung und General-Erfahrung werden ausschließlich vom zuständigen Spielserver vergeben. Änderungen müssen gegen bestätigte Gefechte geprüft werden.
- Räume sind keine zentrale globale Spieluhr. Kampfschritte brauchen ausdrücklich definierte Zuständigkeit, Sequenzen, Bestätigungen und Regeln für verspätete Ereignisse.
- Räume werden nach Sichtbarkeit aufgeteilt. Geheime Truppenbestände dürfen nicht in allgemein zugänglichen Ereignissen landen. Einladungsräume ersetzen keine Ende-zu-Ende-Verschlüsselung; das Datenschutzmodell ist vor sensiblen Nutzdaten festzulegen.
- Matrix übernimmt keine Prüfung auf erfundene Armeen oder manipulierte Erfahrung. Serverübergreifende Spielökonomie bleibt eine eigene Vertrauens- und Regelentscheidung.

## Bereits verfügbar

`GET /.well-known/federated-strategy` liefert Instanz-ID, Weltname, Regelsatz und `federationEnabled: false`. `capabilities` ist leer. Der Server ruft keine fremden URLs ab und nimmt keine Föderationsnachrichten an.

## Abnahmekriterien für eine spätere erste Verbindung

- Zwei Spielinstanzen verwenden getrennte, miteinander föderierende Matrix-Homeserver. Die Spielinstanzen werden explizit gegenseitig zugelassen.
- Beide prüfen Identität, Version und erlaubte Nachrichtentypen.
- Wiederholte Zustellung führt nur zu einer Verarbeitung.
- Ungültige Signaturen, abgelaufene Nachrichten und unbekannte Gegenstellen werden abgewiesen.
- Ein Neustart verliert keine bestätigten Nachrichten.
- Ein offline gegangener Partner blockiert den lokalen Spielbetrieb nicht.
- Keine Rohstoffe oder Armeen wechseln in diesem ersten Verbindungstest den Server.
