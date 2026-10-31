# Codex-Auftrag 19: Bündnisse innerhalb einer Welt

## 0. Ziel und geprüfter Ausgangspunkt

Baue eine erste vollständige Bündnisfunktion für Spieler derselben Serverwelt. Spielbarer Ablauf:

Bündnis aus einer eigenen Stadt gründen → anderen Kommandanten einladen → Einladung ausdrücklich annehmen → miteinander im internen Bündnischat sprechen → Mitgliedsstadt auswählen → über die bestehende Logistik Ressourcen liefern.

Dazu gehören eine klare Rollenverwaltung, Beitritt/Austritt, Führungsübergabe, öffentliche Erkennbarkeit und sichere dauerhafte Speicherung.

Ausgangspunkt der Planung ist main cf360426ebf9b38060dcab74faac0b5b2c12e287. Zwischenauftrag 18a wurde dort mit PR #25 integriert; README und UX_REFACTOR_18A_VALIDATION.md dokumentieren die neue Bedienung. Aktuell Spielerschema 18, Weltschema 4. Der Planungschat hat Dateien gelesen, keine Tests erneut ausgeführt.

Lies AGENTS.md, README.md, docs/PROJECT.md, docs/WEBSOCKET.md, docs/FEDERATION.md und docs/UX_REFACTOR_18A_VALIDATION.md. Prüfe den tatsächlichen Arbeitsstand und erhalte zwischenzeitliche Änderungen. Der bisherige Auftrag 18a bleibt im [Git-Verlauf](https://github.com/bavxhack/War2glory/blob/cf360426ebf9b38060dcab74faac0b5b2c12e287/CODEX_PROMPT.md) erhalten.

Alle neuen Zahlen und Regeln unten sind eigene vorläufige Projektentscheidungen, keine belegten War2Glory-Originalwerte.

## 1. Umfang und Grenzen

Jetzt umsetzen:
- Bündnis gründen mit Namen, Kürzel und Beschreibung.
- Verzeichnis und öffentliche Bündnisprofile.
- Einladungen, ausdrückliche Annahme/Ablehnung und Widerruf.
- Genau eine Bündnismitgliedschaft je Kommandant.
- Anführer, Offizier und Mitglied mit geprüften Rechten.
- Führungsübergabe, Austritt, Ausschluss und Auflösung.
- Interner persistenter Chat und eine angeheftete interne Mitteilung.
- Begrenztes internes Verwaltungsprotokoll.
- Bündniskürzel an Städten und Mitgliedern.
- Direkter Einstieg in bestehende Ressourcenlieferungen und private Nachrichten.
- WebSocket-Updates, JSON-Persistenz, Migration und Tests.

Für spätere Aufträge vormerken:
- Fremde stationierte Unterstützungstruppen, Rückruf und deren Versorgung.
- Gemeinsame Angriffe, PvP, Diplomatie/Kriegserklärungen.
- Bündniskasse, automatische Abgaben, Markt/Tauschhandel.
- Bündnisforschung, gemeinsame Lager, Produktions-/Kampfboni.
- Automatisch geteilte Aufklärung oder Einblick in private Stadtzustände.
- Serverübergreifende Bündnisse und Matrix-Anbindung.

Bündniszugehörigkeit verändert in diesem Auftrag keine Spielpreise, vorhandenen Punkte, Kampfregeln, Eigentumsrechte oder Truppenbewegungen. Ein bestehender Transport wird durch Beitritt, Austritt oder Auflösung nicht abgebrochen oder umgebucht.

## 2. Zentrale Regeln und Konfiguration

Erstelle ein unabhängiges game-core-Modul für Bündnisregeln, Rechte und Zustandsübergänge. Keine WebSocket-/Dateizugriffe im Kern.

Eigene vorläufige Standards:

| Einstellung | Standard | Zulässiger Bereich |
| --- | --- | --- |
| ALLIANCE_CREATE_WOOD | 1000 Holz | ganze Zahl 0–1000000 |
| ALLIANCE_CREATE_STONE | 1000 Stein | ganze Zahl 0–1000000 |
| ALLIANCE_MAX_MEMBERS | 20 Kommandanten einschließlich Anführer | ganze Zahl 2–100 |
| ALLIANCE_INVITE_TTL_HOURS | 168 Stunden = 7 × 24 Stunden | ganze Zahl 1–8760 |

Nahrung und Öl kosten bei Gründung jeweils 0. Keine laufenden Bündniskosten. Kein neues Gebäude als Voraussetzung.

Konfiguration wie bisher zentral validieren; .env.example, Compose-Weitergabe und Entwicklungsdokumentation ergänzen. Ungültige Werte vor Spielstandänderungen ablehnen. Regeln bekommen eine nachvollziehbare Version.

Mitgliederlimit bei Gründung am Bündnis speichern. Spätere ENV-Änderungen gelten für neu gegründete Bündnisse; bestehende behalten ihr Limit. Neue Gründungspreise gelten für neue Angebote; Preis-/Regeländerung zwischen Vorschau und Start verlangt ein neues bestätigtes Angebot.

Einladung speichert expiresAt bei Ausstellung. Spätere TTL-Änderung verlängert/verkürzt keine bestehende Einladung.

Zusätzliche zentral definierte Schutzgrenzen, ebenfalls eigene Prototypwerte:
- höchstens eine erfolgreiche Bündnisgründung je Kommandant innerhalb von 24 Stunden, auch bei kostenlos konfigurierter Gründung;
- höchstens 20 offene Einladungen je Bündnis und 10 je Empfänger;
- höchstens 10 neue Einladungen pro ausstellendem Spieler in einer rollierenden Stunde;
- höchstens 5 neue Chatnachrichten pro Spieler in einer rollierenden Minute;
- Chat: letzte 200 Beiträge je aktivem Bündnis;
- Verwaltungsprotokoll: letzte 100 Ereignisse.

Deduplizierte Wiederholungen sind keine neuen Aktionen und verbrauchen kein zweites Kontingent. Wechsel von Tabs, Logout oder Serverneustart darf die geltenden Grenzen nicht einfach zurücksetzen. Kleine begrenzte Zeitstempellisten genügen; kein unbegrenztes Ereignisarchiv.

## 3. Identität, Gründung und öffentliche Daten

Bündnis-ID serverseitig unveränderlich erzeugen; lokal eindeutige UUID und instanceId der Welt verwenden. Namen und Kürzel sind Anzeige-/Suchwerte, keine Autorität und keine Dateipfade.

Gründungsformular:
- Name: nach Trim/NFKC 3–40 Unicode-Codepunkte.
- Kürzel: 2–5 ASCII-Buchstaben/Ziffern, serverseitig in Großbuchstaben normalisieren.
- Öffentliche Beschreibung: optional, höchstens 500 Unicode-Codepunkte.
- Eigene zahlende Stadt ausdrücklich sichtbar auswählen.
- Ressourcenpreis und Mitgliederlimit vor Start anzeigen.

Namen und Kürzel müssen jeweils unter aktiven Bündnissen der Welt normalisiert eindeutig sein. Namensvergleich nach NFKC, Trim und vereinheitlichter Groß-/Kleinschreibung; konkrete Normalisierung dokumentieren und testen. Texte ohne Steuerzeichen, als Text rendern, kein HTML.

Name und Kürzel sind in Version 1 nach der Gründung unveränderlich. Beschreibung kann mit entsprechenden Rechten geändert werden. Aufgelöste Bündnisse geben Name/Kürzel wieder frei; IDs werden niemals wiederverwendet. Alte Einladungen/Links dürfen nicht auf ein neues gleichnamiges Bündnis umgebogen werden.

Gründung nur, wenn der angemeldete Kommandant noch keinem Bündnis angehört und die gewählte Stadt ihm gehört. Mitgliedschaft gilt für den Kommandanten mit allen seinen Städten; fünf Städte belegen einen Mitgliederplatz.

Automatische serverseitige Gründungsvorschau gemäß 18a. Ein ausdrücklicher Gründungsbutton:
- Zeit und fällige Ereignisse wie bisher abrechnen;
- sämtliche Voraussetzungen und aktuelle Preisversion prüfen;
- Kosten einmalig aus der gewählten Stadt bezahlen;
- Bündnis anlegen, Gründer als einzigen Anführer eintragen;
- Gründungszeit/Cooldown und dauerhaften Befehlsbeleg sichern;
- zusammen atomar committen, erst danach bestätigen.

Keine Rückzahlung bei späterem Austritt oder Auflösung. Vorschau reserviert weder Namen noch Geld.

Öffentlich innerhalb der authentifizierten Welt sichtbar:
ID, Name, Kürzel, Beschreibung, Gründungsdatum, Mitgliederzahl/Limit, Mitglieder-Kommandantennamen und Rollen sowie bereits öffentliche Stadtpositionen. Keine neuen Rankings oder Bündnispunkte in diesem Auftrag.

Nicht öffentlich:
Chat, interne Mitteilung, Einladungen, Verwaltungsprotokoll, private Ressourcen, Garnisonen, Forschung, Generäle, Queues und Berichte.

## 4. Mitgliedschaft und Einladungen

Erste Version verwendet ausschließlich Einladungen, keine offenen Sofortbeitritte und kein zusätzliches Bewerbungssystem.

Anführer/Offizier lädt einen vorhandenen Kommandanten derselben Welt ein. Name wird nach bestehender Kontonormalisierung aufgelöst, danach bleibt die Empfänger-ID verbindlich. Nicht anhand frei gesendeter Besitzerfelder entscheiden.

Einladung enthält stabile ID, Bündnis-ID, Aussteller-ID, Empfänger-ID, createdAt, expiresAt, Status und gegebenenfalls Abschlusszeit.

Regeln:
- Eigene Mitglieder, sich selbst und bereits einem anderen Bündnis angehörende Kommandanten nicht neu einladen.
- Pro Bündnis/Empfänger höchstens eine offene Einladung; erneutes Senden erzeugt weder Doppelobjekt noch verlängert es die Frist.
- Ein Kommandant darf mehrere Einladungen verschiedener Bündnisse bis zum genannten Limit besitzen.
- Einladung reserviert keinen Mitgliederplatz.
- Nur der Empfänger darf annehmen oder ablehnen.
- Bei Annahme erneut Bündnisexistenz, offene/unabgelaufene Einladung, aktuelle Mitgliedschaft und Kapazität prüfen.
- Bei now >= expiresAt abgelaufen. Clientuhr ist nicht maßgeblich.
- Erfolgreiche Annahme macht andere offene Einladungen desselben Spielers ungültig.
- Bei inzwischen vollem Bündnis keine Teilaufnahme; Einladung darf bis Ablauf offen bleiben und später erneut angenommen werden.
- Widerruf durch aktuelle berechtigte Verwaltung.
- Einladung gilt im Namen des Bündnisses. Ein späterer Rollenwechsel des Ausstellers allein widerruft sie nicht; aktuelle Verwaltung kann sie widerrufen.
- Auflösung macht alle offenen Einladungen dieses Bündnisses ungültig.

Beitritt kostenlos, ohne automatische Ressourcen-/Truppenbewegung. Nach Austritt erneuter Beitritt nur über eine neue gültige Einladung. Neue Mitgliedschaft erhält eine neue membershipId; alte Rollenbefehle dürfen nach Aus-/Wiedereintritt nicht wieder wirksam werden.

Offline-Empfänger sieht offene Einladungen nach Login/Resume. Eine persistente Einladungsübersicht mit Badge genügt; keine automatischen privaten Nachrichten als notwendiger zweiter Zustellweg.

## 5. Rollen und Rechte

Pro aktivem Bündnis genau ein Anführer. Rollen:

| Aktion | Anführer | Offizier | Mitglied |
| --- | --- | --- | --- |
| Interne Inhalte lesen, Chat senden, selbst austreten | ja, Austrittsregel beachten | ja | ja |
| Einladen / offene Einladungen widerrufen | ja | ja | nein |
| Beschreibung / interne Mitteilung bearbeiten | ja | ja | nein |
| Normales Mitglied ausschließen | ja | ja | nein |
| Offizier ausschließen | ja | nein | nein |
| Befördern / degradieren | ja | nein | nein |
| Führung übertragen | ja | nein | nein |
| Eigenen Chatbeitrag entfernen | ja | ja | ja |
| Fremden Chatbeitrag moderieren | ja | ja | nein |
| Bündnis auflösen | nur als letztes Mitglied | nein | nein |

Offiziere dürfen weder Anführer noch andere Offiziere entfernen oder sich selbst befördern. Selbstentfernung erfolgt über Austritt, nicht über Ausschluss.

Führungsübergabe:
- Nur aktueller Anführer.
- Ziel muss aktuell Mitglied desselben Bündnisses sein.
- Ausdrückliche Bestätigung mit altem/neuem Namen.
- Ziel wird Anführer, bisheriger Anführer Offizier.
- Beide Änderungen atomar; niemals null oder zwei Anführer.
- Keine automatische Wahl und kein automatischer Machtwechsel wegen Offlinezeit.

Austritt:
- Normale Mitglieder/Offiziere können mit ausdrücklichem Klick austreten.
- Anführer mit weiteren Mitgliedern muss zuvor Führung übertragen.
- Einziger verbleibender Anführer kann das Bündnis nach Folgenbestätigung auflösen.
- Keine Auflösung mit weiteren Mitgliedern; diese Regel vereinfacht die erste Version und verhindert unbeabsichtigtes Entfernen aller.

Ausschluss/Austritt:
- Rechte und aktuelle Zielmitgliedschaft im Server erneut prüfen.
- Entfernt sofort zukünftigen Zugang zu internen Inhalten und Aktionen.
- Client bekommt eine minimale Mitgliedschaftsänderung und entfernt private Bündnisansichten/Entwürfe aus aktivem UI-Zustand.
- Bereits früher gelesene Inhalte können technisch nicht rückwirkend ungelesen gemacht werden; keine solche Zusage.
- Städte, Einheiten, Ressourcen, Generäle und bisherige eigene Spielberichte bleiben beim Spieler.
- Laufende gewöhnliche Ressourcenlieferungen bleiben nach bisherigen Regeln bestehen.

Rollen- und Mitgliederbefehle binden erwartete aktuelle Mitgliedschaft/Verwaltungsversion. Autorisierung bei jeder Mutation neu prüfen. Ein veralteter Tab hat keine alten Rechte. Chatnachrichten dürfen nicht jede unabhängige Verwaltungsaktion durch eine gemeinsame globale Konfliktversion ungültig machen; fachlich getrennte Versionen verwenden.

## 6. Interner Chat, Mitteilung und Protokoll

Chat ist ein einfacher, persistenter Textkanal je Bündnis:
- nur aktuelle Mitglieder können lesen und schreiben;
- Nachricht 1–2000 Unicode-Codepunkte nach Trim, kontrollierte Zeilenumbrüche erlaubt, keine unzulässigen Steuerzeichen;
- kein HTML, keine Datei-Uploads, kein Markdown mit ausführbaren Inhalten;
- serverseitige ID, Absender-ID/Name, Zeitpunkt und monoton steigende Sequenz je Bündnis;
- eindeutige Reihenfolge bei gleicher Uhrzeit;
- ältere Beiträge bis zur Retentionsgrenze paginiert abrufen;
- neue Mitglieder dürfen den aktuell gespeicherten Chatverlauf lesen; dies in der UI kurz erklären;
- keine Bearbeitung gesendeter Nachrichten in Version 1.

Moderation:
Eigene Beiträge entfernen; Anführer/Offiziere dürfen fremde Beiträge entfernen. Nur aktuelle Mitglieder mit dem entsprechenden Recht dürfen handeln. Entfernte Texte nicht weiter ausliefern; neutralen Platzhalter mit Sequenz und Moderationskennzeichnung behalten, solange im gespeicherten Fenster. Kein Lösch-Replay, das Text wieder erscheinen lässt.

Sequenzen niemals wegen Retention oder Löschung zurücksetzen. Maximal 200 Beitragsplätze einschließlich Platzhaltern. Vergangener Verlauf außerhalb dieses Fensters ist nicht mehr verfügbar; UI behauptet kein unbegrenztes Archiv.

Angeheftete interne Mitteilung:
ein separat gespeicherter Text bis 2000 Codepunkte, Autor und Änderungszeit. Anführer/Offiziere bearbeiten oder leeren sie. Änderungen mit erwarteter Mitteilungsversion; keine stille Überschreibung aus zweitem Tab.

Ungelesen:
Serverseitiger lastReadSequence je aktueller membershipId, monoton und höchstens bis zu einer für das Mitglied gelieferten/gültigen Sequenz. Neue Mitgliedschaft startet beim aktuellen Chatende; bestehende Historie ist lesbar, aber erzeugt keinen künstlichen Berg alter ungelesener Meldungen. Nur tatsächlich sichtbare Beiträge als gelesen markieren. Andere Tabs desselben Spielers aktualisieren. Nach Retention nur noch verfügbare ungelesene Beiträge zählen.

Interne Verwaltungsereignisse:
Gründung, Beitritt, Austritt, Ausschluss, Rollen-/Führungswechsel, Mitteilungsänderung und Chatmoderation mit Akteur/Zeitpunkt nachvollziehbar zeigen. Höchstens letzte 100 Einträge; keine Ressourcenstände oder private Nachrichten hineinschreiben. Chat nicht zusätzlich in jeder Spieler-Postbox duplizieren.

## 7. UI und Integration in die bestehende Welt

Ergänze einen klar beschrifteten Hauptbereich „Bündnis“. Er ist eine begründete Erweiterung auf acht Hauptbereiche; die sieben bisherigen bleiben erhalten. Mobile Mehr-Navigation mit Bündniseintrag, keine neue unübersichtliche Seitenleiste und kein Rückfall zur Pflicht-Aktionssidebar aus der Zeit vor 18a.

Ohne Mitgliedschaft:
- Einladungen mit Annehmen/Ablehnen;
- Bündnis suchen/vergleichen über Name/Kürzel;
- öffentliches Profil;
- sichtbarer Gründungseinstieg mit automatischer Vorschau und zahlender Stadt.

Mit Mitgliedschaft:
- Übersicht: Name/Kürzel, eigene Rolle, Beschreibung, angeheftete Mitteilung;
- Mitglieder: Rollen, bereits öffentliche Städte, direkte passende Aktionen;
- Chat mit Eingabefeld und lokalem Sendezustand;
- Verwaltung nur mit passenden Rechten, inklusive Einladungsübersicht;
- Protokoll als untergeordneter Bereich.

Nicht jede Aktion in ein eigenes Modal legen. Erhalt der 18a-Prinzipien:
lokale Buttons, Kosten vor Start, automatische Vorschau, echte Entwürfe schützen, klare Fehlermeldungen und nur eine Dialogebene.

Bestätigung bei Gründung, Ausschluss, Führungsübergabe, Austritt und Auflösung angemessen in einem klaren Ablauf; keine redundante Bestätigung für Lesen/Filter/Chatnavigation. Nachricht senden bleibt ein bewusster Klick oder klar beschriftetes Tastaturverhalten, kein automatisches Senden.

Mitgliedsstadt:
- Stadtname und Koordinaten.
- „Auf Karte zeigen“.
- „Ressourcen liefern“ öffnet bestehendes Lieferformular mit genau dieser Zielstadt.
- „Nachricht“ öffnet bestehende private Postbox mit Kommandant als Empfänger.
- Quelle sichtbar wählen, bestehende Öl-/LKW-/Fracht-/Lagerregeln anwenden.
- Keine automatische Mengenwahl, Abbuchung oder Truppenentsendung.
- Keine private Versorgung des Empfängers anzeigen.

Eigene/allierte Städte auf der Weltkarte:
Kürzel und eindeutige textliche Zugehörigkeit; eigene Stadt, Bündnispartner, andere Stadt weiterhin unterscheidbar. Bündniszeichen darf Stadtnamen und Windrose nicht verdecken.

Öffentliche Kartendaten dürfen ausschließlich die öffentlichen Bündnisfelder ergänzen. Server leitet Zugehörigkeit aus dem Bündnisbestand ab, nicht aus Clientbehauptungen oder veralteten Kopien an einzelnen Städten.

Bei Beitritt/Austritt/Auflösung:
öffentliche Anzeige über geeignete Revision/Invalidierung aktualisieren; gecachte Kartenausschnitte und Detailkarten beachten. Keine Kamera-/Zoomänderung, keine Weltneugenerierung.

Bündnismitgliedschaft gewährt keine fremden Stadtaktionen: Verbündete Stadt bleibt fremdes Eigentum. Die eigene-Stadt-Verlegung darf nicht versehentlich auf Verbündete erweitert werden. Gemeinsame NPC-Bestände und private Aufklärungsinformationen unverändert.

## 8. WebSocket, Datenprojektion und Rechte

Alles über den vorhandenen einzelnen WebSocket. Kein neuer HTTP-Spielendpunkt, kein zweiter Chat-WebSocket und kein periodisches Clientpolling.

Mögliche Ereignisfamilien, an aktuelle Namens-/Formatregeln anpassen und dokumentieren:
- alliance.list / alliance.get: begrenztes Verzeichnis und berechtigtes Profil.
- alliance.create.preview / alliance.create.
- alliance.update: öffentliche Beschreibung bzw. separate Mitteilung mit passenden Versionen.
- alliance.invite.
- alliance.invitation.respond / alliance.invitation.revoke.
- alliance.role.change / alliance.leadership.transfer.
- alliance.member.remove / alliance.leave / alliance.dissolve.
- alliance.chat.list / alliance.chat.send / alliance.chat.remove / alliance.chat.read.
- alliance.events.list.
- gezielte private Änderungen und öffentliche invalidierende Zusammenfassungen.

Authentifizierung und Weltzugehörigkeit immer prüfen. Alliance-/Player-/Membership-IDs sind Referenzen, keine Berechtigungsnachweise.

Drei klar getrennte Projektionen:
1. öffentlich für authentifizierte Spieler derselben Welt;
2. intern für aktuelle Bündnismitglieder;
3. einladungsbezogen nur für Empfänger und berechtigte Bündnisverwaltung.

Ein normaler city.snapshot braucht nur kleine eigene Bündnis-/Einladungs-/Ungelesen-Zusammenfassungen. Nicht bei jedem Wirtschaftstick komplette Chat- und Mitgliederhistorien mitsenden.

Paginierung mit stabilen Cursorn und festen Maxima. Vorhandene Nachrichten-/Bytegrenzen respektieren; Seiten zusätzlich nach serialisierter UTF-8-Größe begrenzen. Selbst legale lange Texte dürfen keine übergroßen Sammelpakete erzwingen.

Private Pushes beim Versand erneut nach aktueller Mitgliedschaft filtern. Nicht nur beim Öffnen abonnieren und dann weiter blind senden. Bei Austritt, Kick und Auflösung subscriptions aller Tabs bereinigen. Verzögerte Antworten durch membershipId/Revision im Client abweisen; sie dürfen entfernte private UI-Daten nicht erneut einsetzen.

Request-ID/Fingerprint-Prüfung beibehalten. Identischer Request liefert gespeichertes Ergebnis; abweichender Inhalt unter gleicher ID wird abgelehnt. Rechteentzug darf auch über Replay keine privaten Inhalte wieder freigeben: bei wiederholten alten mutierenden Requests gegebenenfalls nur minimales damaliges Ergebnis liefern, niemals eine damalige private Vollprojektion.

Serverzeit gilt für Fristen und Ratelimits. Unbekannter Ausgang bei Verbindungsabbruch wird nach Resume abgeglichen, nicht mit neuer ID blind wiederholt.

## 9. Speicherung, Migration und Transaktionen

Eine autoritative Quelle für Mitgliedschaft und Rollen. Bevorzugt:
- Bündnisse inklusive Mitglieder/Einladungen/Chat/Mitteilung/Protokoll im bestehenden world.json;
- daraus abgeleiteter In-Memory-Index playerId → allianceId;
- persönliche Spielstände bleiben in ihren Spieler-JSON-Dateien;
- Gründungszahlung, letzter erfolgreicher Gründungszeitpunkt und dauerhafter Befehlsbeleg werden in derselben Transaktion gesichert; einen neuen Spieler-Metadatenwert nur mit passender Schema-Migration ergänzen oder den Zeitpunkt aus vorhandenen dauerhaften Belegen ableiten.

Keine zweite unabhängig beschreibbare Mitgliedschaftsliste je Stadt oder Spieler. Indizes/Caches aus autoritativem Bestand rekonstruieren und auf Inkonsistenzen prüfen.

Gelesener Stand: Welt 4, Spieler 18. Für den neuen Weltbestand explizite idempotente Weltmigration 4 → 5 vorsehen. Wenn neue persistente Spielerfelder erforderlich sind, zusätzlich Spieler 18 → 19; sonst nicht nur wegen der Auftragsnummer das Spielerschema erhöhen. Tatsächliche Entscheidung dokumentieren.

Alle älteren Migrationspfade bis zum neuen Weltschema durchlaufen lassen, nicht einen alten Zweig bei 4 beenden. Neue Welten erhalten denselben gültigen leeren Bündnisbestand. Karten-Seed, Felder, NPCs, Städte, Claims und laufende Missionen unverändert erhalten.

Erhalte bestehende Spielerressourcen, Aufgabenansprüche, Punkte, XP, Forschung, Generäle, Warteschlangen, Hunger- und Regelhistorien. Keine Altspieler automatisch einem Bündnis zuweisen und keine Gründungsgebühr rückwirkend verlangen. Unbekannte Schemata, widersprüchliche Mitgliedschaften oder beschädigte Rollenbestände sichtbar ablehnen; keine stille Reparatur durch Löschen oder zufällige Führungszuweisung.

Nutze die bestehende serialisierte Weltqueue und das Recovery-Journal:
- parallele Gründung mit gleichem Namen/Kürzel: genau eine gewinnt;
- zwei Annahmen für den letzten Mitgliederplatz: höchstens eine gewinnt;
- gleichzeitige Annahme verschiedener Bündnisse: maximal eine Mitgliedschaft;
- Gründungsgebühr und angelegtes Bündnis sind dieselbe Transaktion;
- Führungsübergabe schreibt beide Rollen zusammen;
- erst nach erfolgreichem Commit bestätigen und Updates senden.

Bekannte Speicherfehler dürfen keinen nur im Arbeitsspeicher geänderten Bündnisstand für Folgeaktionen freigeben. Bestehendes Recovery-Verhalten beachten und bei Fehlern vor weiterer Arbeit synchronisieren/stoppen.

Dauerhafter Gründungsbeleg muss auch nach Auflösung und Request-Historienbereinigung erneute Zahlung durch denselben alten Befehl verhindern. Keine Doppelmitgliedschaft und keine erneute Wiederbelebung verbrauchter Einladungen durch Wiederholung.

Chat-/Moderationsdeduplizierung unabhängig vom sichtbaren letzten-200-Fenster behandeln. Das unterstützte Wiederholungsfenster dokumentieren; normale Wiederholung und Reconnect innerhalb dieses Fensters dürfen auch nach Pruning keine zweite Nachricht oder Löschrücknahme erzeugen.

Terminale Einladungen/aufgelöste Bündnisse dürfen kontrolliert bereinigt werden, soweit benötigte kompakte Abschluss-/Deduplizierungsbelege erhalten bleiben. Keine unbeschränkte neue Kopie aller Chatnachrichten. Backup/Wiederherstellung weiterhin vollständiges gestopptes Weltverzeichnis; keine neue externe Datenbank.

## 10. Vorbereitung für spätere Föderation

Jetzt ausschließlich lokale Bündnisse implementieren. Fachliche Regeln unabhängig vom Transport halten und IDs zusammen mit instanceId eindeutig referenzierbar machen.

Keine Matrix-Verbindung, keine Homeserver-Zugangsdaten und keine serverübergreifenden Einladungen oder Lieferungen hinzufügen. federationEnabled bleibt unverändert false.

Die bestehende Föderationsplanung bleibt gültig; lokale Mitgliedschaft ist später kein Beweis für Vertrauen in fremde Server. Keine neue Sicherheitszusage und keine ungeprüfte Übernahme externer Ressourcen.

## 11. Abnahme

Automatisierte Kern-/Server-/Integrationstests für:
1. Gründung mit gültiger eigener Stadt, einmaliger Gebühr, Name/Kürzel-Normalisierung, unzureichenden Ressourcen und fremder Stadt.
2. Zwei gleichzeitige Gründungen mit gleichem Namen/Kürzel; keine Doppelzahlung beim Verlierer.
3. Mitgliedschaft pro Kommandant einschließlich fünf Städten, niemals pro Stadt.
4. Einladungen: Ausgabe, Duplikat, Ablehnung, Widerruf, Ablauf exakt an Zeitgrenze, Offline-Login, volles Bündnis, fremder Empfänger.
5. Zwei Annahmen letzter Platz; zwei Bündnisse für denselben Spieler; andere Einladungen nach Erfolg ungültig.
6. Vollständige Rollenmatrix, veralteter Offizier-Tab, neue membershipId nach Wiederbeitritt.
7. Führungsübergabe mit genau einem Anführer, Austrittssperre und Auflösung nur als letzter Anführer.
8. Entfernte/aufgelöste Mitgliedschaft hat keinen privaten Lese-, Schreib- oder Push-Zugang; öffentliche Projektion enthält keine internen Daten.
9. Chatreihenfolge, Rate-/Längenlimits, Moderation, Retention, monotone Lesemarkierung, Mehrtab-Updates und erneuter Beitritt.
10. Keine Textausführung durch HTML-/Scriptinhalt; Unicodegrenzen, Payloadgrößen und Paginierung.
11. Request-Wiederholung, verlorene Bestätigung, Pruning, Neustart und injizierte Speicherfehler nach Journal-/Welt-/Spielerwrite.
12. Migrationsketten alter Welten einschließlich Welt 4; Karte und vollständige bestehende Spielermechaniken erhalten.
13. ENV-Änderungen: neue Gründungsangebote, eingefrorene Mitgliederlimits, alte Einladungstermine unverändert.
14. Bestehende Lieferung an Mitglied ist normaler Transport; keine fremde Truppenverlegung; Austritt/Auflösung verändert laufende Lieferung nicht.
15. Kartenrevision und gecachte Zugehörigkeit aktualisieren, ohne Kamera/Windrose oder private Aufklärung zu verändern.

Browserdurchlauf mit mindestens drei Testkonten und zwei Tabs:
- A gründet, lädt B ein; B nimmt nach erneuter Anmeldung an.
- A befördert B; B lädt C ein, kann A aber nicht entfernen oder Führung übernehmen.
- B/C chatten; Nachrichten erscheinen live und bleiben nach Neustart.
- Berechtigter moderiert einen Beitrag; Text verschwindet auch in anderem Tab.
- A öffnet Mitgliedsstadt und startet ausdrücklich eine reguläre Lieferung.
- Führung an B übertragen; A tritt aus und erhält keine neuen internen Inhalte.
- Restliche Mitglieder verlassen nach Regeln das Bündnis; letzter Anführer löst auf.
- Fehlversuche und Bestätigungsverlust erzeugen weder Doppelgebühr noch Doppelmitgliedschaft.

Desktop und 390/320 px prüfen: Bündniseinstieg, Gründungsformular, Einladungen, Rollen, Chat, Lieferung, Tastatur/Fokus, echte Entwürfe und Offlinezustand. Bestehende 18a-Hauptwege und Windrose gezielt regressionsprüfen.

npm test und npm run build ausführen. Kontrollierte Uhr für Fristen verwenden. Nur tatsächlich ausgeführte Browser-/Laufzeitprüfungen als bestanden ausweisen.

## 12. Dokumentation und Abschluss

Aktualisiere README.md, docs/PROJECT.md, docs/WEBSOCKET.md, .env.example, erforderliche Compose-/Betriebsdokumentation und dokumentiere den tatsächlichen Schema-/Regelstand.

Erstelle docs/ALLIANCES_VALIDATION.md mit:
- tatsächlichen Testbefehlen und Ergebnissen;
- Rechte-/Sichtbarkeitsmatrix;
- Migration, Recovery, Mehrtab- und Konkurrenzfällen;
- Desktop-/Mobilnachweisen;
- Einschränkungen einschließlich Chatretention und Wiederholungsfenster.

Implementierten Stand von Planung trennen. Keine unbelegten Originalspielwerte oder behauptete Föderation.

Abschluss kurz: spielbarer Bündnisablauf, relevante Dateien, geprüfte Fälle, offene Grenzen.

Als nächsten separat zu spezifizierenden Auftrag stationierte Bündnisunterstützung prüfen: Eigentümer bleibt derselbe, Empfängerzustimmung, stationärer Unterhalt, Hungerfolgen, Rückwegöl, Rückruf und automatischer Umgang mit Austritt/Ausschluss müssen davor vollständig festgelegt werden. In Auftrag 19 keine Platzhalterbewegungen dafür bauen.
