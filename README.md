# Federated Strategy — Arbeitstitel

Ein eigenständiges, offenes JavaScript-Strategiespiel, inspiriert vom Wunsch nach einem Spiel im Stil von War2Glory. Langfristiges Ziel: eigene Server betreiben und freiwillig mit anderen Servern zusammenspielen. Dieses Paket ist der erste lokale Entwicklungsprototyp, keine vollständige Nachbildung.

Repository: https://github.com/bavxhack/War2glory

**Weiterentwicklung mit Codex:** Der Startauftrag steht in [CODEX_PROMPT.md](CODEX_PROMPT.md). Projektregeln stehen in [AGENTS.md](AGENTS.md).

## Starten

Voraussetzung: Node.js 24 oder neuer. In den entpackten Projektordner wechseln:

```sh
npm start
```

Anschließend http://localhost:3000 öffnen. Keine zusätzlichen npm-Pakete und kein Installationsschritt erforderlich. Beenden mit Strg+C.

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

## Implementierter Stand 0.4

- Responsive Stadtlandschaft mit eigenen CSS-Grafiken für Gebäude, Wege, Grün und sichtbare Baustellen.
- Registrierung, Anmeldung, Abmeldung und Sitzungswiederaufnahme; jeder Kommandant besitzt eine getrennte Stadt.
- Ereignisbasierte Spielkommunikation über WebSocket statt privater HTTP-Spielendpunkte.
- Holz, Stein und Nahrung; Sägewerk, Steinbruch und Bauernhof.
- Neun feste Bauplätze; bestehende Gebäude können ausgebaut und freie Plätze bebaut werden.
- Eine serverseitig geprüfte, sequenzielle Warteschlange mit bis zu drei Bauaufträgen.
- Server prüft Kosten, Belegung und Aufträge; wiederholte Auftrags-IDs werden nur einmal verarbeitet.
- Atomare JSON-Spielstände pro Spieler, stabile Instanz-ID, ausdrückliche Übernahme der alten Demo-Stadt und Produktion während Abwesenheit.
- Maschinenlesbare Serverbeschreibung als Vorbereitung auf Föderation.
- Dauerhafte gemeinsame 24×24-Weltkarte mit Gelände, eindeutigen Spielerpositionen und 18 gemeinsam sichtbaren NPC-Städten.
- Kartenwechsel, Ausschnittsnavigation, Koordinatensuche, Zoom, Tastaturbedienung und öffentliche Stadtinformationen über WebSocket.
- Spielregeln und Serverintegration mit `npm test` prüfen.

Provisorische Regeln: Jedes Gebäude produziert seine Stufe in Rohstoffen pro Sekunde. Neubau beziehungsweise Ausbau auf Stufe n kostet 40 × n Holz und 30 × n Stein und dauert 5 × n Sekunden. Kosten werden beim Einreihen genau einmal abgezogen; Abbruch und Rückerstattung sind noch nicht verfügbar. Jedes Ressourcenlager fasst 2000 Einheiten. Das sind eigene Demo-Werte, keine bestätigten War2Glory-Werte.

Auch 24×24 Felder, 18 NPC-Städte, deren Schwierigkeitsstufen 1–3 sowie die intern vorbereiteten 500 Nahrung Kapazität und 25 Nahrung pro Stunde sind eigene **Prototypwerte**, keine Originalwerte. Die Oberfläche zeigt Entfernungen als euklidische Luftlinie; Marschrouten und -zeiten sind noch nicht implementiert. NPC-Vorräte sind gemeinsam in `world.json` vorbereitet, aber es gibt noch keine Regeneration, Plünderung oder Kampfaktion.

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

Nicht enthalten: Passwortwiederherstellung, zusätzliche Gebäudetypen, Abbruch von Bauaufträgen, Aufklärung, Forschung, Truppen, Generäle/Levelsystem, Kampf beziehungsweise tatsächliche NPC-Farmzüge, Bündnisse, Handel oder aktive Föderation. Der Quellcode wird im oben verlinkten Repository entwickelt; es gibt noch keine veröffentlichte Spielinstanz.

Planungsstand vom 27.09.2026: NPC-Städte zum Farmen von Nahrung und aufwertbare Generäle mit Truppenführung gehören zum Projektziel. Matrix ist der bevorzugte Ansatz für die Föderation. Diese späteren Etappen sind geplant; der ausführbare Prototyp steht mit Konten, eigenen Städten und WebSocket-Kommunikation auf Stand 0.3.

## Zusammenarbeit

Wir erweitern jeweils einen spielbaren Ablauf, prüfen ihn und dokumentieren die Regeln. Der vorgeschlagene nächste Schritt sind Truppen und Generäle mit Erfahrung und Levelsystem; danach folgen Aufklärung und erste NPC-Farmzüge. Die Reihenfolge kann nach deinen Prioritäten geändert werden.

Der enthaltene eigene Code steht unter MIT. Der Name ist ein vorläufiger Arbeitstitel. Es werden keine Originalgrafiken, Originaltexte oder Originalquellen von War2Glory mitgeliefert. Eine genaue Funktionsliste und gewünschte Ähnlichkeit stimmen wir anhand deiner Beschreibungen und Referenzen ab.
