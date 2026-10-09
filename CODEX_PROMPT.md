# Codex-Auftrag 14: Ressourcenladung, Betriebsöl und Einsatzreichweite

## Auftrag und Arbeitsweise

Auftrag 13 ist laut Nutzer abgeschlossen. Implementiere Auftrag 14 auf dem aktuellen Stand von bavxhack/War2glory. Lies AGENTS.md sowie README.md, docs/PROJECT.md, docs/WEBSOCKET.md und docs/DEVELOPMENT.md, soweit vorhanden. Prüfe vorhandene Implementierung, offene Änderungen und Tests; erhalte fremde Arbeit. Liefere einen getesteten PR ohne selbstständiges Merge oder Deployment.

Der Planungschat erstellt ausschließlich Anweisungen und hat keine Anwendungstests ausgeführt. Dieser Auftrag ist keine Bestätigung bereits implementierter Funktionen. Neue ergänzende Balancewerte sind vorläufige Projektentscheidungen, keine belegten War2Glory-Originalwerte.

## 1. Verbindliche Anforderungen

- Freie nicht negative ganze Mengen Holz, Stein, Nahrung und Öl auf Einsätze mitnehmen, innerhalb der Stadtbestände und einer gemeinsamen Transportgrenze.
- Das gesamte notwendige Betriebsöl für Hin- und Rückweg muss beim Start zusätzlich in die Transportkapazität passen.
- Betriebsöl wird verbraucht und gibt Platz frei. Bei normal abgeschlossener Reise bleibt kein Betriebsöl übrig. Freiwillige Ölladung ist dagegen normale Ressource und wird nicht automatisch verbrannt.
- Eigene Ressourcenladung, Betriebsöl und Beute getrennt führen.
- Alle bewegten Einheitentypen bleiben ölpflichtig, mit positiven typabhängigen Raten. Verzögerung verlängert nur die Hinfahrt; deren Ölverbrauch steigt proportional. Rückfahrt bleibt normal.
- Unterwegs befindliche Truppen verbrauchen keine Stadtnahrung. Mitgenommene Nahrung führt keinen neuen Reiseunterhalt ein.
- Eigene Ressourcen werden bei NPC-Einsätzen nicht abgeliefert; verbliebene Ladung kehrt zurück und begrenzt die Beute.
- NPCs bleiben geteilt und liefern zunächst nur die bestehende Nahrungsbeute. Spielerlieferungen und Handel sind spätere Schritte.

## 2. Exakte Mengen- und Treibstoffrechnung

Vorläufige Balancefestlegung: Eine Einheit jeder Ressource einschließlich Öl wiegt eine Transporteinheit. Zentral definieren. Bestehende typabhängige Traglasten und Ölraten aus der Konfiguration übernehmen und je Mission speichern.

Bestehende Verhältnisrechnung beibehalten:
- d = bestehende gerundete Felddistanz, mindestens 1.
- T = normale Dauer einer einfachen Strecke.
- D = zusätzliche Hinwegzeit; für Berechnungen dieselbe Zeiteinheit wie T.
- E = d × Summe(Truppenanzahl × Ölrate je Einheit und Feld): exakter normaler Einwegbedarf.
- F = ceil(E × (2T + D) / T): einmalig bezahltes und geladenes Gesamtbetriebsöl.

Bestehende Milliöl-/BigInt-Verhältnisrechnung verwenden. Anzeige-Rundungen dürfen keine Buchungen steuern. Rationale Mengen JSON-kompatibel als sichere Ganzzahlen bzw. Dezimalstrings für Zähler/Nenner speichern.

Rundungsregel: Rückwegreserve = E. Hinwegverbrauch = F − E, einschließlich einmaligem Aufrundungsrest. Ohne Verluste wird insgesamt genau F verbrannt, ohne Refund und ohne zweiten Stadtabzug.

Verbrauch aus gespeicherten Zeiten und Ausgangsmengen ableiten, nicht durch wiederholte gerundete Tick-Abzüge. Bei H = T + D ist Restöl auf dem Hinweg F − (F − E) × verstricheneZeit/H, auf das gültige Intervall begrenzt. Am Ziel genau E; auf normalem Rückweg sinkt die verbleibende Reserve auf 0.

Beispiel: E=10, T=1 Minute, zusätzliche Verzögerung 9 Minuten → Hinfahrt 10 Minuten und 100 Öl, Rückfahrt 1 Minute und 10 Öl, Gesamtstartöl 110. Zusätzliche 10 Minuten bedeuten dagegen 11 Minuten Hinfahrt. Formular klar als „Zusätzliche Verzögerung“ beschriften.

## 3. Start und Vorschau

Startbelegung = Summe freiwilliger Ressourcenladung + F.
Nur starten, wenn diese Belegung <= Transportkapazität und sämtliche Stadtbestände ausreichen.

Atomar abbuchen:
- Holz, Stein und Nahrung jeweils um freiwillige Ladung.
- Öl einmalig um freiwillige Ölladung + F.
- Truppen/General reservieren und Mission einschließlich Ladung und Regelsnapshot persistieren.
Keine Teilbuchung bei Fehlern und keine doppelte Abrechnung bereits bezahlten Öls.

Die Vorschau zeigt Truppenmix, Traglast, eigene Ladung, Gesamtbetriebsöl, Hinwegverbrauch, Rückwegreserve, Startbelegung und voraussichtlichen Beuteplatz am Ziel ohne Kampfverluste. Prognose deutlich kennzeichnen.

Beispiel ohne Verluste: Kapazität 1000, eigene Ladung 200, Hinwegöl 100, Rückwegöl 100 → Startbelegung 400, freier Startplatz 600. Am Ziel Belegung 300, maximal 700 zusätzliche Beute. Auf dem Rückweg frei werdender Platz erlaubt keine nachträgliche Plünderung.

Freiwilliges Öl und Betriebsöl separat anzeigen. Serverseitig negative, gebrochene, nicht endliche, übergroße Mengen und unbekannte Ressourcenschlüssel ablehnen. Eigentümer, Preise, Kapazität und Regelversion serverseitig bestimmen. Veraltete Vorschau nach bestehendem Verfahren neu berechnen/ablehnen.

## 4. Aufklärung und Kampfverluste

Die folgenden ergänzenden Regeln sind vorläufige Projektentscheidungen für einen vollständigen Ablauf.

Späher:
- Bestehende Ressourcen-/Beutetraglast 0 erhalten.
- Separate ausschließlich für Betriebsöl nutzbare Tankkapazität: SCOUT_FUEL_CAPACITY=20 je Späher als validierter ENV-Default.
- Gesamtes Startbetriebsöl muss in diese Tanks passen. Keine Güter- oder Beutetraglast dadurch gewähren.
- Gemeinsamen Treibstoffkern nutzen; keine Aufklärungsverzögerung oder bisher ausgeschlossene gemischte Späher-/Raid-Gruppen einführen.

Raids:
- Nach Kampf gelten Traglasten der tatsächlich überlebenden Infanterie und LKWs.
- Exakten Rückwegbedarf E_survivors aus Überlebenden, gespeicherter Distanz und Raten berechnen.
- E − E_survivors als mit ausgeschalteten Einheiten verlorenes Betriebsöl buchen. Kein Refund, keine neue Beute, kein neuer Stadtabzug.
- Auf normalem Rückweg E_survivors verbrauchen. Bei vollständigem Truppenverlust gehen Restöl und gesamte Ladung verloren. Bestehende General-Rückkehr-/Verlustregeln erhalten.

Konservative Rückkehrsicherung: Vorläufig muss für jeden teilnehmenden Raid-Einheitentyp d × Ölrate je Einheit <= eigene Traglast je Einheit gelten. So passt die normale Rückwegversorgung auch bei beliebiger Überlebendenzusammensetzung. Hinwegöl und Güter nutzen weiterhin den gemeinsamen Frachtraum. Verstoß mit konkretem Hinweis auf Einheitentyp und Rückwegreserve ablehnen; diese zusätzliche Reichweitenbedingung dokumentieren. Keine neue Strandungs-, Rettungs- oder zusätzliche Truppenvernichtungsmechanik einführen.

Nach Verlusten gilt Vorrang: Rückwegöl → eigene Ladung → neue Beute.
Ganzzahlige Güterkapazität am Ziel = floor(Überlebendenkapazität − E_survivors).

Übersteigt eigene Ladung diesen Wert, Überschuss als Ladungsverlust buchen. Proportional nach bisherigen Ressourcenmengen auf verbleibende Plätze verteilen: zunächst abrunden, Restplätze nach größtem Bruchrest vergeben, Gleichstände in fester Reihenfolge Holz, Stein, Nahrung, Öl. Keine negative Ladung.

Bei Sieg maximal min(verfügbarer NPC-Nahrung, nach eigener Ladung freier Güterkapazität) plündern. Bei Niederlage keine neue Beute; verbliebene eigene Ladung kehrt mit Überlebenden zurück. Bestehende Kampf-, XP-, Punkte- und LKW-Verlustregeln erhalten.

Testbeispiel mit Traglast Infanterie20/LKW200 und Ölraten 0,1/1:
- 20 Infanteristen + 4 LKW, d=5, keine Verzögerung: Traglast1200, E=30, F=60.
- Nach Kampf 15 Infanteristen + 3 LKW: Traglast900, Rückwegöl22,5, verlorenes Betriebsöl7,5.
- Güterplätze floor(900−22,5)=877.
- Bei eigener Ladung300 maximal577 neue Nahrung.
- Bei eigener Ladung1000 bleiben877 eigene Güter,123 gehen verloren, keine Beute.
- Ölbilanzen: 30 Hinwegverbrauch + 7,5 Kampfverlust + 22,5 Rückwegverbrauch = 60.

## 5. Reichweite, ENV und React-Oberfläche

Dieselbe zentrale Berechnung für Vorschau und verbindlichen Start verwenden. Reichweite hängt vom aktuellen Truppenmix, Ladung, Zusatzzeit, Ölraten und Traglasten ab. LKWs benötigen selbst Öl; zusätzliche Einheiten garantieren keine größere Reichweite.

Für ein Ziel verständlich unterscheiden: Stadtöl fehlt, Ladung zu schwer, Tankkapazität zu klein oder Rückwegreserve eines Typs zu groß. Eine maximale Entfernung nur mit denselben Bedingungen innerhalb der tatsächlichen Weltgrenzen berechnen.

Bestehende ENV-Parameter erhalten; Spähertankwert in .env.example und Dokumentation ergänzen. Laufende Missionen behalten ihre gespeicherten Parameter bei Konfigurationsänderungen.

React-Einsatzmodal um Mengenfelder und Kapazitäts-/Ölvorschau erweitern. Mobile Ansicht, laufende Missionen und Postboxberichte berücksichtigen. Spielkommunikation weiterhin über vorhandene WebSocket-Events, ohne zweite REST-Spiel-API oder Polling.

Eigene Ladung, Beute, verbranntes/verlorenes/restliches Betriebsöl, Ladungsverluste und Lagerüberläufe separat ausweisen. Keine privaten Ladungen oder unaufgeklärten Informationen an andere Spieler über Welt-Events offenlegen.

## 6. Rückkehr, Persistenz und Migration

Rückkehrende Güter und Beute je Ressource nach den dann gültigen Stadtlagergrenzen einlagern. Eigene Ladung zuerst, danach Beute. Überlauf nach bestehenden Regeln verwerfen und separat berichten. Eigene Rückfracht ist keine neue Beute und erzeugt keine XP/Punkte. Betriebsöl nicht einlagern.

Invarianten:
- Stadtbestände niemals negativ.
- Startbetriebsöl = bisher verbrannt + verloren + aktuell verbleibend.
- Eigene Ladung und Beute jeweils vollständig separat bilanzieren.
- Nach jedem abgeschlossenen Zustandsübergang bleibt Belegung innerhalb der aktuellen Kapazität.
- Wiederholte Requests, mehrere Tabs, Reconnect und Neustart erzeugen keine zusätzlichen Güter oder Abzüge.

Vorhandene Persistenz-/Transaktionsmechanismen für Spieler und geteilte NPCs nutzen bzw. erforderlichenfalls vervollständigen. NPC-Beuteentnahme, Missionsresultat und Rückkehr dürfen bei Crash/Wiederholung nur einmal wirksam werden. Offline fällige Ereignisse in richtiger Reihenfolge verarbeiten. Stadtunterhalt bis Abfahrt und ab Rückkehr korrekt verrechnen.

Statisch gelesener Ausgangspunkt war Spielerschema14 mit npc-pve-4-logistics-provisional und fuel-2-positive-ratio-provisional. Aktuellen Stand prüfen und nächste freie Schema-/Missionsversion nutzen; Schema15 nur, falls noch frei.

Alte laufende Missionen nach ihren gespeicherten Regeln beenden: kein rückwirkendes Öl als neue Fracht, keine neue Reichweitensperre und keine erneute Zahlung. Alte Berichte weiter anzeigen. Generäle, Porträts, Bewerberkosten, Nachrichten, Forschung und Versorgungshistorie bewahren.

## 7. Tests und Abnahme

Gezielt prüfen:
- Gemeinsame Kapazitätsgrenze aller Ressourcen, exakt voll und eine Einheit zu schwer.
- Freiwilliges Öl plus Betriebsöl korrekt einmalig bezahlt; nur Betriebsöl verbrannt.
- Beispiele 1000/200/100/100 mit700 Beuteplätzen und +9 Minuten bei Einwegbedarf10 mit110 Gesamtöl.
- Bruchteilbedarf/Rundungsreste; keine überschätzte Traglast, Restbetriebsöl0 nach Rückkehr.
- Überlebendenbeispiel1200→900 mit22,5 Rückwegöl und577 Beute bei300 eigener Ladung.
- Proportionale Ladungsverluste, Niederlage, vollständiger Truppenverlust.
- Spähertankgrenze und keine neue Späherbeute.
- Rückwegreserve-Prüfung bei geänderten ENV-Raten.
- Volle Stadtlager und getrennte Bilanz für Rückfracht/Beute/Überlauf.
- Zwei Spieler am selben NPC, doppelte requestId, mehrere Tabs, Neustart während Hinweg/Kampf/Rückweg/Rückkehr ohne Doppelbuchung.
- Migration alter Missionen/Berichte und Konfigurationswechsel.
- Unterwegs kein Stadtunterhalt; nach Rückkehr nur Überlebende berücksichtigen.

Bestehende Tests und Build ausführen, vollständigen UI-Ablauf bis zum Rückkehrbericht prüfen. Tatsächlich ausgeführte Befehle und Ergebnisse dokumentieren; keine ungetesteten Erfolge behaupten.

Abnahme: Ladung und gesamter Treibstoff passen vor Abfahrt, verbranntes Öl gibt Platz frei, Überlebendenkapazität begrenzt die tatsächliche Beute und der vollständige Ablauf bleibt auch bei Neustart ohne Doppelbuchung korrekt.

## Danach

Als separaten nächsten Auftrag Spielerlieferungen/Versorgung zwischen Städten auf diesem Frachtmodell spezifizieren. Forschung, weitere Militärtechnik, spätere Flugzeuge/Raketenwerfer/Luftfähigkeiten und Matrix-Föderation bleiben weitere Projektschritte. Diese Folgefunktionen hier noch nicht implementieren.
