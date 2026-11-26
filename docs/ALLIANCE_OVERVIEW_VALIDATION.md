# Modernisierte Bündnisübersicht – Prüfungen vom 26.11.2026

Ausgangspunkt: `main c0416ba` (PR #26 integriert). Der anfangs vorhandene Checkout war noch auf `e4af676`; nach Prüfung des sauberen Arbeitsverzeichnisses und des gemergten PRs wurde `origin/main` geholt und per Fast-forward übernommen. Umsetzung auf `codex/modern-alliance-overview`.

## Ergebnis

Der Bündnisbereich besitzt eine ruhigere, kompakte Gestaltung mit dunklen neutralen Flächen, dezenteren Rahmen, klarerer Schriftgewichtung und sparsamen Salbei-Akzenten. Der Profilkopf zeigt Bild, Name, Mitgliederzahl und Rolle; inhaltslose Standardbeschreibungen entfallen. Der mobile Profilkopf und die Standardembleme passen in schmale Fenster. Die angeheftete Mitteilung bleibt in der Übersicht sichtbar.

Fünf unmittelbar erreichbare Bereiche:

- **Übersicht:** Profil, Mitteilung, kompakte Mitgliedervorschau und Chat.
- **Mitglieder:** vollständige geladene Mitglieder-/Städteliste mit bestehenden Kontakt-, Liefer- und Rollenaktionen sowie weiterer Paginierung.
- **Chat:** eigener breiter Kanal mit bisheriger Historie, Eingabe, Moderation und ausdrücklichen Lesemarken.
- **Verwaltung:** Bild, Einladungen, interne Mitteilung und öffentliche Beschreibung; nur mit bestehenden Rechten.
- **Entdecken:** bestehendes öffentliches Verzeichnis und Suche.

Die Übersicht zeigt bei eigener Mitgliedschaft bis zu drei Mitglieder. Bei größeren Bündnissen führt „Alle Mitglieder (Anzahl)“ zur vollständigen Ansicht; weitere serverseitige Seiten bleiben dort ladbar. Öffentliche fremde Profile behalten die vollständige bereits geladene Liste. Es gibt keine neue Serverprojektion und kein Abschneiden weiterer Mitglieder ohne Folgeweg.

Bereiche wechseln innerhalb derselben React-Instanz. Ausgeblendete Eingaben bleiben gemountet und behalten ihre fachlichen Entwürfe. Der Wechsel zu einem anderen Bündnisprofil bzw. aus dem Hauptbereich verwendet weiterhin den bestehenden Entwurfsschutz. Nach Mitgliedschaftswechsel werden private Inhalte weiterhin über die neue `membershipId` verworfen. Rollen-/Bild-/Mitteilungsversionen und Upload-Schutz sind unverändert. Bereichswechsel erzeugen keine automatische Mutation oder Lesemarkierung.

Keine Änderung an Backend, Kosten, Spielmechaniken, Datenformat, Bündnisrechten oder gespeichertem Bildbestand. Die übrige Spieloberfläche und der reparierte Baukatalog bleiben außerhalb der neuen CSS-Regeln.

## Tatsächlich ausgeführt

Umgebung: Node.js 24, React 19, Vite 7, System-Chromium/Playwright, Browserlocale `de-DE`, Zeitzone `Europe/Berlin`. Nur isolierte Testwelten unter `work/` und `/tmp`; keine produktiven Spielstände.

- `npm ci --cache /workspace/War2glory/work/npm-cache`: erfolgreich mit bestehender Lockdatei, keine neue Abhängigkeit.
- `npm run build`: erfolgreich, 78 Module.
- `npm test`: **282 Tests bestanden, 0 fehlgeschlagen**.
- `ALLIANCE_IMAGE_UI=1 ALLIANCE_UI_ARTIFACTS=/workspace/War2glory/docs/screenshots/alliance-modern node scripts/validate-alliances-ui.mjs`: vollständiger Bündnisablauf erfolgreich. Der Prüfstand nutzt die tatsächlichen Bereichsbuttons für Verwaltung, Übersicht und Entdecken.
- Dabei geprüft: Gründung und Vorschau; Bild-Dateiauswahl, Serverprüfung, SVG-Ablehnung und Bildversion-Konflikt; Einladungen und Rechte; Bildanzeige auf Karte/im Verzeichnis; Live-Chat und Moderation; Mitteilungsentwurf mit Konflikt zwischen Tabs; reguläre Lieferung; echter Serverneustart mit Resume und erhaltenem Bild; Führung/Austritt/Auflösung; kein weiterer interner Inhalt nach Austritt; erhaltene Lieferungen.
- Zusätzliche Navigation: Chatentwurf bleibt über Mitglieder → Chat erhalten; Verwaltungsentwurf bleibt über Chat → Verwaltung erhalten. Ein interner Bereichswechsel öffnet keinen Verwerfen-Dialog. Tastatur-Tab/Enter öffnet das Verzeichnis; dasselbe bereits ausgewählte Profil lässt sich wieder öffnen.
- `node scripts/validate-alliance-overview.mjs`: fokussierter Browserprüfstand mit **sechs tatsächlichen Mitgliedschaften**. Übersicht zeigt drei; „Alle Mitglieder (6)“ zeigt sechs einschließlich des letzten Mitglieds. Verwaltungsentwurf bleibt erhalten. Alle fünf Bereiche bei **1440/768/390/320 CSS-Pixeln** ohne horizontalen Dokumentüberlauf und ohne unnötige Dialoge. Der Bereichsreiter darf auf kleinen Fenstern innerhalb seiner eigenen Leiste horizontal scrollen; sämtliche Buttons bleiben erreichbar.
- `git diff --check`: ohne Befund.

Keine JavaScript-Seitenfehler in beiden Browserprüfständen. Repräsentative Desktop-, Mobil- und Verwaltungsaufnahmen wurden visuell geprüft. Screenshotnachweise und maschinenlesbare Prüfschritte: `docs/screenshots/alliance-modern/` (`desktop.png`, `profile-390.png`, `profile-320.png`, Verwaltungs-/Gründungsaufnahmen, `overview-1440.png`, `overview-768.png`, `overview-390.png`, `overview-320.png`, `checks.json`, `overview-checks.json`).

## Grenzen

Chromium mit emulierten Fenstergrößen; keine physischen Geräte, Safari/Firefox oder Screenreader geprüft. Kein neuer Dockerbuild und kein Deployment für diese Clientüberarbeitung. Die vorhandenen Grenzen der JSON-Persistenz, des Chatfensters und der Bildpipeline gelten unverändert.
