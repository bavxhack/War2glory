# Auftrag 17 – Forschungsbaum, Arbeitsdauer und Traglast

Prüfdatum: 18.10.2026. Ausgangsstand: `0590123`, zu Beginn sauberer Arbeitsbaum. Die in CODEX_PROMPT.md genannte ältere Basis wurde nicht ausgecheckt. Node.js 24.19.0; vorhandene Abhängigkeiten und System-Chromium. Ausschließlich isolierte Testwelten unter temporären Verzeichnissen beziehungsweise `work/research-browser/`; kein produktiver `data/`-Spielstand verwendet oder zurückgesetzt.

## Regeln und Balance

Alle neuen Voraussetzungen, Preise und Wirkungszahlen sind eigene vorläufige Projektentscheidungen. Historische Quellenabgrenzung unverändert in RESEARCH_REFERENCE.md.

- Katalog `research-4-engineering-provisional`: neun stabile IDs, Kategorien, Wirkungstypen, Stufengrenzen, Kosten/Dauer und explizite Abhängigkeiten. Katalogprüfung erkennt unbekannte Vorgänger, ungültige Stufen und Zyklen.
- Bautechnik benötigt masonry 1, Ladetechnik logistics 1; Ausbildungstechnik hat keinen Forschungsvorgänger. Universität mindestens max(2, Zielstufe), Maximum 5. Kosten je Zielstufe L: 150×L Holz und Stein. Forschungsbasis 90×L Sekunden; bestehende Universitäts-/Leitungsformel und Sekundenrundung bleiben erhalten.
- Geschwindigkeitsfaktor F=(10000+b×L)/10000. Effektive Arbeit max(1,ceil(bisherige Millisekunden/F)), mit ganzzahliger rationaler Rechnung. Bei 60000 ms und Stufe 5 mit b=500: 48000 ms, +25 % Geschwindigkeit und 20 % Zeitersparnis. Gebäude-/Mengenfaktoren werden zuvor berechnet. Keine Verkürzung von Abriss, Forschung oder Reise.
- Typkapazität floor(Basis×(10000+b×L)/10000), erst danach Gruppenmenge. Infanterie 20/21/25, LKW 200/210/250 bei Stufe 0/1/5. Späher 0 Güterplätze, separate Tanks unverändert. Basiswerte werden nicht überschrieben.
- Kampfrechenprobe: 20 Infanteristen und 4 LKW auf Stufe 5: 1500 Plätze; nach 5/1 Verlusten 1125; abzüglich 22,5 Rückwegöl floor=1102 Güterplätze; mit 300 eigener Ladung höchstens 802 neue Beute. NPC-Vorrat, Kampf und Ölregeln bleiben unverändert.
- Forschungspunkte bleiben abgeleitet: zehn je abgeschlossener Stufe, einmal spielerweit. Drei neue Nullstufen erzeugen keine Punkte.
- ENV für Bau-/Ausbildungs-/Ladebonus: Standard 500, ganzzahlig 0–2000, explizite 0 ohne Bonus. Normalisierung nur auf dem Server; gespeicherte Aktivierungszeit in `researchRuleHistory`. Laufende bezahlte Arbeit und Reisen werden nicht neu berechnet.

## Speicherung, Migration und Ereignisse

Spielerschema 17 / Weltschema 4 sind ausreichend; es werden additive Felder verwendet, keine Migrationsketten ersetzt. Fehlende neue Forschungs-IDs werden mit 0 normalisiert. Alte Forschungsversionen 1, 2 und 3 schließen anhand ihrer gespeicherten Zeiten ab. Bauten, Ausbildung, Hungerpausen und Reisen ohne neue Metadaten behalten ihre historischen Zahlungen, Termine und Kapazitäten. Unbekannte Forschungs-IDs werden konkret abgewiesen; die Originalspielerdatei wird dabei nachweislich nicht überschrieben.

Neue Arbeitsaufträge speichern effektive Dauer sowie Regelversion, Stufe, BPS und Dauer ohne Forschungsbonus. Missionen speichern effektive Typkapazitäten und Bonusgrundlage im bestehenden Logistiksnapshot. Kampf, Rückreise und Neustart lesen diesen Snapshot. Empfängerwissen wird dabei nicht herangezogen; aktuelle Ziellagergrenzen gelten wie bisher bei Zustellung.

Die bestehende Ereignisordnung bleibt erhalten: In der Stadt werden am gleichen Zeitpunkt Bauabschlüsse vor Forschungsabschluss verarbeitet; die Versorgung berücksichtigt danach fällige Ausbildung. Mehrstadt-Abrechnung nimmt zunächst die Ansichten aller Städte mit altem Wissen und übernimmt dann den globalen Abschluss. Weltmissionen werden nach Zeit und bestehendem `eventOrder` geordnet (Feldmissionen nach ID, NPC-/Transportmissionen nach gespeicherter Sequenz und ID), danach Spieler und Phase. Zustellungen/Rückkehr am Zeitpunkt erfolgen vor der abschließenden Hungerprüfung. Jeder neue Befehl rechnet zuvor fällige Welt-/Stadtereignisse ab.

Neu angenommene Forschungs-, Bau- und Ausbildungsbefehle behalten dauerhafte Wiederholungsbelege, atomar mit Zahlung und Auftrag. Bereits vor dieser Änderung entfernte historische Belege sind nicht rekonstruierbar. Fremde private Forschungsstände werden nicht veröffentlicht.

## Ausgeführte automatisierte Prüfungen

Der abschließende vollständige Lauf bestand mit 230 Tests. Die konkreten Befehle und Ergebnisse stehen unten. Zwischenläufe wurden zur Fehlerkorrektur verwendet: Der erste Lauf ohne Socketfreigabe konnte lokale Server nicht binden (`listen EPERM`). Ein weiterer Lauf fand zwei hart codierte alte Katalogversionen in den vorhandenen Servertests; diese wurden auf den neuen aktiven Katalogstand angepasst. Neue Testfixtures wurden bei der Entwicklung korrigiert (Request-ID-Mindestlänge, Startressourcen und normale Bewerberpool-Erzeugung). Diese Zwischenläufe sind keine bestandenen Abnahmen.

Gezielte neue Tests in `test/research-expansion.test.js` prüfen Katalog und Sperrgründe, alte Standardwerte, Stufen 0/1/5, zivile/militärische Bauten, alle drei Einheitentypen mit Gebäudefaktoren, eingefrorene aktive/wartende Arbeit, Hungerpause, Fracht-Rundung und Rechenprobe, konfigurierbare Basiskapazitäten, Nullbonus, Spähertanks, fünf Städte und Punkte, alte Forschungsversionen, Regelwechsel und Neustart, Offline-Schritte, unveränderte historische JSON-Daten und sichtbare Fehler bei unbekannten IDs. Ein Sockettest prüft veraltete Bau-/Ausbildungsbelege ohne Abbuchung, zwei Sitzungen mit derselben ID, gemeinsame Queue, Wiederholung nach 31 Tagen und private Forschung eines anderen Kontos.

Bestehende Tests prüfen zusätzlich eigene/fremde Lieferungen, reine Späher-/Generalverlegung, Verlust-/Öl-/Unterhaltsregeln, Migrationen, Journalausfälle und Recovery. Ihre Ergebnisse gelten gemeinsam mit dem vollständigen Lauf; es wurde kein zusätzlicher neuer Fehler-Injektionstest speziell für die Forschungsregelhistorie geschrieben.

## Browsernachweis

Reproduzierbares Skript: `scripts/validate-research-ui.mjs`. Es verwendet einen echten lokalen Spielserver, den gebauten React-Client, WebSocket und Headless-Chromium. Voraussetzungen sind Playwright (wie bei den bestehenden UI-Skripten unter `work/browser/`) und `/usr/bin/chromium`. In dieser Umgebung wurde das bereits installierte Playwright ausdrücklich über `PLAYWRIGHT_MODULE` ausgewählt; keine neue Projektabhängigkeit installiert.

Der Prüfstand erzeugt zwei eigene Städte, Universität 5, Kaserne und nötige Vorgängerforschung. Vor den neuen Forschungen werden Bau, Ausbildung und eine generalfreie Lieferung über die Oberfläche gestartet. Jede der drei Technologien wird über Kartenwahl, Vorschau und kostenpflichtige Bestätigung erforscht. Der Testserver wird anschließend gezielt auf den gespeicherten Abschlusszeitpunkt gesetzt; dies ersetzt minutenlanges Warten, nicht die serverseitige Abschlusslogik. Neue Aktionen werden in der anderen Stadt geprüft: Bautechnik 1 ergibt 4762 ms Neubau, Ausbildungstechnik 1 steht im gespeicherten Auftrag, Ladetechnik 1 ergibt 210 Plätze je LKW. Altmission und alte Ausbildung bleiben auf ihren gespeicherten Werten. Reload nimmt die Sitzung wieder auf; Neustart lädt Forschung und alte Aufträge aus JSON.

Desktop 1440×1000 und Mobil 390×844 sowie 320×844: neun Karten, Gruppenüberschriften und Status als Text; kein horizontaler Dokumentüberlauf. Forschungsvorschau und mobiles Aktionenpanel per Escape geschlossen; native Dialoge verwenden die bestehende Fokusbehandlung. Desktop-/390px-Screenshots wurden zusätzlich visuell angesehen. Artefakte des erfolgreichen Laufs: `work/research-browser/checks.json`, `desktop.png`, `mobile.png`, `mobile-320.png`. Fehlgeschlagene Entwicklungsdurchläufe (Selektoren, Responsive-Renderwechsel, ausstehende Zustandsantworten) wurden korrigiert und erneut ausgeführt. Beim längeren Ausbildungstest fiel außerdem auf, dass die übergeordnete Eingabe-Capture-Behandlung die Mengenverarbeitung im portalierten Formular unterbrechen konnte. Die Entwurfserkennung läuft nun im Bubble-Schritt nach der lokalen Eingabe; die eingegebene Menge 80 wird im erfolgreichen Test tatsächlich bezahlt und mit 240000 ms gespeichert.

Grenzen: kein physisches Mobilgerät, kein Safari/Firefox, kein Screenreader-Audit. Die Browserwelt ist eine vorbereitete Testwelt; Ausbau aller Voraussetzungen von einer leeren Neuregistrierung wurde hier nicht durchgespielt. Keine Produktionsspielstände oder externen Server geprüft. Offline-Ressourcenproduktion verwendet weiterhin vorhandene Gleitkommazahlen; der Schrittvergleich toleriert für Ressourcen 1e-8, während Forschungsstände, Aufträge und Ereignisse exakt verglichen werden. Neue BPS-/Frachtberechnungen selbst sind ganzzahlig/rational.

## PR-Beschreibung

Erweitert die globale Forschung um Bau-, Ausbildungs- und Ladetechnik mit einem gemeinsamen versionierten Katalog und nachvollziehbaren Angeboten. Neue Aufträge übernehmen serverseitig geprüfte Geschwindigkeits- beziehungsweise Traglastboni und speichern die angewandten Werte; bestehende bezahlte Arbeit und Reisen laufen unverändert weiter. Die Forschungsseite erklärt Abhängigkeiten, Stadtbezug und Wirkung; Ausbildungsangebote werden vor Zahlung geprüft.

Die sechs bisherigen Technologien und die Migrationsketten bleiben erhalten. Schema 17/4 wird additiv normalisiert, neue IDs starten bei 0, alte Forschungsaufträge bleiben abschließbar. Validierte ENV-Regeln werden mit Aktivierungszeit gespeichert. Prüfung: vollständige Node-Tests, Vite-Build und echter Chromium-Ablauf in zwei Städten auf Desktop/Mobil inklusive Sitzungswiederaufnahme und Serverneustart; konkrete Ergebnisse unten.

## Abschließende Befehle und Ergebnisse

| Tatsächlich ausgeführter Befehl | Ergebnis |
| --- | --- |
| `npm test` (mit lokaler Socketfreigabe) | 230 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen |
| `node --test test/research-expansion.test.js` | 15 gezielte neue Tests bestanden |
| `npm run build` | Vite-Produktionsbuild erfolgreich, 62 Module |
| `PLAYWRIGHT_MODULE=/opt/codex/runtimes/cua/lib/node_modules/playwright/index.mjs node scripts/validate-research-ui.mjs` | Acht dokumentierte Browserprüfschritte erfolgreich, keine JavaScript-Seitenfehler |
| `git diff --check` | Keine Whitespacefehler |

Chromium-Artefakte zur Prüfung: [Desktop](screenshots/task17/desktop.png), [Mobil 390 px](screenshots/task17/mobile.png), [Mobil 320 px](screenshots/task17/mobile-320.png), [Prüfschritte als JSON](screenshots/task17/checks.json). Vollständige Laufprotokolle liegen lokal unter `work/test-final.log`, `work/expansion-network.log`, `work/build.log`, `work/browser-final.log`. Die ignorierten Testwelten und Sitzungsdateien werden nicht mitgeliefert.

Die drei neuen ENV-Werte werden auch durch `compose.yaml` ausdrücklich weitergegeben, einschließlich 0. Docker-/Containerbuild und Deployment wurden in diesem Auftrag nicht ausgeführt. Die PR-Beschreibung steht oben. Vor Veröffentlichung werden zwischenzeitliche Änderungen auf main übernommen.


## Visuelle Ergänzung: neun Motive und aufklappbare Beschreibung (18.10.2026)

Jede aktive Technologie besitzt ein eigenes generiertes Bildmotiv, lokal als WebP-Bildtafel ausgeliefert. Zuordnung und Herkunft stehen in `apps/client/assets/README.md`. Kompakte Karten zeigen Bild, Namen, Stufe und Status. Genaue Wirkung, Kosten, Voraussetzungen und Sperrgründe sind standardmäßig in einem geschlossenen nativen `details`-Element verborgen. Das sichtbare Caret dreht sich beim Aufklappen; Enter/Leertaste und die native Offen-/Geschlossen-Semantik ermöglichen Tastatur- und assistive Bedienung. Die Forschungsaktion bleibt unabhängig davon erreichbar. Spiellogik und Spielstände wurden für diese Ergänzung nicht geändert.

Erneut tatsächlich ausgeführt: `npm test` (230 bestanden), `npm run build` (erfolgreich), `PLAYWRIGHT_MODULE=/opt/codex/runtimes/cua/lib/node_modules/playwright/index.mjs node scripts/validate-research-ui.mjs` (erfolgreich, neun protokollierte Prüfschritte, keine JavaScript-Seitenfehler) und `git diff --check` (erfolgreich). Der Browserdurchlauf prüft zusätzlich neun geladene Bildmotive, zunächst geschlossene Beschreibungen sowie das einzelne Auf-/Zuklappen aller neun Karten per Tastatur. Auf Mobil wird die Beschreibung zusätzlich per Klick geöffnet und wieder geschlossen. Desktop 1440×1000, Mobil 390×844 und 320×844 bleiben ohne horizontalen Dokumentüberlauf. Der vollständige bisherige Forschungs-/Mehrstadt-/Neustartpfad wird weiterhin durchgespielt.

Die Desktop-/Mobil-Screenshots wurden aktualisiert und visuell geprüft; [aufgeklappte mobile Beschreibung](screenshots/task17/mobile-details.png). Laufprotokolle dieser Ergänzung: `work/research-visual-test.log`, `work/research-visual-build.log`, `work/research-visual-browser.log`. Die oben genannten Grenzen (Headless-Chromium, vorbereitete Testwelt, keine physischen Geräte oder Screenreaderprüfung) gelten weiter.
