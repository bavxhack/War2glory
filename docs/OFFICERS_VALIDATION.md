# Auftrag 12 – Prüfbelege vom 08.10.2026

Implementiert auf main `6656580`: Bewerber mit Anfangsprofilen, steigende Erwerbspreise, exklusive Forschungsleitung, Grundwertwirkung neuer Farmzüge, ENV und Migration. Alle Balancezahlen sind eigene vorläufige Vorschläge; keine Originalwerte.

## Automatische Prüfungen

`npm test`: 97 Tests, alle bestanden. `npm run build`: erfolgreich. `git diff --check`: erfolgreich.

- Unabhängige Rekrutierungspreise für k=1/2/3/4: 500/2000/4500/8000 je Ressource; BigInt-Überlauf, unveränderter Startgeneral, Budget 30 und drei unterschiedliche Profile.
- Fehlkäufe, Namen, fremde Kandidaten, Preis-/Pool-/Rosterkonflikte erhalten Ressourcen, Zähler und Auswahl. Zwei WebSockets mit verschiedenen Kandidaten desselben Pools verpflichten genau einen General. Wiederholung und geändertes Payload, verlorener/erneut angefragter Erfolg sowie Wiederholung nach Poolablauf und Neustart geprüft. Simulierter Schreibfehler hinterlässt keine Teilzahlung/-rekrutierung.
- Pool vor Ablauf gültig, exakt beim Ablauf ungültig; Kaserne entfernen/wiederherstellen erzeugt keinen Neuwurf. Große Offlineabwesenheit erzeugt vier IDs für genau einen Pool, ohne verpasste Auswahlen anzusammeln. Erstberechtigung bei Bauabschluss 5000 ms bleibt auch bei Abrechnung bis 20000 ms der Zyklusanker.
- Intervalländerung bei Stunde 25 lässt das alte Fenster bis Stunde 48 bestehen; dann folgt das neue Minutenintervall. Historie/Termin und Pool bleiben bei Neustart erhalten. Limitabsenkung und größerer gespeicherter Erwerbszähler erzeugen keine neuen Generäle oder nachträglichen Zahlungen.
- Bürgermeister A, Forschungsleiter B und Farmgeneral C gleichzeitig; Forschungsleitung gegen Missionsstart desselben Generals erlaubt nur eine Bindung. Veraltete Abberufung und Rollenübernahme eines gebundenen Generals scheitern.
- Forschung n=2/U=2/F=20: 91 s, ohne General bzw. mit Nullbonus 110 s. F=100 bei Cap 50: 73 s. Geänderte Generalversion entwertet Vorschau; Umbenennen/Universitätsausbau/Führungsänderung ändern laufenden Snapshot nicht. Abschluss zum gespeicherten Zeitpunkt belässt das Amt. Abriss der letzten Universität gibt es atomar frei. Laufende Abrisssperre bleibt durch bestehende Forschungstests geprüft.
- Grundangriff 15 wirkt mit 30 %, plus zwei Skills mit 34 %; Zuweisungsgrenze zählt Grundwerte mit. Altgrundwerte und bereits verteilte Skills werden nicht gekürzt. Missionsversion 1/2 bleibt unverändert, Version 3 speichert effektive Werte und Boni.
- Schema 8 → 9 → 10, direkte Migration aus 9 und Journalwiederherstellung; bestehende Rollen, XP/Skills, alte Missionen, Versorgung und Forschung erhalten. `research-1-provisional` schließt normal ohne Bonus ab. Unveränderte Regression für Unterhalt, Nahrung/Bürgermeister, Lager, Kampf, Beute, Erstzielbelohnung und Punkte.
- ENV-Grenzen, Nullbonus, positive Ganzzahlpreise, isolierte Regeln, Dateiladen und Compose-Weitergabe geprüft.

## Browserablauf mit isoliertem Testspielstand

Tatsächlich in lokalem Chromium ausgeführt, kein Produktivspielstand verwendet. Testuhr und `GENERAL_CANDIDATE_REFRESH_HOURS=1/60` nur für diesen temporären Testserver:

1. Bewerber prüfen, Namen „Browser B“ setzen, 500/500 bezahlen; automatisch geöffnetes bestehendes Generalmodal prüfen und mit Escape schließen.
2. Testuhr zum festen Wechsel vorstellen, neu laden, aus dem nächsten Pool „Browser C“ für 2000/2000 verpflichten; neuer General sichtbar ausgewählt.
3. Desktop 1440 px und Mobilbreite 390 px prüfen, kein horizontaler Überlauf. Illustrationen und Texte sichtbar; Modalfokus innerhalb des Dialogs, Escape bedienbar.
4. Forschungsleitung B auswählen, Vorschau bestätigen, Forschung starten; Rollenwahl während des Projekts deaktiviert, gespeicherten Bonus und Projektfortschritt sichtbar prüfen. Keine Browser-JavaScriptfehler.

Der vollständige Rollen-/Farm-/Offline-/Neustart-/Abberufungsablauf ist zusätzlich über echte lokale WebSockets mit Testuhr ausgeführt. Die Browserprüfung umfasst diese Teilstrecke nicht als manuelle Wartezeit von 24 Stunden; Produktions-Langzeitbetrieb und unabhängige ARM64-Ausführung wurden nicht getestet.

## Container

Lokaler AMD64-Container erfolgreich mit Node 24 aufgebaut. Nur für die verwaltete Umgebung wurde beim npm-Schritt die vorhandene Proxy-CA als temporäres BuildKit-Secret eingebunden; kein Zertifikat und keine Zugangsdaten im Repository/Image. Compose-Konfiguration validiert.

Gestarteter isolierter Container: Healthcheck erfolgreich. Alle sieben absichtlich abweichenden Werte aus `docker compose config` an den Container übergeben und mit nativem `loadConfiguration` verglichen: Limit 5, Holz 700, Stein 800, Exponent 3, Intervall 2,5 h, Führungsbonus 2 %, Cap 60 %. Wirksame Werte und Regelversion identisch. Anschließend Testcontainer samt anonymem Spielstandvolume entfernt.

Vorhandene `data/`-Spielstände wurden nicht verändert, gelöscht oder committed. Keine manuelle historischen Kosten-/XP-/Ressourcenkorrektur.

## Ergänzung: individuelle Porträts

20 erzeugte Charakterporträts visuell geprüft: 10 Frauen und 10 Männer im lokalen 5×4-Atlas. Schema 11 ergänzt zufällige `portraitId` für vorhandene Generäle und gespeicherte Bewerber, vor Auslieferung atomar gespeichert. Bestehende Kennungen bleiben erhalten. Neue Bewerber übernehmen ihre Kennung unverändert bei Verpflichtung. Kein Einfluss auf Spielwerte; neue Vergaben vermeiden bereits belegte Bilder, bis alle 20 Motive verwendet sind.

Abschließende Prüfung dieser Ergänzung: `npm test` mit 101 bestandenen Tests, `npm run build` und `git diff --check` erfolgreich. Zusätzliche Tests prüfen Katalogverhältnis, erreichbare Motive, Vermeidung von Doppelbildern, unveränderte übrige Daten bei Migration, gespeicherten Bewerberpool, Neustart, Umbenennen/Skills und ignorierte Client-Porträtwerte. Browserablauf bei 1440/390 px mit neuen Porträts erneut erfolgreich ausgeführt; Bewerberkarten, Generalübersicht, ausgewähltes Modal und Tastaturbedienung geprüft. Diese Ergänzung führt keinen neuen Netzwerkdienst oder Containerparameter ein; der neue Bildatlas wird im bestehenden Vite-Build lokal mit ausgeliefert.

Container-Nachprüfung der Porträterweiterung: GitHub-Lauf 129 zeigte einen fehlenden `packages/`-Ordner in der Frontend-Buildstufe. Die neue Porträtkomponente importiert den gemeinsamen Katalog; deshalb kopiert der Dockerfile nun vor `npm run build` zusätzlich `packages/`. Der korrigierte vollständige Container-Build mit Porträtatlas, anschließender Healthcheck und Vergleich aller sieben abweichenden Compose-/Native-Werte wurden lokal erfolgreich ausgeführt.
