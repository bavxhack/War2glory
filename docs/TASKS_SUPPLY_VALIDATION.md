# Auftrag 18 – tatsächlich ausgeführte Prüfungen

Geprüft am 19.10.2026 unter Node.js 24.19.0. Ausgangspunkt `9a635a03e73dbddd07530c338d99b0c35e8a0a79`, zu Beginn sauberer Arbeitsbaum auf Branch `work`. Dieser aktuelle Repository-Stand wurde verwendet; der ältere Prompt-Bezug wurde nicht ausgecheckt. Sämtliche Testwelten liegen in temporären Verzeichnissen oder ignoriertem `work/`. Keine produktiven Spielstände, keine Tokens oder Sitzungsdateien im Commit.

## Spielbarer Ablauf

Stadt → Aufgaben → bestehende Spielaktion → bestätigter Fortschritt → Belohnung ausdrücklich in einer eigenen Zielstadt abholen. Voraussetzungen hängen an erfüllten Zielen, nicht an abgeholten Belohnungen. Neun Einführungsaufgaben und drei freiwillige Ausbauaufgaben verwenden den zentralen Katalog `tasks-1-provisional`. Alle zwölf Belohnungen entsprechen CODEX_PROMPT.md und sind **eigene vorläufige Projektentscheidungen**, keine War2Glory-Originalwerte. Keine zusätzlichen Kommandantenpunkte, XP, Skillpunkte oder Währungen.

Stadt → Alle Städte zeigt je getrenntem Lager die verbindliche Serverversorgung. Prognosen gelten **bei unveränderten Raten**; sie simulieren keine künftige Ausbildung, Rückkehr, Forschung oder Rollenwechsel. Positive Nettoraten liefern keine endliche Leerstandszeit. Schonfrist, nächste Verlustwelle und Erholung stammen aus dem gespeicherten Versorgungssystem. Eine andere Stadt wird nicht durch fremden Überschuss versorgt. Die Hilfe bereitet bestehende Formulare vor und sendet nichts automatisch ab.

## Befehle und Ergebnisse

| Tatsächlich ausgeführter Befehl | Ergebnis im abschließenden erfolgreichen Lauf |
| --- | --- |
| `npm test` | **249 Tests bestanden**, 0 fehlgeschlagen, 0 übersprungen |
| `node --test test/tasks-supply.test.js` | **11 gezielte Tests bestanden**, 0 fehlgeschlagen |
| `npm run build` | Vite 7.1.7: Produktionsbuild erfolgreich, 71 Module |
| `node scripts/validate-tasks-supply-ui.mjs` | 6 protokollierte Chromium-Prüfschritte bestanden, keine JavaScript-Seitenfehler |
| `node scripts/validate-world-map-ui.mjs` | 10 Karten-/Windrosen-Prüfschritte bestanden; 14 Ausschnittanfragen, keine JavaScript-Seitenfehler |
| `node scripts/validate-research-ui.mjs` | 9 protokollierte Prüfschritte bestanden, keine JavaScript-Seitenfehler |
| `node scripts/validate-logistics-ui.mjs` | 16 protokollierte Prüfschritte bestanden, keine JavaScript-Seitenfehler |
| `git diff --check` | Keine Whitespacefehler |
| `git ls-remote origin refs/heads/main` | main entsprach vor Veröffentlichung dem Ausgangspunkt `9a635a03…` |

Browserabhängigkeiten wurden ausschließlich im ignorierten Arbeitsverzeichnis installiert: `npm install --prefix work/browser --cache /workspace/War2glory/work/npm-cache --no-audit --no-fund playwright` und entsprechend `prettier`. Browser: Headless-System-Chromium `/usr/bin/chromium`, echter gebauter React-Client und echter lokaler WebSocket-Server. Lokale Socketprüfungen benötigten die Ausführungsfreigabe außerhalb der Socket-Sandbox.

Laufprotokolle: `work/test-final.log`, `work/tasks-final.log`, `work/build-final.log`, `work/tasks-browser-final.log`, `work/map-browser.log`, `work/research-browser.log`, `work/logistics-browser-final.log`. Temporäre Testwelten und deren Sitzungsschlüssel bleiben ignoriert. Reproduzierbare Skripte und ausgewählte screenshots ohne Sitzungsdaten werden mitgeliefert.

## Geprüfte fachliche Übergänge

1. **Frisches Konto:** Ausschließlich normale WebSocket-Befehle für Bauernhof, Bürgermeister, Lagerhaus, Universität, Forschung, Raffinerie, Kaserne, Infanterie-/Späherausbildung, Aufklärung und Farmzug. Kontrollierte Uhr ersetzt Produktions-/Reisewartezeiten. Alle neun intro-Aufgaben werden ohne Belohnungsabholung erfüllt. Keine zusätzlichen Truppen oder Gebäude über das Tutorial. Der Test bildet insgesamt 60 Infanteristen aus und sendet 30 gegen das schwächste reguläre NPC-Ziel; er behauptet ausdrücklich nicht, zehn Infanteristen reichten für jedes Ziel. Zusätzliche stationierte Ausbildung und Unterhalt schaffen regulär Lagerplatz für tatsächliche Beute.
2. **Frühe Nachweise:** Ausbildung zählt erst nach Abschluss; getrennte Jobs zählen einmal und sättigen den Zähler. Ein vor Freischaltung belegtes Lagerhaus bleibt nach Abriss nachgewiesen und wird nach erfülltem Bauernhof abgeschlossen. Truppenbestände von 500 Einheiten erzeugen keinen Ausbildungsnachweis. Nochmaliges Abrechnen desselben Zeitpunkts verändert den Fortschritt nicht.
3. **Fachliche Ereignisse:** Scout ohne freigegebene Intelligence und Feldaufklärung erfüllen die NPC-Aufgabe nicht. Sieg ohne gespeicherte Nahrung erfüllt den Raid nicht. Eigene Lieferung an volle Stadt erfüllt Versorgung nicht; danach erfüllt tatsächliche Teilannahme von genau einer Nahrung das Ziel bereits bei Ankunft. Eigene Rückladung, neue Beute und gelieferte Güter bleiben über die vorhandenen Frachtpfade getrennt.
4. **Auszahlung:** Fehlt bei einer Ressource ein Platz, ändern sich weder Ressourcen noch Anspruch. Exakter Platz funktioniert; schon vorhandener Ölüberbestand bei Belohnung ohne Öl wird erhalten. Eingefrorene Anspruchswerte und Version werden verwendet, Punkte bleiben unverändert. Fremde Zielstadt wird über WebSocket abgewiesen.
5. **Zwei Tabs und Wiederholung:** Verschiedene requestIds konkurrieren um denselben Anspruch; genau eine gewinnt. Gleiche ID/Payload liefert Originalresultat, geänderter Inhalt wird abgewiesen. Neustart und sogar explizites Entfernen der zusätzlichen `processedCommands` im Test lassen den dauerhaften Abholbeleg wirksam. Ein neuer Befehl kann nach 31 Tagen keine zweite Belohnung erzeugen.
6. **Schreibfehler und Recovery:** Fehler vor Journalablage lässt den Anspruch offen. Fehler beim Spielerdatei-Rename nach durablem Journal wird wiederhergestellt; die zuvor nicht bestätigte Auszahlung ist danach genau einmal vorhanden und mit ursprünglicher requestId wiederholbar. Keine allein im RAM verbliebene Auszahlung. Ausbildungsfortschritt ist bei großem Offlineschritt, kleinen Schritten und Journal-Replay identisch.
7. **Hungergrenze:** Abholung nach einer bereits fälligen Hungerwelle rechnet diese zuerst ab (20 → 19 Infanteristen), vergibt danach Nahrung und behält den Mangelzähler. Eine Nahrungsbelohnung während Mangel startet nur die bestehende Erholung und setzt nicht die Schonfrist zurück.
8. **Übersicht:** Zwei unterschiedliche Städte, eigener Bürgermeister, globale Landwirtschaft und getrennte Truppenbestände liefern exakt `supplySummary(cityView(...)) × 3600`. Defizit bleibt trotz positivem Gesamtsaldo sichtbar. Nichtnegative Rate liefert `null` für Leerstandszeit; Mangel-/Erholungsstatus und gespeicherte Termine werden geprüft. Bestehende Versorgungs-, Forschungs-, Mehrstadt- und Logistiktests prüfen zusätzlich Ausbildungsabschluss, Rückkehr, Verlegung, historische Regelversionen und Forschungsabschluss einschließlich zeitgleicher Hungergrenzen.

## Migration und Speicherung

Explizites Spielerschema **17 → 18**, Weltschema unverändert **4**. Der neue Fünf-Städte-Fall enthält Forschung, laufende Ausbildung, eine tatsächlich gestartete laufende eigene Lieferung sowie gespeicherte Scout-/Raid-Berichte. Abgesehen von Schema und neuem Aufgabenobjekt bleibt der kanonische JSON-Bestand gleich, einschließlich Mission/Fracht/Öl/Terminen; zweites Laden ist identisch. Aufgaben berücksichtigen den Bauernhof in der fünften Stadt und eindeutige alte Berichte. Laufende spätere Ausbildung zählt bei ihrem Abschluss; vorhandene Truppen und vor Aktivierung fällige Ausbildung werden nicht als neue historische Erfolge erraten. Beschädigtes Aufgabenschema wird abgewiesen und die Originaldatei nicht überschrieben. Bestehende Tests prüfen auch ältere Schema-/Legacy-Importketten, historische Missionen, Rollen, Punkte und Journalfälle.

Fortschritt ist spielerweit. Maximal fünf bei zehn gesättigte Ausbildungszähler, zwölf erreichte Ziele und zwölf eingefrorene Ansprüche; keine neue unbeschränkte Ereigniskopie. Stabile Ausbildungsjobs werden zusammen mit dem Fortschrittszähler aus ihrer Queue entfernt. Missionen/Berichte bleiben die bestehenden Abschlussbelege. Dauerhafte `claim`-Objekte und Request-Fingerprints sichern genau eine Auszahlung; die bestehende serialisierte Weltqueue und das bestehende Recovery-Journal werden genutzt. Einführungs-Ausblendung bleibt als UI-Präferenz im lokalen Browser vom Aufgabenstand getrennt.

## Tatsächliche Browserbedienung

- Desktop 1440×1000: Bauernhof über vorhandene Ausbauaktion erhöhen → Serverabschluss → Aufgabenstatus → volles Lager abweisen → andere Zielstadt wählen → Belohnung abholen → abgeholten Bereich per Enter öffnen. Zweiter Tab erhält denselben Stand.
- Übersicht erkennt Hungerhafen; Bauernhofhilfe öffnet die richtige vorhandene Aktion ohne Bauauftrag. Lieferhilfe verlangt ausdrücklich eine andere eigene Quelle, setzt nur das Ziel; Nahrung und LKWs bleiben 0, keine Mission wird gestartet. Ungesendeter Lieferentwurf wird beim Stadtwechsel bestätigt und verworfen.
- 390×844 und 320×844: Versorgungskarten ohne horizontalen Dokumentüberlauf; Abholdialog startet in der aktuell ausgewählten Stadt. Escape schließt Dialoge und gibt Fokus zurück. Abbruch zeigt veralteten Stand mit Zeitstempel und sperrt Abholung; Resume/Reload übernimmt den gespeicherten Anspruch.
- Bestehende Weltkartenprüfung: alle acht Windrosenrichtungen, Halten, Tastatur, Abbruch/Blur, verspätete Antworten, alle Weltecken, Projektion/Auswahl, Touch und Reload auf 390/320 px. Kartenquellcode, Projektion und Kachelgrößen wurden für Auftrag 18 nicht geändert.
- Bestehende Forschungsprüfung: neun Technologien, alle drei neuen Technikboni in zweiter Stadt, eingefrorene Altaufträge, Desktop/Mobil, Tastatur, Reload und Serverneustart.
- Bestehende Logistikprüfung: generalfreie fremde/eigene Lieferung, Infanterie-/Späher-/Generalverlegung, XP-Kauf, Forschung, Bericht, Entwurf, Feldaufklärung/Eroberung/Gründung, sieben Navigationseinträge, 390/320/683 CSS-Pixel, unabhängige Tab-Stadtauswahl und Reload.

[Desktop Aufgaben](screenshots/task18/desktop-tasks.png) · [Desktop Versorgung](screenshots/task18/desktop-overview.png) · [Mobil 390 px](screenshots/task18/mobile-390.png) · [Mobil 320 px](screenshots/task18/mobile-320.png) · [Mobile Weltkarte](screenshots/task18/mobile-map.png) · [Prüfschritte JSON](screenshots/task18/checks.json). Desktop- und 320px-Versorgungsbilder wurden zusätzlich visuell angesehen. Die kontrollierte Testuhr erklärt die historischen Datumsanzeigen in den Bildern.

## Entwicklungsfehler und Grenzen

Erste Läufe deckten historische Testfixtures mit unpassend mitkopiertem neuem Aufgabenobjekt sowie einen temporären Stadtauswahlwechsel beim Migrationsdurchlauf auf. Die Fixtures bilden nun echte historische Schemas; Migration beobachtet Stadtansichten ohne Auswahleffekt. Der Einführungslauf belegte außerdem, dass Sieg bei vollem Nahrungsbestand keine Aufgabe erfüllt; der erfolgreiche Test schafft Platz durch reguläre Ausbildung/Unterhalt. Der bestehende Logistik-Browserlauf benötigte seit den vorigen Aufträgen präzisere Selektoren: konkrete erreichbare Forstwirtschaft statt erster Forschungskarte und Tastaturauswahl des isometrischen Bodenfelds statt überdeckter Polygonmitte. Spielregeln und Weltkarte wurden dafür nicht verändert. Alle oben als erfolgreich angegebenen Befehle wurden nach diesen Korrekturen tatsächlich erfolgreich ausgeführt.

Keine physischen Mobilgeräte, Safari/Firefox oder Screenreader getestet. Browserwelten sind vorbereitete isolierte Prüfszenarien; der vollständige frische Einstieg wurde im WebSocket-Integrationstest mit Produktions-/Reisezeitfortschreibung geprüft. Keine Last-/Mehrprozessprüfung, kein Dockerbuild oder Deployment in Auftrag 18. JSON-Speicherung bleibt auf einen Serverprozess je Welt ausgelegt. Eingehende Nahrung wird nicht als garantiert verfügbar vorweggebucht. Bündnisse, PvP, Tauschhandel und Matrix bleiben separate Folgeaufträge.
