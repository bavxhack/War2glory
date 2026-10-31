# Auftrag 19: lokale Bündnisse und tatsächliche Prüfungen

Stand: 31.10.2026. Ausgangspunkt: `e4af676` nach erfolgreichem `git pull --ff-only origin main`. Der erste Pull ohne Netzwerkfreigabe scheiterte an der Proxyverbindung; der zweite mit Netzwerkfreigabe war erfolgreich. 18a ist in diesem Ausgangspunkt enthalten.

## Implementierung und Daten

Ein unabhängiger Regelkern `packages/game-core/alliances.js`, Serveradapter `apps/server/alliances.js` und direkte React-Oberfläche `apps/client/src/AllianceView.jsx` ergänzen den vorhandenen WebSocket. Acht Hauptbereiche, auf Mobilgeräten Einstieg über „Mehr“. Lokale Formulare, automatische Gründungsvorschau, bewusste Mutationen und Bestätigungen für Gründung/Ausschluss/Führungsübergabe/Austritt/Auflösung. Mitgliedsstädte öffnen vorhandene Karte, private Nachrichten und unveränderte Ressourcenlieferungen.

**Welt 5 / Spieler 18.** `world.json.alliances` ist die einzige Mitgliedschafts-/Rollenautorität. Mitgliedschaften werden daraus abgeleitet, niemals an Städten gespeichert. Neue Welten und sämtliche bisherigen Weltmigrationszweige erreichen Schema 5. Bestehende Spielerfelder benötigen keine Migration. UUIDs zusammen mit der Welt-instanceId identifizieren Bündnisse. Aktive Namen werden nach NFKC, Trim und `toLocaleLowerCase('de-DE')` verglichen; Kürzel nach NFKC/Trim als 2–5 ASCII-Buchstaben/Ziffern in Großbuchstaben. Namen/Kürzel bleiben unveränderlich. Beschreibungen, Mitteilung und Chat werden ausschließlich als Text gerendert; Steuer-/Formatzeichen werden abgelehnt, Chat/Mitteilung erlauben LF-Zeilenumbrüche.

ENV: `ALLIANCE_CREATE_WOOD=1000`, `ALLIANCE_CREATE_STONE=1000`, `ALLIANCE_MAX_MEMBERS=20`, `ALLIANCE_INVITE_TTL_HOURS=168`. Eigene vorläufige Projektwerte, keine behaupteten Originalwerte. Zentrale Ganzzahl-/Bereichsvalidierung vor Serverstart; Compose reicht die Werte weiter. Angebote tragen die gehashte Regelversion. Mitgliederlimit am Bündnis und Ablaufzeit an der Einladung bleiben bei ENV-Wechsel erhalten.

Gründung: eigene gewählte Stadt, Ressourcen/Regeln/Cooldown erneut prüfen; Gebühren, Bündnis, Gründerzeitpunkt und dauerhaften Requestbeleg gemeinsam journalisieren. Annahmen/Gründungen/Führung und alle übrigen Bündnismutationen laufen in der vorhandenen Weltqueue. Kandidaten werden geklont und erst beim Commit übernommen. Nach Speicherfehlern wird der alte In-Memory-Stand wiederhergestellt; das bestehende `needsRecovery` synchronisiert vor weiteren Bündnisaktionen das Journal. Erst nach Commit erfolgt `command.ok`/Push.

Gründungsbelege überstehen Auflösung und normale Historienbereinigung dauerhaft. Andere Bündnisbefehle haben ein **30-Tage-Wiederholungsfenster** (Serverzeit); ihre kompakten SHA-256-Fingerprints enthalten keine aufbewahrte Kopie gelöschter Chattexte. Identische Wiederholungen liefern nur `duplicate`, abweichende Inhalte einen Fehler. Alte Privatprojektionen werden nie aus Befehlsbelegen wieder ausgespielt. Nicht blind mit einer neuen ID nach Verbindungsverlust wiederholen. Nach 30 Tagen sind normale Befehls-IDs kein Wiederholungsnachweis mehr; verbrauchte/entfernte Einladungs-IDs erhalten dadurch keine neue Autorität.

Chat: letzte 200 Plätze einschließlich neutraler Moderationsplatzhalter, monotoner Sequenzzähler; Verwaltungsprotokoll letzte 100 Ereignisse. Chatseiten beginnen mit den neuesten Beiträgen, „Weitere Beiträge“ lädt ältere. Seiten sind auf 20 Einträge und zusätzlich UTF-8-Bytes begrenzt; Mitgliederprofile verwenden einen kleineren Seitenrahmen, damit auch lange Mitteilungen passen. Lesemarken sind monoton, an membershipId und tatsächlich an diesen Tab ausgelieferte Sequenzen gebunden; der Benutzer markiert sichtbar gelesene Beiträge ausdrücklich. Neue Mitgliedschaft beginnt am aktuellen Chatende. Persönliche Rate-/Cooldown-Daten bleiben im Weltbestand erhalten.

## Rechte und Sichtbarkeit

| Aktion/Daten | Anführer | Offizier | Mitglied | Außenstehender |
| --- | --- | --- | --- | --- |
| Verzeichnis/öffentliches Profil/Städte | ja | ja | ja | ja, authentifiziert |
| Chat/Mitteilung/Protokoll lesen, Chat senden | ja | ja | ja | nein |
| Einladen/Widerrufen/Beschreibung/Mitteilung | ja | ja | nein | nein |
| Normales Mitglied ausschließen | ja | ja | nein | nein |
| Offizier ausschließen, Rollen/Führung ändern | ja | nein | nein | nein |
| Eigenen Beitrag entfernen | ja | ja | ja | nein |
| Fremden Beitrag moderieren | ja | ja | nein | nein |
| Austritt | vorher Führung abgeben | ja | ja | entfällt |
| Auflösung | nur allein | nein | nein | nein |

Einladungen sind nur dem Empfänger und aktueller berechtigter Verwaltung sichtbar. Jedes Lesen und jede Mutation autorisiert erneut. Mitgliedschafts- und Verwaltungsversion schützen alte Tabs/Zielmitgliedschaften; Chat erhöht die Verwaltungsversion nicht. Mitteilung besitzt eine eigene Version. Pushes enthalten nur die kleine eigene Zusammenfassung und lösen autorisierte neue Leseanfragen aus. Es gibt keine dauerhaft abonnierten privaten Chatstreams. Bei Entzug/Wiedereintritt wird die private React-Ansicht einschließlich Entwürfen über membershipId neu angelegt; überholte Leseeffekte werden verworfen.

## Tatsächlich ausgeführte automatisierte Prüfungen

Umgebung: Node.js 24.19.0, Vite 7, React 19, System-Chromium und vorhandenes Playwright. Ausschließlich temporäre/isolierte Testwelten unter `/tmp` und `work/`; keine produktiven Spielstände, kein Deployment/Push. Lokale Server/Browser wurden mit Netzwerkfreigabe gestartet. Der erste Testlauf ohne diese Freigabe scheiterte an `listen EPERM`; das ist kein Spieltest-Erfolg.

- `npm test`: abschließend **270 Tests bestanden, 0 fehlgeschlagen**, einschließlich 16 Bündnistests.
- `npm run build`: erfolgreich, 74 Module, Vite-Produktionsbuild.
- `git diff --check`: ohne Befund.
- `node --test test/alliances.test.js test/alliances-server.test.js`: zunächst 15 Tests bestanden. Anschließend zusätzliche Prüfung der offenen Einladungsgrenzen/Offiziersrechte/UTF-8-Seiten ergänzt; `node test/alliances.test.js`: alle 8 Kerntests bestanden. Der abschließende Gesamtlauf enthält alle 16 Bündnistests. Enthält eine tabellarisch ausgeführte Rollenmatrix für sämtliche Verwaltungs-/Chatrechte.
- Konkurrenz: zwei gleiche Gründungen → genau ein Gewinner ohne Verliererzahlung; zwei Annahmen letzter Platz und konkurrierende Bündnisse für denselben Spieler → nur eine Aufnahme.
- Zahlung/Replay: exakt ein Stadtabzug, fremde Stadt/fehlende Ressourcen/alte Preisversion abgewiesen, alter Gründungsbefehl nach Auflösung, 31 Tagen und Neustart weiterhin dedupliziert.
- Einladungen: Duplikat ohne Fristverlängerung, fremder Empfänger, volles Bündnis, exakte Ablaufgrenze, weitere Einladungen nach Annahme ungültig, Login eines Empfängers, Ausstellerdegradierung, Einladungslimit und gespeicherte TTL.
- Rollen: veralteter Offiziertab, neue membershipId bei Wiederbeitritt, atomare Führungsübergabe, Austrittssperre, Auflösung nur als letzter Anführer.
- Privatheit/Chat: Außenprofil ohne interne Felder, kein Lesen nach Kick, Mehrtab-Push, Löschplatzhalter nach Neustart, Rate/Längen-/Unicodegrenzen, monotone Lesemarke, getrennte Mitteilungsversion, Chatretention und Replay nach Pruning/Neustart.
- Recovery: tatsächliche Dateisystemfehler beim Journal-, Welt- und Spielerwrite injiziert. Vor Folgeaktion kein Phantom-Bündnis; nach Recovery/Retry/Neustart genau ein Bündnis und eine Gebühr.
- Migration: Welt 1/2/3/4 erreichen 5; zweiter Start idempotent; Karte bei 4→5 und bestehende Spielerdaten erhalten; beschädigte Führungsrolle wird abgelehnt.
- ENV-Wechsel: veraltetes Angebot abgelehnt, bestehendes Limit/Ablaufdatum unverändert, Chat-Ratelimit über Neustart erhalten.

Im erweiterten Browserprüfstand wurden ein Menü-/Entwurfsdialog-Übergang auf eine Ebene begrenzt und stabile zugängliche Namen für veränderliche Textareas ergänzt. Der erste mobile Prüfstand hatte außerdem einen Viewport-/Menü-Render-Rennzustand; er wartet jetzt auf den tatsächlichen responsiven Navigationszustand. Eine eingefrorene Browser-Testuhr verursachte falsche Karten-Ratelimitfehler; der Browserablauf verwendet jetzt laufende Serverzeit, Grenz-/Fristentests weiterhin kontrollierte Zeit. Nur der abschließend erfolgreiche Lauf wird als bestanden ausgewiesen.

Der neue WebSocket-Test deckte einen Fehler im vorhandenen Testhelfer auf: er interpretierte exakt 127 Nutzbytes nach der 16-Bit-Längenauflösung erneut als 64-Bit-Header. `test/support/socket.js` verwendet dafür jetzt `else if`.

## Tatsächlich ausgeführte Browserprüfungen

`node scripts/validate-alliances-ui.mjs`: drei Testkonten und ein zweiter Bravo-Tab. Gründung mit Vorschau/Bestätigung, Einladung nach Reload/Resume, Annahme, Offizier lädt dritten Spieler ein, keine Führungsaktion für Offizier, Chat live in allen beteiligten Ansichten, Scripttext ohne Ausführung, eigene Moderation in anderem Tab, Mitgliedsstadt → echte reguläre Lieferung mit ausdrücklich gewählten LKW/Gütern, Führungsübergabe, Austritt mit sofortigem Entzug privater UI, kein weiterer Chattext beim Ausgetretenen, regelgerechte Auflösung. Laufende Lieferung bleibt vorhanden.

Nachweise: `docs/screenshots/task19/desktop.png`, `mobile-390.png`, `mobile-320.png`, maschinenlesbare tatsächliche Prüfschritte in `checks.json`. 1440×900 sowie 390/320×844; keine JavaScript-Seitenfehler. Zusätzlich tatsächlich geprüft: Server stoppen, offline gesperrten Sendebutton abwarten, Server mit demselben Weltverzeichnis/Port neu starten, automatische Wiederverbindung und gespeicherte Moderation prüfen. Mitteilungsentwurf aus einem zweiten Tab meldet einen echten Versionskonflikt und bleibt erhalten. Ein mobiler Chatentwurf bleibt nach Navigation → „Bleiben“ bei beiden Breiten unverändert erhalten.

Regressionen tatsächlich erneut ausgeführt:
- `node scripts/validate-ux18a-ui.mjs`: direkte Bau-/Forschungs-/Ausbildungs-/Liefer-/Verlegungswege, Vorschaukonflikte, Entwürfe, Reconnect, zwei Tabs, 1440/1280/768/390/320 und 200%-Arbeitsfläche; bestanden.
- `node scripts/validate-ux18a-paths.mjs`: Aufgabenabholung, Generalrollen/Umbenennung, Rekrutierung, Abriss, NPC-Aufklärung/Farmzug, Feldaufklärung/Eroberung/Gründung und Berichtsfolgeplanung; bestanden.
- `node scripts/validate-world-map-ui.mjs`: acht Richtungen, Halten/Loslassen, Tastatur-/Fokusverlust, verspätete Antworten, Weltgrenzen, Auswahl, echte emulierte Touch-Ereignisse 390/320 und Resume; bestanden.

## Grenzen

JSON-Speicherung bleibt auf einen Serverprozess je Welt ausgelegt. Kein Last-/Mehrprozess-, Docker-, Safari-/Firefox-, Screenreader- oder physischer Mobilgerätetest. Keine neue Unterstützung, fremde Truppenverlegung, Diplomatie, PvP, Boni oder aktive Föderation; `federationEnabled` bleibt false. Frühere empfangene Inhalte können nicht rückwirkend ungelesen werden. Die 200-/100-Grenzen sind kein unbegrenztes Archiv. Kompakte Gründungsbelege bleiben absichtlich dauerhaft; normale Befehlsbelege werden bei Mutationen nach 30 Tagen bereinigt. Backup/Wiederherstellung umfasst weiterhin das vollständige gestoppte Weltverzeichnis einschließlich eventuell vorhandenen Recovery-Journals.
