# War2Glory: vertiefte historische Recherche vom 18.10.2026

Diese Recherche ergänzt [RESEARCH_REFERENCE.md](RESEARCH_REFERENCE.md). Sie ist eine Quellen- und Planungssammlung, kein Implementierungsauftrag. Im Repository wurden nur Dokumentation und Anweisungen gelesen; keine Spielfunktionen oder Tests ausgeführt. Auftrag 17 und die vereinbarten Projektregeln werden durch historische Fundstellen nicht geändert.

## Ergebnis und Belastbarkeit

Zusätzliche brauchbare Quellen sind insbesondere zwei Interviews mit damaligen Verantwortlichen, ein alter Allianz-Leitfaden, ein deutscher Generäle-Guide und ausführlichere Offiziers-/Skillseiten. Sie erklären weitere Spielmechaniken. Ein vollständiges Originalhandbuch, ein vollständiger Forschungsbaum mit allen Voraussetzungen oder eine verifizierte Original-Codeveröffentlichung wurden in den ausgewerteten Treffern nicht gefunden.

Die Suche umfasste deutsch-/englischsprachige Spielnamenvarianten, Publisherseiten, Wikis, Fachpresse, Spielerleitfäden, Forum-/Archivspuren, Videos und öffentliche Quellcodehinweise. Eine vollständige Erfassung des gesamten Internets ist damit nicht behauptet.

Die Belegstufen bedeuten:
- **Hoch:** direkte damalige Aussage eines Verantwortlichen oder konkreter zeitgenössischer Test. Das belegt eine historische Beschreibung, nicht automatisch alle Versionen oder eine mathematisch genaue Regel.
- **Mittel:** konkrete Community-Dokumentation/Spielerbeobachtung. Region, Update und Veröffentlichungszeit häufig unklar; ähnliche Texte können voneinander abgeschrieben sein.
- **Niedrig:** offenbar weiterveröffentlichter Text mit unklarer Herkunft. Nur Suchspur, keine belastbare Implementierungsgrundlage.
- **Offen:** keine ausreichende Bestätigung.

Fandom-Inhalte waren überwiegend über den Suchindex lesbar. Direkte Aufrufe wurden teilweise durch Zugriffsbeschränkungen verhindert. Suchauszüge sind hier ausdrücklich keine geprüften vollständigen Seitenrevisionen. Historische Aussagen dürfen nicht anhand eines aktuellen Crawldatums datiert werden.

## 1. Kampf: mehr als eine einzige Angriffs-/Verteidigungszahl

**Hohe Beleglage:** Das Interview mit Kolja Kirchberg beschreibt gezielte Angriffsziele sowie Vorrücken, Zurückziehen und Bereitschaft während des Gefechts [S1]. Der Test vom 21.12.2010 beschreibt ein rechteckiges Schlachtfeld mit quadratischen Feldern und den Einfluss von Reichweite, Panzerung und Durchschlagskraft [S3].

**Eigene Folgerung für die Planung:** Vor weiteren schweren Einheiten lohnt sich ein gesondertes Kampfmodell mit Positionen, Bewegungsentscheidung, Zielwahl und reproduzierbarem Ablauf. Zuerst müsste festgelegt werden, ob Spieler während eines Gefechts aktiv eingreifen oder vorbereitete Befehle verwenden können. Eine Rundendauer, Angriffsreihenfolge, Schadensgleichung, Trefferwahrscheinlichkeit und das Verhalten bei Zeitüberschreitung sind durch die Quellen nicht hinreichend rekonstruiert.

Die Bezeichnung „Echtzeitspiel“ in Produkttexten und rundenbasierte Gefechte in Spielerbeschreibungen widersprechen sich nicht zwingend: Weltzeit und Gefechtsauflösung sind getrennte Ebenen. Dies ist eine begriffliche Einordnung, keine bestätigte Originalarchitektur.

## 2. Aufklärung, Plünderung und Einnahme unterscheiden

Eine Spielbeschreibung nennt Auskundschaften, Plündern und Einnehmen als verschiedene Optionen [S4]. Der HORNS-Anfängerleitfaden konkretisiert: Beim Plündern seien Stadtbefestigungen nicht beteiligt und Gold keine Beute; bei Einnahme dagegen seien Befestigungen relevant und Gold könne mitgenommen werden [S5]. **Mittel für diese Detailregeln**, da es ein Spielerleitfaden ohne verifizierten Versionsstand ist.

**Eigene Planung:** Vor PvP für jede Angriffsart genau definieren: beteiligte Verteidiger, geschützte Vorräte, mögliche Besitzänderung, Folgen für Generäle und erlaubte Rückzugszustände. Feld-Eroberung und Gründung im aktuellen Projekt sind damit nicht automatisch eine vollständige Umsetzung historischer Stadteroberung.

Derselbe Anfängerleitfaden beschreibt das Verstecken von Ressourcen in Verkaufsangeboten [S5]. Das ist eine Warnung für unser späteres Handelsdesign: Angebote, stornierte Geschäfte und unterwegs befindliche Fracht dürfen keine ungewollte unbegrenzte Schutzablage erzeugen. Es ist kein Featurewunsch.

## 3. Rohstofffelder und zeitgesteuerte Suche

Das damalige Interview bestätigt eroberbare Ressourcenfelder mit Produktionsboni [S1]. Der HORNS-Leitfaden trennt Erobern, Besetzen und „Ransack“, also Durchsuchen. Er beschreibt vom Gelände abhängige Schmuckfunde und stündliche Fundversuche mit einer Obergrenze [S6].

Ein konkret dokumentiertes **Community-Modell**, nicht verifizierte Serverlogik, lautet:
- Versuche = min(24, floor(Aufenthaltsdauer in Stunden)).
- Aus 59 Minuten folgen nach diesem Modell 0, aus 90 Minuten 1 und aus 30 Stunden 24 Versuche.
- Die Rechnung gibt ausschließlich die beschriebenen Zeitfenster wieder, keine Dropchance oder garantierte Beute.

**Eigene Planung:** Besitzbare Außenfelder und Suchaufträge wären eine eigene Erweiterung neben NPC-Farmzügen und Stadtgründung. Benötigt würden Eigentümer, zugeordnete Stadt, Produktionsbonus, Besetzung, Sammelzeitpunkt und Rückruf. Rangmaterialien sollten erst nach einer eigenen Progressionsentscheidung dazugehören.

Der Leitfaden behauptet außerdem höheren Nahrungsbedarf für außerhalb stationierte Truppen [S6]. Das wird nicht auf reisende Projekttruppen übertragen: Unsere beschlossene Regel ohne Stadtunterhalt unterwegs bleibt bestehen.

## 4. Gewöhnliche Offiziere, besondere Generäle und historische Helden

Hier besteht eine wichtige Begriffsgrenze:

| System in den Quellen | Historische Beschreibung | Beleglage |
| --- | --- | --- |
| Gewöhnliche Offiziere | Rekrutierung über Military Institute, Verwaltung über Staff HQ; Militär-/Wissens-/Politikwerte [S7] | Mittel |
| Besondere „Generäle“ | Deutscher Guide beschreibt eine eigene Einberufung und Beförderung mit speziellen Gegenständen; unterscheidet sie ausdrücklich von normalen Offizieren [S9] | Mittel |
| WW2 Heroes | Eigene Suche, Gefechte gegen Fundorte und spätere Rekrutierung im Heldenleitfaden [S10] | Mittel |

Die englischen Offiziersseiten beschreiben Politik als Einfluss auf Produktion/Bau, Militär auf Angriff/Ausbildung und Wissen auf Panzerung/Forschung [S7, S8]. Der UK-Guide nennt zusätzlich Gehalt, Loyalität, Ausrüstung und Erfahrung durch Kämpfe sowie abgeschlossene Bauten bei Bürgermeistereinsatz [S8]. Formeln und Loyalitätsgrenzen sind nicht ausreichend gesichert.

Der deutsche Generäle-Guide beschreibt Beförderung nach Erreichen von Stufe 100 mit Rücksetzung auf Stufe 1 und bleibendem Zugewinn. Er nennt eine Grenze von fünf besonderen Generälen und besonderen Loyalitätsschutz, aber eine Verlustmöglichkeit bei Stadtübernahme [S9]. Das ist **keine** belegte Grenze für sämtliche Offiziere in allen Fassungen. Zahlen werden als Quellenangaben wiedergegeben, nicht berechnet oder für unser Projekt festgelegt.

**Eigene Planung:** Das vorhandene Generalmodell behalten. Ausbildungsspezialisten, zusätzliche Rollenboni, Umschulung, Seltenheit und besondere Helden nur separat spezifizieren. Keine fremden Loyalitäts-/Gehalts-/Prestigeregeln stillschweigend an unser XP- und Skillsystem anhängen.

## 5. Zusätzliche Offiziersfähigkeiten, auch für Luftstreitkräfte

Die Community-Seite Officer Skills beschreibt erlernbare Fähigkeiten über Handbücher und teils nur in bestimmten Kampfrunden wirksame Effekte [S11]. Beispiele, sinngemäß:
- Luftformation und früher Luftschlag: Luftangriff beziehungsweise frühe Aktionsgeschwindigkeit.
- Ingenieurfähigkeit: geringerer Ölbedarf beim Marsch.
- Gegenangriff: zusätzliche Angriffsmöglichkeit.
- Spionage: verbesserte Aufklärung.
- Weitere Fähigkeiten für Panzerverbände, Marine und Stadtverteidigung.

**Mittel für die Existenz dieser beschriebenen Skillgruppen; offen für exakte Wirkung.** Die Seite verwendet mehrmals „level“, ohne daraus zuverlässig Prozentwerte ableiten zu können. Manche Beschreibungen sind uneinheitlich.

**Eigene Planung:** Für die spätere Luftphase Einheitengruppen, passive Boni und zeitlich begrenzte Kampfeffekte getrennt modellieren. Ein möglicher Ölbonus müsste später unsere Regeln für bezahltes Betriebsöl, Verzögerung und Kapazität konsistent ergänzen; Auftrag 17 enthält ihn nicht.

## 6. Stadtverwaltung, Arbeitskräfte und Verteidigung

| Thema | Fund und Grenze | Möglicher eigener Projektschritt |
| --- | --- | --- |
| Rathaus und Bürger | Wiki nennt Steuerhöhe, Moral, Sonderabgaben, Produktionsauslastung und Maßnahmen für Bevölkerung/Moral [S12]; mittel | Ein geschlossenes Bevölkerung-/Arbeitskräfte-/Goldkonzept entwerfen |
| Wohnraum und Auslastung | Zeitgenössischer Test beschreibt Wohnhäuser, Nahrung, Steuern und zusätzliche Fabrikschichten [S3]; hoch für das Grundsystem | Wirkung und Bedienbarkeit prüfen, bevor weitere Wirtschaftskosten entstehen |
| Radar | Spielerreview beschreibt Warnung vor anrückenden Gegnern [S13]; mittel | Anmarschwarnung mit abgestufter Informationsqualität vor PvP |
| Befestigungen | UK-Gebäudeguide nennt Mauer, Bunker, Haubitzen, Flak und Panzerabwehr [S14]; mittel | Separates Verteidigungssystem; nicht normale Bauplätze oder bewegliche Truppen gleichsetzen |
| Lagerhaus | UK-Guide beschreibt Schutz vor Plünderung mit abweichender Behandlung bei Einnahme [S14]; mittel | Lagerkapazität und Plünderschutz als verschiedene Größen |
| Hauptquartiere | UK-Guide unterscheidet Offiziersverwaltung und größere Einsatzmöglichkeiten [S14]; mittel | Erst Einsatzlimits und Rollenbedarf entscheiden, dann zusätzliche Gebäude |

Rathaus-/Mauer-Abhängigkeiten sind in verschiedenen Beschreibungen nicht konsistent genug, um einen Original-Baubaum festzuschreiben. Auch historische Gebäude-Stufengrenzen dürfen unsere vorhandenen Stufen nicht ungeprüft ersetzen.

## 7. Bündnisse, gemeinsame Angriffe und getrennte Fortschrittswerte

Das Interview mit Produktmanager Kris Litson vom 24.02.2012 nennt gemeinsame Offensiven, zur Verteidigung geliehene Truppen, Allianzhandel, Ränge/Diplomatie und Allianz-Inselfestungen [S2]. Es unterscheidet außerdem Reputation als allgemeinen Fortschritt und Honour als PvP-bezogenen Wert; Aufgabenketten und tägliche Aufgaben liefern unterschiedliche Belohnungen.

**Hoch für die damalige Featurebeschreibung.** Nicht belegt sind damit die genaue Abrechnung gemeinsamer Kämpfe, Truppenversorgung beim Verbündeten oder die Formeln der beiden Wertungen.

**Eigene Planung:** Eine ausgeliehene Garnison muss Eigentum des Senders behalten und einen Rückweg haben. Das unterscheidet sich von unserer bereits spezifizierten dauerhaften Verlegung zwischen eigenen Städten. Vor einer gemeinsamen Offensive müssen Ankunftskoordination, Oberbefehl, individuelle Verluste und Beuteanteile feststehen. Ein zweiter Punktestand ist nur ein Kandidat; unsere Kommandantenwertung wird nicht ersetzt.

## 8. NPCs, Aufgaben, Ränge und weitere Gegenstände

- **NPCs:** Die Wiki beschreibt passive NPC-Gegner mit unterschiedlichen Stufen, Offiziersfortschritt und Gegenstandsbeute [S15]. Aufgelistete „verlustfreie“ Truppenkombinationen sind Spielertipps mit unbekannten Voraussetzungen, keine Testfälle für unsere Kampfengine.
- **Aufgaben:** Die Missionsseite unterscheidet Ausbau, tägliche Aufgaben, Elite und Helden [S16]. Das sind Aufgabenrubriken, keine Reise-Missionstypen.
- **Ränge:** Die deutsche Seite verbindet Aufstieg mit Aufgaben und Schmuck aus Außenfeldern [S17]. Unsere Grenze von fünf Städten bleibt verbindlich.
- **Abzeichen:** Ein offenbar weiterveröffentlichter Text beschreibt ausrüstbare Abzeichen mit Einheitentyp-Boni, Verbesserungen und Zerlegung [S18]. Niedrige Belegstufe; Originalherkunft und Fassung nicht gesichert.
- **Katastrophen/Überlastung:** Ein weiterer Spiegeltext beschreibt Zufallsereignisse sowie Probleme durch Ressourcenüberstand, Arbeitermangel oder geringe Moral [S19]. Niedrige Belegstufe; weder Wahrscheinlichkeiten noch Verlustformeln bestätigt.

**Eigene Planung:** Aufgaben und eine spätere Gegenstandsverwaltung können sinnvoll getrennt vorbereitet werden. Zufällige Ressourcenvernichtung oder kostenpflichtige Gegenstände werden durch diese Recherche nicht beauftragt.

## 9. Forschung und Einheiten: was weiterhin fehlt

Die erneut gefundene Technologie-Liste enthält 19 benannte Themen [S20]. MMOGames nennt 21 Technologien [S21]. Die Differenz ist nicht aufgeklärt. Eine Aufzählung ist noch kein Baum.

Weiterhin offen:
- Exakte Abhängigkeiten, Universitäts-/Forschungszentrumsstufen und Freischaltungen je Technologie.
- Kosten, Zeiten, maximale Stufen sowie Prozent- und Kombinationsregeln.
- Vollständige Einheitenwerte für Lebenspunkte, Angriffsarten, Reichweite, Geschwindigkeit, Nahrung, Öl und Traglast.
- Unterschied zwischen Bewegung auf der Weltkarte und Bewegung im Gefecht.
- Kampfformel, Rundungsregeln, Zufall, Verlustverteilung und Reparatur.
- NPC-Vorräte, Garnisonen, Regeneration und Dropwahrscheinlichkeiten.

Die im Wiki-Inhaltsverzeichnis erwähnte Einheitenvergleichstabelle konnte nicht als verwertbarer Inhalt abgerufen werden. Aus Klassenbezeichnungen und Werbeaussagen keine fehlenden Tabellenzeilen erfinden. Die aktuellen Werte in Auftrag 17 bleiben eigene vorläufige Spielregeln.

## 10. Versionen und Ansprechpartner sorgfältig auseinanderhalten

- **Browserfassung:** Interviews dokumentieren Just A Game als damaligen Publisher [S2]. Eine offizielle gamigo-Meldung vom 13.04.2017 beschreibt den Wechsel ins gamigo-System und verlinkt damaliges Spiel und Forum [S22].
- **Mobile Verwandtschaft:** Die App-Store-Seite zu War 2 Victory nennt WISTONE ENTERTAINMENT CO LTD und bezeichnet die App als auf WAR2 basierend [S23]. Ihre Versionshistorie nennt spätere Systemänderungen, darunter ein neues Kampfsystem. Damit sind Mobilwerte kein sicherer Ersatz für ältere Browserregeln.
- **Deutsche Mobil-App:** Eine Drittanbieter-Appseite führt com.wistone.war2victory.de als War 2 Glory (DE) [S24]. Das ist nur eine Zuordnungsspur; es wurde keine APK heruntergeladen oder ausgeführt.
- **Heutige Rechte und Quellcode:** Aus damaligem Publishing oder einer aktuellen App-Store-Nennung folgt nicht, wer den alten Browser-Servercode besitzt oder veröffentlichen darf. Diese Information kann ich nicht sicher bestätigen.

Für die laufende Herstelleranfrage wären besonders wertvoll: ursprüngliche Spiel-/Serverversion, Regelhandbuch, Technologie-/Gebäude-/Einheitentabellen, anonymisierte Kampfbeispiele, Formeln zur Zeit- und Bonusberechnung, NPC-Regeneration und Ansprechpartner für die Freigabe von Code beziehungsweise Dokumentation. Das sind Anfragen, keine bereits verfügbaren Unterlagen.

## 11. Medien, Archive und Suchgrenzen

Das bereits bekannte Video [V1] wurde erneut als Suchtreffer mit Titel, Kanal MMO Attack und Veröffentlichungsdatum 31.07.2012 gefunden. In dieser Recherche wurde keine neue visuelle Videoanalyse durchgeführt; keine Zeitmarke oder Formel daraus abgeleitet.

Alte Forum-/Spiel-URLs aus [S22] waren hier nicht abrufbar. Auch getestete Wayback-/CDX-Aufrufe lieferten keinen auswertbaren Archivinhalt. Das belegt weder die Löschung sämtlicher Archive noch ihre Nichtexistenz. Kein funktionierender historischer Handbuch-Download wurde bestätigt.

Ausgeschlossen als Mechanikbeleg: allgemeine „ähnliche Spiele“-Listen, mit anderen Spielen vermischte Suchtreffer, automatisch erzeugte Supportantworten und reine APK-Werbetexte. Die Suche nach Quellcode lieferte keinen verifizierten Original-Release; insbesondere Vergleichsseiten über Open-Source-Alternativen belegen keinen offenen War2Glory-Code.

## 12. Konsequenzen für unseren Projektplan

Diese Reihenfolge ist ein eigener Vorschlag. Keine Änderung bereits beschlossener Regeln und kein neuer nummerierter Implementierungsauftrag:

1. **Auftrag 17:** spezifizierte Forschungserweiterung beibehalten.
2. **Einführung/Aufgaben und Versorgungsübersicht:** verständlicher spielbarer Einstieg; Belohnungen einmalig und nachvollziehbar.
3. **Außenfelder und Suchaufträge:** als eigenständiges Konzept prüfen; nicht mit Stadtgründung gleichsetzen.
4. **Bündnisse und stationierte Unterstützung:** Mitgliedschaft, Rechte, Fremdgarnisonen, Versorgung und Rückruf; danach Handel.
5. **PvP-Vorbereitung:** Schutzphase, Kriegserklärung, Radar, Aufklärung, Angriffsarten, Befestigungen und Lager-Plünderschutz.
6. **Taktische Kampfgrundlage und weitere Bodeneinheiten:** Befehle, Positionen und deterministische Berichte festlegen.
7. **Luft/Raketen und spezialisierte Generalfähigkeiten:** auf dem Kampfmodell aufbauen.
8. **Optionale spätere Vertiefung:** Bevölkerung/Gold, Ausrüstung, besondere Generäle/Helden, Marine und Allianzfestungen jeweils gesondert entscheiden.

Matrix-Föderation bleibt ein eigener Strang. Die historischen Quellen liefern dazu keine Vorlage für unser geplantes serverübergreifendes Vertrauensmodell.

## Quellenregister

Alle Zugriffsangaben beziehen sich auf den 18.10.2026. „Index“ bedeutet im Suchindex gelesen, nicht als vollständige Seite geprüft.

| ID | Quelle | Zugang / Einordnung |
| --- | --- | --- |
| S1 | [GamesSphere: Interview mit Kolja Kirchberg](https://gamessphere.de/specials/War_2_Glory_-_Das_Interview_mit_Just_A_Game) | Direkt gelesen; damaliger Operations Manager, Artikeltext mit Zeichencodierungsfehlern, Datum nicht sicher bestimmt |
| S2 | [GameOgre: Interview mit Kris Litson](https://gameogre.com/interview-for-war2-glory-with-kris-litson-product-manager-of-war2glory/) | Direkt gelesen; Product Manager; 24.02.2012 |
| S3 | [GameStar: War2Glory im Test](https://www.gamestar.de/artikel/war2glory-zweiter-weltkrieg-als-gratis-browserspiel,2320051.html) | Direkt gelesen; Martin Deppe; 21.12.2010 |
| S4 | [GamesSphere: Spielbeschreibung](https://gamessphere.de/games/war2-glory) | Index; Überblick, kein präziser Regelsatz |
| S5 | [HORNS: For Beginners](https://w2ghorns.weebly.com/for-beginners.html) | Direkt gelesen; Spieler-/Allianzleitfaden, undatiert |
| S6 | [HORNS: War2Glory Guide](https://w2ghorns.weebly.com/war2glory-guide.html) | Direkt gelesen; Außenfelder, Suche und Spielerpraktiken |
| S7 | [War2Glory Wiki: Officers](https://war2glory.fandom.com/wiki/Officers) | Index; Community-Wiki |
| S8 | [War 2 Glory UK Wiki: Officers](https://war2gloryuk.fandom.com/wiki/Officers) | Index; Direktaufruf fehlgeschlagen |
| S9 | [WAR2 Glory Wiki: Generäle Guide](https://war2glory.fandom.com/de/wiki/Gener%C3%A4le_Guide) | Index; deutsche Beschreibung besonderer Generäle |
| S10 | [War2Glory Wiki: WW2 Heroes](https://war2glory.fandom.com/wiki/WW2_Heroes) | Index; Spielerleitfaden, keine gesicherten Kauf-/Dropwerte übernommen |
| S11 | [War2Glory Wiki: Officer Skills](https://war2glory.fandom.com/wiki/Officer_Skills) | Index; Effektbeschreibungen teilweise unklar |
| S12 | [War2Glory Wiki: City Hall](https://war2glory.fandom.com/wiki/City_Hall) | Index; Stadtverwaltung |
| S13 | [TheReviewBubble: War 2 Glory Review](https://thereviewbubble.weebly.com/war-2-glory-review.html) | Direkt gelesen; Spielerbericht, kein Herstellerhandbuch |
| S14 | [War 2 Glory UK Wiki: Buildings](https://war2gloryuk.fandom.com/wiki/Buildings) | Index; Gebäudefunktionen und Verteidigung |
| S15 | [War2Glory Wiki: NPC](https://war2glory.fandom.com/wiki/NPC) | Index; keine Verlustgarantien aus Tipps übernehmen |
| S16 | [War2Glory Wiki: Missions](https://war2glory.fandom.com/wiki/Missions) | Index; Aufgabenrubriken |
| S17 | [WAR2 Glory Wiki: Edelsteine und Ränge](https://war2glory.fandom.com/de/wiki/Edelsteine_und_R%C3%A4nge) | Index; historische Rangprogression |
| S18 | [Lasopagreen: War2glory Codes](https://lasopagreen248.weebly.com/blog/war2glory-codes) | Index; Spiegel-/Sammeltext mit unklarer Herkunft, niedrige Belegstufe |
| S19 | [Dopcadomains: War2glory Strategy Guide](https://dopcadomains.weebly.com/war2glory-strategy-guide.html) | Index; weiterveröffentlichter Hazard-Guide, niedrige Belegstufe |
| S20 | [War2Glory Wiki: Technology](https://war2glory.fandom.com/wiki/Technology) | Index; 19 Namen, kein vollständiger Baum |
| S21 | [MMOGames: War2 Glory](https://www.mmogames.com/game/war2-glory/) | Index; nennt 21 Technologien, Fassung unklar |
| S22 | [gamigo: Neue Website für War2Glory](https://de.gamigo.com/news/neue-website-fuer-war2glory) | Direkt gelesen; offizielle Meldung vom 13.04.2017 |
| S23 | [Apple App Store: War 2 Victory](https://apps.apple.com/us/app/war-2-victory/id416757122) | Direkt gelesen; Herstellerbeschreibung und Versionshistorie der Mobilfassung |
| S24 | [APK-Metadaten: War 2 Glory (DE)](https://war-2-glory-de.apkcafe.in/) | Index; Drittanbieter, nur Produkt-/Paketzuordnung, keine Downloadempfehlung |
| V1 | [MMO Attack: War 2 Glory Full Gameplay and Review](https://www.youtube.com/watch?v=xu_h6W6ERGM) | Nur Metadaten erneut gefunden; keine neue Szenenauswertung |

Die Zusammenfassungen sind eigene knappe Paraphrasen. Originaltexte und Originalgrafiken wurden nicht in das Projekt kopiert.
