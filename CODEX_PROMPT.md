# Codex-Auftrag 15: Bis zu fünf Städte, Felderkundung, Eroberung und Stadtgründung

## Auftrag und Priorität

Diese Fassung ersetzt den bisherigen Auftrag 15 „Ressourcenlieferungen“. Lieferungen werden Auftrag 16 und jetzt nicht implementiert. Der Nutzer bestätigt Auftrag 14 als abgeschlossen und legt fest:
- Maximal fünf eigene Städte insgesamt, einschließlich der ersten Stadt.
- Zwischen eigenen Städten wechseln können.
- Für eine neue Stadt zunächst ein freies Feld aufklären und erobern.
- Die Anzahl der dortigen Verteidiger variiert; genaue Informationen erst durch Aufklärung.
- Nach erfolgreicher Eroberung gegen eine Gebühr eine Stadt errichten.

Implementiere den vollständigen Ablauf auf aktuellem main. Lies AGENTS.md sowie vorhandene Projekt-, Entwicklungs- und WebSocket-Dokumentation. Erhalte fremde Arbeit. Falls Lieferarbeiten bereits begonnen wurden, nicht löschen: kompatibel erhalten, diesen Auftrag priorisieren und Abweichungen im PR erklären. Liefere einen getesteten PR ohne automatisches Merge/Deployment. Der Planungschat ändert ausschließlich Anweisungen.

Statisch gelesene Grundlagen: Spielerschema 15 nach Auftrag 14; world.js mit WORLD_SCHEMA_VERSION=3 und bislang einer per find ermittelten eigenen Stadt; getrennte Fracht-/Treibstoffrechnung; Weltqueue und Recovery-Journal. Aktuellen Stand prüfen, keine Versionsnummer blind wiederverwenden. Neue Zahlen/Regeln unten sind ausdrücklich vorläufige Projektentscheidungen.

## 1. Mehrstadt-Datenmodell und Zuständigkeiten

Eine kanonische Sammlung eigener Städte mit stabilen cityIds statt einer zweiten parallel gepflegten Kopie von player.city einführen. Weiterhin serverseitige JSON-Persistenz; kein Datenbankwechsel erforderlich.

Stadtbezogen:
- Name, Position, Gebäude und getrennte zivile/militärische Bauplätze;
- eigene Ressourcen, Lagergrenzen, Produktion, Bauqueues;
- stationierte Einheiten, Ausbildungsqueues, Versorgung und Hungerverlauf;
- zugewiesener Bürgermeister und zugehöriger Führungsbonus.

Spielerweit als vorläufige Festlegung:
- Konto, Generäle/Skills/Porträts, Bewerber und steigende Rekrutierungskosten;
- Forschung und genau eine bestehende Forschungsqueue mit Forschungsleitung;
- Punkte, Postbox und Aufklärungsberichte.
Gebäudepunkte über eigene Städte summieren; Forschungspunkte und Kampfwertung nur einmal zählen. Kein Punktbonus allein durch Stadtgründung.

Generäle bleiben ein gemeinsamer Pool. Ein General hat höchstens eine Rolle: idle, Bürgermeister einer konkreten cityId, Forschungsleiter oder Mission. Pro Stadt höchstens ein Bürgermeister; derselbe General nie in zwei Städten gleichzeitig. Freie Generäle dürfen vorläufig ohne neue Reiseaktion einer Rolle/einem Einsatz zugeordnet werden; das ist eine Verwaltungsregel, kein Einheitentransport.

Forschungskosten aus explizit ausgewählter eigener Stadt bezahlen; dort muss die erforderliche Universität stehen. Forschung wirkt spielerweit, soweit ihre bestehende Definition dies vorsieht. Aktuelle Forschungsqueue speichert finanzierende/ausführende cityId. Vorhandene Abriss-/Belegungsregeln auf diese Universität anwenden. Stadtwechsel erzeugt weder weitere Queues noch mehrfachen Forschungsleiterbonus. Rekrutierungskosten ebenfalls aus expliziter eigener Stadt, Rekrutierungszähler bleibt spielerweit.

Alle Städte schreiten auch inaktiv/offline fort. Umschalten darf keine Produktion, Hungerfrist oder Queue zurücksetzen. Nahrung wird ausschließlich von stationierten Einheiten in ihrer Stadt verbraucht. Alle bestehenden Vorgänge auf bisher versteckte Ein-Stadt-Annahmen prüfen.

## 2. Stadtwechsel und cityId in jedem relevanten Befehl

React erhält einen gut erreichbaren Stadtwähler mit Name, Koordinaten und „N/5 Städte“. Stadtansicht, Militärseite, Ressourcenleiste, Bürgermeister und Warteschlangen zeigen ausschließlich die gewählte Stadt. Weltkarte zeigt sämtliche eigenen Städte und zentriert/ermittelt Entfernungen relativ zur ausgewählten Ausgangsstadt.

Stadtauswahl ist Ansichtszustand, keine globale Servervariable, die Aktionen anderer Tabs umlenkt. Auswahl pro Tab speichern; nach Reconnect vorhandene Auswahl wiederherstellen, andernfalls erste eigene Stadt. Jeder stadtbezogene Befehl und jede Vorschau enthält cityId. Server prüft Besitz und Gültigkeit. Kein stiller Fallback auf eine andere Stadt bei ungültiger ID.

Verspätete Antworten/Events für Stadt A dürfen nach Wechsel zu B nicht deren Anzeige überschreiben. Ereignisse mit cityId und vorhandenen Revisionen eindeutig zuordnen. Laufende Missionen speichern originCityId und kehren immer dorthin zurück, unabhängig von aktueller Ansicht.

Truppen bleiben stadtgebunden. Ein Stadtwechsel versetzt keine Armee. Keine Stadt-zu-Stadt-Truppenverlegung in diesem Auftrag. Spielerweite Generalsverwaltung und Postbox dürfen Stadtbezüge anzeigen, aber keine Duplikate erzeugen.

## 3. Freie Felder und variable Verteidiger

„Frei“ bedeutet ohne Stadt oder bestehende Reservierung, nicht unverteidigt. Nicht-Wasser-Terrain innerhalb der Welt ist grundsätzlich gründbar. NPC-Städte, Spielerstädte und reservierte Felder nicht als freie Ziele akzeptieren.

Karte bleibt vollständig sichtbar. Öffentliche Daten dürfen Terrain, freie/belegte Felder, Städte und Reservierungsstatus zeigen, aber keine exakten Verteidigerzahlen oder verborgene Schwierigkeitswerte.

Verteidigung serverseitig je Feldzustand erzeugen und dauerhaft speichern, spätestens bei erster relevanter Erkundung. Vorläufig 5–30 Infanterie-Verteidiger, ganze Anzahl, über validierte ENV-Min/Max konfigurierbar. Feldwerte variieren zwischen Koordinaten und sind für alle Spieler derselben Welt identisch. Kein neues Würfeln beim Öffnen, wiederholten Aufklären, Angriff oder Neustart. Keine öffentliche Zufallsgrundlage, aus der der Client exakte Verteidiger errechnen kann.

Feld besitzt stabile Identität aus Instanz/Koordinate sowie eine Zustandsrevision. Freie Felder nicht als plünderbare NPC-Städte anlegen. Keine Ressourcenbeute bei ihrer Eroberung.

## 4. Aufklärung als Voraussetzung

Bestehenden Scout-Ablauf um freie Felder erweitern: eigene Späher und freier General, normale Reisezeit, positives Öl, Tankgrenze aus Auftrag 14, kein Reiseunterhalt. Keine kostenlose sofortige Aufklärung beim Anklicken.

Erfolgreicher Bericht enthält Zielkoordinate, genaue beobachtete Verteidigung, Zeitpunkt und Feldrevision. Vorläufig erst nach Rückkehr der Späher zum Spieler freigeben und für Eroberung verwendbar machen. Der Bericht gilt spielerweit, sodass eine andere eigene Stadt einen Angriff starten darf.

Eroberungsstart erfordert einen eigenen abgeschlossenen Bericht für genau das noch freie Feld und dessen aktuelle Revision. Fremde/gefälschte Berichts-IDs ablehnen. Bei geänderter Revision vor Start erneut aufklären lassen. Keine Zeitablaufpflicht für einen weiterhin unveränderten Zustand hinzufügen.

Nach Abfahrt können andere Spieler das Feld verändern. Angriff bei Ankunft gegen dann vorhandene Verteidiger auflösen, sofern noch frei; alte Aufklärung garantiert keinen unveränderten Kampf. Wenn inzwischen Stadt/reserviert: kein PvP, keine Doppelbelegung, normaler Rückweg mit verständlichem Bericht.

Neue freie-Feld-Aufklärung gewährt vorläufig keine XP. Bestehende NPC-Aufklärungsbelohnungen bleiben unverändert; neue Erkundungen dürfen keine unbegrenzte XP-Quelle eröffnen.

## 5. Eroberungsmission und Stadtplatz-Reservierung

Neuer Missionstyp mit eigener Regelversion, bestehende Kampf-/General-/Traglast-/Öllogik wiederverwenden. Mindestens ein Infanterist, optionale LKWs und eigener freier General. Verzögerung darf dieselben Grenzen und proportionalen Ölregeln wie Raids nutzen. Eigene Ressourcenladung bleibt möglich und kehrt nach bestehenden Verlust-/Lagerregeln zurück; sie wird nicht zur Gründungsgebühr.

Vorläufig höchstens eine laufende Eroberung oder ungenutzte Feldreservierung pro Spieler. Beim Start einen seiner maximal fünf Stadtplätze reservieren:
bestehende Städte + aktive Eroberungs-/Gründungsreservierungen <= 5.
Start, Siegerermittlung und Gründung jeweils erneut prüfen. Kein sechster Stadtplatz durch mehrere Tabs oder parallele Requests. Ein laufender Angriff reserviert nur den persönlichen Stadtplatz, nicht exklusiv das Weltfeld; andere Spieler dürfen dasselbe freie Feld angreifen.

Bei Ankunft:
- Noch freies Ziel: vorhandenen Kampfalgorithmus gegen aktuelle Feldverteidigung anwenden.
- Überlebende Verteidiger nach Niederlage dauerhaft speichern und Revision erhöhen. Vorläufig keine zeitliche Regeneration freier Feldverteidiger; NPC-Regeneration bleibt unverändert.
- Erfolgreiche Eroberung nur bei besiegter Verteidigung und mindestens einem überlebenden Infanteristen. Gleichzeitige Vernichtung ergibt keinen Anspruch.
- Sieg erzeugt genau einen exklusiven Feldanspruch des Spielers mit Ablaufzeit, gebunden an Ausgangsstadt und persönliche Platzreservierung.
- Verluste, Rückwegöl, eigene Ladung und normale Rückkehr gemäß Auftrag 14. Keine Beute; XP/Kampfpunkte nur nach bestehenden Regeln für tatsächlich besiegte Gegner/eigene Verluste, keine zusätzliche Eroberungsprämie.
- Niederlage oder inzwischen ungültiges Ziel gibt persönlichen Stadtplatz frei. LKWs/Infanterie/General kehren nach bestehenden Regeln zurück.

Gleichzeitige Ankünfte in stabiler Reihenfolge (Zeit, dann Missions-ID) unter Weltqueue verarbeiten. Nur erster berechtigter Sieger erhält den Anspruch. Verlierende Konkurrenzmission greift keinen Spieleranspruch an und erhält keine Kampfbelohnung ohne Kampf.

Vorläufiger Feldanspruch: 24 Stunden ab Sieg, ENV CITY_CLAIM_TTL_HOURS=24. Sofortige Gründung nach Sieg ist möglich; die Armee fährt dennoch in ihre Ausgangsstadt zurück und wird nicht teleportiert.

Anspruch nur vom Eigentümer nutzbar, nicht übertragbar. Bei Ablauf ohne Gründung Feld und persönlichen Platz freigeben. Verteidigung auf das gespeicherte ursprüngliche Feldkontingent zurücksetzen, Revision erhöhen, alte Aufklärung ungültig machen. Neue Verteidigerzahlen dabei nicht erneut würfeln. Kein manuelles Stadtaufgeben oder Anspruchshandel in dieser Stufe.

## 6. Stadtgründung gegen Gebühr

Eigener aktiver Feldanspruch zeigt Aktion „Stadt gründen“, Namensfeld und verbindliche serverseitige Kostenübersicht. Gebühr vorläufig:
- Basis je 500 Holz, 500 Stein, 500 Nahrung, kein zusätzliches Gründungsöl.
- Für die neue Stadt Nummer n (2 bis 5): je Basis × (n−1).
- Damit je Ressource 500/1000/1500/2000 für zweite/dritte/vierte/fünfte Stadt.
- Basiswerte als validierte ENV-Parameter dokumentieren. Grenze von fünf Städten ist verbindlich und nicht durch ENV erhöhbar.

Gebühr aus der beim Eroberungsstart gespeicherten Ausgangsstadt abbuchen; nicht aus zusammengerechneten Stadtbeständen. Reiseöl wurde separat bezahlt. Ist Bestand unzureichend, Anspruch bis Ablauf erhalten und keine Teilzahlung ausführen. Kostenquote mit Regelversion/Anspruch/aktueller Stadtanzahl binden, bei Änderung neue Vorschau verlangen.

Gründung atomar: Anspruch prüfen/verbrauchend entfernen, Gebühren abbuchen, neue stabile cityId erzeugen, Weltfeld in Stadt umwandeln, Stadtsammlung und öffentliche Karte aktualisieren. Nur einmal je requestId/Anspruch. Bei abgelaufenem Anspruch oder fünfter bereits vorhandener Stadt ohne Zahlung ablehnen. Bei exakter Ablaufzeit gewinnt Ablauf (now >= expiresAt).

Neue Stadt als vorläufiges Startpaket:
- Eigene Standard-Bauplätze, getrennt zivil/militärisch.
- Je ein Sägewerk, Steinbruch und Bauernhof auf Stufe 1.
- Ressourcen anfangs 0; normale Produktion beginnt ab Gründungszeit.
- Keine Gratisarmee, kein neuer General, keine zusätzliche Bewerberauswahl oder Forschung.
- Bestehende globale Forschungswirkungen berücksichtigen; lokale Gebäudevoraussetzungen weiter prüfen.
So kann die Stadt ohne bereits implementierte Lieferungen selbstständig anlaufen. Erste vorhandene Stadt/Neuspieler-Startpaket nicht rückwirkend verändern.

Stadtnamen serverseitig trimmen/validieren, 1–40 Unicode-Codepoints, keine Steuerzeichen; als Text sicher rendern. Gleiche Namen sind erlaubt, cityId ist maßgeblich.

## 7. Persistenz, Migration und Konkurrenz

Spieler-/Weltschemata jeweils auf nächste freie Version erhöhen. Altspieler erhält seine bestehende Stadt mit stabiler ID und unveränderten Koordinaten, Gebäuden, Ressourcen, Truppen und Queues. Laufende alte Missionen bekommen eindeutig diese originCityId; Fracht, Termine, bereits bezahltes Öl und historische Regeln nicht neu berechnen.

Generäle/Forschung/Postbox/Bewerber nicht vervielfachen. Alten Bürgermeister der bisherigen Stadt zuordnen. Alte Forschungsqueue bindet die bisherige Stadt. Historische Berichte weiter darstellen. Migration idempotent und mit Testfixtures absichern; kompatible Ansichtsadapter sind erlaubt, doppelte autoritative Stadtbestände nicht.

Weltregister muss mehrere Städte desselben Spielers unterstützen. Spielerregistrierung/zufällige Platzierung müssen Ansprüche respektieren. Stabile cityId zusätzlich zur playerId verwenden; playerId allein bezeichnet keinen Zielort mehr. Alte NPC-IDs erhalten.

Weltqueue und bestehendes Recovery-Journal nutzen. Feldverteidigung, Kampfergebnis, Anspruch, Spielerplatz, Gebühren und neue Stadt jeweils in ihren zusammengehörigen Zustandsübergängen atomar buchen. Nach Crash keine doppelte Stadt, Zahlung, XP, Armee oder Anspruch.

Offlineereignisse aller Städte und Missionen chronologisch mit stabiler Gleichstandsregel abarbeiten. Inaktive Städte produzieren/verbrauchen nicht abhängig von Ansicht oder Login-Reihenfolge. Globale Forschung zu ihrem tatsächlichen Abschlusszeitpunkt wirksam machen, nicht rückwirkend für einen ganzen Offlinezeitraum. Feldanspruch-Ablauf und Gründungsbefehl unter derselben Zeit-/Queue-Ordnung verarbeiten.

## 8. Oberfläche und WebSocket-Verträge

Spielkommunikation weiter vollständig über vorhandene WebSocket-Konventionen; keine zweite REST-Spiel-API.

- Stadtwähler und Übersicht bis fünf Städte, lokale Bestände und Baustatus.
- Freies Feld: „Aufklären“; ohne Bericht unbekannte Verteidiger.
- Nach eigenem Bericht: Verteidigerzahl, Berichtszeit, Zustand und „Erobern“, soweit Voraussetzungen erfüllt.
- Eigener Anspruch: verbleibende Zeit, Gründungskosten, Ausgangsstadt für Zahlung und Aktion „Stadt gründen“.
- Missionen/Berichte zeigen Ausgangsstadt, Zielkoordinaten und Ergebnisse.
- Nach Gründung neue Stadt auswählbar, kein ungefragtes Umleiten anderer Tabs.
- Ablehnungen verständlich: fünfte Stadt, laufender Anspruch/Eroberungszug, fehlende Aufklärung, ungültiger Bericht, besetztes Feld, fehlende Einheiten/Öl/Gebühr, abgelaufener Anspruch.
- Öffentliche Kartendaten verraten keine versteckte Verteidigung, privaten Bestände oder Generalskills. Besitzprüfungen für alle cityIds und claims serverseitig.

## 9. Tests, Dokumentation und Abnahme

Gezielt testen:
1. Migration einer bestehenden Stadt einschließlich Bürgermeister, Forschung, Frachtmissionen, Produktion und Hungerstand; wiederholte Migration ohne Duplikate.
2. Stadtwechsel zwischen mindestens zwei Städten, getrennte Lager/Queues/Truppen, parallele Tabs und verspätete Events ohne Fehlbuchung.
3. Offlinefortschritt sämtlicher Städte, spielerweite Forschung nur einmal und zeitlich korrekt, lokale Bürgermeister-/Unterhaltswirkung.
4. Unbekannte/fremde cityId, gefälschter Bericht/Anspruch, manipulierte Kosten und General-Doppelbelegung abgelehnt.
5. Variable persistierte Feldverteidigung; gleicher Stand für verschiedene Spieler, keine Änderung durch Neustart oder erneute Aufklärung.
6. Eroberung ohne abgeschlossene eigene Aufklärung abgelehnt; geänderte Revision verlangt vor Start neue Erkundung.
7. Sieg, Niederlage, gegenseitige Vernichtung, Überlebendenrückkehr, Öl-/Ladungsbilanz und keine Feldbeute.
8. Zwei Spieler am selben Feld, zwei Startbefehle desselben Spielers und Konkurrenz zur Neuspielerplatzierung ohne Doppelbesitz.
9. Anspruchsablauf inklusive exakter Grenze, Rücksetzung gespeicherter Verteidiger, veralteter Bericht und wieder freier Stadtplatz.
10. Gründung mit ausreichender/fehlender Gebühr, sichere Namensbehandlung und selbstständig produzierendem Startpaket.
11. Von einer bis genau fünf Städte; sechste Stadt sowie sechster reservierter Platz auch parallel unmöglich.
12. Crash-Injektion an Journal-/Dateischreibgrenzen für Sieg und Gründung, doppelte requestId, Reconnect: weder doppelte Zahlung noch Stadt/XP/Truppen.
13. Bestehende NPC-Aufklärung, Raids, Forschung, Bewerber, Postbox und Punkte regressionsfrei.

Build und bestehende Tests ausführen. UI-Ablauf Aufklären → Bericht → Erobern → Anspruch → Gründung → Stadtwechsel mit getrennten Beständen tatsächlich prüfen, auch mobil/Tastatur. Ergebnisse mit ausgeführten Befehlen in docs/MULTICITY_VALIDATION.md dokumentieren; keine ungetesteten Erfolge behaupten.

README, docs/PROJECT.md, docs/WEBSOCKET.md und .env.example aktualisieren. Auftrag 14 abgeschlossen erhalten, Auftrag 15 nach tatsächlicher Implementierung markieren. Ressourcenlieferungen als Auftrag 16 planen, einschließlich eigener und fremder Städte und expliziter Ausgangs-/Ziel-cityIds.

Abnahme: Bis fünf Städte sind unabhängig spielbar; neue Städte ausschließlich nach eigener Aufklärung, erfolgreicher Eroberung und Gebührenzahlung; Daten bleiben bei Stadtwechsel, Parallelzugriff und Neustart konsistent.
