# Historische Recherche: Forschungsrichtungen und fehlende Ausbauschritte

Recherchestand: 16.10.2026. Ergänzung zum Projektplan, kein Implementierungsauftrag und kein Nachweis fertig entwickelter Funktionen. Der Planungschat ändert ausschließlich Dokumentation. CODEX_PROMPT.md bleibt Auftrag16; dessen Abschluss ist in diesem Rechercheauftrag nicht bestätigt.

## Ergebnis und Grenzen der Recherche

Eine historische Community-Wiki-Seite nennt 19 Forschungsrichtungen [Q1]. Das ist eine belegbare Themenliste, kein vollständig rekonstruierter Forschungsbaum. Eine andere Spielbeschreibung nennt insgesamt21 Technologien [Q2]. Die Differenz bleibt offen; weder zwei zusätzliche Namen noch Versionsunterschiede sind damit bewiesen.

Für den Originalbaum sind Voraussetzungen zwischen Technologien, Gebäudelevel, Forschungsstufen, Preise, Zeiten und genaue Prozentwirkungen nicht ausreichend belegt. Solche Werte nicht als Originalwerte in Code oder Projektplan aufnehmen. Deutsche Bezeichnungen unten sind eigene sinngemäße Übersetzungen, keine verifizierten deutschen UI-Texte.

Das Nutzer-Video ist als „War 2 Glory Full Gameplay and Review“ von MMO Attack erreichbar [V1], Dauer laut Player6:40. Die Wiedergabe blieb hier auch nach einem Neuladen ohne sichtbare Gameplay-Bilder im Ladezustand. Untertitel wurden als nicht verfügbar angezeigt. Deshalb sind keine Szenen, Zeitmarken oder Aussagen des Sprechers ausgewertet. Die fehlenden Spielmechaniken unten stammen aus separat recherchierten Textquellen, nicht aus angeblich angesehenen Videobildern.

## Benannte Forschungsrichtungen und eigener Projektvorschlag

Alle 19 Themenbezeichnungen stammen sinngemäß aus [Q1]. Die rechte Spalte ist ausdrücklich ein eigener Entwurf für unser Spiel. Sie beweist weder Originalwirkung noch Originalvoraussetzungen.

| Nr. | Sinngemäß übersetztes Forschungsthema | Vorgeschlagene Einordnung in unser Projekt |
| --- | --- | --- |
| 1 | Anbautechniken | Mit bestehender Landwirtschaft abgleichen; keinen doppelten Nahrungsbonus anlegen |
| 2 | Prospektion | Spätere Rohstofferschließung; Nutzung erst nach Entscheidung über neue Ressourcen |
| 3 | Metallurgie | Spätere Metallwirtschaft und Materialfreischaltungen |
| 4 | Stahlerzeugung | Spätere Stahlproduktion, getrennt von Metallurgie definieren |
| 5 | Ausbildungstechniken | Ausbildungszeit verbessern; aktive Queues versionieren |
| 6 | Aufklärungstechniken | Qualität/Tiefe von Berichten; öffentliche Karte bleibt sichtbar |
| 7 | Feuerkraft | Definierte offensive Einheitenwerte verbessern |
| 8 | Panzerung | Definierte defensive Einheitenwerte verbessern |
| 9 | Ballistik | Reichweite/Projektilsystem erst mit entsprechendem Kampfmodell |
| 10 | Schwerindustrie | Spätere schwere Fahrzeuge und Produktionsgebäude |
| 11 | Verbrennungsmotoren | Mit Motorisierung abgleichen; Mobilitätswirkung gesondert balancieren |
| 12 | Bautechnik | Bauzeiten verbessern |
| 13 | Stadtverteidigung | Spätere Befestigungen und Verteidigungsanlagen |
| 14 | Plündertechnik | Verteilung/Zugriff auf plünderbare Bestände, niemals Traglast überschreiten |
| 15 | Ladetechnik | Transportkapazität; klar von Lagerkapazität trennen |
| 16 | Lagertechnik | Bestehende Lagerlogistik ist der Anknüpfungspunkt |
| 17 | Reparaturtechnik | Zunächst nur vormerken, bis Schäden und reparierbare Objekte existieren |
| 18 | Führungstechnik | Spätere Armeeführung/Einsatzgrenzen; eigener Skill-Führung nicht ungeprüft doppeln |
| 19 | Düsentriebwerke | Spätere Luftfahrtphase mit eigenem Truppen-/Generaldesign |

Vorläufige Gruppierung für die Oberfläche: Wirtschaft, Bau/Ausbildung, Logistik, Aufklärung/Kampf und spätere Technologien. Diese Gruppierung ist unser Entwurf, keine rekonstruierte Originalreihenfolge.

## Abgleich mit dem tatsächlich gelesenen Forschungsstand

packages/game-core/research.js enthält im abgerufenen main sechs Definitionen:
- Forstwirtschaft, Steinverarbeitung, Landwirtschaft und Lagerlogistik.
- Ölverarbeitung und Motorisierung als Freischaltungen.

Sechs ergibt sich durch Zählen dieser sechs Einträge; das ist kein Vergleichswert über die Vollständigkeit des ganzen Spiels. Bestehende vier wiederholbare Themen und zwei Freischaltungen nicht bei Aufnahme historischer Namen ersetzen oder doppelt rechnen.

Aktuelle konkrete Kante: Motorisierung benötigt Ölverarbeitung1 und Lagerlogistik1 sowie Universität2; Ölverarbeitung benötigt Universität1. Diese Abhängigkeiten sind eigene bestehende Projektregeln. Forstwirtschaft/Steinverarbeitung sind keine durch [Q1] bestätigten Originalthemen und bleiben eigenständige Projektentscheidungen.

## Vorschlag für unseren Forschungsbaum

Zuerst einen versionierten Katalog aufbauen, dessen Einträge Voraussetzungen, maximale Stufe, Kosten/Dauer, Effekte, Freischaltungen und Aktivierungsstatus explizit enthalten. Quellenstatus je Thema dokumentieren: Originalname belegt / eigene Wirkung / Originalwerte unbekannt. Nicht alle19 Themen sofort als wirksame Forschungen anbieten.

| Ast | Bestehender Anker | Nächster sinnvoll spielbarer Ausbau | Vor Freigabe zu entscheiden |
| --- | --- | --- | --- |
| Wirtschaft | Landwirtschaft, Forstwirtschaft, Steinverarbeitung, Ölverarbeitung | Bestehende Produktion konsistent zeigen | Neue Ressourcen oder bestehende Modellierung beibehalten |
| Lager/Transport | Lagerlogistik, Motorisierung | Neue Ladetechnik für Traglast | Bonusgrenzen, Kosten und Startsnapshot |
| Bau/Ausbildung | Universität und vorhandene Queues | Bautechnik und Ausbildungstechniken | Zeitfaktoren, Rundung, Mindestdauer |
| Aufklärung/Kampf | Scoutberichte, NPC-Kampf, Generalboni | Aufklärung, Feuerkraft und Panzerung | Informationsgrenzen und getrennte Bonusfaktoren |
| Verteidigung | Bisher kein spezifizierter kompletter PvP-Ablauf | Stadtverteidigung mit Befestigungen | Angriffsarten, Lager-/Besitzschutz, Kampfmodell |
| Schwere Technik | Motorisierung | Schwerindustrie und weitere Bodenfahrzeuge | Gebäude-/Forschungs-/Ressourcenkosten |
| Luftfahrt | Bereits vorgemerkte Flugzeuge/Luftfähigkeiten | Flugplatz und Düsentriebwerke | Einheitentypen, Öl, Abwehr, Generalfähigkeiten |
| Reparatur | Noch kein Schadensmodell | Erst nach definierter Schadensmechanik | Was reparierbar ist und welche Verluste endgültig sind |

Konkrete neue Kanten/Stufen erst im nächsten ausführbaren Forschungsauftrag mit dem Nutzer festlegen. Keine grafischen Pfeile als angebliche Originalabhängigkeiten hinzufügen. Für eine erste eigene Erweiterung sind Bautechnik, Ausbildung und Ladetechnik am ehesten an vorhandene Mechaniken anschließbar; dies ist eine Planungsempfehlung.

Umsetzungsregeln:
- Spielerweiter Forschungsstand und eine Queue aus Auftrag15 erhalten.
- Zeit-/Produktionswirkung exakt ab Abschlusszeitpunkt, auch offline und über mehrere Städte.
- Laufende Missionen behalten Treibstoff-, Traglast- und Bonus-Snapshots.
- Laufende Bau-/Ausbildungsjobs nicht still rückwirkend verkürzen; neue Regelsätze und Zeitpunkte definieren.
- Plünderbonus erzeugt keine Ressourcen und ersetzt nicht die gemeinsame Frachtgrenze.
- Bewegungsgeschwindigkeit und zusätzliche Verzögerung nicht durch pauschalen Ölbonus inkonsistent machen.
- Bestehende IDs/Level/Punkte/Queue bei Migration bewahren.
- Gesperrte spätere Technologien in der UI erklären, ohne wirkungslose Forschungszahlungen zu erlauben.
- Keine Kosten/Prozentzahlen aus Vermutungen übernehmen.

## Zusätzliche historische Mechaniken als Projektkandidaten

Die folgenden Punkte sind Abgleich/Planung, keine pauschale Zusage, jede Originalmechanik zu kopieren. „Offen“ bezieht sich auf die gelesene Planung und die hier gelesenen Forschungsdefinitionen, nicht auf einen vollständigen aktuellen Codeaudit.

| Projektkandidat | Historischer Beleg | Bedeutung und Einordnung für unser Spiel |
| --- | --- | --- |
| Tutorial, Aufbauaufgaben und Tages-/Eliteaufträge | Missionsgruppen in [Q3], Aufgabenbeispiele in [Q4] | Nach Auftrag16 ein kleiner Einführungsablauf mit einmaligen Belohnungen; doppelte/transferbasierte Belohnungen verhindern |
| Bevölkerung, Wohnraum, Moral, Steuern/Gold | [Q4] und Rathausbeschreibung [Q5] | Eigenes Wirtschaftskonzept, keine stillen zusätzlichen Unterhaltskosten |
| Rathaus/Hauptquartier als Ausbauzentrum | [Q5] | Voraussetzungen/Übersicht später prüfen; fünf-Städte-Grenze bleibt verbindlich |
| Stahl und seltene Metalle | [Q6] | Original unterscheidet diese Ressourcen; unser Holz/Stein-System nicht ungefragt ersetzen |
| Radarzentrale und Warnung vor Anmärschen | [Q7] | Vor PvP zusammen mit Sichtbarkeit/Spionage spezifizieren |
| Mauern, Bunker und stationäre Abwehr | [Q6] | Eigenes Verteidigungskapitel vor schweren PvP-Angriffen |
| Geschützter Ressourcenanteil bei Angriffen | Warehouse-Beschreibung in [Q6] | Unser Lagerhaus erhöht bisher Kapazität; Schutz ist eine eigene zukünftige Wirkung, kein bereits vorhandenes Feature |
| Mehrere Boden-/Luft-/See-Einheitengattungen und Fraktionen | [Q8] | Boden zuerst erweitern; Marine/Küsten-/Wasserregeln später gesondert entscheiden |
| Taktische Befehle und Zielwahl im Gefecht | [Q4] | Spätere Kampfausbaustufe; zuerst reproduzierbare serverseitige Kampfrunden/Replay planen |
| Anfängerschutz vor PvP | [Q4] | Vor Freischaltung von Spielerangriffen verbindlich definieren, ohne historische Dauer automatisch zu kopieren |
| Generalsausrüstung und zusätzliche Entwicklung | [Q4], Attribute/Standortrollen auch [Q9] | Vorhandene XP/Skills erhalten; Gegenstände/Slots und Kombinationsgrenzen extra planen |
| Ränge, Erkundungsfunde und längerfristige Aufgaben | [Q10] | Progression optional entwickeln; Originalangaben zu mehr Städten ändern unsere Grenze5 nicht |
| Stadtverlegung auf der Weltkarte | [Q4] | Späterer eigener Vorgang, getrennt von Truppenverlegung; keine Teleportation in Auftrag16 ergänzen |

Ein Teil ist bereits grob vorgemerkt (Bündnisse, Handel, Luft/Raketen, Forschung). Neu ist die ausdrückliche Aufnahme von Bevölkerung/Moral, Aufgabenprogression, Radar, Befestigungen, Lager-Plünderschutz, taktischen Gefechten, Marine/Fraktionen und Generalsausrüstung als noch zu spezifizierende Kandidaten.

## Empfohlene Reihenfolge nach Auftrag16

1. Forschungsgrundlage konkretisieren und kleine Erweiterung für Bau, Ausbildung und Traglast liefern.
2. Tutorial/Aufgaben und stadtübergreifende Versorgungsübersicht als begrenzten spielbaren Schritt.
3. Bündnisse und Unterstützung; geregelter Handel als eigener Folgeschritt.
4. PvP-Vorbereitung: Radar/Aufklärung, Anfängerschutz, verteidigte Städte, geschützte Bestände und Angriffsarten.
5. Kampfausbau und zusätzliche Bodeneinheiten, danach schwere Industrie.
6. Luftfahrt/Raketen und die bestätigten Luftfähigkeiten für Generäle.
7. Bevölkerung/weitere Ressourcen und Generalsausrüstung nach eigener Balanceentscheidung; Marine/Fraktionen optional später.
8. Matrix-Föderation als eigener Strang weiterverfolgen, nicht von sämtlichen optionalen Originalsystemen abhängig machen.

Dies ist eine vorgeschlagene Reihenfolge, kein neuer nummerierter Codex-Auftrag. Offene Spielentscheidungen mit dem Nutzer abstimmen; Auftrag16 bleibt bestehen.

## Quellen und Zugriff

Alle Links am 16.10.2026 recherchiert. Community-Wikis sind keine offizielle vollständige Regeldokumentation; lokale Fassungen/Zeitstände können abweichen. Wiki-Inhalte waren im Suchindex lesbar, direkte Aufrufe teils gesperrt. Solche Zugriffsgrenzen nicht als erfolgreiche Direktprüfung ausgeben.

- [V1] Nutzerreferenz: [War 2 Glory Full Gameplay and Review, MMO Attack](https://www.youtube.com/watch?v=xu_h6W6ERGM). Browser: Titel/Kanal/Dauer geprüft, Wiedergabe ohne Gameplaybilder, keine Untertitel verfügbar. Keine Szenenauswertung.
- [Q1] [War2Glory Wiki: Technology](https://war2glory.fandom.com/wiki/Technology). Suchindex liefert19 Namen; keine ausreichend belegten Abhängigkeiten/Kosten.
- [Q2] [MMOGames: War2 Glory](https://www.mmogames.com/game/war2-glory/). Spielbeschreibung nennt21 Technologien; deshalb Vollständigkeit der Wiki-Liste offen.
- [Q3] [War2Glory Wiki: Missions](https://war2glory.fandom.com/wiki/Missions). Gruppen von Spielaufgaben, keine Beschreibung unserer Reise-Missionstypen.
- [Q4] [GameStar-Test, Martin Deppe, 21.12.2010](https://www.gamestar.de/artikel/war2glory-im-test-zweiter-weltkrieg-als-gratis-browserspiel,2320051.html). Zeitgenössischer Test, direkt geöffnet.
- [Q5] [War2Glory Wiki: City Hall](https://war2glory.fandom.com/wiki/City_Hall). Rathausverwaltung, Wirtschaft und Gebietsübersicht.
- [Q6] [War 2 Glory UK Wiki: Buildings](https://war2gloryuk.fandom.com/wiki/Buildings). Ressourcen-/Militärgebäude, Warehouse und Wall; historische Details nicht ungeprüft als aktuelle Regeln übernehmen.
- [Q7] [TheReviewBubble: War 2 Glory Review](https://thereviewbubble.weebly.com/war-2-glory-review.html). Persönlicher Spielerbericht, Radar-/Gebäudeverwendung mit geringerer Belegsicherheit.
- [Q8] [War2Glory Wiki: Troops](https://war2glory.fandom.com/wiki/Troops) und [BrowserGames.de: War2 Glory](https://www.browsergames.de/war2). Einheitengattungen und Fraktionen; keine vollständige Einheitentabelle rekonstruiert.
- [Q9] [War2Glory Wiki: Officers](https://war2glory.fandom.com/wiki/Officers). Unterschiedliche Offiziersrollen; eigene Führungs-/Skillregeln nicht automatisch ersetzen.
- [Q10] [WAR2 Glory Wiki: Edelsteine und Ränge](https://war2glory.fandom.com/de/wiki/Edelsteine_und_R%C3%A4nge). Historische Rang-/Fundprogression; weicht bei Stadtzahlen von unserem beschlossenen Modell ab.
