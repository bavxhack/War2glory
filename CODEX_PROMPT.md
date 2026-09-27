# Startauftrag für Codex

Arbeite im Repository `bavxhack/War2glory` am vorhandenen JavaScript-Prototyp weiter. Lies zuerst `AGENTS.md`, `README.md`, `docs/PROJECT.md`, `docs/FEDERATION.md` und `docs/DEVELOPMENT.md`. Prüfe den tatsächlichen Code und vorhandene Änderungen, bevor du Dateien bearbeitest. Behalte fremde Änderungen bei und setze auf dem aktuellen Projektstand auf.

## Langfristiges Ziel

Wir entwickeln ein eigenständiges Open-Source-Browserstrategiespiel im Stil von War2Glory. Spielclient und Spielserver werden in JavaScript entwickelt. Betreiber sollen eigene Server erstellen und über eine Föderation zusammen oder gegeneinander spielen können. Matrix ist der bevorzugte Föderationsansatz: ein eigenes versioniertes Spielprotokoll über Matrix, mit einem JavaScript-Adapter und einem separat betriebenen Matrix-Homeserver. Matrix ersetzt weder Spielvalidierung noch Regeln gegen manipulierte Ressourcen.

NPC-Städte zum Farmen von Nahrung und Generäle mit Truppenführung, Erfahrung, Levelaufstiegen und aufwertbaren Attributen sind verbindliche Kernanforderungen. Genaue Originalwerte sind nicht verifiziert. Markiere eigene Balancewerte als vorläufig. Übernimm keine fremden Originalgrafiken, Originaltexte oder Originalquellen.

## Tatsächlicher Ausgangspunkt

- Node.js-HTTP-Server und Browserclient ohne zusätzliche npm-Abhängigkeiten.
- Eine lokale gemeinsame Demo-Stadt pro Welt; noch keine Anmeldung.
- Holz, Stein und Nahrung sowie Sägewerk, Steinbruch und Bauernhof.
- Ein aktiver Ausbauauftrag; serverseitig geprüfte Kosten und Zeiten.
- JSON-Spielstände mit Schema- und Regelsatzversion, Offline-Produktion und stabiler Instanz-ID.
- Reine Spiellogik in `packages/game-core/` und Tests über `npm test`.
- Alpha und Beta können getrennt gestartet werden, tauschen aber keine Daten aus.
- Matrix, NPC-Städte, Generäle, Truppen, Kampf und echtes Multiplayer sind bislang nur geplant.

## Konkreter nächster Auftrag: Etappe 1 umsetzen

Baue einen spielbaren Stadtbildschirm mit festen Bauplätzen und einer erweiterten Bauwarteschlange. Implementiere diese Etappe vollständig; arbeite noch nicht eigenständig alle späteren Etappen ab.

1. Führe zunächst `npm test` aus und prüfe Datenmodell, Zustandsübergänge und API.
2. Ergänze eine übersichtliche Stadtkarte als Raster mit auswählbaren Bauplätzen. Nutze zunächst HTML/CSS und eigene einfache Darstellungen. Freie Plätze und bestehende Gebäude müssen erkennbar sein.
3. Ermögliche das Errichten der vorhandenen Gebäudetypen auf freien Plätzen und das Ausbauen bestehender Gebäude. Definiere Kosten und Bauzeiten zentral in der Spiellogik; liefere die benötigten Angebotsdaten an den Client, statt Formeln in der Oberfläche zu duplizieren. Zusätzliche Gebäudetypen kommen in einer Folgeaufgabe nach Festlegung ihrer Wirkung.
4. Ergänze eine begrenzte, sequenziell abgearbeitete Bauwarteschlange. Definiere und dokumentiere eine vorläufige Obergrenze. Bei Annahme eines Auftrags werden seine Kosten genau einmal abgezogen. Ein abgelehnter Auftrag darf den Spielstand nicht verändern. Mehrfachbelegung eines Bauplatzes und widersprüchliche Folgeaufträge sind serverseitig zu verhindern. Abbruch und Rückerstattung gehören zunächst nicht zu dieser Etappe.
5. Zeige Baukosten, Dauer, Gebäudestufe, Produktion, Warteschlangenposition und verbleibende Zeit verständlich an. Sorge für Tastaturbedienbarkeit und eine brauchbare Darstellung auf kleinen Bildschirmen.
6. Halte die Zeitberechnung serverseitig. Nach längerer Abwesenheit müssen mehrere Bauaufträge in der richtigen Reihenfolge fertiggestellt und Produktionsänderungen ab den jeweiligen Fertigstellungszeitpunkten berücksichtigt werden. Polling-Häufigkeit darf das Ergebnis nicht ändern.
7. Erhalte vorhandene Spielstände durch eine explizite Migration. Prüfe, ob Änderungen eine neue Schema- und Regelsatzversion benötigen. Bestehende Gebäude, Ressourcen, aktive Aufträge und Instanz-IDs dürfen nicht stillschweigend verschwinden; unbekannte Versionen müssen verständlich abgewiesen werden.
8. Ergänze gezielte Tests für Bauplatzbelegung, unzureichende Rohstoffe, volle Warteschlange, doppelte Anfragen, mehrere Offline-Abschlüsse und die Migration eines bestehenden Spielstands. Prüfe außerdem Neustart und getrennte Welten.
9. Führe die Tests aus und kontrolliere den Stadtbildschirm im Browser, soweit die Umgebung das ermöglicht. Kennzeichne fehlende visuelle Prüfung offen.
10. Aktualisiere README und Projektplan mit dem tatsächlich erreichten Stand. Beschreibe Änderungen, Prüfungen und offene Grenzen. Arbeite auf einem eigenen Branch und stelle das Ergebnis als Pull Request bereit, sofern der Repository-Zugriff das ermöglicht; andernfalls liefere den vollständigen lokalen Patch. Veröffentliche noch keine Spielinstanz.

## Leitplanken

- Nutze die vorhandene Projektstruktur und reine JavaScript-ES-Module. Keine Umstellung auf TypeScript oder ein neues Framework ohne konkrete Notwendigkeit.
- Implementiere noch keine Matrix-Anbindung, Konten, Weltkarte, NPC-Kämpfe oder Generäle. Bereite den Code modular vor und dokumentiere notwendige Schnittstellen.
- Behalte den lokalen Betrieb bei, bis Anmeldung und Berechtigungen in einer späteren Etappe vorhanden sind.
- Implementiere kleine, überprüfbare Zustandsübergänge. Speichere keine Geheimnisse oder lokalen Spielstände im Repository.
- Kläre echte Produktblockaden kurz; entscheide reversible technische Details selbst und dokumentiere vorläufige Regeln.
- Antworte dem Nutzer auf Deutsch.

## Danach vorgesehene Reihenfolge

Konten und Multiplayer → Weltkarte mit NPC-Städten → Forschung, Truppen und Generäle → Kämpfe und NPC-Farmzüge → Bündnisse und Handel → Matrix-Föderation → serverübergreifende Gefechte.
