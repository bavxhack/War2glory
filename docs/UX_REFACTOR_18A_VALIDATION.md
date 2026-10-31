# Zwischenauftrag 18a – Umsetzung und tatsächliche Prüfungen

Geprüft am 28.–29.10.2026. Ausgangspunkt der Umgebung war `9a635a0`; der normale Git-Fetch scheiterte zunächst an der Sandbox-Proxyverbindung. Der GitHub-Connector bestätigte die fehlenden Vorgaben und Auftrag 18 auf main. Anschließend gelang `git fetch origin main` mit Netzwerkfreigabe und ein sauberer Fast-forward auf **`1d4b16d0e44878fda7da665f22a280d670624820`**. Die vorübergehend aus dem Connector gelesenen Änderungen wurden vor diesem Fast-forward vollständig zurückgenommen. Die eigentliche 18a-Änderung baut auf diesem Commit auf.

Umgebung: Node.js 24.19.0, React 19, Vite 7, System-Chromium `/usr/bin/chromium`, vorhandenes Playwright unter `/opt/codex/cua_node/lib/node_modules/playwright`. Lokale Server und Browser benötigen hier Sandbox-Freigabe. Alle Spielaktionen fanden in isolierten, neu angelegten Testwelten unter `work/` statt. Kein produktiver `data/`-Spielstand wurde geladen, verändert oder zurückgesetzt. Kein Deployment, Push oder Auftrag 19.

## Was geändert wurde

- Gemeinsame Gebäudekarten mit echtem direktem Ausbau, sichtbarem Preis/Dauer/Nutzen, lokalem Baukatalog, getrennten zivilen/militärischen Angeboten und Mehr/Abriss. Keine verschachtelten Buttons. Universität übernimmt ihre ID; Ausbildung übernimmt Gebäude/Einheit.
- Bestehende Vorschauen werden nach 250 ms gebündelt geladen. Spieler, Stadt, Objekt, Eingaben, relevante Regeln/Zustände und Verbindung gehören zum Vorschaukontext. Alte Antworten nach Änderung, Schließen oder Kontextwechsel schalten nichts frei. Ticks/Ressourcenwachstum allein lösen keine Vorschau pro Sekunde aus. Keine automatische Mutation.
- Preise und Start stehen im jeweiligen Formular. Ein Konflikt erhält die Eingaben, zeigt den Fehler und lädt eine neue Vorschau; der Spieler muss erneut bewusst starten. Sofortige Starts sind durch lokale Versand-Refs gegen Doppelaktivierung geschützt.
- Hauptnavigation bleibt siebengeteilt. Der Sidebar-Portalpfad und der allgemeine mobile Aktionen-Dialog entfallen. Versorgung ist über Ressourcen/Alle Städte erreichbar, Aktivitäten über einen kompakten Statusbutton und objektbezogene Queue-Links.
- Generäle: sichtbare Verwaltungs-/Rekrutierungsreiter, Standort-/Rollenfilter und ein Detail mit Übersicht, Entwicklung und Rolle/Standort. Direkte Zahleneingabe ergänzt die Stepper. XP-Kauf und irreversible Verteilung bleiben getrennt. Keine fest codierte Bürgermeister-Ertragsprognose aus einer anderen Stadt.
- Feldwahl zeigt unmittelbar die Feldkarte. Sie kann geschlossen werden, ohne Kamera oder Maßstab zu ändern. Windrose und Suchwerkzeuge bleiben zugänglich. Eigene/fremde Städte bieten nur vorhandene zulässige Folgeaktionen; kein PvP.
- Versorgungshilfe richtet Nahrung **hierher**, Verlegungen **von hier**. Quelle/Ziel stehen im Transportformular. Ein Quellenwechsel lädt einen bestätigten Stadtstand und schützt einen veränderten Entwurf, bevor er verworfen wird.
- Aufgaben zeigen Zielstadt und komplette Belohnung vor dem Einzelabholbutton, inklusive erkennbarem Platzmangel. Ziellinks übernehmen bekannte Gebäude-/Universitäts-/Einheiten-/Rollenkontexte; fehlende Aufgaben-Voraussetzungen führen zuerst zur Voraussetzung.
- Berichtsspitzen zeigen Ergebnis, Stadt, Verluste/Beute/Zeit vor den vollständigen Detailbilanzen. Der Kartenlink verwendet aktuelle Kartendaten und ausdrückliche Zielkoordinaten; Postboxfilter, Seite und Auswahl werden bei der Rückkehr übernommen. Nachrichten werden niemals automatisch gesendet.
- Fachliche Entwürfe ersetzen pauschales `onInput`-dirty. Normale Suche/Filter warnen nicht. Bei nötigem Verwerfen gibt es Bleiben/Verwerfen; innerhalb eines Fachdialogs wechselt dafür der Inhalt derselben Ebene. Reload wird bei echtem Entwurf über `beforeunload` geschützt. Ein Kontowechsel legt sämtliche privaten Ansichten neu an.

## Inventar und Zuordnung zu bestehenden Befehlen

**B16**: der bestehende Logistik-Browserprüfstand wurde in dieser Sitzung **vor** dem Umbau erfolgreich ausgeführt. **B18**: Aufgaben-/Versorgungsprüfstand ebenfalls vor dem Umbau ausgeführt. **N**: neuer `validate-ux18a-ui.mjs`-Durchlauf. **P**: neuer `validate-ux18a-paths.mjs`-Durchlauf. **K**: separater Kartenprüfstand. **T**: vollständige Node-Regression. **S**: statische Quellcode-/Befehlszuordnung, kein zusätzlicher vollständiger Browserablauf dieser einzelnen Variante. Die Kürzel unterscheiden ausdrücklich reale Prüfungen von Ableitungen.

Die Vorher-Wege nennen Desktop / mobil, soweit unterschiedlich. Auswahlfelder, Texteingaben und Scrollwege sind zusätzlich zu den genannten Buttonaktivierungen erforderlich; es werden keine Gesamtzeitgewinne behauptet.

| Aktionsgruppe / Kontext | Vorher | Neuer Ort / Weg | Nachweis |
| --- | --- | --- | --- |
| Registrierung, Anmeldung, Resume | Formular, expliziter Submit | Bestehendes Formular; privater UI-Zustand je Spieler | B16, B18 → N; `auth.register/login/resume`, T |
| Abmelden/Kontowechsel | Kontobutton / mobiles Menü | Bestehender Button; echter Entwurf vor Verlust geschützt | S → N; `auth.logout`, T |
| Stadtwechsel | Stadtwähler → Stadt; bei Dirty pauschale Warnung | Wähler → Stadt; nur echte veränderte Entwürfe warnen | B16, B18 → N; `city.sync`, T |
| Ressourcen, Lager, Versorgung | Ressource → Details; mobil mögliche zweite Dialogebene | Ein Ressourcen-Dialog mit umschaltbaren Details | B18/S → N, T |
| Ziviler Ausbau | Grundstück → Panel / zusätzlich mobiler Aktionen-Dialog | Direkter Kachelbutton, Angebot vorher sichtbar | B16, B18 → N; `construction.enqueue`, T |
| Ziviler Neubau | Grundstück → Panelangebot / mobil Panel öffnen | Bauen → bepreistes Katalogangebot am konkreten Platz | S → N; `construction.enqueue`, T |
| Gebäudeinfos, Maximalstufe, Sperren | Auswahl und Panel | Karte/Mehr, konkreter Sperrgrund und Ressourcenfehlbetrag | S → N/P teilweise; Grenzwerte T |
| Abriss zivil/militärisch | Auswahl → Vorschau → endgültig bestätigen | Mehr → Abreißen → eine serverseitige Folgenbestätigung | S → P zivil; militärisch gemeinsamer Baustein S/T; `building.preview/demolish` |
| Universität → Forschung | Auswahl → Panel → allgemeine Forschungsseite | Forschen auf Gebäude, Stadt und konkrete Universität übernommen | S → N/S; `research.preview/start`, T |
| Militärbau/Ausbau | Militärplatz → Panelangebot | Gemeinsame Karte, ausschließlich Militärangebote | S → N Navigation/Training; Bauflächenregeln T |
| Kaserne/Fabrik → Ausbildung | Auswahl → Panel → Menge → Prüfen → Start | Ausbilden/LKWs herstellen → automatisches Angebot → Start | S/B16 → N Kaserne; Fabrik gemeinsames Formular S/T; `training.preview/enqueue` |
| Truppenbestand / Einheiteneinstieg | Übersicht im Panel | Bestandskarten im Militär-Hauptbereich mit passendem Einstieg | B16/S → N; force-summary und T |
| Bau-/Ausbildungsqueues | Kurze Listen, teils nur drei; allgemeiner Seitensprung | Alle Aufträge → vollständige Liste mit Stadt-/Gebäudefilter | S → N; neue Projektion und T |
| Forschungstechnologie | Karte auswählen → Panel prüfen → Dialogstart | Forschen auf Karte → automatisch geladene Planung → Start | B16 → N; `research.preview/start`, T |
| Forschungsort / Leitung | Panel, Auswahl sendet Rollenänderung | Forschungsbereich / gemeinsames Generaldetail mit Stadt/Besetzung | B16/S → P; `general.researcher`, T |
| Generalübersicht / Filter | General-Karten; langer Universal-Dialog | Meine Generäle, Standort/Rolle, direkte Entwicklungs-/Rollenlinks | B16 → N/P |
| Umbenennen | Name im Universal-Dialog, Speichern im Fuß | Übersicht mit Eingabe und Speichern beieinander | S → P; `general.rename`, T |
| Bürgermeister ernennen/wechseln/abberufen | Dialogfuß, ausgewählte Stadt teilweise irreführend | Rolle/Standort mit tatsächlicher Stadt und vorhandener Besetzung | S → P Ernennung/Abberufung; Austausch T; `general.mayor` |
| Forschungsleitung ernennen/freigeben | Forschungsseite/Detail | Gemeinsame Rolle; vorhandene Standort-/Forschungssperren | S → P; `general.researcher`, T |
| Generalverlegung | Allgemeine Logistik, Auswahl erneut nötig | Verlegen am freien General übernimmt tatsächliche Quelle/ID | B16/S → P Standort/N Verlegung; Deep-Link S/T; `transfer.preview/start` |
| XP kaufen | Menge → Kauf prüfen → Kauf bestätigen | Automatischer XP-Preis → bewusster Kauf | B16 → N; `general.preview/convert`, T |
| Skills verteilen | Plus/Minus → Prüfen → Speichern | Direkte Zahlen/Stepper → automatische Vorschau → unwiderruflich verteilen | S → N; `general.preview/distribute`, T |
| Rekrutieren | Bewerber im Panel → Prüfen → Dialog → erzwungenes Detail | Sichtbarer Reiter → Kandidat → automatischer Preis → Verpflichten; Detail freiwillig | S → P; `general.recruit.preview/recruit`, T |
| Windrose, Suche, Zoom, Zentrieren | Bestehende Kartensteuerung | Bewahrt; keine neue Zieh-/Pfeiltastensteuerung | B16/B18 → K; `map.viewport/details`, T |
| NPC-Aufklärung | Feld → Panel/Drawer → Aktion → Prüfen → Start | Feld zeigt Aktionskarte → planen → automatisch geprüft starten | B16/S → P; `scouting.preview/start`, T |
| NPC-Farmzug | Feld → Panel/Drawer → Dialog → Prüfen → Start | Feld → Angriff planen → automatisches Angebot → bewusster Start | S → P; `raid.preview/start`, T |
| Freies Feld: Aufklären/Erobern/Gründen | Panel, jeweils manuelles Prüfen | Unmittelbare Feldkarte, gleiche Stufen mit automatischen Angeboten | B16 → P; `field.scout/conquest.preview/start`, `city.found.preview/found`, T |
| Eigene/fremde Kartenstadt | Details ohne durchgängige Folgewege | Eigene Stadt öffnen, Lieferung, zulässige Verlegung; fremde Nachricht/Lieferung | S → K/N Auswahl; Deep-Links S/T |
| Lieferung, freiwilliger General/Fracht | Formular → fremdes Panel → Prüfen → Start | Ein Formular; General optional; automatisches Angebot und lokaler Start | B16 → N generalfreie Fremdlieferung/Rückkehr; Varianten T; `delivery.preview/start` |
| Dauerhafte Truppen-/Generalverlegung | Formular und Start räumlich getrennt | Getrennter Modus, Quelle/Ziel/Dauerhaftigkeit/Versorgung zusammen | B16 → N echte Verlegung; Späher-/General-only T |
| Liefer-/Verlegungsstatus | Logistikliste | Bestehende Liste plus vollständige Aktivitäten | B16 → N/P; historische Berichte T |
| Versorgungshilfe | Zusatzdialog; auch Verlegung setzte Ziel statt Quelle | Direktformular; Nahrung-Ziel / Verlegequelle eindeutig | B18 → N Verlegequelle; übrige Zuordnung S/T |
| Aufgaben fortsetzen / Einführung | Allgemeiner Seitensprung, lokal ausblendbar | Kontextabsicht mit bekanntem Objekt; Ausblenden/Wiederfinden bewahrt | B18 → N/P Aufgaben; einzelne Zielverweise S |
| Einzelbelohnung / volle Lager | Abholen → Zielstadtdialog → bestätigen | Zielstadt und Belohnung sichtbar → ein Abholbutton | B18 → P; Platz-/Einmaligkeits-/Zwei-Tab-Fälle T; `tasks.claim` |
| Aktivitäten / Alle Bewegungen | Höchstens drei, Weiterleitung teils unvollständig | Vollständige eigene Bau-/Ausbildungs-/Forschungs-/Reiselisten, Filter | S → N vierter Bauauftrag; Projektion T |
| Berichte lesen / Kartenfolge / Rückweg | Lange Bilanz direkt; kein Zielkartenlink | Ergebnis zuerst; Bilanzen aufklappbar; aktueller Zielkartenlink | B16 → P incl. Filterrückkehr; `mail.read`, T |
| Nachricht / Antwort / Senden | Postboxformular, unzureichender Entwurfsschutz | Gleiches Formular, explizites Senden, echter Textentwurf geschützt | S/B16 → N Senden/Bleiben; Antwort/Lesestatus T; `mail.send/read` |
| Postboxsuche, Ordner, Filter, Seiten | UI-Filter fälschlich global dirty | Normale Ansichtszustände; Rückkehr übernimmt Auswahl/Filter/Seite | S → N Suche, P Rückkehr; Pagination S/T |
| Offline, Fehler, Reconnect, späte Antworten | Uneinheitliche Sperren und globale Meldungen | Veralteter Stand sichtbar; Lesen bleibt; passende Vorschau erst nach Abgleich | B18 → N, neue Transporttests T |

Damit sind sämtliche bestehenden Befehlsfamilien einem neuen oder erhaltenen Einstieg zugeordnet. Nicht jeder Parametersatz jedes Befehls wurde zusätzlich im Browser geklickt; insbesondere Fabrik, General-only-Transporte und alle Fehlerkombinationen sind durch gemeinsame Komponenten, statischen Abgleich und bestehende Regel-/Servertests abgesichert, nicht durch erfundene neue Browsermessungen.

## Reale Aktivierungsfolgen

Gleiche vorbereitete Bestände, explizite Städte, keine kostenfreie Umgehung von Voraussetzungen. Im Browser verwendet: volle Ausgangslager, freie Generäle, konkrete Universität/Kaserne und passende Ziele. Testuhren ersetzen das Abwarten von Bau-/Reisezeit, nicht deren serverseitige Abschlusslogik.

| Ablauf | Vorher | Nachher tatsächlich ausgeführt |
| --- | --- | --- |
| Sichtbarer Ausbau | Desktop 2 Buttons (B16/B18); mobil 3 aus Code abgeleitet | 1 Button; Preis steht davor (N) |
| Freier Platz bebauen | Auswahl und Panel; Zählung S | 2 Buttons: Bauen, bepreistes Angebot (N) |
| Forschung bei gewählter Universität | 3 Buttons: auswählen, prüfen, starten (B16) | 2 Buttons: Forschen, Start (N) |
| Ausbildung | Auswahl/Panel, manuelles Prüfen/Start (S) | 2 Hauptbuttons: Kaserne/Ausbilden, Start; Einheit und Menge im Formular eingegeben (N) |
| Bereits ausgefüllte Lieferung/Verlegung | Desktop Prüfen + Start; mobil zusätzlich Panel (B16) | 1 Startbutton nach automatischer Vorschau (N) |
| Sichtbarer NPC | Panel und manueller Prüfschritt (S) | Feldauswahl, Planen, Start: 3 Aktivierungen plus nötige Einheiteneingabe (P) |
| Abholbare Aufgabe | Abholen, Dialog bestätigen (B18) | 1 Abholbutton; Zielstadt vorher sichtbar gewählt (P) |
| Stadtwechsel ohne Entwurf | Wähler, Stadt (B16) | Gleicher 2-Schritt-Weg; keine zusätzliche pauschale Warnung (N) |

Eingaben/Dropdownwahlen werden nicht als eingesparte Klicks verkauft. Serverwartezeit ist separat: Vorschau-Debounce 250 ms, anschließend Antwort abwarten. Es wurde keine menschliche Tippdauer oder prozentuale Zeitersparnis gemessen. Hauptaktionen benötigen keinen Wechsel in eine zweite Sidebar-Scrollfläche. Lange Karten/Formulare und Aktivitäten dürfen innerhalb ihrer Ansicht scrollen; die Tests verwenden dafür tatsächliches Scrollen zu Elementen. Keine pauschale Behauptung „alles ohne Scrollen“.

## Ausgeführte Prüfungen

| Befehl | Ergebnis |
| --- | --- |
| `npm run build` | Vite-Produktionsbuild bestanden |
| `npm test` | **254 bestanden**, 0 fehlgeschlagen |
| `node scripts/validate-logistics-ui.mjs` vor Umbau | Bestehende Desktop-/Mobilwege, Fremdlieferung, permanente Verlegung, General-XP, Forschung, Feldgründung, Postbox, Stadtwechsel, getrennte Tabs bestanden |
| `PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright/index.mjs node scripts/validate-tasks-supply-ui.mjs` vor Umbau | Bestehende Aufgaben, volle Lager, Zielstadt, Belohnung, Versorgungshilfe, Mobil, Reconnect bestanden |
| `node scripts/validate-ux18a-ui.mjs` nach Umbau | Direkte Hauptwege, Vorschau-A/B-Reihenfolge, echte Lieferung/Verlegung, Skills, Nachrichtenentwurf, fünf Städte, zwei Tabs, Queue-Filter/vierter Eintrag, Ressourcen/Dialogebene und Kontowechsel bestanden; keine Browser-JavaScriptfehler |
| `node scripts/validate-ux18a-paths.mjs` nach Umbau | Belohnung, Umbenennen, beide Rollen, Rekrutierung, Abriss, NPC-Aufklärung/Farmzug, Feldgründung, Berichtskarte und Filterrückweg bestanden; keine Browser-JavaScriptfehler |
| `node scripts/validate-world-map-ui.mjs` nach Umbau | Acht Richtungen, Halten/Loslassen außerhalb, Enter/Leertaste, Pointer-Abbruch, Fenster-/Fokusverlust, späte Kartenantwort, Weltecken, Projektion und mobile Touchsteuerung bestanden; keine Browser-JavaScriptfehler |
| `git diff --check` | Bestanden |

Browsergrößen N: **1440×900, 1280×800, 768×1024, 390×844, 320×844**, jeweils alle sieben Hauptseiten ohne horizontalen Dokumentüberlauf. Zusätzlich 640×400 CSS-Pixel mit CDP-Geräteskalierung 2 als **200%-Arbeitsflächenprüfung**: Enter-Navigation, Tab im Dialog, Escape. Kein manueller Browserleisten-Zoom behauptet. K prüft zusätzlich tatsächliche Touch-Ereignisse mit Halten und reduzierte Bewegung.

A/B-Vorschauprüfung: Zwei Logistikantworten werden im Browser gezielt zurückgehalten. Nach Änderung der Ladung darf die Antwort auf A den Start von B nicht freigeben. Erst die passende B-Antwort schaltet ihn frei. Ein weiterer Durchlauf liefert D tatsächlich vor C aus; die späte C-Antwort überschreibt das gültige D-Angebot nicht. Eine Antwort nach Formularschließung öffnet es nicht erneut. Ein abgebrochener Quellenwechsel erhält Stadt und Eingaben. Reconnect sendet keinen Start erneut; ein neuer Stadtstand wird abgeglichen. Unit-Tests prüfen zusätzlich spätes Karten-Detail nach neuer Stadt-/Feldwahl, fehlgeschlagenen Versand ohne Phantom-Pending, späte Abrissantworten nach Schließen sowie promise-basierte Starts mit unklarem Bestätigungsausgang. Die vollständige Regression umfasst Migrationen, alte Regelversionen, Lager-/Öl-/Truppenregeln, Aufgaben-Einmaligkeit, Speicherfehler, Journal-Recovery und Neustart.

Die Aktivitätenprojektion wird mit fünf Städten, 15 Ausbildungsaufträgen, einem fünften Bauauftrag und sechs Reisetypen geprüft. Fingerprints und private Intelligence sind ausgeschlossen; Ausgangsdaten werden nicht verändert. Im Browser sind vier tatsächlich vorbereitete stadtübergreifende Bauaufträge vorhanden und der vierte sichtbar erreichbar. Keine Liste wird auf drei Einträge gekürzt.

## Screenshots und Artefakte

[Vorher: Stadt mit Panel](screenshots/task18a/before-city.png) · [Nachher: Desktopstadt](screenshots/task18a/desktop-city.png) · [390px: direkte Gebäudekarte](screenshots/task18a/mobile-city.png) · [320px: Weltkarte](screenshots/task18a/mobile-map.png) · [320px: Feldkarte und Windrose](screenshots/task18a/mobile-selection.png).

Maschinenlesbare Laufbelege liegen daneben: `before-logistics.json`, `before-tasks.json`, `after-ui.json`, `after-paths.json`, `after-map.json`. Die reproduzierbaren Skripte stehen unter `scripts/`; ursprüngliche Testwelten und weitere Screenshots bleiben ignoriert unter `work/`.

## Grenzen

Kein physisches iOS-/Android-Gerät, kein Safari/Firefox, kein Screenreader-Audit und keine echte Bildschirmtastatur. 44-Pixel-Ziele und Formularfußleisten sind implementiert; alle denkbaren Kombinationen aus Tastaturöffnung, Zoom, langem Namen, Hunger, vollem Lager und voller Queue wurden nicht zusätzlich als vollständiger Browser-Cross-Product-Test ausgeführt. Regel-/Serverprüfungen dieser Zustände sind Bestandteil von `npm test`; in der Inventartabelle ist die Prüftiefe je Aktionsgruppe benannt.

Es gibt keinen neuen Backend-Spielmechanismus, keine Regel-/Preisänderung und keine Migration: `packages/game-core` ist gegenüber dem Ausgangscommit unverändert, Spielerschema **18**, Weltschema **4**. Die neue private Aktivitätsprojektion ist die einzige Snapshot-Erweiterung. Auftrag 19, neue Einheiten, Kampfregeln, Handel, Bündnisse und Föderation wurden nicht begonnen.
