# UI-Konzept für Auftrag 16: Klarer Spielrahmen und direkt erreichbare Aktionen

Stand: 12.10.2026. Zur Umsetzung beauftragt, kein bereits implementiertes Design. Dieses Dokument ergänzt CODEX_PROMPT.md. Der Planungschat erstellt das Konzept; Codex setzt es im bestehenden React-Client um.

## Problem und Ziel

Im gelesenen App.jsx stehen Stadtwähler, große Ressourcenbereiche und obere Ansichtstabs vor dem Arbeitsbereich. Rechts folgen in SidebarStatus.jsx mehrere Aktivitätslisten, bevor SidebarActions.jsx die eigentlichen Aktionen einhängt. Dadurch konkurrieren Navigation, Status und Bedienung um Platz. Der Nutzer berichtet, dass Funktionen nur durch Scrollen erreichbar und die Seitenleiste schwer erkennbar sind.

Ziel: Hauptnavigation, Stadtkontext und aktuelle Aktionen auf den ersten Blick erkennen. Kein vollständiges Spielmenü als lange Liste unter der Stadtkarte. Lange Fachinhalte dürfen weiterhin scrollen; Navigation und primäre Aktionswege bleiben erreichbar.

## Informationsarchitektur

| Hauptpunkt links | Inhalt | Geltungsbereich |
| --- | --- | --- |
| Stadt | Stadtlandschaft, Gebäude, zivile Bauplätze und Bauqueue | Gewählte Stadt |
| Weltkarte | Sichtbare Welt, Aufklärung, Eroberung und Gründung | Welt, Entfernung ab gewählter Stadt |
| Militär | Militärbauplätze, stationierte Truppen und Ausbildung | Gewählte Stadt |
| Logistik | Ressourcen liefern, Truppen/Generäle verlegen, laufende Transporte | Gewählte Ausgangsstadt; eigene Filter |
| Generäle | Gemeinsamer Pool, Standort, Rollen, Skills und Rekrutierung | Spielerweit; Stadtbezüge ausdrücklich |
| Forschung | Technologien, eine Forschungsqueue und Forschungsleitung | Spielerweit; zahlende Stadt ausdrücklich |
| Postbox | Berichte und Nachrichten mit ungelesenem Zähler | Spielerweit |

Stadtwechsel ändert die Seite nicht und startet keinen Spielbefehl. Bei offener ungesendeter Aktion Stadtwechsel bestätigen lassen oder vorher abbrechen; niemals still die Ausgangsstadt ändern. Bereits gesendete Missionen bleiben an gespeicherte IDs gebunden. Spielerweite Seiten kennzeichnen „Alle Städte“, lokale Seiten den konkreten Stadtnamen.

## Desktop ab 1280 CSS-Pixel Breite

Drei klar abgegrenzte Bereiche:
- Links feste Hauptnavigation, Richtwert 224 px, voller sichtbarer Höhe. Oben Logo/Spielname und Überschrift „Navigation“. Darunter die sieben Hauptpunkte mit vorhandenen passenden Icons und ausgeschriebenen Namen. Unten Konto/Verbindung/Abmelden.
- Oben im Arbeitsbereich kompakter Stadtkopf mit Stadtwähler, Koordinaten, N/5 und Ressourcenleiste. Richtwert Gesamthöhe 96–112 px; tatsächlichen Inhalt ohne abgeschnittene Schrift gestalten.
- In der Mitte großzügiger Arbeitsbereich; rechts kontextbezogenes Bedienpanel, Richtwert 320 px. Header des Panels eindeutig als „Aktionen · [Kontext]“ benennen.

Navfläche mit eigener Hintergrundfarbe, sichtbarer Trennlinie und ausreichend Abstand vom Hauptinhalt. Aktiver Punkt mit Hintergrund, Akzentleiste und Textgewicht; zusätzlich aria-current, nicht allein Farbe. Hover-/Fokuszustände sofort erkennbar. Nicht nur eine unbeschriftete Iconleiste.

Rechte Panel-Tabs:
1. Aktionen — Standard bei Ansichts-/Objektwechsel; wichtigste Schaltfläche zuerst.
2. Aktivitäten — kompakte Zusammenfassung für Bau, Ausbildung, Forschung und Bewegungen.
3. Versorgung — Nahrungsbilanz, Unterhalt und Hungerinformationen.

Aktivitätslisten dürfen die Aktionen nicht nach unten schieben. Im Aktivitäten-Tab maximal drei nächste Einträge pro Kategorie, danach „Alle anzeigen“ zur passenden Ansicht. Mengen/Restzeit sichtbar, Detailbilanzen erst bei Auswahl. Versorgung zeigt zuerst Nettorate/Reichweite; ausführliche Faktoren darunter.

Hungerwarnung stadtbezogen kompakt im Stadtkopf sichtbar; critical Zustand nicht nur in geschlossenem Tab verstecken. Übersicht über Warnungen anderer eigener Städte als Zähler mit anklickbarer Liste ohne fremde Ressourcen offenzulegen.

Lange Inhalte im Hauptbereich und geöffneten Panel können getrennt scrollen. Keine übereinanderliegenden fixen Ebenen, die Buttons verdecken. Ressourcen- oder Paneldetails öffnen höchstens auf Wunsch zusätzliche Inhalte; Navigation bleibt in normaler Desktopansicht ohne Scrollen bedienbar.

## Ressourcen und Status

Vier kompakte Ressourcenkacheln: Symbol + Name + Vorrat/Kapazität + Nettoänderung pro Stunde. Keine vollständigen Ertrags-/Lagerformeln permanent auf vier Karten. Klick/Tastatur öffnet einen Detail-Popover bzw. das bestehende Dialogmuster; Tooltip allein genügt nicht.

Stadtname und Ausgangsstadt bleiben auch in Logistikformularen sichtbar. Verbindung als kompakter Indikator mit Text; Offline-/Reconnectzustand verhindert versehentliche doppelte Starts. Kommandantenpunkte beim Konto bzw. in einer Übersicht, nicht als breite Zeile über jeder Arbeitsansicht.

## Mittlere Breite von 768 bis 1279 px

- Navigation als sichtbarer Button „Menü“ plus aktuell gewählter Seitenname, öffnet beschriftete Drawer-Navigation.
- Zweispaltige Arbeitsansicht, falls sinnvoll; sonst Hauptinhalt mit „Aktionen“-Button, der Kontextpanel als Drawer öffnet.
- Kein automatisches Stapeln einer langen rechten Sidebar unter den gesamten Hauptinhalt.
- Ressourcen können auf zwei Zeilen oder als kompakter Streifen umbrechen, ohne horizontales Dokument-Scrolling.

## Mobile unter 768 px

- Kompakter Kopf: „Menü“, gewählte Stadt und Stadtwechsel. Ein sichtbarer Link/Button „Ressourcen“ öffnet Zahlen/Details bei Bedarf; Hungerwarnung bleibt direkt erkennbar.
- Untere feste Navigation mit Stadt, Welt, Logistik und Mehr. „Mehr“ öffnet alle sieben ausgeschriebenen Punkte. Aktive Seite klar kennzeichnen.
- Im gewählten Kontext eine beschriftete Aktion wie „Gebäude verwalten“ oder „Feldaktionen“; öffnet bestehendes Modal oder Drawer. Keine unsichtbare Sidebar unter der Karte.
- Lange Formulare in einem einzigen scrollbaren Dialogbereich; Bestätigungsbereich erreichbar und bei Sticky-Platzierung mit ausreichend Inhaltsabstand.
- Drawer/Modal mit Schließen, Escape, Fokusführung und Rückgabe an auslösenden Button. Bildschirmtastatur und safe-area berücksichtigen.
- Bestandsnavigation auch bei 320 px und 200 % Zoom nutzbar; notwendiger Inhalts-Scroll erlaubt. Alle Menüpunkte höchstens nach einem Öffnen des Menüs anwählbar.

## Logistikansicht

Zwei deutlich beschriftete Modi:
- „Ressourcen liefern“: Hin- und Rückreise; LKWs kommen zurück, General optional.
- „Truppen & Generäle verlegen“: Hinreise; Einheiten und ausgewählte Generäle bleiben in eigener Zielstadt.

Oben gewählte Ausgangsstadt, daneben explizite Zielstadt. Eigene und fremde Ziele beim Liefern kenntlich machen. Verlegen zeigt nur andere eigene Städte. Übersicht über ausgehende/eingehende Bewegungen, filterbar nach Stadt und Typ.

Formular in drei kurzen Abschnitten: Ziel → Auswahl → Prüfung. Mengenfelder, Generalwahl optional beim Liefern und Mehrfachwahl beim Verlegen. Vorschau zeigt Zeit, Öl, Kapazität und spätere Wirkung auf Stadtunterhalt. Erst nach aktueller serverseitiger Vorschau endgültig starten.

Texte müssen den Unterschied erklären:
- Liefern: „LKWs kehren nach der Lieferung nach [Stadt] zurück.“
- Verlegen: „Die ausgewählten Einheiten und Generäle sind nach Ankunft in [Stadt] stationiert.“

Keine Genialität durch Farbe erwarten: klare Verben, konkrete Städte und Richtung. Keine zusätzliche Menüebene für jedes Unterformular.

## Umsetzung im vorhandenen Client

Bestehenden WebSocket-Transport und autoritative Spielzustände weiterverwenden. App.jsx, SidebarStatus.jsx und SidebarActions.jsx sind Ausgangspunkte der statischen Prüfung; tatsächliche Pfade prüfen. Navigationszustand zentral ordnen, Ansichten fachlich belassen und bestehende Portale/Modals an neue Kontextflächen anpassen. Ein Generalbereich darf aus MilitaryView extrahiert werden, ohne ihn zusätzlich doppelt zu rendern.

Bestehende Stadt-/Gebäudeillustrationen, Farbwelt und Icons weiterentwickeln. Dunkle Flächen mit unterscheidbaren Ebenen, helle Texte, sparsamer Akzent. Keine neue Grafikproduktion, keine zusätzliche UI-Bibliothek allein für dieses Layout.

Alle bestehenden Funktionen müssen eine eindeutige neue Heimat erhalten: Bau/Abriss, Ausbildung, Bürgermeister, Generalrekrutierung/-Skills, Forschungsleitung, NPC-/Feldaktionen, Eroberungsprognose, Gründung und Postbox. Vor Umbau eine kurze Zuordnung im PR dokumentieren; keine Aktion während des Redesigns verlieren.

## Überprüfbare Abnahme

- Bei 1366×768 sind alle sieben Hauptpunkte und der Start einer Aktion ohne Dokument-Scroll erreichbar.
- Im rechten Panel steht die passende primäre Aktion vor Aktivitätslisten.
- Bei 390×844 und 320 px Breite kein horizontaler Dokumentüberlauf; jede Hauptseite über sichtbare Navigation erreichbar.
- Tastatur, Escape, Fokuswiederherstellung, 200 % Zoom und lange Stadtnamen funktionieren.
- Reale Bedienwege: Stadtwechsel → Gebäudeaktion, Weltfeld → Aufklärung/Eroberung, Logistik → Lieferung/Verlegung, General → Skills, Forschung → Start, Postbox → Bericht.
- Nach Stadtwechsel keine alte Vorschau oder fremde cityId im Formular.
- UI-Screenshots und tatsächlich ausgeführte Browserprüfungen unter docs/LOGISTICS_UI_VALIDATION.md dokumentieren.
