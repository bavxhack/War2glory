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

## Stand 0.1

- Browseroberfläche mit einer gemeinsamen Demo-Stadt pro Server.
- Holz, Stein und Nahrung; Sägewerk, Steinbruch und Bauernhof.
- Ein Bauauftrag gleichzeitig, maximale Gebäudestufe 10.
- Server prüft Kosten und Aufträge; Browser setzt keine Rohstoffstände.
- JSON-Spielstände, stabile Instanz-ID, Produktion während Abwesenheit.
- Maschinenlesbare Serverbeschreibung als Vorbereitung auf Föderation.
- Spielregeln und Serverintegration mit `npm test` prüfen.

Provisorische Regeln: Jedes Gebäude produziert seine Stufe in Rohstoffen pro Sekunde. Ein Ausbau auf Stufe n kostet 40 × n Holz und 30 × n Stein und dauert 5 × n Sekunden. Jedes Ressourcenlager fasst 2000 Einheiten. Das sind eigene Demo-Werte, keine bestätigten War2Glory-Werte.

## Projektaufbau

| Pfad | Aufgabe |
| --- | --- |
| `apps/client/` | Oberfläche: JavaScript, HTML und CSS |
| `apps/server/` | Node.js-HTTP-Server und Speicherung |
| `packages/game-core/` | Spiellogik ohne Netzwerk- oder Datenbankabhängigkeit |
| `docs/PROJECT.md` | Ziel, Etappen und offene Produktentscheidungen |
| `docs/FEDERATION.md` | Entwurf für serverübergreifendes Spielen |
| `docs/DEVELOPMENT.md` | Vorgeschlagener Codex-/GitHub-Arbeitsablauf |
| `test/` | Regel- und Integrationstests |
| `data/<welt>/state.json` | Automatisch erzeugter lokaler Spielstand |

## Entwicklungsgrenzen

Dieser Stand bindet ausschließlich an 127.0.0.1. Es gibt noch keine Benutzerkonten oder getrennten Spielerrechte; alle lokalen Besucher steuern dieselbe Stadt. Internetbetrieb wird erst mit Konten, Zugriffsrechten und einem geeigneten Deployment ergänzt.

Genau einen Prozess pro Weltdatei starten. Die JSON-Ablage ist für den Prototyp gedacht, nicht für verteilte Serverprozesse. Aufträge werden vor der Erfolgsantwort gespeichert. Produktion wird anhand gespeicherter Zeitstempel nachberechnet. Vor manuellen Änderungen oder Backups den Server stoppen; zum Sichern den jeweiligen `data/<welt>/`-Ordner kopieren. Löschen dieses Ordners setzt die Welt einschließlich Instanz-ID zurück.

Nicht enthalten: Anmeldung, Multiplayer innerhalb einer Welt, Weltkarte, NPC-Farmstädte, Forschung, Truppen, Generäle/Levelsystem, Kampf, Bündnisse, Handel oder aktive Föderation. Der Quellcode wird im oben verlinkten Repository entwickelt; es gibt noch keine veröffentlichte Spielinstanz.

Planungsstand vom 27.09.2026: NPC-Städte zum Farmen von Nahrung und aufwertbare Generäle mit Truppenführung gehören zum Projektziel. Matrix ist der bevorzugte Ansatz für die Föderation. Diese Ergänzungen aktualisieren die Planung; der ausführbare Prototyp bleibt auf Stand 0.1.

## Zusammenarbeit

Wir erweitern jeweils einen spielbaren Ablauf, prüfen ihn und dokumentieren die Regeln. Der vorgeschlagene nächste Schritt ist eine Stadtkarte mit Bauplätzen und einer ausgebauten Bauwarteschlange. Die Reihenfolge kann nach deinen Prioritäten geändert werden.

Der enthaltene eigene Code steht unter MIT. Der Name ist ein vorläufiger Arbeitstitel. Es werden keine Originalgrafiken, Originaltexte oder Originalquellen von War2Glory mitgeliefert. Eine genaue Funktionsliste und gewünschte Ähnlichkeit stimmen wir anhand deiner Beschreibungen und Referenzen ab.
