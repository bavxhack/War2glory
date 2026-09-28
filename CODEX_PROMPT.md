# Codex-Auftrag 6: Bestehende Spieloberfläche schrittweise auf React und Vite umstellen

## Ziel und Arbeitsweise

Der Nutzer hat das empfohlene Refactoring beauftragt und meldet das Lagerhaus als umgesetzt. README und Projektplan beschreiben inzwischen auch Lagerwirtschaft und Abriss als implementiert. Prüfe diesen Ausgangspunkt im Code; der Planungschat hat keine eigenen Laufzeittests durchgeführt.

Arbeite vom aktuellen main im Repository bavxhack/War2glory aus. Lies AGENTS.md, README.md, docs/PROJECT.md, docs/WEBSOCKET.md, docs/DEVELOPMENT.md und docs/FEDERATION.md. Prüfe offene PRs und bestehende Änderungen und bewahre fremde Arbeit. Dieser Auftrag ersetzt Auftrag 5 als aktuellen Arbeitsauftrag; die Spielregeln aus Auftrag 5 bleiben bestehen.

Der Planungschat erstellt ausschließlich Anweisungen. Du, Codex, führst das Refactoring und seine Prüfungen durch und öffnest einen Pull Request. Ziel ist dieselbe vollständig bedienbare Anwendung mit einer wartbaren React-Oberfläche. Migriere in überprüfbaren Abschnitten, führe aber den gesamten hier beschriebenen Frontend-Umfang zu Ende.

## 1. Bestandsaufnahme und verbindliche Grenzen

- Erfasse vor Änderungen die tatsächlich vorhandenen Bildschirme, Dialoge, Interaktionen, WebSocket-Nachrichten, Clientzustände und Testabdeckung. Halte eine kompakte Funktionsliste für die spätere Abnahme fest.
- Nimm Referenz-Screenshots der vorhandenen Stadt, Militärseite, Weltkarte, Lageranzeige und Abrissvorschau auf, soweit ausführbar.
- Behalte JavaScript mit ES-Modulen bei; React-Komponenten dürfen JSX verwenden. Kein zusätzlicher TypeScript-Umbau.
- React übernimmt Darstellung und lokale Bedienzustände. Server und packages/game-core bleiben für Regeln, Preise, Eigentum, Zeit, Punkte und Fortschritt verbindlich.
- Erhalte bestehende WebSocket-Nachrichten und serverseitige JSON-Spielstände. Das Refactoring benötigt keine Spielstandmigration, Ressourcenänderung oder Rücksetzung.
- Änderungen am Server dürfen nur der nötigen Auslieferung des Frontend-Builds dienen, nicht der Neuimplementierung von Spielregeln oder Authentifizierung.
- Bestehende Stadtdarstellung, Gebäude, Texte, CSS-Grafiken und mobile Bedienung erhalten. Kein gleichzeitiges Redesign und kein Ersatz der vorhandenen Karte durch eine Demo.
- Öl, Nahrungsunterhalt, Kämpfe, Forschung, zusätzliche Generalrekrutierung und neue Skillregeln bleiben spätere Aufgaben. Schon vorhandene Funktionen vollständig übernehmen.
- Die frühere Leitlinie „ohne Framework zum Einstieg“ ist durch die Nutzerentscheidung für React im Frontend erweitert; der Spielkern bleibt frameworkunabhängig.

## 2. React-/Vite-Grundlage und Betrieb

- Führe React, React DOM, Vite und die erforderliche JSX-Integration im vorhandenen Repository ein. Wähle zueinander und zur Projektlaufzeit passende stabile Versionen anhand offizieller Dokumentation; Lockfile committen.
- Behalte apps/client als Frontendbereich. Nutze die vorhandene Projektstruktur, ohne einen unnötigen Monorepo-, Serverframework- oder Paketmanagerumbau.
- Ergänze nachvollziehbare npm-Skripte für Entwicklung, Frontend-Build und bestehende Tests. Halte Abhängigkeiten begrenzt; zusätzliche State-, UI- oder Routingbibliotheken nur bei konkret begründetem Bedarf.
- Für die Entwicklung darf Vite Assets ausliefern und den bestehenden WebSocket-Endpunkt /game an den Spielserver weiterleiten. Gleiche Protokoll-/Pfadangaben mit docs/WEBSOCKET.md ab.
- Erhalte Host-/Origin-Prüfungen und bestehende Sitzungsübergabe. Erlaube nur erforderliche Entwicklungsursprünge in einer expliziten Entwicklungskonfiguration. Keine globale Freigabe aller Origins oder Abschaltung bestehender Schutzprüfungen.
- Im normalen Betrieb liefert der bestehende Node-Server den gebauten Client aus. Kein Vite-Entwicklungsserver im Produktivcontainer.
- npm start und die vorhandenen Welt-/Portoptionen sowie start:alpha und start:beta müssen nach dokumentierter Installation und Build weiter funktionieren. Bei fehlendem Build eine verständliche Anleitung statt leerer Seite liefern.
- Docker und CI für reproduzierbaren Paketinstallationsschritt, Tests und Frontend-Build anpassen. Das vorhandene Spielstand-Volume und ein Serverprozess je Welt bleiben erhalten.
- Baue Browserassets ohne Servermodule, Dateisystemzugriffe, private Spielstände oder Geheimnisse. Keine Tokens in öffentliche Frontend-Konfiguration aufnehmen.
- Assets mit passenden MIME-Typen und sicheren Pfaden ausliefern; Fehler bei unbekannten Assets nicht durch ein HTML-Dokument verdecken. Bestehende statische öffentliche Endpunkte erhalten.
- Übernimm die bestehende Seitennavigation zunächst möglichst direkt. Falls echte neue URL-Routen nötig sind, definiere gezielte SPA-Fallbacks, ohne /game oder andere Serverendpunkte zu verschlucken.
- Dokumentiere die neuen Installations-/Buildschritte, Ports, Entwicklungskonfiguration und Containerabläufe.

## 3. Gemeinsamer Clientzustand und WebSocket-Lebenszyklus

- Trenne Transport, serverbestätigten Clientzustand und React-Komponenten. Eine zentrale Transportschicht pro Browsertab verwaltet Verbindung, Anmeldung/Sitzungswiederaufnahme, Ereignisverteilung und offene Anfragen.
- React-Komponenten abonnieren Zustände und rufen benannte Aktionen auf. Keine eigenständige WebSocket-Verbindung je Komponente und kein zweiter paralleler Ereigniszustand für dieselben Spieldaten.
- Verwende eine überschaubare Zustandslösung; lokale Formularentwürfe, ausgewählter Bauplatz und offene Dialoge bleiben lokale Bedienzustände. Dauerhafter Fortschritt kommt weiterhin vom Server.
- Erhalte requestId, Fehlerantworten und Deduplizierung. Eine Mutation wird durch eine Benutzeraktion ausgelöst, nicht als Nebeneffekt eines Renderns oder bloßen Komponenten-Mounts.
- Nach Verbindungsabbruch ausstehende Mutationen nicht blind mit neuen IDs erneut senden. Nutze das bestehende Wiederaufnahmeverfahren und gleiche den bestätigten Zustand ab.
- Abonnements, Listener, Timer und Reconnect-Versuche sauber aufräumen. Navigation, Hot Reload und React Strict Mode dürfen keine doppelten Verbindungen, Aktionen oder unkontrollierten Wiederverbindungszyklen erzeugen.
- Bei Logout, Sitzungsablauf und Kontowechsel private Zustände sowie offene Dialoge/Anfragen zuverlässig trennen. Verspätete Antworten einer alten Sitzung dürfen nicht im neuen Konto erscheinen.
- Datenfluss bleibt ereignisbasiert. Kein neues HTTP-Polling für Spielstände. HTTP für statische HTML-/CSS-/JS-Assets ist weiterhin normal.
- Sichtbare Countdowns oder interpolierte Ressourcenanzeigen dürfen lokal aktualisiert werden, aber keine Bauabschlüsse, Ressourcenbuchungen oder Punkte verbindlich berechnen. Nach Servermeldungen korrigieren.
- Verhindere unnötige Neuberechnung der gesamten Weltkarte bei jedem Countdown. Getrennte Ansichten gezielt abonnieren; Optimierungen nur bei beobachtbarem Bedarf.

## 4. Migration der vorhandenen Oberfläche

Führe diese Reihenfolge in nachvollziehbaren Commits durch:

1. React-App-Grundgerüst, Anmeldung/Sitzungszustand, Navigation, Verbindungsanzeige, Ressourcen-/Punkteanzeige und gemeinsame Dialogbausteine.
2. Stadtansicht mit Gebäudeplätzen, Auswahl, Angeboten, Bau-/Ausbauaktionen, Warteschlange, Lagerhaus und Kapazitätsdetails.
3. Abrissvorschau und Bestätigung einschließlich historischer Investitionshinweise, Kapazitäts-/Produktions-/Punkteänderungen und serverseitiger Sperren.
4. Militärbereich mit eigenen Bauplätzen, vorhandenen Kasernen, Ausbildung, Warteschlangen, Truppen und aktueller Generaldarstellung.
5. Weltkarte einschließlich Koordinatensuche, Ausschnittsladen, Zoom, Maus-/Touch-Verschieben, Auswahl, öffentlichen Details und vorhandener Aufklärung.
6. Einsatzauswahl, Hin-/Rückmarschübersicht und private historische Berichte sowie alle weiteren in der Bestandsaufnahme gefundenen bestehenden Interaktionen.

- Baue fachlich verständliche Komponenten und Hooks, keine einzige riesige App-Komponente. Gemeinsame Dialoge, Ressourcenwerte und Warteschlangenanzeigen wiederverwenden, ohne unnötig ein allgemeines UI-Framework zu entwickeln.
- Während der Migration darf ein klar abgegrenzter alter Teil übergangsweise bestehen. React und alter DOM-Code dürfen nie dieselben Elemente gleichzeitig verwalten.
- Am Ende müssen sämtliche bestehenden Spielbildschirme im React-Client erreichbar sein. Überholte DOM-Renderer und Eventhandler entfernen; keine dauerhaft parallelen Frontends.
- Vorhandene reine Karten-/Geometrie-/Formatierungsfunktionen können weiterverwendet werden. Falls eine imperative Grafikfläche existiert, über eine kontrollierte React-Komponente mit vollständigem Aufräumen integrieren.
- Erhalte Kartenposition und Zoom bei gewöhnlichen Spielereignissen. Gesuchte Koordinaten, Bauplatzwahl und Formulare dürfen nicht durch jede Servermeldung ungewollt zurückgesetzt werden.
- Erfolgs-, Fehler-, Lade- und Verbindungszustände müssen verständlich bleiben. Während unklarer Serverbestätigung keine scheinbar abgeschlossenen Käufe oder Abrisse anzeigen.
- Nutzernamen und andere variable Texte sicher als Text darstellen. Kein ungeprüftes HTML für Benutzerinhalte.
- Dialoge mit Tastatur bedienen können: sinnvolle Fokusführung, Escape/Abbrechen, beschriftete Felder und Fokusrückkehr. Responsive Stadt-/Militär-/Kartenbedienung erhalten.

## 5. Prüfungen und Abnahme

- Führe die vorhandenen Regel- und Serverintegrationstests aus. Passe Tests nicht so an, dass ungewollt geänderte Spielregeln als korrekt gelten.
- Ergänze gezielte Frontend-/Integrationstests für zentrale Risiken des Umbaus statt Tests, die nur die Komponentenstruktur nachbilden.
- Prüfe reproduzierbare Installation mit Lockfile, Frontend-Build und Start des gebauten Clients über den normalen Node-Server sowie den Container-Build.
- Prüfe mindestens folgende Abläufe mit zwei unabhängigen Benutzerkontexten:
  - Registrierung/Login, Reload, Logout/Kontowechsel und Sitzungswiederaufnahme.
  - Bauen/Ausbauen, Warteschlangen, Kapazitätszuwachs und Lagerhaus.
  - Abrissvorschau abbrechen bzw. bestätigen, gesperrter Abriss, Überbestand und aktualisierte Gebäudepunkte.
  - Getrennte zivile/militärische Bauangebote und vorhandene Ausbildungsabläufe.
  - Kartenbedienung, NPC-Aufklärung, Einsätze und private Berichte; keine privaten Daten beim zweiten Nutzer.
  - Verbindung während einer Mutation unterbrechen, erneut verbinden und Zustand abgleichen: keine doppelte Zahlung, Auftragserzeugung oder Rückerstattung.
  - Wiederholte Navigation und Strict Mode ohne doppelte aktive Listener/Verbindungen und ohne mehrfach gesendete Mutationen.
- Mit einem vorhandenen Testspielstand arbeiten, der Gebäude, Lagerhaus, Truppen und laufende Vorgänge enthält. Produktionsdaten weder ins Repository kopieren noch überschreiben.
- Vergleiche fachlich relevante Zustände vor/nach Umstellung; normale zeitabhängige Produktion und fällige Ereignisse berücksichtigen.
- Browserprüfung in Desktop- und schmaler Mobilansicht: Stadt, Militär, Lager-/Abrissdialog, Karte, Missions-/Berichtsansicht. Nutze die Referenz-Screenshots zur Kontrolle; geliefertes Ergebnis mit Screenshots dokumentieren.
- Keine neuen Konsolenfehler, fehlenden Assets oder endlosen Reconnects im normalen Betrieb.
- Falls Tests mangels Werkzeug/Zugriff nicht ausführbar sind, benenne die Lücke konkret. Keine ungetestete Funktion als geprüft darstellen.

## 6. Lieferung und nächste Arbeit

- Liefere die vollständige Migration in einem reviewbaren Pull Request mit nachvollziehbaren Teilcommits. Nicht eigenständig zusammenführen oder deployen.
- Beschreibe auf Deutsch Motivation, neue Frontendstruktur, Betriebsschritte, durchgeführte Tests und verbleibende Einschränkungen.
- Aktualisiere README, Entwicklungs-/WebSocket-Dokumentation, Projektplan und erforderliche Projektleitlinien anhand des tatsächlichen Ergebnisses. Alte Aussagen „keine npm-Abhängigkeiten“ erst mit der Implementierung ersetzen.
- Dokumentiere React/Vite als Grundlage künftiger Oberfläche, ohne den Spielkern an React zu koppeln.
- Keine Balanceänderungen oder neuen Spielmechaniken in diesen PR mischen.
- Danach folgt die Generalverwaltung mit mehreren Generälen und später die im Projektplan beschriebenen Farm-, Unterhalts-, Forschungs- und Föderationsschritte.
