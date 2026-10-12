# Stadtwahl und feste Seitenleiste – 12.10.2026

Implementiert auf dem Stand von Auftrag 15, ohne Änderung von Spiellogik, Schema oder Balance.

Die Stadtwahl ist eine gestaltete Stadtkarte mit Bild, Name, Koordinaten und N/5-Zähler. Ein zugängliches natives Dialogfenster listet die eigenen Städte mit Aktiv-Markierung auf. Auswahl bleibt pro Tab gespeichert, bestehende Besitzprüfung/Transportlogik unverändert. Escape stellt den Fokus auf den Auslöser zurück; Namen werden als Text gerendert und umbrechend dargestellt.

`App` enthält genau eine dauerhafte `SidebarStatus`-Instanz für die gewählte Stadt. Bewegungen, Bauaufträge und laufende Forschung stehen unabhängig von Stadt-/Militär-/Welt-/Forschungs-/Postboxansicht oben, inklusive Restzeit und Fortschrittsbalken. Ausbildungsqueue und Versorgung sind zusätzliche aufklappbare Details. Spielerweite Forschung erscheint einmal mit ausführender Stadt. Bei Stadtwechsel werden lokale Bestände, Truppenbewegungen und Bauqueues nicht vermischt.

Die jeweilige Gebäude-, Militär-, Feld- oder Forschungsaktion wird über React-Portale unter der Übersicht dargestellt; kein weiterer Socket, kein Polling und keine zweite Kopie des Spielzustands. Forschungstechnologien werden in der Hauptansicht ausgewählt und in der Seitenleiste geplant. Bewerberaktionen stehen ebenfalls darunter. Der Desktop hält die Übersicht beim Scrollen sichtbar und bietet einen eigenen Scrollbereich für längere Aktionen. Auf schmalen Geräten steht die Übersicht über den Aktionen; weder Daten noch Aktionen werden nur wegen einer anderen Ansicht ausgeblendet.

## Ausgeführte Prüfungen

- `npm test`: 186 Tests bestanden, keine Fehler/übersprungenen Tests.
- `npm run build`: Vite-Produktionsbuild erfolgreich.
- `node scripts/validate-sidebar-ui.mjs`: echte Chromium-/WebSocket-Prüfung mit gleichzeitig laufender Aufklärung, Gebäudeausbau und Forschung. Alle fünf Ansichten behalten dieselbe Übersichtsinstanz und zeigen alle drei Aufträge; Aktionen stehen im DOM darunter. Stadtwechsel zeigt getrennte lokale Aktivitäten, globalen Forschungsursprung, Tastatur/Fokus und Auswahl nach Neuladen. Dokumentbreite bei 390 und 320 Pixel geprüft.
- `BROWSER_MOBILE=1 node scripts/validate-sidebar-ui.mjs`: derselbe Ablauf ab 390×844 Pixel.
- `node scripts/validate-multicity-ui.mjs`: bestehender vollständiger Feldablauf mit angepasster Stadtwahl erfolgreich: Aufklären → Erobern → Gründungsmodal → Stadtwechsel → Neuladen → Rückkehrbericht.
- `git diff --check`: keine Whitespacefehler.

Testwelten und Screenshots liegen ausschließlich im ignorierten `work/`, insbesondere `sidebar-desktop.png` und `sidebar-mobile.png`. Der Browserprüfer benötigt die bereits dokumentierte optionale Playwright-Installation unter `work/browser` und Chromium unter `/usr/bin/chromium`. Die Serveruhr/Testressourcen werden nur in isolierten Testwelten kontrolliert. Produktive Spielstände wurden nicht verändert. Kein Merge/Deployment durchgeführt.
