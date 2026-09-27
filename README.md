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

## Stand 0.2

- Browseroberfläche mit einer gemeinsamen Demo-Stadt und einer responsiven Stadtkarte pro Server.
- Holz, Stein und Nahrung; Sägewerk, Steinbruch und Bauernhof.
- Neun feste Bauplätze; bestehende Gebäude können ausgebaut und freie Plätze bebaut werden.
- Eine serverseitig geprüfte, sequenzielle Warteschlange mit bis zu drei Bauaufträgen.
- Server prüft Kosten, Belegung und Aufträge; wiederholte Auftrags-IDs werden nur einmal verarbeitet.
- JSON-Spielstände, stabile Instanz-ID, explizite Migration von Schema 1 auf 2 und Produktion während Abwesenheit.
- Maschinenlesbare Serverbeschreibung als Vorbereitung auf Föderation.
- Spielregeln und Serverintegration mit `npm test` prüfen.

Provisorische Regeln: Jedes Gebäude produziert seine Stufe in Rohstoffen pro Sekunde. Neubau beziehungsweise Ausbau auf Stufe n kostet 40 × n Holz und 30 × n Stein und dauert 5 × n Sekunden. Kosten werden beim Einreihen genau einmal abgezogen; Abbruch und Rückerstattung sind noch nicht verfügbar. Jedes Ressourcenlager fasst 2000 Einheiten. Das sind eigene Demo-Werte, keine bestätigten War2Glory-Werte.

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

Nicht enthalten: Anmeldung, Multiplayer innerhalb einer Welt, zusätzliche Gebäudetypen, Abbruch von Bauaufträgen, Weltkarte, NPC-Farmstädte, Forschung, Truppen, Generäle/Levelsystem, Kampf, Bündnisse, Handel oder aktive Föderation. Der Quellcode wird im oben verlinkten Repository entwickelt; es gibt noch keine veröffentlichte Spielinstanz.

Planungsstand vom 27.09.2026: NPC-Städte zum Farmen von Nahrung und aufwertbare Generäle mit Truppenführung gehören zum Projektziel. Matrix ist der bevorzugte Ansatz für die Föderation. Diese späteren Etappen sind geplant; der ausführbare Prototyp steht mit der Stadtkarte auf Stand 0.2.

## Zusammenarbeit

Wir erweitern jeweils einen spielbaren Ablauf, prüfen ihn und dokumentieren die Regeln. Der vorgeschlagene nächste Schritt sind Konten, mehrere Städte beziehungsweise Spieler, Berechtigungen und eine belastbare Speicherung. Die Reihenfolge kann nach deinen Prioritäten geändert werden.

Der enthaltene eigene Code steht unter MIT. Der Name ist ein vorläufiger Arbeitstitel. Es werden keine Originalgrafiken, Originaltexte oder Originalquellen von War2Glory mitgeliefert. Eine genaue Funktionsliste und gewünschte Ähnlichkeit stimmen wir anhand deiner Beschreibungen und Referenzen ab.
