# Isometrische Weltkarte – Umsetzung und Prüfung

Abschlussprüfung am 19.10.2026 mit Node.js 24 und gebautem React-/Vite-Client. Ausschließlich isolierte Testwelten; keine produktiven Spielstände verändert. CODEX_PROMPT.md und der übergeordnete Projektplan bleiben unverändert.

## Darstellung und Bedienung

Die Karte ist eine isometrische 2,5D-Szene mit rautenförmigem Boden, Schatten und nach Tiefe geordneten Objekten. Eigene, fremde und NPC-Städte besitzen unterschiedliche Gebäudeensembles. Wald, Hügel und Wasser entsprechen den vorhandenen Geländetypen; die Grafik fügt keine Spielinformationen hinzu. Stadttexte stehen aufrecht, tragen Koordinaten und Typ und werden bei überlappenden Beschriftungen versetzt. Die Bildherkunft ist in `apps/client/assets/README.md` dokumentiert. Mangels verifizierter Originalvorlagen wird keine originalgetreue War2Glory-Grafik behauptet.

Die Windrose bleibt innerhalb des Kartenrahmens unten rechts. Acht Richtungen entsprechen der Bildschirmrichtung der Kamera; die Landschaft läuft entgegengesetzt. Ein kurzer Druck bewegt 64 Bildpixel. Nach 220 ms Haltezeit folgt Bewegung mit 170 Bildpixeln pro Sekunde, unabhängig von Bildrate und Tastaturwiederholung. Loslassen außerhalb, Pointer-Cancel, Fokusverlust und versteckte Dokumente stoppen die Bewegung. Enter/Leertaste und Touch werden unterstützt. Navigation verändert weder Auswahl noch Zoom und löst keine Spielaktion aus. Ziehen, Wischen, Mausrad und lose Pfeiltasten bewegen die Kamera nicht.

Suche, eigener Stadtmittelpunkt und expliziter Zoom verwenden dieselbe Projektion. Der anfängliche Maßstab beträgt 144 px pro Raute, auf schmalen Geräten 128 px; Navigation hält den Maßstab konstant. Die responsive Kartenfläche benötigt kein Scrollen der Seite. Jenseits der ausdrücklich gezeichneten Weltgrenze liegt eine dekorative Wasserfläche ohne auswählbare Felder.

## Projektion, Daten und Spielstände

`apps/client/isometric-map.js` enthält Projektion und inverse Feldwahl: `screenX=(x-y)*w/2`, `screenY=(x+y)*w/4`. Kamera und Trefferprüfung verwenden dieselben Formeln. Bewegungen stoppen an der ersten Weltgrenze, statt seitlich weiterzugleiten. Gebäude werden nach `x+y` gezeichnet; explizite Trefferflächen berücksichtigen die sichtbare Architektur. Bodenkoordinaten liegen hinter Gebäuden, Auswahlkontur und aufrechte Beschriftungen darüber.

Die Kamera reagiert lokal, ohne eine WebSocket-Antwort abzuwarten. Der Cache lädt fehlende 12×12-Blöcke, am Weltende kleiner, über das bestehende `map.viewport`: eine Anfrage gleichzeitig, mindestens 110 ms Abstand, Retry nach 1800 ms. Vorhandene Blöcke werden nicht erneut angefragt. Verspätete Antworten setzen die Kamera nicht zurück. Niedrigere Revisionen werden verworfen; höhere Revisionen erneuern den Cache. Auswahl außerhalb einer Antwort und bereits geladene Details derselben Stadt bleiben erhalten. Timer werden beim Verlassen beendet.

Es gibt keine neuen Serverbefehle, Geländearten oder Spielregeln. Auswahl, Aufklärung und Feldaktionen verwenden die bisherigen Detail-/Aktionspfade. Spielerschema 17, Weltschema 4 und gespeicherte Koordinaten bleiben bestehen; keine Migration oder Rücksetzung ist erforderlich.

## Tatsächlich ausgeführte Prüfungen

| Befehl | Ergebnis |
| --- | --- |
| `npm test` | 238 Tests bestanden, 0 fehlgeschlagen |
| `npm run build` | Produktionsbuild erfolgreich |
| `PLAYWRIGHT_MODULE=/opt/codex/runtimes/cua/lib/node_modules/playwright/index.mjs node scripts/validate-world-map-ui.mjs` | Neun Browserprüfgruppen erfolgreich, keine JavaScript-Seitenfehler |
| `git diff --check` | Keine Whitespacefehler |

Sechs neue automatisierte Kameratests prüfen Projektion und inverse Auswahl bei mehreren Maßstäben und Weltenden, alle acht Bildschirmrichtungen, Stopp an Grenzen, zeitbasierte Bewegung, Abbruch/Richtungswechsel, Cache-Revisionen und begrenzte Nachladeblöcke einschließlich kleiner Welten. Zwei Transporttests prüfen erhaltene Auswahl/Details, veraltete Antworten und weiterhin leere Felder. Bestehende Spiellogik- und Persistenztests bleiben Bestandteil des vollständigen Testsatzes.

Das Browserskript startet einen echten lokalen Server mit einer 48×48-Testwelt, zwei Konten und benachbarten eigenen, fremden und NPC-Städten. Es protokolliert öffentliche Kartenanfragen und verzögert gezielt eine Antwort. Geprüft wurden:

- Alle acht kurzen Richtungsbewegungen, sofortige Kamerareaktion und unveränderter Maßstab/Scrollzustand.
- Kontinuierliches Halten und Loslassen außerhalb ohne Auswahländerung.
- Enter-/Leertasten-Halten sowie Pointer-Cancel, Fenster-Blur und tatsächlicher DOM-Fokusverlust.
- Verzögerte Antwort ohne Kamerarücksprung oder Verlust der Auswahl.
- Suche zu allen vier Weltecken, dortige Feldwahl und deaktivierte Grenzrichtungen.
- Tatsächlicher Pixelklick auf ein projiziertes Feld, Stadtwahl, Tiefensortierung und aufrechte Beschriftungen.
- 390×844 und 320×844: Windrose im Rahmen, kein Dokumentüberlauf, emulierte native Touch-Taps und Touch-Halten, unveränderter Zoom/Scrollzustand.
- Sitzungswiederaufnahme durch mobilen Reload mit passender Anfangskamera und Maßstab.
- Begrenzte Kartenanfragen und keine weiteren Anfragen bei ruhender, bereits geladener Kamera.

Desktop und beide Mobilgrößen wurden mit aktivierter Einstellung für reduzierte Bewegung geprüft. Die Screenshots wurden zusätzlich visuell angesehen: [Desktop](screenshots/world-map/desktop.png), [390 px](screenshots/world-map/mobile-390.png), [320 px](screenshots/world-map/mobile-320.png), [Weltgrenze](screenshots/world-map/world-edge.png). [Bereinigte Prüfergebnisse](screenshots/world-map/checks.json). Lokale Laufprotokolle und Testwelten liegen ausschließlich unter ignoriertem `work/`.

Grenzen: Headless-Chromium, kein physisches Touchgerät, Safari/Firefox oder Screenreader-Audit. Touch wurde über Chromium-Eingabeemulation geprüft; Cancel und Fenster-Blur synthetisch ausgelöst. Alle vier Ecken wurden per Suche erreicht, kein durchgehender Halteweg über die gesamte Welt protokolliert. Kein neuer kostenpflichtiger Missionsstart, Serverneustart, Deployment oder Dockerbuild in diesem Kartenprüflauf. Es handelt sich um eine feste isometrische Darstellung, keine frei drehbare 3D-Engine.
