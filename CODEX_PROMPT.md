# Codex-Auftrag 16: Lieferungen, dauerhafte Verlegung und UI-Redesign

## Auftrag und Arbeitsweise

Der Nutzer bestätigt Auftrag 15 als abgeschlossen. Neue verbindliche Anforderungen vom 12.10.2026:
- Ressourcen transportieren darf ohne General erfolgen.
- Truppen und Generäle von einer eigenen Stadt in eine andere eigene Stadt transferieren; nach Ankunft gehören sie zum dortigen Stadtbestand.
- Oberfläche und Seitenleisten neu ordnen, damit Navigation und Aktionen klar erkennbar und ohne langes Scrollen erreichbar sind.

Implementiere Auftrag 16 in drei zusammenhängenden Teilen: Ressourcenlieferungen, dauerhafte Stadtverlegung, UI-Konzept aus docs/UI_CONCEPT_16.md. Dieses Dokument ist der aktuelle Arbeitsauftrag, alte Generalpflicht für Lieferungen ist aufgehoben.

Lies AGENTS.md, README und vorhandene Projekt-/WebSocket-/Entwicklungsdokumentation. Prüfe aktuellen main und offene Änderungen; erhalte fremde Arbeit. Liefere einen getesteten PR ohne automatisches Merge/Deployment. Der Planungschat hat nur Quellen statisch gelesen und keine Anwendungstests ausgeführt.

Gelesene Basis: Spielerschema16, Weltschema4, cities als kanonischer Bestand, stadtbezogene Armeen/Versorgung und gemeinsamer Generalpool. multicity.js enthält Ansichtsadapter; App.jsx, SidebarStatus.jsx und SidebarActions.jsx derzeit lange rechte Aktivitäten vor Aktionsportal. Vor Änderungen aktuellen Stand prüfen. Zahlen/Detailregeln ausdrücklich als vorläufige Projektentscheidungen behandeln.

## 1. Zwei klar getrennte Reisearten

| Modus | Ziel | Einheiten | Generäle | Ende |
| --- | --- | --- | --- | --- |
| Ressourcen liefern | Andere eigene oder fremde Stadt derselben Welt | Mindestens ein LKW | Optional einer, nie Voraussetzung | Zustellung, normale Rückfahrt zur Ausgangsstadt |
| Truppen & Generäle verlegen | Andere eigene Stadt derselben Welt | Beliebige zulässige stationierte Infanterie/Späher/LKWs, auch ohne General | Optional mehrere; auch General-Verlegung ohne Truppen zulassen | Stationierung im Ziel, keine Rückfahrt |

Identische Ausgangs-/Ziel-cityId, NPCs und unbekannte/fremdinstanzliche Ziele ablehnen. Eigentümer aus Sitzung bestimmen. Verlegung an fremde Spieler bleibt für spätere Bündnis-Unterstützung; keine Besitzübertragung in diesem Auftrag.

Jede Vorschau/Startaktion nennt originCityId und targetCityId. Aktuelle Ansicht ist kein autoritativer Missionsparameter. Lieferung und Verlegung erhalten separate Missionstypen, Regeln und Abschlusszustände; bestehende scout/raid/conquest-Rückkehrlogik nicht versehentlich auf neue Typen anwenden.

## 2. Ressourcen liefern, General optional

- Mindestens ein verfügbarer LKW, positive freiwillige Ladung aus Holz/Stein/Nahrung/Öl.
- Kein General gewählt: gültiger Standardfall. Kein Fallback auf Startgeneral, keine versteckte Generalreservierung.
- Optionaler General muss frei und in Ausgangsstadt stationiert sein. Begleitet Lieferung und kommt mit LKWs zurück; kein Bonus, keine XP/Punkte.
- Exakte Preis-, Zeit-, Öl- und Kapazitätsfunktionen aus Auftrag14 wiederverwenden.
- Bei E als exaktem Einwegölbedarf: Gesamtbetriebsöl F=ceil(2E), Hinwegverbrauch F−E, Rückwegreserve E. Ladung + F muss in LKW-Traglast passen.
- Freiwilliges Öl getrennt von Betriebsöl. Nur freiwilliges Öl zustellen.
- Kosten/Ladung einmalig aus Ausgangsstadt abbuchen; LKWs und optionalen General atomar reservieren.
- Keine Stadtnahrung für reisende LKWs. Nach Rückkehr Unterhalt wieder in Ausgangsstadt.
- Keine Zusatzverzögerung für Lieferungen in dieser Stufe; nicht-null Eingabe serverseitig ablehnen.
- Ziel bei tatsächlicher Ankunft fortschreiben, dann pro Ressource min(Ladung, floor(max(0, Kapazität−Bestand))) zustellen.
- Nicht passende Güter fahren automatisch zurück, ohne Vernichtung am Ziel oder Warten auf Lagerplatz.
- Ziel inzwischen nicht existent oder anderer Empfänger als gespeichert: gesamte Ladung normal zurück. Technische Speicherfehler recovern, nicht als Zielverlust ausgeben.
- Heimatüberlauf nach bestehenden Regeln verwerfen und berichten. Kein Betriebsöl einlagern; nach Rückfahrt exakt0.
- Direkte unentgeltliche Lieferung, kein Gegenhandel/Annahmezwang, kein Rückruf/Ändern nach Start.

Beispiel bei Defaultwerten: 5 LKW×200=1000 Traglast; Distanz10×5×1=50 Öl je Weg,100 gesamt. Maximal900 Güter. 600 Holz/300 Nahrung bei Zielplatz250 Holz/200 Nahrung: 250/200 zugestellt,350/100 zurück. Öl100 insgesamt verbrannt. General nicht erforderlich.

## 3. Dauerhafte Einheitenverlegung

- Auswahl aus tatsächlich stationierten eigenen Einheiten der Ausgangsstadt. Infanterie, Späher und LKWs bleiben dieselben Identitäten/Mengen; keine Herstellung/Gratisarmee.
- Mindestens eine Einheit oder ein General auswählen. Keine Infanteriepflicht und kein Generalzwang.
- Normale einfache Reisezeit, keine Zusatzverzögerung und keine Kämpfe/Überfälle.
- Beim Start Einheiten aus Ausgangsstadt entfernen; unterwegs nur im Missionsbestand führen.
- Vorläufig kein zusätzlicher Ressourcenfrachtmodus bei Verlegung: Ressourcenlieferung ist die separate Hin-/Rückfahrt. Betriebsöl bleibt zwingend mitgeführt. Vorhandene frei wählbare Ladung bei NPC-Einsätzen bleibt erhalten.
- Alle Einheitentypen verbrauchen ihre bestehenden positiven Ölraten auf der einfachen Strecke.
- Einwegöl F_one=ceil(E), einmalig aus Ausgangsstadt. Einweg-Rundungsrest wird bis Ankunft verbrannt. Keine Rückwegzahlung.
- Betriebsöl-Kapazität mit vorhandenen Regeln prüfen. Spähertanks nur für ihren Anteil nutzbar, kein Güterraum. Für gemischte Truppen Späher-Einwegöl auf ihre Tanks, Infanterie-/LKW-Einwegöl auf gemeinsamen normalen Frachtraum verteilen; Rundungsrest deterministisch einer teilnehmenden Gruppe zuteilen, erforderlichenfalls exakte ganzzahlige Teilbudgets mit Gesamt ceil(E) berechnen. Keine doppelte Rundung und kein genereller Nullraumfehler für reine Späherverlegung.
- Kein städtischer Nahrungsunterhalt unterwegs.
- Bei Ankunft Ziel bis zu diesem Zeitpunkt fortschreiben, Einheiten einmalig dem stationierten Bestand hinzufügen, Mission beenden.
- Ab Ankunft gilt Nahrungsunterhalt der Zielstadt. Schlechte Zielversorgung warnen, aber kein kostenloses Unterhalts-Aussetzen oder neue Ablehnung erfinden. Bestehende Schonfrist/Hungerregeln verwenden.
- Gesamtmenge eines Einheitentyps über alle Städte plus laufende Missionen bleibt durch Transfer erhalten. Keine Truppen in Quelle und Ziel gleichzeitig zählen.
- Einwegziel ist andere eigene Stadt und bleibt für diese Reise reserviert als gültiger Bestand; vorhandene fehlende Stadtaufgabe/Spielerstadteroberung nicht neu einführen. Jede künftige Löschung muss laufende Transfers respektieren. Bei inkonsistenten fehlenden Zielzuständen Verarbeitung mit Fehler/recovery stoppen, keine kostenlose Rückreise oder Vernichtung erfinden.

Beispiel: 10 Infanteristen,5 Felder,Ölrate0,1 → E=5, einmalige Zahlung5 Öl, Hinreise und Stationierung. Ausgangsbestand−10, Zielbestand+10 ab Ankunft; kein Rückweg.

## 4. Generäle bekommen einen tatsächlichen Standort

Generäle bleiben spielerweit einzigartig verwaltet, erhalten aber stationierte cityId bzw. eindeutigen Transitstatus. Kein Kopieren des Pools pro Stadt. Die Verwaltungsregel aus Auftrag15, freie Generäle ohne Reise jeder Stadt zuzuordnen, wird für neue Aktionen durch echten Stadtstandort ersetzt.

- In der Generalübersicht alle Generäle mit Standort/Rolle/Reise anzeigen.
- Rekrutierung erzeugt General in der bezahlenden Stadt.
- Kampfeinsatz, Bürgermeister- und Forschungsleiterzuweisung erfordern Standort in der entsprechenden Ausgangs-/Universitätsstadt.
- Namens-/Skillverwaltung darf spielerweit bleiben; Einsatz und Rollen sind ortsgebunden.
- Bürgermeister/Forschungsleiter vor Verlegung ausdrücklich freigeben. Aktive Mission, Lieferbegleitung oder Transit sperrt neuen Einsatz/Verlegung.
- Mehrere freie stationierte Generäle gemeinsam auswählen. Doppelte IDs, fremde/anderswo stationierte Generäle ablehnen.
- Beim Start reservieren, in transit kennzeichnen; erst bei Ankunft Ziel-cityId setzen und idle. Keine automatische Bürgermeister-/Forschungsrolle am Ziel.
- Lieferung mit General behält dessen Standortbezug zur Ausgangsstadt und gibt ihn erst bei Heimkehr frei.
- Bei gemischter Truppen-/Generalverlegung reisen Generäle als Begleiter ohne zusätzlichen Ölposten; Einheiten zahlen ihre bestehenden Raten. General ist keine zusätzliche kämpfende Einheit.
- General-only-Verlegung muss möglich sein, ohne zwangsweise einen tatsächlichen LKW zu verlegen.

Vorläufige Regel für General-only-Reise: abstrakter Diensttransport, kein neuer trainierbarer Einheitentyp. Je General positive Ölrate0,1 pro Feld, reine Betriebsöltankkapazität20. ENV GENERAL_TRANSFER_OIL_PER_FIELD und GENERAL_TRANSFER_FUEL_CAPACITY validieren, snapshotten und dokumentieren. Exakte Einweg-Gesamtzahlung ceil(d×Generalsanzahl×Rate) muss in Gesamt-Tanks passen; normale Reisezeit. Keine Güter-/Beutetraglast oder Kampfkraft. So ist auch eine reine Generalreise zeitlich/ölpflichtig, ohne kostenloses Teleportieren.

Diese Zusatzwerte sind Projekt-Balancevorschläge. Bestehende tatsächliche Bewegungsölsätze nicht ersetzen.

## 5. Exakte Buchung, Offlinechronologie und Berichte

Gemeinsame Weltqueue und Recovery-Journal verwenden. Senderladung, Empfängergutschrift und Missionsfortschritt atomar buchen; Einzeldatei-Rename allein genügt nicht. Bei Transfers innerhalb eines Spielers alle betroffenen Städte gemeinsam aus einer kanonischen Spielerkopie ändern, nicht zwei veraltete Ansichten nacheinander überschreiben.

Stabile IDs, requestId und versionierte Regelsnapshots. Gleiche ID/gleicher Inhalt liefert dasselbe Ergebnis, abweichender Inhalt mit gleicher ID wird abgelehnt. Ankunft/Rückkehr/Stationierung und Postboxeinträge mit persistierten Markern deduplizieren.

Ressourcenlieferung pro Ressource:
Startladung = zugestellt + unterwegs + zuhause wieder eingelagert + Heimatüberlauf.
Betriebsöl separat: geladen = verbrannt + verbleibend (hier keine neuen Reiseverluste).
Transfers: Ausgangsabbuchung und Zielzugang genau einmal, General-ID bleibt einzigartig.

Offlineereignisse nach Zeitpunkt und stabiler Gleichstandsregel abarbeiten. Nahrungslieferung kann erst ab ihrer Ankunft spätere Hungerereignisse beeinflussen; Einheitenverlegung beeinflusst Zielunterhalt erst ab Ankunft. Nicht zuerst Ziel bis jetzt rechnen und dann rückwirkend zustellen. Ergebnis unabhängig von Login-Reihenfolge, Auswahl und Neustart.

Empfänger einer Fremdlieferung sieht angekündigte Ladung, Absender und Ankunft sowie später tatsächlich erhaltene Ressourcen. Keine privaten Bestände, Lagerausbauten oder Generalfähigkeiten in Vorschau/öffentlichen Welt-Events. Eigene Zielstadt darf normale eigene Bestände/Versorgungsprognose anzeigen. Unbeteiligte erhalten keine privaten Bewegungsdetails.

Absenderbericht trennt geladen/zugestellt/zurückgeführt/Heimatüberlauf und Ölverbrauch. Transferbericht nennt Einheiten/Generäle, Quell-/Zielstadt und Stationierungszeit; keine „Rückkehr“ für Einwegtransfer. Eigene Lieferungen erzeugen einen zusammengefassten Postboxbericht, keine identischen Sender-/Empfängerduplikate. Fremdlieferungen je einen passenden Bericht für beide Spieler. Keine XP/Skill-/Kommandantenpunkte durch Lieferung oder Verlegung.

## 6. UI-Konzept verbindlich umsetzen

docs/UI_CONCEPT_16.md enthält Layout, Navigationspunkte, responsive Verhalten und überprüfbare Abnahme. Zusammen mit Logistik implementieren, nicht nur als Entwurf ablegen.

- Links klar erkennbare Hauptnavigation mit Stadt, Weltkarte, Militär, Logistik, Generäle, Forschung und Postbox.
- Kompakter Stadtkopf mit Stadtwahl, Kapazitäten und Ressourcen.
- Rechts Kontextpanel: Aktionen zuerst; Aktivitäten und Versorgung über eigene Tabs.
- Lange Statuslisten nicht vor die primären Aktionen stellen.
- Auf Mobilgeräten sichtbare Menü-/Aktionsbuttons und Drawer/Modal statt langer Sidebar unter dem Inhalt.
- Ressourcen liefern und dauerhaft verlegen als unterschiedliche Modi mit klaren Texten.
- Ohne General muss Lieferung sichtbar auswählbar/startbar sein.
- Alle bisherigen Funktionen behalten; bestehende Illustrationen/Modals/Transport weiterverwenden.
- Stadtwechsel, mehrere Tabs, veraltete Vorschauen und verspätete Ereignisse korrekt auf cityIds beziehen.

Spielbefehle/Updates ausschließlich über bestehende WebSocket-Konventionen; keine zweite REST-Spiel-API/Polling. Neue Events und Datenschutzprojektionen dokumentieren.

## 7. Migration und Umsetzungsschritte

In sinnvoller Reihenfolge:
1. Gemeinsamer Logistikkern mit Richtung/Leganzahl; standortbezogene Generalmigration und Endzustände.
2. Liefer-/Verlegebefehle, atomare Speicherung und Offlinechronologie.
3. UI-Rahmen/Navigation, neue Logistikformulare, Kontextpanel.
4. Integration, Regression, Dokumentation und PR.

Ausgangsschema16; nächste freie Spielerschema-/Regelversion nutzen. Altdaten-Standorte eindeutig rekonstruieren:
- Bürgermeister → zugewiesene Stadt.
- Aktiver Forschungsleiter → Stadt der laufenden Forschung; ohne aktiven Job bestehende belegte Forschungsleitung erhalten und an dafür gültige Universitätsstadt binden bzw. wenn unklar ohne Kosten/Verlust freigeben und sichtbar neu zuweisen lassen.
- General in alter laufender Mission → gespeicherte originCityId, nach bisherigem Ende dort verfügbar.
- Sonstige freie Generäle → ursprüngliche erste Stadt, einmalig.
Alte Missionen mit historischer Generalnutzung unverändert beenden. Keine neue Reise/Ölrechnung rückwirkend. Neue ortsgebundene Regeln nur für neue Aktionen. Nicht eindeutig zuordenbare Daten nicht erraten/wegwerfen; kontrollierte Migrationsmeldung/Testfixture vorsehen.

Generäle, Bewerberkosten, Forschung, Porträts, Punkte, fünf-Städte-Grenze, Feldverteidigung/Ansprüche und Postbox bewahren. Bestehende cityView/exposeCity-Adapter auf beide Transferstädte prüfen, keine doppelten autoritativen Bestände.

README, docs/PROJECT.md, docs/WEBSOCKET.md und erforderliche ENV-/Entwicklungsdokumentation aktualisieren. Tatsächliche Tests und Screenshots in docs/LOGISTICS_UI_VALIDATION.md beschreiben.

## 8. Abnahme und gezielte Tests

- Generalfreie Lieferung erfolgreich; alle Generäle anderweitig gebunden blockiert sie nicht. Optionaler General korrekt reserviert/heimgekehrt.
- Voll-/Teil-/Nullannahme aller vier Ressourcen, freiwilliges Öl bleibt Fracht, Betriebsöl vollständig verbrannt.
- Eigene und fremde Stadt als Lieferziel, ungültige/fremdinstanzliche Ziele abgelehnt.
- Verlegung ohne General, mehrere Generäle gemeinsam, reine Generalreise und reine Späherreise mit korrekten Tank-/Ölgrenzen.
- Einwegöl nur einmal, kein versehentlicher Rückweg; Einheiten/Generäle genau einmal im Ziel.
- Standort verhindert Einsatz/Role in falscher Stadt; gebundene Generäle und doppelte IDs abgelehnt.
- Quellenunterhalt bis Abfahrt, kein Reiseunterhalt, Zielunterhalt ab Ankunft; Offline-Nahrung und Hungerfolge chronologisch korrekt.
- Zwei Lieferungen an volles Ziel, parallele eigene Stadtactions und stale Stadtansichten ohne Überfüllung/Überschreiben.
- Crash an Journal-/Spielerdatei-/Commitgrenzen, doppelte Requests/Ankunft/Stationierung/Berichte ohne doppelte Buchungen.
- Migration von Schema16 mit Bürgermeistern, Forschungsleitung und alten Missionen; keine neuen Generalduplikate oder Rückrechnungen.
- Keine Transfer-XP/Punkte und keine Privatdatenlecks.
- Browser: Desktop1366×768, Mobil390×844 und320 px, 200% Zoom, Tastatur/Fokus, lange Namen; Hauptnavigation und primäre Aktion direkt erreichbar.
- Reale Abläufe: Stadtwechsel/Gebäude, Feldaktionen, Lieferung ohne General, Truppen-/Generalverlegung, Forschung, Skills, Postbox.
- Bestehende NPC-/Eroberungs-/Versorgungs-/Forschungs-/Postbox-Tests und Build weiterhin erfolgreich.

Nur tatsächlich ausgeführte Prüfungen als bestanden dokumentieren. Abgenommen: direkte generalfreie Versorgung, dauerhafte stationierte Zielbestände und aufgeräumte direkt bedienbare Navigation funktionieren mit Reconnect/Neustart.

## Danach

Bündnisse und Unterstützung in fremden Städten gesondert spezifizieren; danach verbindlicher Tauschhandel. Weitere Forschung/Militärtechnik und spätere Luft-/Raketenphase sowie Matrix-Föderation bleiben Folgeaufträge.
