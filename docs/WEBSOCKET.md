# WebSocket-, Konto- und Speicherformat

## Ereignisprotokoll (Version 1)

Die Anwendung lädt nur statische Dateien, `GET /health` und die öffentliche Föderationsbeschreibung über HTTP. Private Spielstände und Spielbefehle sind ausschließlich über `GET /game` als WebSocket-Upgrade erreichbar. Jedes Clientereignis enthält `version`, `type`, eine eindeutige `requestId` und `payload`. Antworten tragen dieselbe `requestId`; Push-Ereignisse benötigen keine.

Der Server akzeptiert `auth.register`, `auth.login`, `auth.resume`, `auth.logout`, `city.sync`, `construction.enqueue`, `building.preview`, `building.demolish`, `training.enqueue`, `scouting.start`, `raid.start`, `general.rename`, `general.mayor`, `general.preview`, `general.convert`, `general.distribute`, `research.preview`, `research.start`, `map.viewport` und `map.details`. Er sendet zusätzlich `map.snapshot`, `map.details` und bei neu registrierten Städten `map.changed`. Kartenausschnitte sind höchstens 15×15 Felder groß; Koordinaten, IDs und eine kurze Anfragerate werden serverseitig geprüft. Antworten auf öffentliche Kartendetails enthalten keine Ressourcen, Garnisonen, Bauaufträge oder Regenerationszeitstempel. Nachrichten sind auf 16 KiB begrenzt. Der Server prüft Format, Ereignistyp und Origin. Hinter einem Reverse Proxy werden erlaubte öffentliche Origins explizit angegeben:

```sh
npm start -- --host 0.0.0.0 --origins https://spiel.example.org
```

Der Proxy muss WebSocket-Upgrades weiterreichen. Externer Zugriff muss TLS verwenden, damit Browser `wss://` einsetzen. Weitergeleitete Header allein erweitern nicht die Vertrauensgrenze.

## Sicherheit und Wiederholung

Passwörter werden mit Node.js `scrypt`, zufälligem 128-Bit-Salt und konstantem Vergleich geprüft. Sitzungsschlüssel besitzen 256 Bit Zufall, laufen nach 30 Tagen ab, sind widerrufbar und werden serverseitig nur SHA-256-gehasht gespeichert. Der Browser speichert den Schlüssel in `localStorage`, damit ein Neustart wieder zur Stadt führt. Das schützt nicht gegen JavaScript aus einer XSS-Lücke derselben Origin. Passwortwiederherstellung und Mehrfaktor-Anmeldung sind noch nicht vorhanden.

Eine bestätigte Befehls-ID bleibt 30 Tage lang erhalten, höchstens die letzten 500 IDs pro Spieler. Dieselbe ID und derselbe Inhalt liefern eine idempotente Bestätigung einschließlich des gespeicherten Abrissergebnisses. Ein abweichender Inhalt wird abgewiesen. Zustandsänderungen werden je Welt serialisiert und erst nach erfolgreichem atomarem Speichern bestätigt.

## JSON-Ablage, Sicherung und Altstadt

Eine Welt enthält `world.json`, `accounts.json` und je Spieler `players/<serverseitige-uuid>.json`. `world.json` ist die verbindliche Quelle für Weltidentität, Karte, NPCs und Stadtpositionen. Für eine neue Stadt wählt der Server kryptografisch zufällig aus allen freien, bebaubaren Feldern; die serialisierte Vergabe verhindert Doppelbelegungen bei gleichzeitigen Registrierungen. Die Weltänderung wird bei einer Registrierung vor Spieler und Konto atomar geschrieben und bei Folgefehlern zurückgerollt; alle Schritte laufen in derselben Prozesswarteschlange. Bestehendes Weltschema 1 wird vor der einmaligen Migration als `world.json.schema-1.backup` gesichert und erhält für alle vorhandenen Konten Positionen. Wiederholtes Laden vergibt keine neue Position. Temporäre Dateien werden atomar umbenannt. Dateinamen stammen nie aus Benutzereingaben. Pro Weltverzeichnis darf genau ein Serverprozess schreiben. Unbekannte oder beschädigte JSON-Dateien stoppen den Start, statt still überschrieben zu werden.

NPC-Nahrung und Garnison sind gemeinsame, versionierte Bestände. Der Server rechnet beide nur bis zum fachlichen Zeitpunkt des nächsten chronologischen Ereignisses fort. Ankunft und Rückkehr werden mit einer persistenten Ereignisnummer geordnet. `transaction.json` enthält vor dem Schreiben zusammengehöriger Welt-/Spielersnapshots eine wiederholbar anwendbare Transaktion und wird beim Start vor Spielzugriff wiederhergestellt. So sehen gleichzeitige Angriffe den fortgeschriebenen Bestand und ein Absturz zwischen Einzeldateien erzeugt weder doppelte Beute noch nur halb angewandte Verluste. Die Datei ist intern und wird nie an Clients projiziert.

Für Sicherung und Wiederherstellung den Server stoppen und das vollständige Verzeichnis `data/<welt>/` kopieren beziehungsweise ersetzen. Bestehende `state.json`-Demo-Daten werden nicht automatisch einem Konto gegeben. Nach Registrierung und bei gestopptem Server erfolgt die ausdrückliche Übernahme so:

```sh
npm run claim-legacy -- --world alpha --username Kommandant --confirm
```

Das Werkzeug migriert Schema 1 oder übernimmt Schema 2, schreibt die Stadt in die ausgewählte Spielerdatei und benennt die Quelle als datiertes Backup um.

## Lager-, Militär-, Aufklärungs-, Farm- und Versorgungsprototyp (Spielerschema 9)

Schema 4 ergänzt stabile Gebäudeidentitäten, tatsächlich am Auftrag festgehaltene Kosten und eine Investitionsgrundlage je Gebäude. Alte fertige Gebäude werden konservativ als unvollständig dokumentiert markiert; ihre Kosten werden nicht aus der aktuellen Preistabelle erfunden. Nachweisbare alte Warteschlangenaufträge übernehmen die unter dem damaligen Prototyp verbindlich abgezogenen Auftragskosten.

Snapshots enthalten Kapazität, Produktion und Kapazitätsaufschlüsselung je aktiver Ressource. `building.preview` liefert für ein eigenes fertiges Gebäude eine an Identität und Zustand gebundene Abrissvorschau. `building.demolish` verlangt deren `slotId`, `buildingId` und `version`; der Server prüft Bau- und Ausbildungsabhängigkeiten erneut, schreibt Abriss, Rückerstattung und Deduplizierungsbeleg atomar und lehnt veraltete Vorschauen ab. Die vorläufigen zentralen Werte sind 2000 Grundkapazität, 250 Kapazität je Produktionsgebäudestufe oberhalb Stufe 1, 500 je Lagerhausstufe für alle Ressourcen und 10 Prozent abgerundete Rückerstattung nachgewiesener Kosten. Abriss ist sofortig; Überbestand bleibt erhalten und stoppt nur positive Produktion der betroffenen Ressource.

`city.snapshot` und `city.updated` enthalten nun zusätzlich die abgeleitete Punkteübersicht, vier getrennte Militärbauplätze, stationierte Einheiten, Ausbildungsaufträge, den Startgeneral, eigene Einsätze und ausschließlich zurückgekehrte Berichte. Neue authentifizierte Befehle sind `training.enqueue` (`barracksSlotId`, `unit`, `amount`) und `scouting.start` (`targetId`, `generalId`, `scouts`). Beide verwenden dieselbe Befehls-ID-Deduplizierung und werden vor der Bestätigung atomar im Spielerstand gespeichert. Der Server leitet die Kaserne aus dem eigenen gespeicherten Militärbauplatz ab; fremde Spieler-, Bauplatz- oder Berichts-IDs werden nicht als Autorität akzeptiert.

Die zentralen vorläufigen Testwerte sind: vier Militärbauplätze; gemeinsame Bauwarteschlange mit drei Plätzen; **jede fertige Kaserne besitzt eine eigene Ausbildungswarteschlange mit drei Gruppen**; höchstens 1.000 Einheiten je Gruppenauftrag; Späher kosten 10 Holz/5 Stein/5 Nahrung und benötigen auf Kasernenstufe 1 zwei Sekunden, Infanterie 15/10/10 und drei Sekunden. Verschiedene Kasernen bilden parallel aus. Innerhalb einer Kaserne wird die gesamte Gruppe erst gemeinsam fertig, und folgende Gruppen beginnen erst nach dem Ende der vorherigen. Eine höhere Kasernenstufe teilt nur die beim Auftragsstart festgeschriebene Dauer. Gebäudepunkte sind `10 × Summe fertiger Gebäudelevel`; Forschungspunkte sind mit Auftrag 11 aktiv, signierte Kampfbeiträge seit Auftrag 8.

Jeder Spieler erhält idempotent einen Startgeneral. Level L benötigt insgesamt `50 × L × (L − 1)` Erfahrung (maximal 10), das historische Feld `leadership` beträgt `20 × Level`. Die echte Bürgermeistereigenschaft ist `attributes.leadership` plus `skills.allocations.leadership`; vorhandene Grundwerte werden nicht neu skaliert. Schema 5 übernimmt alle vorhandenen Generäle und aktiven ID-Verweise verlustfrei. Jeder General besitzt zusätzlich eine Besitzer-ID, eine Konfliktversion, Grundwerte für Führung/Angriff/Verteidigung sowie getrennte Zähler für verwendete XP, erworbene/freie Skillpunkte und Verteilungen. Fehlende Skilldaten beginnen bei null; bestehende Gesamterfahrung bleibt unverändert. `general.rename` verlangt General-ID, Namen und erwartete Konfliktversion, wird wie andere Änderungen dedupliziert und akzeptiert nach dem Trimmen 1–40 Unicode-Codepunkte ohne Steuerzeichen. Gleichnamige Generäle bleiben zulässig. Skillbefehle sind seit Auftrag 10 mit dem vorläufigen Regelsatz `general-skills-1-provisional` aktiv; Details stehen unten. Vor Aufklärung oder Farmzug wählt der Spieler einen freien General und eine positive Anzahl stationierter, nicht bereits gebundener Einheiten. Ein Führungslimit ist für diese Einsätze derzeit nicht aktiv. Pro Einsatz prüft der Server typübergreifend eine Obergrenze von insgesamt 10.000 Einheiten. Der Server reserviert General und Einheiten für den gesamten Hin- und Rückweg; sie stehen erst nach der Rückkehr wieder für andere Aktionen bereit. Eine spätere Reichweitenbegrenzung durch Nahrung ist noch nicht aktiv. Die erste zurückgekehrte Aufklärung je NPC gibt 10 General-Erfahrung. Pro Richtung gilt vorläufig `max(5 Sekunden, ceil(Luftlinie) × 5 Sekunden)`. Gelände beeinflusst den Weg noch nicht; Aufklärungen gelingen ohne Verluste. Berichte werden erst bei Rückkehr sichtbar und enthalten einen historischen Snapshot. Aufklärung gewährt weder Beute noch Kommandanten-Kampfpunkte.

## React-/Vite-Client

Der Browser verwendet weiterhin ausschließlich den Endpunkt `/game` und Protokollversion 1. Eine zentrale Transportschicht in `apps/client/src/transport.js` verwaltet genau eine Verbindung je gemounteter Anwendung, Sitzungswiederaufnahme, Request-IDs, Reconnect und den bestätigten Zustand. Vite leitet im Entwicklungsmodus nur diesen Pfad weiter; im normalen Betrieb liefert der Node-Server den gebauten Client selbst aus. Entwicklungsursprünge müssen mit `--origins` ausdrücklich freigegeben werden.

## Versorgung und Bürgermeister (vorläufiger Prototyp)

Spielerschema 7 speichert den Aktivierungszeitpunkt, Mangeldauer, Erholungsbeginn, nächste Verlustwelle und begrenzte private Versorgungsereignisse. Der weltweite `supplyActivatedAt` verhindert rückwirkenden Unterhalt bei der Migration. `general.mayor` setzt eine eigene freie General-ID oder `null`; Rollenwechsel werden nach vorheriger Zeitabrechnung dedupliziert und atomar gespeichert. Snapshots trennen Nahrungsgrundproduktion, Bürgermeisteranteil, Unterhalt und Nettobilanz. Stationierte sowie missionsgebundene lebende Einheiten werden genau einmal gezählt. Hunger verändert Einsatzstärken und kann auf dem Rückweg nicht mehr tragbare Beute dauerhaft entfernen. Bei gleichem Zeitstempel wird zuerst die Wirtschaft bis zu diesem Zeitpunkt abgerechnet, dann werden geordnete Missionsereignisse einschließlich einer Beuterückkehr verarbeitet und erst danach wird eine weiterhin fällige Hungerwelle ausgelöst. Die konkreten Verbrauchs-, Frist-, Verlust- und Bonuswerte sind vorläufige Vorschläge, keine Originalwerte.

## Aktive Skillaktionen und Migration auf Spielerschema 8

Alle Skillbefehle verwenden `generalId`, `expectedVersion` und `rulesetVersion: "general-skills-1-provisional"`. Der Server sucht ausschließlich in den eigenen Generälen, prüft den aktuellen General-/Regelstand und rechnet vorher fällige Welt- und Versorgungsereignisse ab. Bei Konflikten sendet er `command.error` und anschließend einen aktuellen privaten `city.snapshot`. Der Client bewahrt den Entwurf und verlangt eine neue Vorschau/bewusste Bestätigung.

- `general.preview` mit `points` prüft den Kauf; mit `changes: { leadership, attack, defense }` prüft es Zuweisungsdeltas. Antwort `general.preview`: General-/Regelversion, Skillzusammenfassung, Kaufkosten/Rest-XP, nächster Preis, Grenzen, vorgeschlagene effektive Eigenschaften und militärische Boni. Die Vorschau bucht nichts.
- `general.convert` mit positiver sicherer Ganzzahl `points` erhöht nur `skills.experienceSpent` und `skills.totalPoints`; Gesamt-XP und Level bleiben erhalten. Kosten werden in konstanter Zeit mit sicherer Ganzzahlrechnung geprüft.
- `general.distribute` mit nicht negativen ganzzahligen `changes` bucht mindestens einen freien Punkt. Negative Zuweisungen, unbekannte Eigenschaften, fehlende Punkte und Überschreiten der Wirkungsschranken werden atomar abgewiesen.

Beide Mutationen erhöhen die Generalversion und speichern Skillzähler mit ihrem Deduplizierungsbeleg in derselben atomaren Spielerdatei vor `command.ok`. Gleiche ID/Inhalt wirkt nur einmal, widersprüchlicher Inhalt wird abgewiesen. Ein fehlgeschlagener Schreibvorgang verändert keine persistenten Skillzähler; ein erfolgreicher Schreibvorgang mit verlorener Antwort wird anhand des Belegs erkannt. Generalversionen ändern sich auch beim Start und bei Rückkehr eines Einsatzes. Es bleibt ein WebSocket pro Browsertab; Modalanfragen werden bei Sitzungs-/Verbindungsende verworfen und nicht blind wiederholt.

Schema 8 speichert `generalSkillRuleset`. Die idempotente Migration von Schema 7 normalisiert fehlende Skillfelder, bewahrt bestehende Zähler und prüft deren Konsistenz (`totalPoints = freePoints + Summe allocations`). Inkonsistente Altzähler stoppen die Migration, statt XP oder Punkte zu erfinden. Rollen, Grundwerte, Ressourcen, Versorgungstermine und Berichte bleiben erhalten. Farmmissionen ohne Versionskennung erhalten ausdrücklich die alte Version; keine neuen Boni werden hinzugefügt. Ein offenes `transaction.json` wird vor jeder Migration wiederhergestellt.

Neue Farmmissionen speichern `ruleset: "npc-pve-2-skills-provisional"` und `combatBonuses: { attackPercent, defensePercent }` beim Start. Die Ankunft liest nur diese Aufnahme. Berichte der neuen Version enthalten die angewandten Boni; alte Ergebnisse/Berichte erhalten keine neue Darstellung. Das Journal speichert Kampf, tatsächliche Verluste, Beute, Rückkehr und Belohnungen weiterhin zusammenhängend. Bürgermeisterverteilung nutzt `attributes.leadership + skills.allocations.leadership`, rechnet bis zum Buchungszeitpunkt mit dem alten Bonus und aktualisiert danach tatsächliche Versorgung und Ausbildungsstatus, ohne die Schonfrist zu verschenken.

Vorläufige Werte: `10 × n` XP pro erworbenem Punkt, manuelle Umrechnung, eins zu eins Zuweisung, zwei Prozent militärische Wirkung je verteiltem Punkt, maximal 25 Angriff-/Verteidigungspunkte bzw. 50 Prozent Wirkung; Bürgermeister maximal effektive Führung 50. Kampfverluste/Rundung und Beispiele stehen in README. Diese Werte bleiben zur Prüfung vorgeschlagen. Universität und erste Stadtforschung sind seit Auftrag 11 aktiv; Forschungsgeneral und Rekrutierung weiterer Generäle bleiben offen.


## ENV-Regelhistorie und Spielerschema 9

`world.json.supplyRuleHistory` enthält unveränderliche `{ effectiveAt, rules }`-Einträge. Bei Altwelten werden zuerst die bekannten früheren Konstanten ab `supplyActivatedAt` festgehalten, nicht aktuelle ENV-Werte. Beim Start: Journal wiederherstellen → alte Intervalle und geordnete Ereignisse abrechnen → geänderte Regeln ab einem einmal festgehaltenen Übergangszeitpunkt mit allen aktualisierten Spielern im Journal speichern. Bei unveränderten Werten entsteht kein neuer Eintrag. Spielerstände aus älteren Journalbildern werden anhand der Historie über jeden Wechsel fortgeschrieben.

`supply.rules` sind die aktuell wirksamen Raten; `cycleRules` halten die Frist-/Verlust-/Erholungsregeln des begonnenen Mangelzyklus bis stabiler Erholung fest. `lossThresholdMs` ist die nächste akkumulierte Mangelschwelle. Null-Unterhalt lässt Einheiten in Bestands-/Missionsübersichten bestehen und verursacht keinen Hunger; Verlustgruppen umfassen nur aktuell versorgungspflichtige Einheiten. Der Client erhält ausschließlich diese freigegebenen Spielregeln, niemals allgemeine ENV-Daten. Konfiguration wird pro Weltinstanz gehalten.

Migration 8 → 9 ergänzt `city.research: { ruleset, levels: { forestry, masonry, agriculture, logistics }, active }` mit fehlenden Stufen 0 und ohne Auftrag. Vorhandene Forschung wird erhalten und auf konsistente Stufen geprüft; fremde/inkonsistente Schemas werden nicht überschrieben. Karten und NPC-IDs bleiben unverändert.

`research.preview` verlangt eigene `universityId` (dauerhafte Gebäude-ID), `technology`, erwartete `targetLevel` und `rulesetVersion: "research-1-provisional"`. Die Antwort enthält verbindliche Kosten, Dauer, aktuelle/nächste Wirkung und `expectedUniversityLevel`. Die Vorschau bucht nichts. `research.start` verlangt zusätzlich diese Universitätsstufe; Preise, Dauer und Faktoren bestimmt ausschließlich der Server. Kosten und Auftrag sowie Deduplizierungsbeleg landen gemeinsam in der privaten Spielerdatei vor `command.ok`. Parallele Starts werden je Welt serialisiert; gleiche requestId/Inhalt wirkt einmal, anderer Inhalt wird abgelehnt. Konflikt liefert Fehler und aktuellen privaten Snapshot zur neuen bewussten Prüfung.

Ein Forschungsauftrag speichert stabile ID, Technologie/Zielstufe, Universitäts-ID/-Stufe, bezahlte Kosten, Regelversion, festgeschriebene Dauer sowie Start-/Endzeit. Auftragsende setzt die Stufe genau einmal und entfernt den aktiven Auftrag; Forschungspunkte werden aus abgeschlossenen Stufen abgeleitet, ohne zusätzliche Ereignisgutschrift. `city.snapshot`/`city.updated` enthalten private Forschung, Angebote, Technologien, Regelsatz, Produktionsanteile und Lagerfaktor. Der bestehende zentrale Socket verarbeitet Vorschau/Bestätigung; kein HTTP-Spielpolling oder eigener Forschungstimer.

Die gemeinsame Simulation rechnet Wirtschaft bis zur nächsten Bau-/Forschungs-/Ausbildungs-/Missions-/Versorgungsgrenze ab. Bei gleichem Zeitpunkt: Bauabschluss, Forschungsabschluss, zulässige Ausbildung, bestehende geordnete Missionen (Ankunft/Rückkehr), zuletzt weiterhin fälliger Hunger. Dadurch nutzt Rückkehr die rechtzeitig erhöhte Kapazität und rechtzeitige neue Produktion/Beute kann eine Hungerwelle verhindern. Ausbildung pausiert bei Mangel, Forschung nicht. Snapshot-Projektion und Befehle besitzen keinen zweiten Abschlussweg. Ein fehlgeschlagener Journalcommit wird vor weiterer Zeitabrechnung auch im gleichen Prozess wiederhergestellt.

Universität ist zivil, mit normaler Investitionshistorie und Gebäudepunkten. Aktive Forschung sperrt Abrissvorschau und Abriss des gebundenen Gebäudes. Ausbau ist erlaubt, beeinflusst den laufenden Auftrag nicht. Abgeschlossene Stufen bleiben bei Abriss erhalten. Öffentliche Kartendetails enthalten weiterhin keine Forschungs-, Ressourcen- oder Garnisonsdaten.

## Offiziersbewerber und Forschungsleitung (Auftrag 12)

Private Snapshots enthalten `officerRules`, `recruitment` (Kosten, nächste Kosten, Sperrgrund), `researcher` und in `military` den `candidatePool`, `acquiredCount`, `rosterVersion`, `roleVersion` und `researcherGeneralId`. Öffentliche Kartendaten enthalten diese Informationen nicht. `city.sync` aktualisiert den Pool, ohne freien Neuwurf. Namen werden als Text gerendert.

- `general.recruit.preview`: `{candidateId}` → Antwort desselben Typs mit `poolId`, `poolVersion`, `candidateId`, `expiresAt`, `acquiredCount`, `rosterVersion`, `rulesetVersion`, `cost`, `nextCost`.
- `general.recruit`: dieselben Bindungsfelder und optional `name`. Preise/Grundwerte werden ausschließlich aus gespeichertem Pool und wirksamen Regeln berechnet. Kaufantwort `command.ok` enthält `generalId`; UI wählt den neuen General. Genau eine Verpflichtung pro Pool, ab exakt `expiresAt` ungültig.
- `general.researcher`: `{generalId: ID oder null, expectedRoleVersion}`. Freier eigener General und fertige Universität nötig. Während Forschung gesperrt. Alte und neue Rolle gemeinsam speichern.
- `general.mayor`: zusätzlich `expectedRoleVersion`. Rolle und Status bleiben exklusiv; abweichende Version verlangt erneute Prüfung.
- `research.preview`: bisherige Felder, zusätzlich Antwort `researcher` (General-ID/-Version, damaliger Name, effektive Führung, Bonus, Rollen-/Betreiberregelversion), `universityFactor`, `durationWithoutGeneralMs`.
- `research.start`: bisherigen Bindungsfeldern das unveränderte `researcher`-Objekt aus der Vorschau hinzufügen. Der Server vergleicht erneut. Auftrag speichert diese Werte; laufende Jobs werden durch Skill-/Namens-/Regeländerung nicht verändert.

Bestehende requestId/Payload-Deduplizierung bleibt aktiv, auch nach Poolablauf. Gleiches Ergebnis wird aus gespeichertem Beleg zurückgegeben; anderer Inhalt zur selben ID wird abgelehnt. Erfolgsantwort erst nach atomarer Spielerdatei inklusive Zahlung, Poolverbrauch, General, Erwerbszähler und Beleg. Weltzeit/Pools verwenden das vorhandene Journal, keine Browserautorität. Wirtschafts-/Forschungsabschlüsse bis Serverzeit werden vor Rollenbefehlen verarbeitet; Forschungsabschluss belässt das Amt. Neue Farmzüge nutzen `npc-pve-3-general-bases-provisional`, alte Missionen 1/2 ausschließlich ihre gespeicherten Regeln.

Generäle und Bewerber besitzen seit Schema 11 eine private `portraitId` aus dem festen lokalen Katalog mit 20 Einträgen. Diese Kennung wird ausschließlich serverseitig zugeteilt und gespeichert, beim Kauf vom Bewerber übernommen und bei Umbenennen/Skills/Neustart beibehalten. Clientwerte für Porträtwahl werden nicht als Zuweisung verwendet. Keine neuen Befehle oder öffentlichen Kartendaten nötig.

## Postbox

`city.snapshot`/`city.updated` enthalten die eigene `mailbox`: `messages`, `readReportIds`, `unreadCount`. Berichte bleiben unverändert in `military.reports`; `readReportIds` speichert ihren persönlichen Lesestatus. Nachrichten enthalten serverseitige IDs, Absender-/Empfänger-ID und damalige Kommandantennamen, Betreff, Text, `sentAt` und empfangsseitiges `readAt`. Öffentliche Kartenantworten enthalten keine Postboxdaten.

- `mail.send`: `{recipient: Kommandantenname, subject, body}` → `command.ok` mit `messageId`, `duplicate`. Empfänger ist ein anderer existierender Spieler derselben Welt. NFKC/kleingeschriebene Empfängersuche wie bei der Anmeldung. Betreff 1–100, Text 1–4000 Unicode-Codepunkte; Steuerzeichen außer Zeilenumbruch/Tab im Nachrichtentext abgewiesen. Maximal fünf neue Sendungen im gleitenden Minutenfenster. Absender, Zeiten und Nachricht-ID stammen ausschließlich vom Server.
- `mail.read`: `{kind: 'message' oder 'report', id}` → `command.ok`. Nur eigene Einträge, keine fremden IDs. Wiederholtes Lesen ist wirkungslos; das erste `readAt` bleibt erhalten.

Sendungen sind in der Weltwarteschlange serialisiert; Senderkopie und Empfängerkopie werden gemeinsam mit dem bestehenden Transaktionsjournal gespeichert. Bestätigung und private Broadcasts erst danach. Derselbe Sender/requestId/Inhalt liefert dauerhaft dieselbe Nachricht-ID, ohne zweite Zustellung oder erneute Rate-Limit-Buchung; anderer Inhalt wird abgewiesen. Die Nachrichtenkopie enthält dafür `commandId`/`fingerprint`, unabhängig von der begrenzten allgemeinen Befehlshistorie. Lesestatusänderungen werden in der eigenen Spielerdatei gespeichert und an alle eigenen Verbindungen gesendet. Kein Nachrichten-Polling oder zusätzlicher Socket. Große ausgehende private Snapshots nutzen gültige 64-Bit-WebSocket-Längen.

Migration 11 → 12 ergänzt leere Nachrichten und markiert ausschließlich bereits vorhandene Berichts-IDs als gelesen. Später abgeschlossene Einsätze liefern weiterhin neue ungelesene Berichte, auch bei Offline-Abrechnung. Keine rückwirkende Änderung der Berichtsinhalte.

## Forschungsfreischaltungen und typisierte Logistik (Auftrag 13)

Private Snapshots enthalten Ölressourcen/Kapazitäten, LKW-Bestand, zwei neue Technologien sowie bedingte Bauangebote (`reason`). `research-3-logistics-provisional` ergänzt `oilProcessing` (maximal 1, Universität 1, 300/300, 120 s) und `motorization` (maximal 1, Universität 2, Ölverarbeitung/Lagerlogistik 1, 500/500, 240 s). Kosten/Dauer der vier bisherigen Technologien bleiben unverändert. `research-1`-/`research-2`-Aufträge werden anhand gespeicherter Zeiten abgeschlossen, ohne Nachbelastung oder Generalbonusänderung. Freischaltungen geben jeweils zehn abgeleitete Forschungspunkte.

`training.enqueue` akzeptiert `{trainingSlotId, unit, amount}` und den bisherigen Alias `barracksSlotId`. `truck` darf nur in der eigenen fertigen `vehicleFactory` mit abgeschlossener Motorisierung hergestellt werden; Infanterie/Späher nur in Kasernen. Kosten, Gebäudestufe und Dauer werden beim Einreihen festgehalten. Derselbe Ausbildungs-/Hungermechanismus gilt für beide Gebäudetypen.

Neue Vorschauen:

- `raid.preview`: `{targetId, generalId, units: {infantry: positive Ganzzahl, truck: nicht negative Ganzzahl}, delayMinutes: optionale nicht negative Ganzzahl}`. Standard 0, serverseitiges konfiguriertes Limit; Summe aller Typen maximal 10000.
- `scouting.preview`: `{targetId, generalId, scouts}`. Positive Zusatzverzögerung wird abgewiesen; normale Ölzahlung bleibt erforderlich.

Antwort enthält Typmengen/verfügbare Bestände, Generalversion/Boni, Distanz, `travelMs`, `delayMinutes`, `delayMs`, `outboundTravelMs`, `previewAt`, voraussichtliche `arrivesAt`/`returnsAt`, `normalOneWayOil`, `baseOil`, `delayOil`, `outboundOil`, `returnOil`, `totalOil`, `fuelCalculation`, Regeln, Traglast sowie `upkeepBeforePerHour`/`upkeepAfterPerHour`. Kein Live-NPC-Vorrat oder garantierte Beute. Positive Raten stammen aus `logistics.oilMilliPerField`.

`raid.start`/`scouting.start` senden Eingaben und unverändertes `preview` zurück. Server prüft Regeln, Mengen, General, aktuelle Verfügbarkeit und Öl erneut. Sichtbare Mengen/Kosten/Dauer/Regeln binden die Bestätigung; normale Zeit zwischen Vorschau und Bestätigung verschiebt nur Abreise und absolute Termine. Gelieferte Zeitstempel werden nie übernommen. Veränderung verlangt erneute Vorschau. Fehlendes Öl reserviert weder General noch Truppen.

Neue Zahlung: bei E als ungerundetem Normalöl einer Richtung, T als Grundreise und D als Zusatzzeit gilt `ceil(E × (2T+D)/T)`. Hinweg E × (T+D)/T, Rückweg E. Millisekunden und feste Tausendstel mit BigInt; rationale Grundlage als Dezimalstrings im Snapshot. Kein freier Minutenpreis. Aufklärung und reine Infanterie benötigen ebenfalls Öl.

Start speichert Mission, komplette vorausbezahlte Ölmenge, Truppenreservierung, Generalbindung, Weltsequenz und dauerhaften Wiederholungsbeleg zusammen im Journal vor Erfolg. Derselbe Request mit unverändertem Payload wirkt einmal, widersprüchlicher Payload scheitert, auch nach Ablauf der allgemeinen Befehlshistorie. Interne Fingerprints erscheinen nicht in Snapshots. Neustart verändert keine gespeicherten Preise/Termine/Traglast.

`military.reports` bleibt Quelle der vorhandenen Postbox. Neue gemischte Berichte enthalten Start-/Kampf-/Rückkehrmengen, Kampfverluste je Typ, Zeitplan, Ölgrundbedarf/-mehrkosten/-zahlung, Boni, Traglast, Einlagerung und Überlauf. Historische Reise-/Ladungsverluste werden ausdrücklich als solche angezeigt; Altberichte erhalten keine erfundene Ölzahlung. Nachrichten/Lesestatus bleiben unverändert.

Private Snapshots enthalten `logisticsRules` mit den erlaubten Spielregeln und Versorgungssummary: `unitCounts`/`units` beziehen sich auf versorgungspflichtige Gruppen; `totalUnits` und `deployedUnits` zeigen alle lebenden Bestände getrennt. Ab `upkeepScope: stationed` sind unterwegs befindliche Einheiten auch während Zusatzzeit und Rückreise frei von Stadtverbrauch/Hunger. Kein Proviantabzug und kein Verbrauch von Beuteladung. Bei Rückkehr sind Überlebende wieder stationiert; gleichzeitige Hungerwelle folgt erst nach Einlagerung. Solche Verluste stehen in Stadtversorgungsereignissen, nicht im Reisebericht.

Schema 14 führt alle bisherigen Migrationen über Schema 13 weiter. Fehlende Zusatzzeit wird 0, vorhandene Termine/Zahlungen bleiben verbindlich. Historische Versorgungsregeln ohne Scope bedeuten `all-living`; die gespeicherte weltweite Umstellung trennt alte Abrechnung von zukünftigem stationärem Unterhalt. Neue Ölformel und Scope ändern keine vergangenen Berichte. Die Abschnitte zu Schema 7–12 oben dokumentieren frühere Protokollstände; aktueller Unterhalt folgt diesem Abschnitt.

## Ressourcenladung und Betriebsöl (Auftrag 14, Schema 15)

`raid.preview`/`raid.start` akzeptieren zusätzlich `cargo: {wood, stone, food, oil}` mit nicht negativen sicheren Ganzzahlen; ausgelassene Schlüssel sind 0. Unbekannte Schlüssel, Nullwerte, Strings, Bruchteile oder unsichere Summen werden abgewiesen. `scouting.preview`/`scouting.start` erlauben ausschließlich leere/Null-Ladung; die separate Tankkapazität verleiht keine Güter-/Beutetraglast.

Zusätzliche Vorschaufelder: `ownCargo`, `ownCargoAmount`, `startOccupancy`, `freeStartCapacity`, `tankCapacity`, `outboundConsumption` (F−E einschließlich Rundungsrest), `returnReserve` (E), `projectedLootCapacity` (ohne Kampfverluste). Bisherige `outboundOil`/`delayOil` sind rechnerische Bedarfswerte vor Zahlungsrundung. Regeln enthalten `scoutFuelCapacity` und `cargoRules` mit Version und zentralen Einheitsgewichten. Keine Live-NPC-Daten. Alle Ladungsmengen und Kapazitätswerte binden die bestehende Vorschau; Abweichungen verlangen erneute Prüfung. Absolute Termine verschieben sich weiterhin ausschließlich mit dem echten Startzeitpunkt.

Neue Missionen: `npc-pve-5-cargo-provisional`/`npc-scout-3-cargo-provisional`, Logistikkennung `fuel-3-cargo-…`, `cargo.version: cargo-1-provisional`. Startjournal enthält sämtliche Stadtressourcenabzüge, Truppen-/Generalbindung, Sequenz, Mission und dauerhaften Request-Fingerprint. Eigene Ölladung + F wird genau einmal abgebucht; keine spätere Ölzahlung/Erstattung. Alte Missionsversionen 1–4 behalten bisherige Semantik.

`mission.cargo` enthält `initial`, `retained`, `lost` sowie exakte `returnFuelMilli`/`lostFuelMilli` als Dezimalstrings. Nach Kampf enthält das Ergebnis `goodsCapacity`, `lootCapacity` und bisherige NPC-Nahrungsbeute `loadedFood`. Nach Rückkehr ergänzt `cargo.delivery` die vier Ressourcenvektoren `storedOwn`, `overflowOwn`, `storedLoot`, `overflowLoot`. Beutefelder `storedFood`/`overflowFood` bleiben ausschließlich Beute. Eigene Rückfracht gewährt keine Kampfbelohnungen.

Private Einsatz-Snapshots und Rückkehrberichte enthalten `operatingFuel: {loaded, burned, lost, remaining, exact}`. `exact` speichert Zähler für verbranntes/verlorenes/restliches Öl und einen gemeinsamen Nenner als Dezimalstrings; Anzeigezahlen sind keine Buchungsgrundlage. Restöl wird aus gespeicherten Reisezeiten abgeleitet, nie durch gerundete Ticks akkumuliert. Nach normaler Rückkehr gilt restlich 0 und loaded = burned + lost. Weltkartenereignisse enthalten keinerlei fremde Ladung.

Schema 14 → 15 ändert ausschließlich die Schemakennung; keine Nachrüstung alter Einsätze mit Fracht/Tanks, keine Neuberechnung historischer Ölpreise. Ältere Ketten und Journalwiederherstellung bleiben erhalten. Neue inkonsistente Fracht-/Ölbilanzen und unbekannte Versionen werden konkret abgewiesen. Nachrichten, Lesestatus, Generäle, Forschung und Versorgungshistorie bleiben erhalten.

## Auftrag 15: Stadtidentitäten und freie Felder

Transportversion bleibt 1. `city.snapshot` / `city.updated` enthalten `cityId`, `serverTime`, private `cities` (ID, Name, Koordinaten, lokale Bestände/Bauqueues) und eigene `claims`. `city` und lokale Militär-/Versorgungsfelder sind Ansichtsadapter der ausgewählten Stadt. Generäle, Berichte und Postbox bleiben global; angezeigte Missionen/Truppen gehören zur gewählten Ausgangsstadt. `city.research` zeigt die globale Forschungsqueue einschließlich ausführender `cityId`. Gebäude-, Forschungs- und Kampfwertung werden ohne Vervielfachung summiert.

`city.sync {cityId}` wählt ausschließlich die Ansicht dieser Verbindung. Jeder Bau-, Abriss-, Ausbildungs-, Bürgermeister-, Forschungs-/Forschungsleitungs-, Rekrutierungs- und Einsatzbefehl sowie jede entsprechende Vorschau benötigt eine eigene `cityId`; unbekannte, fremde oder fehlende IDs werden abgewiesen. Weltkarte: `map.viewport` / `map.details` benötigen ebenfalls `cityId`; Entfernungen beziehen sich darauf. Stadtwechsel verändert weder Ressourcen noch Truppenstandorte. Der Client speichert die Auswahl in `sessionStorage`, filtert verspätete Antworten anderer Städte und verwirft offene Vorschauen beim Wechsel. `construction.completed` nennt `cityId`; Kartenänderungen bei Anspruch/Sieg/Ablauf/Gründung senden öffentliche `map.changed`-Revisionen ohne Verteidigung oder Privatbestände.

Neue Ereignisse:

| Ereignis | Payload / Ergebnis |
| --- | --- |
| `field.scout.preview` | `cityId, x, y, generalId, scouts`; verbindliche Öl-/Tank-/Zeitvorschau |
| `field.scout.start` | dieselben Werte und vollständige `preview`; Bericht erst bei Rückkehr, keine XP |
| `field.conquest.preview` | `cityId, x, y, generalId, units:{infantry,truck}, reportId, delayMinutes?, cargo?`; eigener abgeschlossener aktueller Bericht erforderlich |
| `field.conquest.start` | dieselben Werte und vollständige `preview`; persönlicher Platz reserviert, kein exklusiver Feldanspruch vor Sieg |
| `city.found.preview` | `cityId, claimId`; Kosten mit `originCityId, fieldRevision, cityCount, expiresAt, rulesetVersion` |
| `city.found` | `cityId, claimId, name, preview`; Zahlung aus gespeicherter Ausgangsstadt, `command.ok` enthält neue `cityId` |

Feldmissionen haben `originCityId`, Koordinaten und eigene Regelversionen `field-scout-1-provisional` / `field-conquest-1-provisional`. Aufklärungsbericht `type:field-scout` enthält private `intelligence:{capturedAt,fieldRevision,defenders,coordinates}`. `type:conquest` berichtet Kampf, Anspruch oder Abbruch bei inzwischen besetztem Feld und getrennte Fracht-/Ölbilanzen; keine Beute. Alle IDs/Bestände, Rollen und Bindungen prüft der Server. Wiederholte Start-/Gründungsbefehle bleiben dedupliziert; geänderte Inhalte zur gleichen ID werden abgewiesen. Öffentliche Reservierungen werden als `type:claim` dargestellt und sind weder NPCs noch angreifbare Städte.

### Feldplanung im Modal (12.10.2026)

`field.conquest.preview` enthält zusätzlich `combatForecast` aus dem vorhandenen Kampfalgorithmus: `victory`, `survivors`, `attackerLosses`, `defenderLosses`, `combatBonuses`, `defenders`, `observedAt`, `reportId`. Grundlage ist ausschließlich der eigene aktuelle Rückkehrbericht; keine zusätzliche kostenlose Aufklärung. Die gesamte Vorschau bindet den Start weiterhin. Scoutvorschauen enthalten keine Verteidigung oder Kampfprognose.

Private Stadtsnapshots ergänzen `fieldMissions` mit aktiven Feldmissionen aller eigenen Ausgangsstädte (ID, Typ, Status, Ausgangsstadt, Koordinaten, Ankunft/Rückkehr; für bereits abgewickelte Kämpfe kompakter Ausgang). Feldscout-Berichte haben ein abgeleitetes `fieldCurrent` für ihre Revisionsgültigkeit. Genaue `intelligence` wird in laufenden Missionen nicht vor Rückkehr übertragen. Öffentliche Kartenverträge bleiben unverändert.

## Stadtlogistik (Auftrag 16, Schema 17)

Vier zusätzliche Ereignisse: `delivery.preview`, `delivery.start`, `transfer.preview`, `transfer.start`. Vorschauantwort hat denselben Typ; Start antwortet `command.ok` mit `missionId` und `duplicate`. Fehler: `command.error`. Alles über den bestehenden authentifizierten Socket und die Weltqueue, kein HTTP-Spielendpunkt/Polling.

Gemeinsam: `cityId` muss `originCityId` entsprechen; `targetCityId` benennt eine andere stabile Spielerstadt-ID. Optionales `instanceId` muss die aktuelle Welt sein. `units` enthält nicht negative Ganzzahlen für `infantry/scout/truck`; Maximum insgesamt wie bestehende Einsätze. `delayMinutes` fehlt oder ist exakt 0 (auch null wird abgewiesen). Start ergänzt die unveränderte Server-`preview`. Vorschau bindet Zielbesitz, Regeln, Einheiten, Generalversionen, Ladung, Kapazität und Öl; absolute Abfahrtszeiten und rein informative eigene Zielversorgung werden beim Start aktualisiert.

Lieferung: ausschließlich `units.truck >= 1`, positive `cargo` aus wood/stone/food/oil; `generalId:null` bzw. fehlend ist der normale generalfreie Fall. Optionaler Begleiter muss frei in der Ausgangsstadt sein. Transfer: eigene Zielstadt, beliebige zulässige Einheiten und/oder `generalIds:[]` (Mehrfachwahl); keine positive cargo. Bürgermeister/Forschungsleiter vor der Reise freigeben. Jeder General erhält in Schema 17 `cityId`; unterwegs zusätzlich `transitMissionId` und Status `transit` oder `delivering`. Historische scout/raid/conquest-Statuswerte bleiben erhalten.

`city.snapshot`/`city.updated` ergänzen:
- `logisticsTargets`: öffentliche Spielerstädte (id/name/commanderName/x/y/own), keine Bestände/Lager oder Skills fremder Spieler.
- `transports`: eigene Lieferung/Verlegung, regelversionierte Mengen, Quell-/Ziel-IDs, Status, gespeicherte Termine, Ladungsmarker und abgeleitetes Betriebsöl. Nur Eigentümer erhält diese Details.
- `incomingTransports`: für Empfänger angekündigte Fremdlieferungen mit Absender, Quell-/Zielname, Ziel-ID, Ladung und Ankunft; keine General-/Armeedetails, Quelllager oder Regeln.
- `migrationNotices`: kontrollierte Freigabe nicht eindeutig zuordenbarer unbeschäftigter Forschungsleitung.
- `cities[].inShortage`: eigene Warnungsübersicht im Stadtkopf.

Lieferzustände: outbound → returning → completed. Verlegezustände: outbound → completed mit `stationedAt` und `returnsAt:null`. Ankunft des Empfängers wird genau bis zum Ereigniszeitpunkt fortgeschrieben; dieselbe Zeitgruppe stellt Güter/Truppen vor der Hungerprüfung zu. Bei fehlendem Verlegeziel stoppt Abrechnung kontrolliert zur Wiederherstellung. Ungültiges Lieferziel lässt die gesamte Ladung zurückfahren. Technische Schreibfehler werden durch das Journal wiederhergestellt.

Berichte `delivery`/`transfer` in der bestehenden Postbox: Senderladung = zugestellt + unterwegs + zuhause eingelagert + Heimatüberlauf; Betriebsöl separat und nach Abschluss 0 verbleibend. Verlegebericht nennt Stationierungszeit statt Rückkehr. Eigene Lieferung erzeugt einen Bericht; fremde Lieferung je einen Sender-/Empfängerbericht, Empfänger nur erhaltene Güter und Absender. Empfängerbericht-IDs enthalten Senderidentität, damit gleiche requestIds verschiedener Absender nicht kollidieren. Keine XP/Punkte.

Startbelege bleiben an der Mission persistiert; gleiche requestId und gleicher kanonischer JSON-Inhalt deduplizieren, abweichender Inhalt wird abgelehnt. Vorschauantworten nach Stadtwechsel werden verworfen; Stadtwahl wird pro Tab gespeichert. Fremdlieferung kündigt nach Start dem Empfänger ein privates city.updated an. Nach Reconnect werden laufende Reisen aus gespeicherten Zuständen projiziert.

## Forschungsbaum und gespeicherte Technikboni (Auftrag 17)

Transportversion bleibt 1, Spieler-/Weltschema bleiben 17/4. `research-4-engineering-provisional` ergänzt `constructionEngineering`, `trainingTechniques`, `loadingTechniques`; alte IDs und Forschungsaufträge der Versionen 1–3 bleiben erhalten. Eigentümer-Snapshots ergänzen `researchEffects` (versionierte normalisierte BPS-Regeln). `researchOffers` enthält Kategorie, Maximalstufe, `prerequisites`, `requiredUniversity`, Wirkung und strukturierte `reasons: [{code,message,...}]`. Codes: `maximum`, `active`, `university`, `prerequisite`, `resources`, `researcher`. Mehrere Gründe können gleichzeitig vorliegen.

`research.preview` enthält zusätzlich `effectRules`; der neue Client sendet sie mit `research.start` zurück. Für die drei neuen Technologien sind sie verpflichtend. Der Server prüft weiterhin nächste Stufe, zahlende Stadt, Universität, Leitung und gemeinsame Queue. Geänderte Regeln/Leitung oder Universität verlangen eine erneute Prüfung vor Zahlung.

Bauangebote enthalten `researchEffect: {rulesetVersion,technology,level,bonusBps,durationWithoutResearchMs}` sowie effektive `durationMs`. `construction.enqueue` sendet diesen unveränderten Effektbeleg zurück. Der Server berechnet alles erneut. Historische Clients ohne Beleg sind ausschließlich bei Stufe 0 und unveränderten Standardboni kompatibel; andernfalls wird eine aktuelle Vorschau verlangt.

Neues Ereignis `training.preview {cityId,trainingSlotId|barracksSlotId,unit,amount}` → `training.preview {cost,durationMs,researchEffect}`. Nutzt denselben Kernpfad wie die Annahme, ohne Zahlung oder Einreihung. `training.enqueue` sendet den Beleg zurück. Client-Eingaben zu Kosten oder Laufzeit werden nicht übernommen. Geänderte Forschungsstufe, Regeln, Menge oder Gebäudestufe können den Beleg ungültig machen. Der Client verwirft ihn bei Eingabeänderung, Stadtwechsel oder Serverablehnung und lässt erneut prüfen.

Neue Bau-/Ausbildungsqueueeinträge speichern `durationMs` und `researchEffect`. Alte Einträge ohne diese Felder behalten ihre bestehenden Zahlungen und Termine. Hungerpausen verschieben weiterhin Termine um pausierte Zeit, ohne die gespeicherte Arbeitsdauer neu zu berechnen.

Alle neuen Reisevorschauen enthalten in `logistics.loadingResearch` die Regelversion, Stufe, Bonus-BPS und `baseCargoPerUnit`; `logistics.cargoPerUnit` enthält effektive Typkapazitäten. Derselbe vollständige Beleg bindet den Start und wird an der Mission gespeichert. Ladetechnik wird einmal im Vorschau-/Startpfad angewandt. Verlust-/Rückkehrpfade verwenden ausschließlich gespeicherte Kapazitäten. Spähertanks und General-Diensttransporttanks bleiben gesondert. Empfängersnapshots fremder Lieferungen erhalten keinen Forschungsstand des Absenders.

Bau-/Ausbildungs-/Forschungsbefehle erhalten für neue Annahmen dauerhafte Wiederholungsbelege in der vorhandenen `processedCommands`-Sammlung. Sie werden von der bisherigen TTL-/Anzahlbereinigung ausgenommen. Ein gleicher Request mit gleichem Inhalt bleibt auch nach Abschluss oder Neustart einmalig; abweichender Inhalt scheitert. Bereits historisch entfernte Belege können nicht nachträglich wiederhergestellt werden. Zahlung, Queue und Beleg werden weiterhin zusammen atomar gespeichert. Bau-/Ausbildungsfehler liefern zusätzlich den autoritativen Stadtsnapshot; vor erneuter Zahlung wird die aktualisierte Prüfung sichtbar.

Die Welt speichert `researchRuleHistory: [{effectiveAt,rules}]` beim Start und bei Regeländerung. Die aktuellen Regeln werden ausschließlich serverseitig normalisiert und dem unabhängigen Kern übergeben. Bereits akzeptierte Aufträge verwenden ihre gespeicherten Werte; eine historische Reise erhält keine heutige Ladetechnik nachgerüstet.


## Weltkartenbedienung: isometrische Kamera und Windrose

Kein neuer Transport oder Serverbefehl. Die Kameraposition ist ausschließlich clientseitig und unabhängig vom `viewport` einer empfangenen Antwort. Projektion und inverse Feldwahl verwenden dieselben Formeln. Kurzer Windrosenklick bewegt 64 Bildpixel, Halten nach 220 ms fährt mit 170 Bildpixeln/Sekunde weiter. Zeitintegration verwendet verstrichene Zeit, keine Frame-/Tastenwiederholungszählung. Die konstante Projektion und der Bildmaßstab ändern sich dabei nicht.

Der Client lädt nur benötigte öffentliche 12×12-Blöcke (am Weltende kleiner) über `map.viewport`, jeweils höchstens eine Anfrage gleichzeitig und mit mindestens 110 ms Abstand. Die bestehende serverseitige Mindestfrist von 75 ms bleibt unverändert. Fehlende Daten erscheinen als nicht auswählbare Ladeflächen; vorhandene Blöcke benötigen keine erneute Anfrage. Ausstehende Anfragen haben einen Retry-Zeitraum von 1800 ms. Beim Ansichts-/Stadtwechsel wird der lokale Nachladetimer beendet.

`map.snapshot` ergänzt den Cache, statt die Kamera auf die angefragte Position zu setzen. Kleinere Revisionen derselben Welt werden verworfen. Eine höhere Kartenrevision verwirft alte Cacheinhalte, bevor neue Ausschnitte übernommen werden. Eine außerhalb des beantworteten Ausschnitts liegende Auswahl bleibt erhalten. Bei gleicher Stadt-ID bleiben bereits geladene Detailinformationen bestehen; ein weiterhin leeres Feld erhält kein künstliches Stadtobjekt. Die privaten Aufklärungsregeln werden nicht erweitert.

Mausziehen, Wischen, Mausrad und lose Pfeiltasten verändern die Kamera nicht. Die Windrose selbst fängt Zeiger- und Tastaturbedienung ab; Pointer-Capture und globale Release-/Cancel-/Blur-/Visibility-Beendigung verhindern hängende Bewegung. Navigation löst keine Feldwahl oder Spielaktion aus. Feld-/Objektklick beziehungsweise fokussierter Button/Enter verwenden weiterhin `map.details` und die vorhandenen Einsatz-/Feldaktionen. Die gewählte eigene Stadt stammt weiterhin aus dem autoritativen Stadt-/Kartenzustand.
