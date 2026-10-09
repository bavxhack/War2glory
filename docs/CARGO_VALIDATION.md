# Auftrag 14: Prüfbelege für Fracht und Betriebsöl

Geprüft am 09.10.2026 auf Basis von `main` (`08513f90a7e8f4981748bd90da254a5713841bdb`), Node.js 24.19.0. Auftrag-14-Prompt und Projektplan wurden vom aktuellen main übernommen; fremde Änderungen und der abgeschlossene Auftrag 13 bleiben erhalten. Neue Balancewerte sind vorläufige eigene Projektentscheidungen, keine War2Glory-Originalwerte.

## Ausgeführte Prüfungen

| Befehl/Ablauf | Ergebnis |
| --- | --- |
| `npm test` | 163 Tests bestanden, 0 Fehler, 0 übersprungen |
| `node --test test/cargo.test.js test/cargo-storage.test.js` | Frachtkern und Speicher-/WebSocket-Abläufe geprüft; zusätzlich danach Niederlage mit Überlebenden im vollständigen Testlauf |
| `npm run build` | Vite-Produktionsbuild erfolgreich, 47 Module |
| `git diff --check` | Keine Whitespacefehler |
| `docker compose config --quiet` | Compose-Konfiguration gültig |
| `BUILDX_CONFIG="$PWD/work/buildx" docker build --secret id=proxy_ca,src=/etc/ssl/certs/ca-certificates.crt -f work/Dockerfile.validation -t war2glory:task14-validation .` | Erfolgreicher Container-Build einschließlich npm ci und Clientbuild |
| Lokaler Start des gebauten Containers mit Port `127.0.0.1:3199:3000` | `/health` und `/` jeweils HTTP 200; Testcontainer anschließend gestoppt |
| `node work/browser-cargo.mjs` | Echter Chromium-/Playwright-Ablauf erfolgreich auf Desktop 1280×900 und Mobil 390×844, keine Browserfehler |

Die temporäre Dockerfile-Kopie unterscheidet sich ausschließlich beim npm-ci-Schritt: BuildKit-Secret mit CA-Vertrauen für den Entwicklungsproxy, TLS-Prüfung aktiv. Keine CA/Geheimnisse in Image oder Repository aufgenommen. Buildx-Zustand, Testwelten, Browser-/Buildprotokolle und Screenshots liegen unter ignoriertem `work/`. Das produktive Dockerfile bleibt unverändert. Es wurde kein Image veröffentlicht und keine Anwendung deployt.

## Unabhängige Rechenbeispiele

- Gemeinsame Startgrenze: 1200 Traglast, 1140 eigene Güter + 60 Betriebsöl passen exakt; 1141 + 60 scheitern ohne Abbuchung/Reservierung. Gemischte Holz-/Stein-/Nahrungs-/Ölladung wird gemeinsam geprüft.
- Freiwillige Ladung 100 Holz/100 Stein/50 Nahrung/50 Öl plus 60 Betriebsöl zieht 100/100/50/110 ab. Ausschließlich Betriebsöl verbrennt; die 50 freiwilliges Öl bleiben eigene Rückfracht.
- 1000 Traglast, 200 eigene Güter, 100 Hinwegöl/100 Reserve: Startbelegung 400, freie Startplätze 600, maximal 700 zusätzliche Güter am Ziel ohne Verluste.
- E=10, T=60 Sekunden, +9 Minuten: F=110, Hinweg 100, Rückweg 10. +10 Minuten verlängern den Hinweg auf 11 Minuten; die vorhandenen Verhältnis-/Zeitbeispiele bleiben geprüft.
- Bruchteilfall E=0,005: Startzahlung 1, Hinwegverbrauch 0,995 einschließlich Rundungsrest, Rückweg 0,005. Nach Rückkehr verbleiben exakt 0; gemeinsame Zähler/Nenner beweisen die Bilanz ohne gerundete Tick-Abzüge.
- 20 Infanterie/4 LKW, Distanz 5: Traglast 1200, E=30/F=60. Nach Kampf gegen 10 Verteidiger: 15/3 Überlebende, Traglast 900, Reserve 22,5, verlorenes Betriebsöl 7,5, ganzzahlige Güterplätze 877. 300 eigene Güter erlauben 577 neue Nahrung. 1000 eigene Güter werden auf 877 gekürzt, Verlust 123, keine Beute.
- Proportionale Verluste verwenden BigInt und größte Bruchreste, Gleichstand Holz/Stein/Nahrung/Öl. Vier gleiche Mengen 250 werden auf 220/219/219/219 verteilt. Weitere ungleiche Rest- und Gleichstandfälle geprüft.
- Niederlage mit tatsächlichen Überlebenden bringt eigene Ladung zurück, ohne neue Beute; vollständiger Verlust verliert sämtliche Ladung und verbleibende Reserve. General-, Kampf-, XP- und Punkteformeln bleiben bestehend.
- Stadtlagerprüfung getrennt je Ressource, eigene Ladung vor Beute: bei 1900 Nahrung und 50 eigener Nahrung passen zunächst 50 eigene und anschließend 50 von 577 Beute, Beuteüberlauf 527. Eigener Öl-/Holz-/Steinüberlauf wird separat bilanziert. Bestehende Überbestände werden nicht gekürzt.
- Späher mit 2 Öl Tankraum je Einheit/2 Einheiten laden exakt 4 Betriebsöl; kleinere Tanks scheitern. Tankraum erlaubt weder freiwilliges Öl noch Güter/Beute. Geänderte positive Ölraten können die konservative Rückwegreserve eines Raid-Typs überschreiten und liefern einen konkreten Sperrgrund.

## Persistenz, Integration und Regression

Geprüft: Neustarts mitten im Hinweg, am Kampf, mitten im Rückweg und bei Rückkehr; aktive Missionen behalten gespeicherte Raten/Traglasten bei Konfigurationsänderung. Fehler beim Schreiben nach NPC-Beuteabzug oder während Rückkehr hinterlassen ein wiederaufnehmbares Journal. Wiederherstellung erzeugt genau eine Einlagerung, Belohnung und einen neuen ungelesenen Bericht. Große Offlinefortschreibung entspricht mehreren kleinen Ereignisschritten.

Zwei Spieler teilen tatsächlich verfügbare NPC-Nahrung nach ihren jeweiligen eigenen Ladungen. Vorschauen reservieren keinen Vorrat. Zwei WebSocket-Tabs mit identischer requestId/Payload buchen nur einmal, geänderte Ladung/gleiche ID und veraltete Vorschau werden abgewiesen. Wiederverbindung und spätere Wiederholung erzeugen keine Güter. Private Kartenantworten und andere Spielersnapshots enthalten keine fremde Fracht.

Schema 14 → 15 verändert alte laufende Missionen und Berichte nicht. Ältere Ketten einschließlich Missionen 1–3 bleiben im Regressionstest; Version 4 mit historischen Nullraten endet ohne rückwirkende Fracht/Ölrechnung. Migration bewahrt Profile, Porträts, Bewerber, Forschung, Nachrichten, Lesestatus und Versorgungshistorie. Schreibfehler lassen den alten Stand unverändert und sind erneut ausführbar; unbekannte/inkonsistente Frachtversionen und Ladungs-/Ölbilanzen stoppen ohne Reset.

Stationärer Stadtunterhalt, historische Versorgungsscopewechsel, Abreise/Rückkehr, Mangelzyklen und Rückkehr an exakter Hungergrenze bleiben geprüft. Neue Einsätze führen weder Reiseunterhalt noch Verbrauch mitgenommener Nahrung ein; Heimkehrende zählen ab Rückkehr erneut zur Stadtversorgung.

## Echter Browserablauf

Mit isolierter Testwelt und steuerbarer Serveruhr: über die echte Oberfläche registriert, vorhandene Technologien/Einheiten und Ressourcen für den Frachtablauf serverseitig vorbereitet; Weltkarte → NPC auswählen → Angriffsdialog → 20 Infanterie/4 LKW, 100 Holz/100 Stein/50 Nahrung/50 Öl, eine zusätzliche Minute → Einsatz prüfen. Angezeigte Startbelegung 432 und Prognose 870 Nahrung geprüft. Eingabeänderung deaktiviert Bestätigung; Tab wechselt zwischen Ladungsfeldern. Mobile Felder passen in den Dialog und die Bilanztabellen sind horizontal erreichbar.

Start über UI → Stadtöl 818, stationierte Infanterie 0 → Militäransicht mit getrenntem Rest-/Verbrauchsöl → echter Serverneustart während Hinmarsch → derselbe Browser setzt seine gespeicherte Sitzung fort → vor tatsächlicher Ankunft bleibt Mission outbound → Ankunft ergibt 577 Beute → normaler Rückweg → Postbox/Angriffe/Detail öffnen. Bericht: Startöl 132, verbrannt 124,5, verloren 7,5, restlich 0; eigene Rückfracht und 577 eingelagerte Beute getrennt. Desktop- und mobile Screenshots visuell geprüft; keine JavaScript-Browserfehler. Es wurde keine reale Reisezeit abgewartet.

## Grenzen und Folgeaufträge

Dieser Ablauf prüft die neue Frachtmechanik mit vorbereiteten Beständen; die Forschungs-/Gebäude-/Herstellungskette aus Auftrag 13 bleibt automatisiert regressionsgeprüft und wurde hier nicht erneut vollständig im Browser gespielt. Kein Langzeitbetrieb, realer Produktionsspielstand, Lasttest oder ARM64-Laufzeittest. Lokaler Containerbuild und Start wurden auf der vorhandenen Plattform ausgeführt; Repository-CI bleibt für weitere Plattformprüfungen zuständig.

Es wird keine pauschale maximale Entfernung behauptet: jeder Zielstart wird mit tatsächlichem Truppenmix, Ladung, Verzögerung und Regeln geprüft. Kein neuer Stranding-/Rettungsmechanismus. NPC-Beute bleibt Nahrung. Spielerlieferungen, Handel, zusätzliche Militärtechnik und Matrix-Föderation bleiben separate spätere Aufträge.
