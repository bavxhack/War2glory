# Federated Strategy — Arbeitstitel

Ein eigenständiges, offenes JavaScript-Strategiespiel, inspiriert vom Wunsch nach einem Spiel im Stil von War2Glory. Langfristiges Ziel: eigene Server betreiben und freiwillig mit anderen Servern zusammenspielen. Dieses Paket ist der erste lokale Entwicklungsprototyp, keine vollständige Nachbildung.

Repository: https://github.com/bavxhack/War2glory

**Weiterentwicklung mit Codex:** Der Startauftrag steht in [CODEX_PROMPT.md](CODEX_PROMPT.md). Projektregeln stehen in [AGENTS.md](AGENTS.md).

## Starten

Voraussetzung: Node.js 24 oder neuer. Abhängigkeiten installieren und den React-Client bauen:

```sh
npm ci
npm run build
```

Danach den Spielserver starten:

```sh
npm start
```

Anschließend http://localhost:3000 öffnen. Beenden mit Strg+C.

Zwei unabhängige Welten: in zwei Terminals jeweils im Projektordner starten:

```sh
npm run start:alpha
```

```sh
npm run start:beta
```

Alpha: http://localhost:3000 · Beta: http://localhost:3001. **Die beiden Welten kommunizieren noch nicht miteinander.** Individuell: `npm start -- --world meine-welt --port 3010`.

## Mit Docker Compose starten

Voraussetzung ist Docker mit dem Compose-Plugin. Das veröffentlichte Image wird aus der GitHub Container Registry geladen und der Server anschließend im Hintergrund gestartet:

```sh
docker compose pull
docker compose up -d
```

Die Spieloberfläche ist danach unter http://localhost:3000 erreichbar. Der Spielstand liegt in dem benannten Volume `war2glory_game-data` und bleibt bei Container-Updates erhalten. Status und Protokollausgabe lassen sich so prüfen:

```sh
docker compose ps
docker compose logs -f game-server
```

Port und Weltname können ohne Änderung der Compose-Datei gesetzt werden:

```sh
PORT=3010 WORLD_NAME=meine-welt docker compose up -d
```

Die Portfreigabe bindet standardmäßig nur an `127.0.0.1`. Das ist weiterhin ein lokaler Prototyp ohne Anmeldung und darf nicht unverändert öffentlich ins Internet gestellt werden. Ein Backup entsteht bei gestopptem Server beispielsweise mit `docker run --rm -v war2glory_game-data:/data -v "$PWD":/backup alpine tar czf /backup/war2glory-data.tar.gz -C /data .`.

Bei jedem Pull Request testet die GitHub-Actions-Pipeline den Code und prüft den Container-Build, veröffentlicht aus Sicherheitsgründen aber kein Image aus fremdem Pull-Request-Code. Bei jedem Branch-Push baut der Workflow anschließend ein AMD64-/ARM64-Image und lädt es selbstständig in die GitHub Container Registry hoch. Der Branch `main` erhält dabei `ghcr.io/bavxhack/war2glory:latest`, andere Branches erhalten ein bereinigtes Branch-Tag und jeder veröffentlichte Build zusätzlich ein `sha-…`-Tag. Tags wie `v0.2.0` erzeugen ein gleichnamiges Image-Tag. Der Upload verwendet ausschließlich das von GitHub bereitgestellte `GITHUB_TOKEN`; ein eigenes Registry-Passwort ist nicht nötig. Für öffentliche Images ist kein Registry-Login zum Herunterladen erforderlich. Die erstmalige Sichtbarkeit des Pakets wird in den GitHub-Paketeinstellungen des Repository-Eigentümers festgelegt.

## Implementierter Stand 0.10

- Responsive Stadtlandschaft mit modernen, lokal ausgelieferten Illustrationen für alle Gebäude, Infanterie, Aufklärungsflugzeuge, Generäle und Städte. Die eigene KI-generierte Bildtafel liegt in `apps/client/assets/game-art.png`; Details in `apps/client/assets/README.md`.
- React-19-Oberfläche mit Vite-Build, zentralem WebSocket-Transport und unverändertem serverseitigem Spielmodell.
- Registrierung, Anmeldung, Abmeldung und Sitzungswiederaufnahme; jeder Kommandant besitzt eine getrennte Stadt.
- Ereignisbasierte Spielkommunikation über WebSocket statt privater HTTP-Spielendpunkte.
- Holz, Stein und Nahrung; Sägewerk, Steinbruch und Bauernhof.
- Neun feste Bauplätze; bestehende Gebäude können ausgebaut und freie Plätze bebaut werden.
- Ressourcenspezifische Lagergrenzen, ausbaubare Lagerhäuser und sofortiger Gebäudeabriss mit serverseitiger Vorschau, nachgewiesener Teilrückerstattung und wieder nutzbaren Bauplätzen.
- Eine serverseitig geprüfte, sequenzielle Warteschlange mit bis zu drei Bauaufträgen.
- Server prüft Kosten, Belegung und Aufträge; wiederholte Auftrags-IDs werden nur einmal verarbeitet.
- Atomare JSON-Spielstände pro Spieler, stabile Instanz-ID, ausdrückliche Übernahme der alten Demo-Stadt und Produktion während Abwesenheit.
- Maschinenlesbare Serverbeschreibung als Vorbereitung auf Föderation.
- Dauerhafte gemeinsame 24×24-Weltkarte mit Gelände, zufällig vergebenen eindeutigen Spielerpositionen und 18 gemeinsam sichtbaren NPC-Städten.
- Kartenwechsel, Verschieben per Maus, Touch, Richtungstasten oder Pfeiltasten, Koordinatensuche, Zoom und öffentliche Stadtinformationen über WebSocket.
- Abgeleitete Kommandantenpunkte, ein getrennter Militärbereich mit vier Bauplätzen sowie persistente Gruppenausbildung von Spähern/Infanterie mit drei eigenen Warteschlangenslots je Kaserne. Einheitenkarten visualisieren Späher als Aufklärungsflugzeuge.
- Ein idempotent vergebener kostenloser Startgeneral, eine auf mehrere Generäle ausgelegte Verwaltung mit sicherer Namensänderung und verlustfreie NPC-Aufklärung mit gezielter Generalwahl, Hin-/Rückmarsch, privaten historischen Berichten und einmaliger Erstziel-Erfahrung.
- Führung, Angriff, Verteidigung sowie getrennte Erfahrungs-/Skillzähler sind als persistente und getestete Grundlage vorhanden. Manuelle XP-Umrechnung und Skillverteilung sind mit dem vorläufigen Regelsatz aus Auftrag 10 aktiv; Führung verbessert Bürgermeister, verteilte Angriff-/Verteidigungspunkte wirken auf neue Farmzüge.
- Vollständige NPC-Farmzüge mit reserviertem General und Infanterie, chronologischem Kampf, begrenzter Nahrungsbeute, Rückkehr, privaten Berichten, General-XP und vorzeichenbehaftetem Kampfbeitrag.
- Truppenübersicht je Einheitentyp: Gesamtbestand, stationiert, lebend unterwegs und separat in Ausbildung. Zurückkehrende Farmzüge zählen nur Überlebende; abgeschlossene Einsätze werden nicht doppelt gezählt.
- Gemeinsame NPC-Garnisonen und Nahrung regenerieren zeitbasiert. Ein wiederaufnehmbares Transaktionsjournal schützt Welt-/Spieleränderungen; fällige Einsätze werden auch offline und nach Neustarts stabil geordnet verarbeitet.
- Laufender Nahrungsunterhalt erfasst stationierte und marschierende Truppen genau einmal. Nach einer Schonfrist verursacht anhaltender Mangel nachvollziehbare Hungerverluste; Ausbildung pausiert dabei, und verringerte Traglast kann Beute auf dem Rückweg kosten.
- Ein freier General kann serverseitig geprüft als Bürgermeister eingesetzt, gewechselt oder abberufen werden. Seine Führung erhöht ausschließlich die laufende Nahrungsproduktion.
- Spielregeln und Serverintegration mit `npm test` prüfen.

Für die Frontend-Entwicklung laufen Spielserver und Vite getrennt: `npm start` stellt den WebSocket auf Port 3000 bereit, `npm run dev` die Oberfläche auf http://localhost:5173. Der Vite-Server leitet `/game` gezielt an den lokalen Spielserver weiter. Der normale Server und das Container-Image verwenden ausschließlich den mit `npm run build` erzeugten Client in `apps/client/dist`; fehlt er, erklärt die Startseite den erforderlichen Build-Schritt.

Provisorische Regeln: Jedes Produktionsgebäude produziert seine Stufe in Rohstoffen pro Sekunde. Neubau beziehungsweise Ausbau auf Stufe n kostet 40 × n Holz und 30 × n Stein und dauert 5 × n Sekunden. Kosten werden beim Einreihen genau einmal abgezogen; ein Auftragsabbruch ist noch nicht verfügbar. Die Grundkapazität beträgt je Ressource 2000. Produktionsgebäude bringen ab Stufe 2 weitere 250 Einheiten je zusätzlicher Stufe für ihre Ressource, Lagerhäuser 500 je Stufe für alle Ressourcen. Ein sofortiger Abriss erstattet abgerundet 10 Prozent der nachgewiesenen Investitionen. Überbestände bleiben erhalten und pausieren die jeweilige Produktion. Das sind eigene Demo-Werte, keine bestätigten War2Glory-Werte.

**Vorläufige Farmregeln, keine War2Glory-Originalwerte:** NPC-Garnisonen starten mit `5 × Schwierigkeit` Infanteristen und bauen alle 300 Sekunden einen Verteidiger wieder auf. Infanterie trägt je Überlebendem 20 Nahrung. Bei einem Sieg (`A > D`) fallen alle Verteidiger und `ceil(D / 2)` Angreifer; bei `A <= D` fallen in der alten Kampfversion alle Angreifer und `floor(A / 2)` Verteidiger. Neue Farmzüge verwenden die unten beschriebene Skillversion; bereits laufende alte Einsätze behalten ihre Regeln. Ein unverteidigtes Ziel verursacht keine Verluste oder Kampfbelohnung. Vernichtete Verteidiger geben je 2 General-XP; der Kampfbeitrag ist NPC-Verluste minus eigene Verluste. Der General überlebt immer. Beute wird erst bei Rückkehr bis zur dann freien Lagerkapazität eingelagert; Überlauf verfällt. Pro Einsatz dürfen über alle beteiligten Einheitentypen summiert höchstens 10.000 Einheiten entsendet werden. Für Aufklärung und Farmzüge gibt es derzeit kein Führungslimit; Führung wirkt beim Bürgermeister; militärische Skillboni werden für neue Farmzüge beim Start festgeschrieben. Eine spätere Reichweitenbegrenzung durch Nahrung ist ausdrücklich noch nicht implementiert.

**Vorläufige Versorgungsregeln, keine War2Glory-Originalwerte:** Infanterie verbraucht 0,10 und Späher 0,05 Nahrung pro Sekunde. Bei leerem Lager und höherem Unterhalt als Produktion läuft eine 30-minütige Schonfrist; anschließend gehen 5 Prozent der noch lebenden Truppen (aufgerundet, mindestens eine Einheit) und danach alle fünf Minuten weitere Truppen verloren. Verluste werden proportional und deterministisch auf stationierte und konkrete Einsatzgruppen verteilt. Eine Versorgungspause bewahrt den bisherigen Mangelzähler; erst 60 Sekunden stabile Versorgung setzen ihn zurück. Ausbildung pausiert während tatsächlichen Mangels ohne erneute Kosten. Der Bürgermeisterbonus beträgt vorläufig ein Prozent je Führungspunkt, höchstens 50 Prozent, und wirkt nur auf Bauernhofertrag. Diese Balancewerte sind Vorschläge zur Prüfung.

Auch 24×24 Felder, 18 NPC-Städte, deren Schwierigkeitsstufen 1–3 sowie die intern vorbereiteten 500 Nahrung Kapazität und 25 Nahrung pro Stunde sind eigene **Prototypwerte**, keine Originalwerte. Die Aufklärung verwendet vorläufig reine Luftlinienzeiten; Terrain-Wegfindung und andere Marscharten sind noch nicht implementiert. NPC-Vorräte und Garnisonen sind gemeinsam in `world.json` gespeichert; Regeneration, Plünderung und der vorläufige deterministische Kampf sind aktiv.

## Projektaufbau

| Pfad | Aufgabe |
| --- | --- |
| `apps/client/` | Oberfläche: JavaScript, HTML und CSS |
| `apps/server/` | Node.js-HTTP-/WebSocket-Server, Anmeldung und Speicherung |
| `packages/game-core/` | Spiellogik ohne Netzwerk- oder Datenbankabhängigkeit |
| `docs/PROJECT.md` | Ziel, Etappen und offene Produktentscheidungen |
| `docs/FEDERATION.md` | Entwurf für serverübergreifendes Spielen |
| `docs/DEVELOPMENT.md` | Vorgeschlagener Codex-/GitHub-Arbeitsablauf |
| `test/` | Regel- und Integrationstests |
| `data/<welt>/` | Lokale Welt-, Konto- und getrennte Spielerdateien |

Protokoll, Origin-Konfiguration, Sitzungsgrenzen, Backups und Altstadtübernahme beschreibt [`docs/WEBSOCKET.md`](docs/WEBSOCKET.md).

## Entwicklungsgrenzen

Dieser Stand bindet standardmäßig an 127.0.0.1. Konten und getrennte Spielerrechte sind implementiert; für Internetbetrieb fehlen weiterhin Passwortwiederherstellung, E-Mail-Verifikation, administrativer Missbrauchsschutz und ein erprobtes Deployment.

Genau einen Prozess pro Weltverzeichnis starten. Die JSON-Ablage ist für den Prototyp gedacht, nicht für verteilte Serverprozesse. Aufträge werden vor der Erfolgsantwort gespeichert. Produktion wird anhand gespeicherter Zeitstempel nachberechnet. Vor manuellen Änderungen oder Backups den Server stoppen; zum Sichern den jeweiligen `data/<welt>/`-Ordner kopieren. Löschen dieses Ordners setzt die Welt einschließlich Instanz-ID zurück.

Nicht enthalten: Passwortwiederherstellung, Abbruch von Bauaufträgen, Forschung, PvP, Eroberung, weitere Generäle, Bündnisse, Handel oder aktive Föderation. Bei migrierten Altgebäuden ohne Kostennachweis bleibt die frühere Investition ausdrücklich unbekannt und wird nicht aus heutigen Preisen geschätzt. Der Quellcode wird im oben verlinkten Repository entwickelt; es gibt noch keine veröffentlichte Spielinstanz.

Historischer Planungsstand vom 28.09.2026 (durch Aufträge 8–10 erweitert): NPC-Städte zum Farmen von Nahrung und aufwertbare Generäle mit Truppenführung gehören zum Projektziel. Matrix ist der bevorzugte Ansatz für die Föderation. Lagerwirtschaft, Abriss, Aufklärung, erste Truppen und der Startgeneral sind nun als Prototyp implementiert; Kampf, Beute und Föderation bleiben geplant.

## Zusammenarbeit

Wir erweitern jeweils einen spielbaren Ablauf, prüfen ihn und dokumentieren die Regeln. Als eigener nächster Auftrag folgen Universität und erste Wirtschafts-/Lagerforschungen; diese sind noch nicht implementiert. Die Reihenfolge kann nach deinen Prioritäten geändert werden.

Der enthaltene eigene Code steht unter MIT. Der Name ist ein vorläufiger Arbeitstitel. Es werden keine Originalgrafiken, Originaltexte oder Originalquellen von War2Glory mitgeliefert. Eine genaue Funktionsliste und gewünschte Ähnlichkeit stimmen wir anhand deiner Beschreibungen und Referenzen ab.

## General-Skills (Auftrag 10, vorläufiger Regelsatz)

Im Generalmodal zuerst einen Kauf prüfen und bewusst bestätigen, anschließend freie Punkte in einem lokalen Entwurf verteilen, prüfen und speichern. Abbrechen verwirft nur den Entwurf. Der n-te jemals erworbene Punkt kostet `10 × n` XP; bei k erworbenen Punkten kosten m weitere `5 × m × (2k + m + 1)`. Drei Punkte kosten 60 XP, bei 75 bleiben 15; die nächsten zwei kosten 90. Gesamt-XP, Level und bestehende Erfahrungsquellen bleiben erhalten, verwendete XP werden separat gespeichert. Jeder Skillpunkt erhöht genau eine Eigenschaft um eins, ohne Respec oder automatische Käufe.

Führung nutzt den vorhandenen Grundwert plus bestätigte Zuweisungen; als Bürgermeister erhöht sie die Grundproduktion um ein Prozent je Punkt bis maximal 50 Prozent. Bei Grundführung 10, zwei zusätzlichen Punkten und 2 Nahrung/s steigt der Ertrag von 2,20 auf 2,24. Der alte Ertrag wird bis zur Speicherung abgerechnet; erst danach gilt der neue Bonus. Hungerzähler bleiben erhalten und Versorgung wird neu geprüft.

Für neue Farmzüge (`npc-pve-2-skills-provisional`) zählen nur verteilte Angriff-/Verteidigungspunkte, jeweils zwei Prozent pro Punkt, maximal 25 Punkte bzw. 50 Prozent. Alte Grundwerte bleiben erhalten und geben keinen militärischen Bonus. Führung kann bis zum effektiven Bürgermeisterwert 50 gesteigert werden; bereits höhere Altwerte bleiben bestehen. Alle Grenzen werden vor Speicherung serverseitig geprüft.

Bei N lebenden Angreifern, D Verteidigern, Angriffsbonus a und Verteidigungsbonus v gilt: Sieg genau bei `N × (1+a) > D`. Bei Sieg fallen D Verteidiger und `min(N, ceil(D/2 × (1-v)))` Angreifer. Bei Niederlage fallen `min(D, floor(N × (1+a)/2))` Verteidiger und `ceil(N × (1-v))` Angreifer: **Überlebende kehren auch bei Niederlage zurück, ohne Beute**. Vergleiche und Rundung werden ganzzahlig gerechnet. Beispiel: 10 gegen 10 mit fünf Angriffspunkten gewinnen mit fünf eigenen Verlusten; 10 gegen 20 mit zehn Verteidigungspunkten verlieren acht und bringen zwei Überlebende heim. Ohne militärische Skills entsprechen Ergebnisse der alten Version.

Neue Einsätze speichern Boni beim Start. Skillkäufe und Verteilung während eines Einsatzes sind möglich, verändern dessen Kampf jedoch nicht. Alte laufende Missionen behalten `npc-pve-1-provisional`; historische Berichte bleiben unverändert. Traglast, Geschwindigkeit, Unterhalt und Hungerregeln bleiben erhalten. Die Zahlen sind eigene Prototypvorschläge aus Auftrag 10, keine War2Glory-Originalregeln.
