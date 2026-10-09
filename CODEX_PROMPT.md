# Codex-Auftrag 15: Ressourcenlieferungen zwischen Spielerstädten

## Arbeitsauftrag und Ausgangspunkt

Der Nutzer bestätigt Auftrag 14 am 09.10.2026 als abgeschlossen und beauftragt den nächsten Ausbauschritt. Implementiere Ressourcenlieferungen innerhalb derselben Spielwelt auf dem bestehenden Frachtmodell. Der Planungschat erstellt ausschließlich Anweisungen.

Lies zuerst AGENTS.md und die vorhandenen Projekt-, Entwicklungs- und WebSocket-Dokumentationen. Prüfe aktuellen main, offene Änderungen und vorhandene Tests; erhalte fremde Arbeit. Liefere einen getesteten PR ohne automatisches Merge oder Deployment.

Statisch gelesener Ausgangspunkt: Spielerschema 15; packages/game-core/logistics.js und cargo.js implementieren NPC-Fracht und Treibstoff, apps/server/storage.js besitzt eine exklusive Weltqueue und ein Recovery-Journal für mehrere Spielerzustände. Bestehende Missionen sind bislang auf NPC-Ziele beschränkt. Prüfe diese Grundlagen im aktuellen Checkout. Die Planung hat keine Anwendungstests ausgeführt.

Die folgenden neuen Lieferregeln sind vorläufige Projektentscheidungen für diesen Auftrag, keine belegten Originalspielwerte.

## 1. Spielbarer Ablauf und Grenzen

Spielerstadt auf Weltkarte auswählen → „Ressourcen liefern“ → LKWs, freien General und Ressourcen wählen → serverseitige Vorschau bestätigen → Hinreise → automatische Einlagerung im Ziel → Rückreise mit nicht angenommenen Gütern → Heimkehr und Bericht.

- Neuer eigenständiger Missionstyp für Lieferungen, kein als Angriff verkleideter NPC-Auftrag.
- Nur andere existierende Spielerstädte derselben Welt/Instanz. Eigene Ausgangsstadt, NPCs, unbekannte Ziele und fremde Instanzen ablehnen.
- Mindestens ein verfügbarer LKW und mindestens eine Ressourceneinheit als Ladung.
- In dieser ersten Lieferstufe ausschließlich LKWs als Transporttruppen. Keine Infanteriepflicht aus Raid-Validierung übernehmen, keine Späher oder Begleitkämpfe.
- Ein eigener freier General begleitet den Transport und bleibt bis zur Heimkehr gebunden. Bürgermeister, Forschungsleiter und bereits eingesetzte Generäle sind ausgeschlossen.
- Transporttruppen und General bleiben Eigentum des Absenders. Keine Stationierung beim Empfänger.
- Automatische, unentgeltliche Lieferung ohne Gegenleistung oder Annahmedialog. Empfänger darf offline sein.
- Normale Hin- und Rückfahrt nach bestehenden Entfernungs-/Zeitregeln. Lieferungen unterstützen vorerst keine zusätzliche Ankunftsverzögerung; nicht-null Verzögerung serverseitig ablehnen.
- Kein Kampf, keine Überfälle, keine Beute und keine XP, Skillpunkte oder Kommandantenpunkte für Lieferungen. Auch wiederholtes Hin-und-her-Senden belohnt niemanden.
- Kein Rückruf oder Ändern von Ziel/Ladung nach Start in diesem Auftrag. Bedienoberfläche erklärt dies vor Bestätigung.
- Keine automatische Verbrauchsversorgung anderer Armeen; Nahrung wird gewöhnlicher Stadtbestand des Empfängers.

## 2. Fracht und Betriebsöl wiederverwenden

Keine zweite Preis-, Zeit-, Reichweiten- oder Kapazitätsrechnung entwickeln. Gemeinsame Funktionen aus Auftrag 14 für Lieferungen nutzbar machen, während Raid-/Scout-Regeln erhalten bleiben.

- Ladung: frei gewählte sichere ganze Mengen Holz, Stein, Nahrung und Öl; unbekannte Schlüssel und ungültige Werte ablehnen.
- Gewichte und LKW-Kapazität aus bestehenden Regeln übernehmen.
- Betriebskosten bleiben positive typabhängige Ölraten.
- E = normaler exakter Einwegölbedarf; bei Verzögerung 0 gilt Gesamtstartöl F=ceil(2E).
- Gesamte Ladung plus F muss beim Start in die Transportkapazität passen. Bestehende Reichweiten-/Rückwegreserveprüfung erhalten.
- Hinwegverbrauch F−E einschließlich Rundungsrest, normale Rückfahrt verbraucht E. Keine Rückerstattung und keine Neubetankung beim Ziel.
- Freiwillige Ölladung und Betriebsöl getrennt halten. Ausschließlich freiwilliges Öl ist lieferbar.
- Start bucht Ladung sowie Betriebsöl einmalig ab und reserviert LKWs/General atomar.
- Reisende LKWs verursachen keinen Stadt-Nahrungsunterhalt, weder beim Absender noch beim Empfänger. Bei Heimkehr beginnt ihr bisheriger stationärer Unterhalt wieder.
- Alle Parameter und Regelversionen je Mission speichern; ENV-Änderungen verändern keine laufende Fahrt.
- Zeitfortschritt und Ölverbrauch weiterhin exakt aus gespeicherten Zeitpunkten ableiten.

Rechenbeispiel mit aktuellen Defaultwerten: 5 LKW mit je 200 Traglast und 1 Öl je Feld, Distanz 10 Felder → Traglast 1000, E=50 und F=100. Maximal 900 Ressourcen können geladen werden. Bei 600 Holz und 300 Nahrung ist die Startkapazität genau ausgeschöpft. 50 Hinwegöl werden verbraucht, 50 bleiben für die Rückfahrt reserviert.

## 3. Ankunft und Teilannahme

Ankunft ist ein serverseitiges, dauerhaft gespeichertes Ereignis. Empfängerstadt zunächst exakt bis zum Ankunftszeitpunkt fortschreiben: Produktion, Bau-/Forschungsabschlüsse, Versorgung und vorher fällige Ereignisse berücksichtigen.

Pro Ressource:
- Freier Lagerraum = max(0, aktuelle Kapazität − aktueller Bestand).
- Angenommen = min(gelieferte ganze Menge, floor(freier Lagerraum)).
- Restladung = gelieferte Menge − angenommen.
- Angenommene Menge dem Empfänger einmalig gutschreiben und gleichzeitig aus der Missionsladung entfernen.
- Nicht angenommene Güter bleiben beim Absender und fahren automatisch zurück. Am Ziel keinen Überlauf vernichten.
- Keine zukünftigen Lagerplätze reservieren; allein der tatsächliche Zustand bei Ankunft zählt.
- Sind alle Ziellager voll, fährt die vollständige Ladung zurück.
- Ist das Ziel nicht mehr gültig oder gehört es bei Ankunft nicht mehr zum gespeicherten Empfänger, keine Gutschrift: gesamte Ladung kehrt zurück, mit begründetem Ergebnis.
- Vorübergehende Speicher-/Lesefehler nicht als „Ziel verschwunden“ behandeln; zuverlässig wiederholen/recovern.
- Kein Warten am Ziel auf später frei werdenden Lagerraum. Sofortige normale Rückfahrt zum bereits gespeicherten Termin.

Im Beispiel aus Abschnitt 2 hat das Ziel bei Ankunft 250 Holzplätze und 200 Nahrungsplätze frei: 250 Holz und 200 Nahrung werden zugestellt. 350 Holz und 100 Nahrung fahren zurück. 50 Betriebsöl bleiben reserviert und werden auf dem Rückweg verbraucht.

Die Rückreise erzeugt keine zweite Lieferung und keine zusätzliche Rechnung. In der Heimat verbliebene Ladung nach bestehenden Regeln einlagern; dortigen Überlauf getrennt berichten. LKWs und General genau einmal wieder freigeben. Bei normaler Heimkehr Betriebsöl 0.

## 4. Dauerhafte Buchungen über zwei Spieler

Wichtigste technische Abnahme: Empfängergutschrift und Reduktion der Transportladung bilden eine gemeinsame Transaktion. Eine Einzeldatei atomar umzubenennen reicht dafür nicht.

Vorhandene exklusive Weltqueue und das Mehrspieler-Recovery-Journal verwenden und falls nötig erweitern. Kein separater ungeordneter Schreibpfad für den Empfänger. Bei parallelen Ereignissen auch Gebäudekosten, Versorgung und weitere Lieferungen konsistent serialisieren.

Persistiere unter stabiler Missions-/Transaktionskennung:
- Absender-, Ausgangsstadt-, Zielstadt- und erwartete Empfänger-ID;
- Einheiten, General, Zeiten und Regelsnapshot;
- anfängliche Ladung, tatsächlich zugestellte Mengen, verbleibende Rückfracht;
- Zustellstatus und Zeitpunkt, Ergebnisgrund, Heimlagerung/Überlauf;
- Treibstoffbilanz separat.

Pro Ressource muss gelten:
Startladung = zugestellt + aktuell unterwegs + zuhause wieder eingelagert + dokumentierter Heimlagerüberlauf.
Kein Güterverlust am Ziel bei bloßem Platzmangel. Betriebsöl hat seine separate Bilanz.

- Startbefehle per vorhandener requestId idempotent behandeln. Identische Wiederholung liefert dasselbe Ergebnis; gleiche ID mit abweichendem Inhalt ablehnen.
- Ankunft und Rückkehr ebenfalls idempotent; Commit-Marker und Ressourcenänderung gemeinsam dauerhaft speichern.
- Nach Crash Journal vor Verarbeitung weiterer Befehle wiederherstellen.
- WebSocket-Meldungen erst nach erfolgreichem Commit. Reconnect rekonstruiert Zustand aus persistierten Daten.
- Ergebnisnachrichten für beide Spieler über vorhandene Postbox zuverlässig genau einmal erstellen bzw. über stabile Ereignis-IDs deduplizieren. Client-Wiederholung darf keine zweite Benachrichtigung erzeugen.
- Mehrere Lieferungen an dasselbe Ziel nach deterministischer Reihenfolge verarbeiten: Ankunftszeit, dann stabile Missions-ID als Gleichstandsregel.

Offline-Fortschritt weltübergreifend innerhalb dieser Instanz in Ereignisreihenfolge abarbeiten: Ein Ziel darf nicht erst bis „jetzt“ fortgeschrieben und dann rückwirkend mit Nahrung versorgt werden. Beispiel: Nahrung trifft um 12:05 ein und verhindert späteren Hunger; bei Serverstart um 12:20 muss sie vor den späteren Versorgungsschritten wirken. Das gilt unabhängig davon, welcher Spieler sich zuerst anmeldet. Bereits vorhandene Regeln zu Schonfrist und Hungerverlusten unverändert anwenden.

## 5. WebSocket, Datenschutz und React

Bestehende Event-Konventionen erweitern, keine neue REST-Spiel-API oder Polling einführen. Vorschau und verbindlicher Start verwenden dieselbe zentrale Berechnung. Authentifizierten Absender aus Sitzung bestimmen; Eigentumsdaten nicht vom Client übernehmen.

Im Lieferdialog:
- Zielstadt, Kommandantenname, Entfernung;
- verfügbare LKWs und freie Generäle;
- vier Ressourcenfelder;
- Ladungsgewicht, Kapazität, Betriebsöl für beide Wege;
- Abfahrt/Ankunft/Rückkehr und verständliche Ablehnungsgründe;
- Hinweis: Zustellung ohne Gegenleistung, nicht passende Mengen kommen zurück.

Keinen aktuellen Bestand, Ausbau, freie Lagerplätze oder Nahrungsbilanz des Empfängers in der Vorschau offenlegen. Lieferung ist kein Aufklärungsersatz. Keine Garantie über die Annahmemenge aus einer clientseitigen Momentaufnahme.

Absender sieht seinen vollständigen Transportzustand und Bilanz. Empfänger sieht eingehende Lieferungen mit Absender, angekündigter Ressourcenladung und Ankunftszeit sowie später tatsächlich erhaltene Mengen. Keine Generalattribute, übrigen Stadtbestände oder andere privaten Missionsdaten des Absenders übertragen. Unbeteiligte Spieler erhalten keine privaten Transportdetails.

Postbox/Ergebnisanzeige:
- Absender: geladen, zugestellt, zurückgeführt, zuhause eingelagert/verfallen, Betriebsölverbrauch und Ergebnisgrund.
- Empfänger: tatsächlich erhaltene Ressourcen, Absender, Zeitpunkt.
- Angenommene Mengen dürfen als unvermeidliches Lieferergebnis sichtbar sein; daraus keine exakten Restlagerwerte ergänzen.
- Bereits vorhandene private Nachrichten erhalten. Keine neue verpflichtende Freitext-/Chatfunktion.

Mobile Ansicht, Tastaturbedienung, Lade-/Fehlerzustände und erneute Vorschau bei geänderten Startbedingungen prüfen. Lageränderungen am Ziel machen eine Absendervorschau nicht ungültig, da Annahme erst bei Ankunft entschieden wird.

## 6. Migration, Dokumentation und Umfang

Neue Missions-/Regelversion einführen, nächste freie Spielerschemaversion prüfen; Ausgangsschema ist 15, daher 16 nur falls noch frei. Bestehende Raid-/Scout-Missionen, Fracht, bezahltes Öl, Termine und Berichte nicht umdeuten. Identifikatoren so strukturieren, dass spätere Instanzzuordnung ergänzt werden kann, aber jetzt keine Matrix-Kommunikation implementieren.

Keine neue Balancekonfiguration ohne konkreten Bedarf: bestehende LKW-, Öl-, Welt- und Zeitparameter wiederverwenden. Falls neue Limits technisch nötig sind, begründen, validieren und in .env.example dokumentieren.

README, docs/PROJECT.md und docs/WEBSOCKET.md anpassen. Einen Nachweis docs/DELIVERY_VALIDATION.md mit wirklich ausgeführten Tests, Ergebnis und bekannten Grenzen erstellen. Auftrag 14 als abgeschlossen erhalten.

In diesem Auftrag ausgeschlossen: Tauschhandel/Marktplatz, Bündnissystem, stationierte Unterstützungstruppen, PvP/Transportüberfälle, Luft-/Raketenwaffen und Serverföderation. Keine Belohnungen für Transfers einführen.

## 7. Tests und Abnahme

Gezielte Kern-, Speicher- und WebSocket-Tests:
1. Beispiel mit 5 LKW, Distanz 10, 900 Ladung + 100 Öl; korrekte Abbuchung und Kapazitätsgrenze.
2. Vollständige, teilweise und vollständig abgelehnte Annahme wegen vollen Lagern; Rest fährt zurück.
3. Alle vier Ressourcen einschließlich freiwilligem Öl; kein Betriebsöl beim Empfänger gutgeschrieben.
4. Während Reise veränderte Zielkapazitäten; Ankunftszustand entscheidet.
5. Unbekanntes/NPC/eigenes/fremdinstanzliches Ziel, ungültige Zahlen, leere Ladung, keine LKWs, gebundener/fremder General, unerlaubte Einheit oder Verzögerung.
6. Nicht mehr gültiges Ziel: normale Rückkehr statt Verlust; Speicherfehler korrekt recovern.
7. Zwei Absender gleichzeitig an fast volles Ziellager, deterministische Reihenfolge ohne Überfüllung.
8. Doppelte Requests und Crash-Injektion nach Journal-Schreiben, zwischen Spielerdateien und vor/nach Journal-Löschung: keine doppelte Gutschrift oder verlorene Ladung.
9. Wiederholte Ankunft/Rückkehr und Reconnect ohne doppelte Ressourcen, Truppen, Generäle oder Postboxberichte.
10. Offline-Ankunft vor späteren Hungerereignissen; Ergebnis unabhängig von Login-Reihenfolge und Serverneustart.
11. Heimlager voll: Überlauf bilanziert; kein Reiseunterhalt, ab Heimkehr stationärer Unterhalt.
12. Keine XP/Punkte aus Lieferung; keine fremden Privatdaten über Vorschau oder Events.
13. Bestehende NPC-Raids, Aufklärung, Schema-Migration und Konfigurationswechsel regressionsfrei.

Bestehende Tests und Build ausführen. Mit zwei tatsächlichen Spielerzuständen den UI-Ablauf von Weltkarte bis beidseitigem Bericht prüfen, einschließlich offline Empfänger und Teilannahme. Tatsächliche Befehle und Ergebnisse dokumentieren.

Abgenommen ist Auftrag 15, wenn Ressourcen genau einmal zwischen zwei Städten übertragen werden, überschüssige Ziel-Ladung zurückkehrt, Öl/Kapazität/Unterhalt aus Auftrag 14 erhalten bleiben und Neustart sowie parallele Lieferungen die Bilanzen nicht verändern.

## Anschließende Planung

Auf Basis funktionierender Lieferungen als nächstes Bündnisse und gemeinsame Versorgung spezifizieren. Danach geregelten Tauschhandel mit verbindlicher Gegenleistung planen. Weitere Forschung/Militärtechnik sowie Matrix-Föderation bleiben eigene Ausbauschritte; Reihenfolge nach diesem Auftrag mit dem Nutzer abstimmen.
