# Codex-Auftrag 4: Kommandantenpunkte, erste Armeen und NPC-Aufklärung

## Auftrag und Arbeitsweise

Arbeite im Repository bavxhack/War2glory vom aktuellen main aus. Lies AGENTS.md, README.md, docs/PROJECT.md, docs/WEBSOCKET.md und docs/FEDERATION.md; prüfe vorhandene Änderungen und offene Pull Requests. Bewahre fremde Arbeit.

Der Planungschat erstellt nur Anweisungen. Du, Codex, implementierst diesen Auftrag, prüfst ihn und öffnest einen Pull Request. Dieser Auftrag ersetzt Auftrag 3. Die Weltkarte wird nicht erneut gebaut.

Ziel ist ein erster vollständiger Ablauf:
eigene Punkte sehen → Kaserne bauen → Späher ausbilden → General zuweisen → NPC-Stadt aufklären → Hin- und Rückmarsch verfolgen → privaten Bericht erhalten → denselben Fortschritt nach erneutem Login vorfinden.

Implementiere die Abschnitte A bis D in überprüfbaren Schritten innerhalb dieses Auftrags. Die danach beschriebenen weiteren Etappen sind Ausblick, nicht automatisch mit umzusetzen.

## Ausgangspunkt und feste Anforderungen

Laut aktuellem Repository bestehen Konten mit eigenen JSON-Spielständen, eine Stadt mit neun Bauplätzen und Bauwarteschlange sowie eine gemeinsame quadratische Weltkarte mit NPC-Städten. Gelände und Stadtpositionen sind von Anfang an sichtbar. Genaue NPC- und fremde Spielerinformationen sind nicht öffentlich. Die NPCs gehören gemeinsam zur Welt, nicht einzelnen Spielern.

Der vorhandene WebSocket-Endpunkt ist laut docs/WEBSOCKET.md /game mit einem versionierten Ereignisformat aus version, type, requestId und payload. world.json enthält unter anderem Karte, NPCs und Stadtpositionen; accounts.json und Spielerdateien ergänzen die Ablage. Überprüfe diese Angaben im Code. Erhalte Protokollkonventionen, Anmeldung, Host-/Origin-Prüfungen, Deduplizierung und Zugriffsrechte.

Es gibt noch keinen bestätigten vollständigen Originalregelsatz. Die folgenden Testregeln sind Arbeitsvorschläge des Planungschats für einen spielbaren, überprüfbaren Prototyp und keine vom Nutzer einzeln bestätigten Balancewerte. Halte sie zentral konfigurierbar und dokumentiere sie im Pull Request. Sie werden nicht als endgültige Spielregeln ausgegeben. Behalte bestehende Werte, soweit sie nicht ausdrücklich betroffen sind.

## A. Kommandantenpunkte zuerst

- Führe eine serverseitige Punktewertung je Kommandant und Serverwelt ein, getrennt von General-Erfahrung.
- Zeige dem Eigentümer Gesamtpunkte und Teilbereiche: Gebäude, Forschung, Kampf einschließlich Niederlageneinfluss.
- Vorläufige Gebäudewertung für diesen Prototyp: 10 Punkte je fertiggestellter Gebäudestufe. Die Summe aller vorhandenen Gebäudelevel wird mit 10 multipliziert. Beispiel: drei Gebäude auf Stufe 1 ergeben 30 Punkte; ein Upgrade eines davon auf Stufe 2 ergibt insgesamt 40 Punkte.
- Geplante oder laufende Bauaufträge zählen erst ab Fertigstellung. Die neue Kaserne zählt nach derselben Regel.
- Gebäudepunkte werden aus dem aktuellen Gebäudebestand abgeleitet. Ein späterer Abriss entfernt den zugehörigen Beitrag; Wiederaufbauen darf keinen dauerhaften Zusatzgewinn erzeugen.
- Forschungs- und Kampfbeiträge sind bislang nicht aktiv. Zeige sie als noch nicht verfügbare Bereiche ohne erfundene historische Leistungen. Bereite getrennte, versionierte Berechnungsbausteine vor.
- Behalte Niederlagen als erforderlichen späteren Einfluss fest; implementiere in dieser Etappe noch keine erfundenen Siege, Abzüge oder Kampfhistorien. Ihre Regeln werden mit dem Kampfsystem festgelegt.
- Die Gesamtwertung dieser ersten Fassung ist nicht negativ. Öffentliche Rangliste und fremde Punkteaufschlüsselungen gehören noch nicht dazu.
- Vorhandene Gebäude erhalten bei der Migration dieselbe Ausgangsbewertung wie neu errichtete Gebäude. Reconnects, Neustarts oder erneute Ereignisverarbeitung dürfen die Punkte nicht erhöhen.
- Ein gespeicherter Punktestand ist nur ein abgeleiteter Wert bzw. nachvollziehbar belegter Ereignisstand, niemals ein frei setzbarer Clientwert. Änderungen an den Punktregeln benötigen eine Versions-/Neuberechnungsstrategie.

## B. Kaserne, Einheiten und Generäle

### Kaserne und Ausbildung

- Ergänze eine ausbaubare Kaserne auf einem regulären freien Bauplatz. Sie verwendet die vorhandene Bauwarteschlange und serverseitige Angebote.
- Produktionsgebäude und nicht produzierende Gebäude müssen in der Spiellogik sauber unterschieden sein. Eine Kaserne erzeugt keine Rohstoffe und darf deren Produktion nicht beschädigen.
- Ermögliche zunächst zwei Einheitenarten: Späher für Aufklärung und Infanterie als vorbereitete erste Kampfeinheit. Infanterie kann ausgebildet werden; Angriffe sind noch nicht verfügbar.
- Verwende eine eigene, begrenzte Ausbildungswarteschlange mit serverseitiger Ressourcenprüfung, einmaliger Zahlung und persistierten Start-/Endzeitpunkten.
- Wähle günstige, zentral konfigurierbare Testkosten und Ausbildungszeiten, sodass eine neue Stadt ohne Spezialwerkzeuge Späher ausbilden kann. Dokumentiere jede Zahl als Prototypwert und erläutere die Einheiten.
- Einheiten werden erst bei Ausbildungsabschluss verfügbar. Zeige stationierte, in Ausbildung befindliche und unterwegs gebundene Truppen getrennt.
- Bestimme die Ausbildungsgeschwindigkeit nachvollziehbar aus der Kasernenstufe. Bereits bezahlte Aufträge dürfen durch einen Ausbau nicht stillschweigend verändert werden; verwende für diese Etappe beim Start festgeschriebene Zeiten.
- Maximalmengen, Warteschlangengrenzen und ungültige Stückzahlen werden serverseitig geprüft. Kein negatives oder nicht ganzzahliges Rekrutieren.
- Dauerhafter Truppenunterhalt, Waffenfabriken und weitere Einheiten sind noch nicht Teil dieses Auftrags.

### Ein erster General pro Kommandant

- Stelle als vorläufige Einstiegsregel jedem neuen und bestehenden Kommandanten genau einen kostenlosen Startgeneral bereit, einmalig und idempotent. Mehrfachlogin und Migration dürfen keine weiteren erzeugen.
- Speichere stabile ID, Name, Level, gesamte Erfahrung, Führungskapazität und aktuellen Einsatzstatus.
- Der General befehligt die zugewiesenen Truppen. Für jeden aktiven Aufklärungsauftrag werden ein freier General und verfügbare Späher benötigt.
- Ein General kann nur einen Einsatz zugleich führen. Unterwegs gebundene Truppen dürfen weder nochmals entsandt noch als stationiert gezählt werden.
- Vorläufiges Levelmodell: Startlevel 1; mindestens 50 × L × (L − 1) gesamte Erfahrung für Level L; vorläufige Obergrenze Level 10. Somit beginnt Level 2 bei 100 und Level 3 bei 300 Erfahrung.
- Vorläufige Führungskapazität: 20 × Level Einheiten. Das ist eine Testregel, keine Originalmechanik.
- Für den ersten erfolgreich zurückgekehrten Aufklärungseinsatz zu einer bestimmten NPC-ID erhält ein Kommandant 10 Erfahrung für den eingesetzten General. Weitere Einsätze zum gleichen Ziel geben in dieser Etappe keine weitere Erfahrung. Speichere die bereits belohnten NPC-IDs dauerhaft.
- Erfahrung und Level gehören dem General, nicht zur Kommandantenpunktewertung. Stelle Fortschritt und die Wirkung des nächsten Levels verständlich dar.
- Weitere Generäle, Ausrüstung, Angriff-/Verteidigungsattribute und rekrutierungsabhängige Qualität bleiben spätere Erweiterungen.

## C. Erste Aktion auf der Weltkarte: NPC-Aufklärung

- Ergänze bei NPC-Städten eine funktionierende Aktion „Aufklären“. Bei Spielerstädten bleibt diese Aktion für diese Etappe gesperrt bzw. eindeutig als noch nicht verfügbar gekennzeichnet.
- Öffne einen Einsatzdialog mit Ziel, General, auswählbarer Späherzahl, Entfernung, voraussichtlicher Hin- und Rückkehrzeit sowie den tatsächlich geltenden Voraussetzungen.
- Eine bestätigte Entsendung bindet General und Truppen serverseitig genau einmal. Ereignis-IDs verhindern doppelte Einsätze.
- Verwende vorläufig einfache Luftlinienreisen ohne Terrain-Wegfindung. Beispielregel: Hinstrecke in Sekunden = Maximum aus 5 und aufgerundeter Entfernung × 5; Rückweg gleich lang. Dokumentiere ausdrücklich, dass Gelände in dieser Testfassung noch keine Wegsperren oder Geschwindigkeitsänderungen erzeugt.
- Persistiere eine eindeutige Einsatz-ID, Eigentümer, Ziel-ID, General-ID, Truppen, Status und verbindliche Zeitpunkte.
- Unterstütze mindestens die Zustände Hinmarsch, Rückmarsch und abgeschlossen. Zeige aktive eigene Einsätze, verbleibende Zeit und Zielkoordinaten in einer Übersicht und auf der Karte.
- Ein abgeschlossener Hinmarsch erzeugt eine Aufnahme der tatsächlich zu diesem Zeitpunkt bekannten internen NPC-Daten. Der private Bericht wird erst nach Rückkehr für den Spieler sichtbar.
- Der Bericht trägt Ziel, Erfassungszeit und Rückkehrzeit. Er ist eine historische Aufnahme, kein dauerhafter Live-Zugriff. Spätere Änderungen am NPC dürfen einen alten Bericht nicht rückwirkend ändern.
- Übermittle ausschließlich Daten, die im Spielmodell tatsächlich existieren. NPC-Nahrung und Lagergrenze dürfen im berechtigten Bericht erscheinen. Noch nicht implementierte Garnisonen als „noch nicht modelliert“ kennzeichnen, nicht als militärisch unverteidigt oder als erfundene Einheiten ausgeben.
- Die öffentliche Weltkarte und ihre normalen Detailantworten bleiben unverändert eingeschränkt. Erkenntnisse gehören ausschließlich in den privaten Berichtskanal des Auftraggebers.
- In diesem ersten Prototyp gelingen zulässige NPC-Aufklärungen ohne Späherverluste. Später folgen gegnerische Aufklärung, Entdeckung und Kampfrisiken. Diese Einschränkung sichtbar dokumentieren.
- Bei Rückkehr werden Späher und General genau einmal frei, der Bericht wird zugänglich und gegebenenfalls einmalig Erfahrung vergeben.
- Noch keine Nahrungsgutschrift: Aufklärung ist keine Plünderung. Kein PvP, kein Kampf, kein Truppenverlust und keine Auswertung fiktiver Siege.
- Noch keine Abbruch-/Rückrufaktion. Unzulässige oder nicht abgeschlossene Funktionen dürfen keine scheinbar funktionierenden Schaltflächen erhalten.

## D. Dauerhafte, zeitlich korrekte Abläufe

- Sämtliche dynamischen Befehle, Bestätigungen, Ausbildungsabschlüsse, Einsätze, Berichte, Punkte und Generaländerungen laufen über das bestehende WebSocket-System. Kein HTTP-Spielpolling.
- Der Server bestimmt Identität, Besitz, verfügbares Material, Kosten und Zeit. Manipulierte Spieler-, General-, Einsatz- oder Berichts-IDs dürfen keinen Zugriff auf fremde Daten bewirken.
- Erhalte JSON-Persistenz und einen Schreibprozess pro Welt. Versioniere Migrationen und sichere bestehende Daten.
- Speichere Ressourcenabbuchung, Ausbildungsauftrag bzw. Einsatzreservierung konsistent, bevor eine Erfolgsbestätigung gesendet wird.
- Verarbeite fällige Abschlüsse chronologisch, auch nach langem Offlinebetrieb. Ausbildung, Bauabschlüsse, Hin-/Rückkehr und Belohnungen müssen in der korrekten Reihenfolge rekonstruiert werden.
- Für Offline-Aufklärung verwende den vorgesehenen Ankunftszeitpunkt als fachlichen Zeitpunkt. Ein erst nach Neustart laufender Handler darf keine erst später entstandenen Ressourcen als damaligen Bericht ausgeben. Solange NPC-Bestände noch statisch sind, dokumentiere diese vereinfachte Grundlage; die spätere Regeneration muss zeitabhängig rekonstruierbar bleiben.
- Wiederholung desselben Ereignisses sowie Absturz zwischen Speicherung und Antwort dürfen weder Truppen verdoppeln noch Erfahrung mehrfach vergeben. Entwurf und Tests müssen auch wiederaufgenommene Einsätze umfassen.
- Halte Transport, Speicherung, Punkteberechnung, Ausbildung, Generäle und Einsatzregeln getrennt. Verwende die bestehende JavaScript-Struktur.
- Private Informationen dürfen weder über Kartendaten noch über neue Übersichten oder Fehlerantworten an andere Spieler gelangen.
- Große Zustandsänderungen müssen bis zum Speichern konsistent bleiben; atomarer Dateiaustausch allein ersetzt nicht die Abstimmung logisch zusammengehöriger Änderungen.

## Prüfungen und Abnahmekriterien

Führe die vorhandenen Tests aus und ergänze gezielte Prüfungen für:

1. Gebäudepunkte bei Migration, Neubau, Upgrade und mehrfacher Zustandsberechnung; keine Punkte für bloß wartende Aufträge.
2. Zwei Spieler mit getrennten Truppen, Generälen, Punkten, Berichten und Einsätzen.
3. Kasernenbau, einmalige Ausbildungskosten, Warteschlangengrenzen und Offline-Abschlüsse.
4. Einmalige Vergabe des Startgenerals und korrekte Level-/Führungsschwellen.
5. Auswahl nur eigener freier Generäle und verfügbarer Späher; keine Überbuchung durch gleichzeitige Verbindungen.
6. Hinmarsch, Datenaufnahme, Rückmarsch, Rückgabe und einmalige Erfahrungsbelohnung.
7. Wiederholte Aufklärung derselben NPC-ID liefert einen neuen Bericht, aber keine erneute Erstaufklärungs-Erfahrung.
8. Neustart während Ausbildung, Hinmarsch und Rückmarsch; korrektes Nachholen bereits fälliger Ereignisse.
9. Wiederholte oder manipulierte Befehle; gleiche Anfrage-ID mit anderem Inhalt.
10. Private Berichte sind erst nach Rückkehr und nur für ihren Eigentümer abrufbar; öffentliche NPC-Details verraten weiterhin keine Vorräte.
11. Speicherfehler und erneute Zustellung verursachen keine doppelte Zahlung, Einheit oder Belohnung.
12. Unveränderte bestehende Stadt-, Karten-, Konto- und WebSocket-Funktionen.

Prüfe außerdem im Browser mit zwei unabhängigen Benutzerkontexten den vollständigen Spielablauf sowie Desktop- und Mobilbedienung. Erstelle Screenshots von Punkteanzeige, Ausbildung, Einsatzübersicht und Bericht. Wenn eine Prüfung nicht möglich ist, benenne sie genau.

## Ergebnis und Lieferung

- Erstelle getrennte nachvollziehbare Commits für Punkte, Ausbildung/Generäle und Aufklärung.
- Liefere einen vollständigen spielbaren Ablauf und einen Pull Request; nicht eigenständig zusammenführen oder deployen.
- Dokumentiere die Testregeln gesammelt mit Formeln und Beispielen. Zeige in der PR-Beschreibung, welche Entscheidungen bewusst vorläufig sind.
- Aktualisiere README, Projektplan sowie Protokoll-/Speicherdokumentation. Passe Container/CI nur soweit nötig an.
- Berichte auf Deutsch, was implementiert, getestet und noch offen ist.
- Ersetze keine eigene Forschung oder keinen eigenen Originalregelsatz durch behauptete War2Glory-Fakten.

## Danach: vorbereitete Reihenfolge, noch nicht automatisch ausführen

1. **Erste NPC-Farmzüge:** Infanterie und General entsenden, Garnison und Kampfregeln festlegen, Kampfausgang/Verluste, gemeinsame Nahrungsvorräte, begrenzte Traglast, Rückkehr mit Beute und allmähliche NPC-Regeneration. Kampfpunkte und Niederlageneinfluss werden hierbei angeschlossen. Vorab Kampf- und Verlustregeln als eigenen Auftrag ausarbeiten.
2. **Lager und Gebäudeabriss:** Stufenabhängige Lagerkapazitäten, ausbaubares Lagerhaus, vollständiger Gebäudeabriss mit kleiner Rückerstattung kumulierter Investitionen. Überbestände und Rückerstattungsanteil vor Umsetzung festlegen.
3. **Universitäten und Forschung:** Produktion, Kapazitäten und Freischaltungen verbessern; Forschungspunkte integrieren.
4. Danach weitere Einheiten und Waffensysteme, Bündnisse/Handel sowie Matrix-Föderation gemäß Projektplan.

Der nächste Auftrag darf diese späteren Schritte nicht als bereits umgesetzt darstellen. Die hier verwendeten Prototypwerte sind ausdrücklich vorläufige Arbeitsvorschläge für den Review.
