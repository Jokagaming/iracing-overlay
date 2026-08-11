# iracing-overlay

Windows-Desktop-App mit transparenten, klickdurchlaessigen Always-on-Top-
Overlays fuer iRacing-Telemetrie — funktional an RaceLab orientiert (kein
Assets-/Code-/Design-Klon).

> Vorgaenger-Prototyp (Python + Browser-Widgets) ist archiviert unter
> [Jokagaming/iracing-overlay-python-poc](https://github.com/Jokagaming/iracing-overlay-python-poc).
> Die dort entwickelte Logik (v.a. die Relative-Abstandsberechnung inkl.
> Start/Ziel-Umlaufkorrektur) wird konzeptionell hierher uebernommen.

## Tech-Stack

- **Electron + TypeScript**, Datenlayer und UI in einer Sprache.
- Geplante iRacing-Anbindung: [`irsdk-node`](https://www.npmjs.com/package/irsdk-node)
  (aktiv gepflegt; `node-irsdk` ist seit Jahren tot). Wird in Meilenstein 1
  eingebunden, inkl. Test der Kompatibilitaet mit Electrons Node-ABI.
- Build: `electron-vite` (Vite fuer Main-, Preload- und mehrere
  Renderer-Bundles), `electron-builder` fuer den Windows-Installer (NSIS).
- `better-sqlite3` fuer ein Rundenzeiten-Log ist bewusst noch nicht eingebaut
  - Standings und Fuel-Rechner brauchen es nicht (Bestzeit/Verbrauch kommen
  live aus der Telemetrie), es haette also noch keinen Verbraucher gehabt.

Nur Borderless Windowed wird unterstuetzt — siehe
[docs/fullscreen-exclusive.md](docs/fullscreen-exclusive.md) fuer den Grund
(Windows komposittet im echten Fullscreen-Exclusive-Modus nicht mehr, das
betrifft jedes Overlay-Fenster, nicht nur dieses).

## Setup

```
npm install
npm run dev
```

Startet Electron im Dev-Modus mit Hot-Reload und verbindet sich mit einer
laufenden iRacing-Instanz. Zuerst erscheint ein Auswahl-Fenster mit einem
Layout-**Profil** (Dropdown oben, z.B. "Standard", "Oval", "Formel" - je
eigene Overlay-Auswahl UND eigene Fensterpositionen) und Checkboxen fuer
die zwoelf Overlays (Relative, Standings, Fuel, Inputs, Radar, Delta,
Laptimes, Reifen, Sektoren, Session-Timer, Weather, Flags) - erst ein Klick
auf "Start" oeffnet die angehakten Fenster: transparent, always-on-top,
standardmaessig klickdurchlaessig. Ueber "+" laesst sich ein neues Profil
anlegen (startet mit allen Overlays angehakt), "✎" benennt das aktuelle um,
"🗑" loescht es (mindestens eines bleibt immer erhalten). Ein Profilwechsel
schliesst alle offenen Fenster und oeffnet die Auswahl des neuen Profils
frisch - Fenster lassen sich nicht live zwischen Profilen "umhaengen".
Profile + Auswahl werden gespeichert
(`%APPDATA%/iracing-overlay/layouts/profiles.json`) und beim naechsten
Start vorausgewaehlt; beim allerersten Start gibt es ein Profil "Standard"
mit allen zwoelf Overlays angehakt. Ueber den Tray-Eintrag
"Overlays auswaehlen..." laesst sich das Fenster jederzeit erneut oeffnen,
um Profil oder Auswahl zu aendern, ohne die App neu zu starten.
`Strg+Alt+E` schaltet einen Edit-Modus um (gelber Rahmen). Im Edit-Modus
laesst sich jedes Fenster einzeln per Ziehen verschieben (auch auf einen
anderen Monitor - das *ist* die Monitor-Auswahl, es gibt dafuer kein
eigenes Dropdown) und per Eck-Griff unten rechts in der Groesse aendern.
Beides wird automatisch pro Profil gespeichert
(`%APPDATA%/iracing-overlay/layouts/<profil-id>.json`, das Profil
"Standard" nutzt weiterhin `default.json`) und beim naechsten Start
wiederhergestellt - haengt der gespeicherte Monitor nicht mehr dran, faellt
die Position auf den Standardwert zurueck.

Automatisches Umschalten des Profils anhand des gerade gefahrenen
Autos/der Serie/des Session-Typs ist bewusst noch nicht gebaut - das waere
ein groesseres, eigenstaendiges Stueck Arbeit (Session-Aenderung erkennen,
UX fuer "Layout hat sich gerade unter dir geaendert"). Aktuell ist der
Profilwechsel manuell ueber den Launcher.

Ohne laufendes iRacing testen:

```
npx electron-vite dev -- --demo
```

Der Datenlayer laeuft dabei direkt im Electron-Main-Process (nicht als
separater Prozess wie `src/data/cli.ts`) - der Code ist identisch, nur der
Aufrufer ist ein anderer, siehe `src/main/dataLayer.ts`.

Da alle Overlay-Fenster rahmenlos sind und keinen Schliessen-Button haben,
ist der **System-Tray** (gelber Punkt) die einzige Stelle, um die App
danach noch zu steuern: Klick oeffnet ein Menue mit "Overlays
auswaehlen..." (oeffnet erneut das Auswahl-Fenster), "Edit-Modus"
(derselbe Toggle wie `Strg+Alt+E`), "Nach Updates suchen" (siehe
"Auto-Update" unten) und "Beenden". Ohne den Tray liesse sich die App nur
ueber den Task-Manager beenden.

## Auto-Update

Ein installierter Client prueft automatisch gegen die GitHub Releases
dieses Repos (`electron-updater`) - einmal beim Start, danach alle 4
Stunden, zusaetzlich manuell ueber "Nach Updates suchen" im Tray. Ist ein
Update fertig heruntergeladen, fragt ein natives Dialogfenster, ob jetzt
neu gestartet werden soll; bei "Spaeter" installiert es sich automatisch
beim naechsten Beenden der App. Aktiv nur im gepackten Build - im
Dev-Modus (`npm run dev`) gibt es kein `app-update.yml` und keinen Grund,
gegen echte Releases zu pruefen.

**Release veroeffentlichen (automatisch, empfohlen):**

`.github/workflows/release.yml` baut bei jedem Push eines `v*`-Tags den
Installer auf einem echten Windows-Runner (kein Cross-Build - der native
`@irsdk-node`-Rebuild braucht Windows-Build-Tools) und laedt ihn direkt als
GitHub Release hoch:

```
npm version minor        # oder patch/major - setzt package.json UND den git-Tag
git push && git push --tags
```

Danach hat die GitHub-Releases-Seite dieses Repos automatisch die neue
`.exe` (inkl. `latest.yml` fuer `electron-updater`) - ein Kollege muss nur
noch diese eine Datei herunterladen und ausfuehren, keine Dev-Tools noetig.
Fortschritt/Ergebnis unter "Actions" im Repo einsehbar.

**Release veroeffentlichen (manuell, z.B. lokal zum Testen):**

```
npm run icons
npx electron-vite build
GH_TOKEN=<token mit repo-Rechten> npx electron-builder --win --publish always
```

Ohne `--publish` und `GH_TOKEN` passiert beim `package`-Skript weiterhin
nichts dergleichen, ein lokales `npm run package` bleibt rein lokal.
`GH_TOKEN` braucht Schreibrechte auf Releases dieses Repos (z.B. ein
Fine-grained PAT mit "Contents: Read and write").

Unsignierte Installer loesen bei jedem Download/Update weiterhin die
Windows-SmartScreen-Warnung aus - ohne Code-Signing-Zertifikat laesst sich
das nicht vermeiden, betrifft Erstinstallation wie Auto-Update gleichermassen.

## Installer bauen

```
npm run icons     # einmalig, oder nach Aenderung des Icon-Motivs
npm run package
```

Baut `dist/iRacing Overlay Setup <Version>.exe` (NSIS, pro Benutzer
installierbar, kein Administrator noetig). `electron-builder` baut dabei
automatisch `@irsdk-node/native` gegen die gepackte Electron-Node-ABI neu
(via `@electron/rebuild`) - das lief beim Testen ohne manuelles Eingreifen
durch.

`resources/icon.ico` und `resources/tray-icon.png` sind nicht von Hand
gezeichnet, sondern per `scripts/generate-icons.mjs` erzeugt (reines
Byte-Schreiben nach ICO-/PNG-Format, keine externen Bildwerkzeuge oder
Zusatzpakete noetig) - dieselben Farben wie die Overlays selbst
(`--bg`, `--player`).

## Status

| Meilenstein | Inhalt | Status |
|---|---|---|
| 0 | Electron-Grundgerued, transparentes Always-on-Top-Testfenster, Hotkey togglet Klickdurchlaessigkeit | **fertig, verifiziert** (Klick bei AN geht durch, bei Edit-Modus kommt er an) |
| 1 | Datenlayer eigenstaendig: SDK-Connector, Mock-Provider, Normalizer, WebSocket-Server | **fertig, verifiziert per Demo-Modus** (Live-Anbindung noch nicht gegen echtes iRacing getestet, siehe unten) |
| 2 | Erstes echtes Overlay (Relative) in Electron eingebunden | **fertig, verifiziert** (Datenlayer laeuft im Main-Process, Relative-Fenster zeigt korrekt sortierte Zeilen, Edit-Modus-Hotkey funktioniert am echten Overlay) |
| 3 | Edit-Modus wird nutzbar (Verschieben, Groesse aendern), Layout-Persistenz, Monitor-Auswahl, mehrere benannte Profile | **fertig, verifiziert per Typecheck/Build** - automatisches Umschalten nach Auto/Serie/Session-Typ ist manuell statt automatisch, siehe unten |
| 4 | Standings + Fuel-Rechner | **fertig, verifiziert per Demo-Modus** - SQLite-Rundenzeiten bewusst zurueckgestellt (kein Verbraucher dafuer), siehe unten |
| 5 | Input-Telemetrie-Graph + Radar | **fertig, verifiziert per Demo-Modus** - Radar zeigt bewusst keine geschaetzten Seitenpositionen anderer Autos, siehe unten |
| 6 | Delta-Bar, Session-Timer, Weather, Flags | **fertig, verifiziert per Demo-Modus** - Track Map bewusst zurueckgestellt (SDK-Datengrundlage ungeklaert), siehe unten |
| 7 | Packaging (`electron-builder`), Tray, Start-/CPU-Budget | **teilweise fertig, verifiziert** - Installer laeuft, CPU-Ziel unter Last von 7.2% auf 2.6% gedrueckt, knapp nicht ganz erreicht, siehe unten |

## Ordnerstruktur

```
src/
  main/        Electron Main-Process
                 index.ts          App-Lifecycle, Hotkey, Fenster erzeugen
                 overlayWindow.ts  Fenster erzeugen, Drag/Resize, Persistenz verdrahten
                 layoutStore.ts    Fenstergeometrie als JSON, pro Profil eine Datei
                 profileStore.ts   Layout-Profile (Name + Overlay-Auswahl) als JSON
                 launcherWindow.ts Auswahl-Fenster: Profile verwalten, Checkboxen + Start
                 dataLayer.ts      startet den Datenlayer im Main-Process
                 tray.ts           System-Tray: Overlays auswaehlen, Edit-Modus, Beenden
                 resources.ts      findet Icons in Dev- und gepacktem Build
  preload/     contextBridge-APIs fuer die Renderer
  renderer/    ein Ordner pro Overlay/Fenster, je ein Vite-Eintrag
                 shared/           Overlay-uebergreifend: WS-Client, Formatierung,
                                    Edit-Modus-Verdrahtung, Basis-CSS
                 launcher/         Auswahl-Fenster: Profil + welche Overlays sollen an sein
                 relative/         Autos vor/hinter dem Spieler (Meilenstein 2), optionale Extra-Spalten (Reifenmischung, Sektor-Vergleich) per Zahnrad im Edit-Modus
                 standings/        Session-Wertung nach Klasse (Meilenstein 4)
                 fuel/             Verbrauch, Restrunden, Nachtankmenge (Meilenstein 4)
                 inputs/           Gas/Bremse/Lenkung als Graph, Gang+Drehzahl (Meilenstein 5)
                 radar/            Naehe-Warnung + Autos in der Umgebung (Meilenstein 5)
                 delta/            Abstand zur eigenen Bestzeit (Meilenstein 6)
                 laptimes/         Balkendiagramm der letzten 5 Rundenzeiten
                 tires/            Reifentemperatur/-verschleiss/-druck pro Ecke
                 sectors/          Sektorzeiten, live + Session-Bestzeit pro Sektor
                 timer/            Session-Countdown, Runden/Zeit (Meilenstein 6)
                 weather/          Luft-/Streckentemperatur, Nasszustand (Meilenstein 6)
                 flags/            Aktive Streckenflaggen (Meilenstein 6)
  data/        Datenlayer, eigenstaendig lauffaehig ohne Electron:
                 types.ts        normalisiertes Modell
                 calc/            reine Funktionen (Relative-Gap, Fuel-Planung, Standings, Rundenzeiten-/Sektorzeiten-Historie), getestet
                 normalize/       SDK-Rohdaten -> normalisiertes Modell
                 mock/            simulierte Telemetrie ohne iRacing
                 server/          WebSocket-Broadcast
                 connector.ts     Live-Verbindung ueber irsdk-node
                 broadcaster.ts   Tick-/Sendeschleife inkl. Telemetrie-Drosselung, getestet
                 cli.ts           Einstiegspunkt: `npx tsx src/data/cli.ts [--demo] [--rate Hz]`
resources/     Icons (generiert, siehe scripts/generate-icons.mjs)
scripts/       Build-Hilfsskripte
docs/          Architektur- und SDK-Notizen
```

## Datenlayer selbststaendig testen

```
npx tsx src/data/cli.ts --demo
```

Startet den WebSocket-Server auf `ws://127.0.0.1:8778` mit simulierter
Telemetrie (20 Autos, 3 Klassen) - kein iRacing noetig. Ohne `--demo`
verbindet er sich mit einer laufenden iRacing-Instanz. `--rate <Hz>`
stellt die Telemetrie-Senderate ein (Standard: 20, siehe "Performance"
unten).

```
npx vitest run
```

Testet die reinen Berechnungsfunktionen (`src/data/calc/`): Relative-Gap,
Fuel-Tracking/-Planung, Standings-Gruppierung, Rundenzeiten-Historie,
Sektorzeiten-Historie.

## Radar: bewusste Design-Entscheidung

Das SDK liefert keine Telemetrie, aus der sich die tatsaechliche Fahrspur
eines fremden Autos herleiten liesse - nur `CarLeftRight`, ein einzelnes
vom SDK selbst berechnetes Signal fuers eigene Auto ("frei" / "Auto links"
/ "Auto rechts" / "Autos beidseitig" / ...). Ein Radar mit erfundenen
Seitenpositionen anderer Autos waere irrefuehrend. Der Radar kombiniert
deshalb bewusst nur echte Daten: `CarLeftRight` als Warnbalken links/rechts,
plus den laengsseitigen Abstand aus `calc/relative.ts` (bereits getestet)
fuer die Punkte oberhalb/unterhalb des Spielers.

Die Lenkwinkel-Linie im Inputs-Graph ist aus demselben Grund eine
Naeherung: `SteeringWheelAngle` kommt ohne das tatsaechliche Maximum des
jeweiligen Fahrzeugs/Lenkrads, `inputs/main.ts` nimmt einen festen,
plausiblen Bereich (±3.5 rad) an statt einen exakten Wert vorzutaeuschen.

Die Temperatur-Faerbung im Reifen-Overlay ist ebenfalls eine Naeherung:
das SDK liefert kein "optimales" Temperaturfenster pro Reifen/Fahrzeug,
`tires/main.ts` nimmt feste, fuer Rennslicks plausible Grenzen (< 70°C
kalt, 70–110°C optimal, > 110°C heiss) an.

## Sektorzeiten: berechnet, nicht vom SDK geliefert

Das SDK liefert nur die Sektor**grenzen** (`SplitTimeInfo.Sectors` -
`SectorNum` + `SectorStartPct`, wo ein Sektor auf der Runde beginnt),
keine fertigen Sektor**zeiten**. `calc/sectors.ts` (`SectorTracker`,
analog zu `FuelTracker`/`LapTimeTracker`) beobachtet, wann `lapDistPct`
eine Grenze ueberquert, und misst die vergangene Session-Zeit seit der
letzten Ueberquerung - inkl. Session-Bestzeit pro Sektor fuer die gruene
Faerbung im Overlay. Strecken ohne definierte Sektoren (manche
Ovale/Testtracks) zeigen das Overlay entsprechend leer/ausgeblendet.

`MultiCarSectorTracker` (selbe Datei) haelt das fuer **jedes** Auto vor,
nicht nur den Spieler - `CarIdxLapDistPct` gibt es fuer jedes Auto, die
Session-Zeit ist fuer alle dieselbe globale Uhr. Grundlage fuer den
Sektor-Vergleich im Relative-Overlay, siehe unten.

## Relative: optionale Extra-Spalten

Ueber das Zahnrad im Header (nur im Edit-Modus sichtbar/klickbar, wie der
Resize-Griff - das Fenster ist sonst klickdurchlaessig) lassen sich zwei
Spalten dazuschalten, Einstellung bleibt im Browser-Storage des Fensters
gespeichert:

- **Reifenmischung** - `CarIdxTireCompound`, fuer jedes Auto sichtbar
  (anders als Verschleiss/Temperatur/Druck, die das SDK nur fuers eigene
  Auto liefert, siehe Reifen-Overlay oben). Nur eine rohe Nummer, keine
  Klartext-Zuordnung wie "Weich"/"Hart" - die liefert das SDK nicht. In
  Serien mit nur einer Mischung zeigt die Spalte fuer alle denselben Wert.
- **Sektor-Δ** - vergleicht jede Zeile im letzten von *mir* abgeschlossenen
  Sektor gegen meine eigene Zeit fuer denselben Streckenabschnitt (nicht
  gegen die jeweils eigene letzte Runde der Zeile - bei Autos mit groesserem
  Abstand waere das nicht derselbe Streckenabschnitt). Gruen = die Zeile war
  dort schneller als ich, Rot = langsamer.

## Track Map: bewusst zurueckgestellt

Das SDK liefert keine direkten 2D-Weltkoordinaten (kein `PositionX/Y`, kein
GPS-artiges `Lat`/`Lon`). Eine Streckenkarte liesse sich nur per
Dead-Reckoning rekonstruieren: `VelocityX`/`VelocityY` ueber die Zeit
integrieren, dabei mit `YawNorth` in Weltkoordinaten rotieren, und den
Fehler pro Runde gegen `LapDistPct` = 1.0 korrigieren. Das Problem: die
generierten Typen dokumentieren nur "X velocity" / "Y velocity" - ob das
ueberhaupt fahrzeug- oder weltbezogene Achsen sind, ist nicht klar, und das
laesst sich ohne eine laufende iRacing-Session nicht verifizieren (siehe
naechster Abschnitt - der Sim-Prozess lief bislang bei keinem
Arbeitsschritt). Eine Rekonstruktion auf einer geratenen Achskonvention zu
bauen haette im Demo-Modus problemlos ausgesehen und waere an echten Daten
vermutlich falsch gewesen - das wollte ich nicht ungeprueft abliefern.
Kommt, sobald eine echte Session zum Verifizieren verfuegbar ist.

## Performance: gemessen, nicht behauptet

Der Installer wurde real gebaut, installiert, gestartet und wieder
deinstalliert (nicht nur "die Datei existiert" geprueft), und die
CPU-Last mehrfach unter echter Last neu gemessen, nicht nur einmal. Alle
Werte auf derselben 16-Kern-Entwicklungsmaschine, System-weit normiert (auf
einem echten Mittelklasse-System mit weniger Kernen waere der Prozentsatz
bei gleichem absoluten Verbrauch entsprechend hoeher):

| Messung | Ergebnis | Ziel |
|---|---|---|
| Startzeit (Klick bis alle Fenster erzeugt) | ~0.3 s | < 3 s ✅ |
| CPU im Leerlauf (wartet auf iRacing) | ~0.03 % | < 2 % ✅ |
| CPU im Demo-Modus, urspruenglich (9 Fenster, Telemetrie bei 60 Hz, WS) | ~7.2 % | < 2 % ❌ |
| CPU im Demo-Modus, Telemetrie auf 30 Hz gedrosselt (WS) | ~3.7 % | < 2 % ❌ |
| CPU im Demo-Modus, Telemetrie auf 20 Hz gedrosselt (WS) | ~2.6 % | < 2 % ⚠️ knapp verfehlt |
| CPU im Demo-Modus, 20 Hz + IPC statt WS fuer die eigenen Fenster (**jetziger Stand**) | ~2.2-2.4 % (2 Messlaeufe) | < 2 % ⚠️ knapp verfehlt |

**Ursache:** neun unabhaengige Electron-BrowserWindows bedeuten neun
unabhaengige Chromium-Renderer-Prozesse, jeder mit eigenem WebSocket,
eigenem `JSON.parse` des vollen Telemetrie-Frames und eigenem DOM-Update -
mal neun, bei jeder Sendung.

**Fix:** `data/broadcaster.ts` (gemeinsam von `cli.ts` und `dataLayer.ts`
genutzt, vorher war die Tick-Schleife in beiden separat implementiert)
sendet Telemetrie jetzt gedrosselt statt bei jedem Poll - die Quelle wird
weiter mit voller Rate abgefragt (`waitForData` blockiert beim echten SDK
ohnehin im Sim-eigenen Takt, und Zustand wie der `FuelTracker` darf keinen
Rundenwechsel verpassen), nur das tatsaechliche Aussenden wird gedrosselt.
Ueber `--rate <Hz>` einstellbar (`cli.ts`) bzw. `telemetryHz` in
`DataLayerOptions` (Electron, ebenfalls per `--rate <Hz>` am
Programmstart). 60→30 Hz brachte die groesste Verbesserung, 30→20 Hz
schon spuerbar weniger (deutet auf einen fixen Sockelverbrauch pro
Renderer-Fenster hin, der sich per Senderate nicht wegdrosseln laesst).
Visuell bei 20 Hz kein wahrnehmbarer Unterschied zu 60 Hz, auch nicht beim
Inputs-Graph.

**Zweiter Schritt: IPC statt WebSocket fuer die eigenen Fenster.** Die neun
eigenen Overlay-Fenster laufen jetzt ueber `webContents.send()` /
`ipcRenderer.on()` statt ueber den WebSocket-Server (kein
JSON.stringify/parse-Rundweg mehr fuer diese neun Fenster). Der WS-Server
laeuft weiter unveraendert fuer externe Verbraucher (z.B. eine kuenftige
OBS-Browser-Source) und fuer das eigenstaendige CLI, das keine IPC-Option
hat. `renderer/shared/client.ts` erkennt automatisch, welcher Transport
verfuegbar ist - dieselben Widget-Dateien funktionieren dadurch
unveraendert in beiden Faellen. Ein IPC-Aequivalent zum WS-"welcome"
(neu verbundener Client bekommt sofort den letzten Session-Stand) war
noetig und ist ergaenzt (`DataLayer.getWelcomeMessages()`, ausgeloest
ueber `did-finish-load` pro Fenster).

Effekt: ~2.6 % -> ~2.2-2.4 %, also ein spuerbarer, aber kleinerer Sprung
als die Sende-Drosselung selbst. Das <2%-Ziel bleibt damit knapp verfehlt.
Weiteres Drosseln unter 20 Hz haette das vermutlich geschafft, wurde aber
bewusst nicht gemacht - das Verhaeltnis Nutzen/Risiko fuer Bildwiederholrate
kippt dort.

**Nicht abgeschlossen verifiziert:** Die interaktive Pruefung von
Edit-Modus/Tray nach diesem Umbau (Hotkey, Fenster verschieben) konnte in
dieser Session nicht zuverlaessig durchgefuehrt werden - die
Eingabe-Simulation (Maus/Tastatur) versagte durchgaengig, auch bei einem
voellig app-unabhaengigen Test (Klick auf die Windows-Uhr oeffnete kein
Kalender-Flyout), was auf ein Umgebungsproblem der Test-Session hindeutet,
nicht auf einen Code-Fehler. Ueber eine dateibasierte Debug-Ausgabe (nicht
stdout-gepuffert) liess sich immerhin zeigen, dass die
Hotkey-Registrierung selbst erfolgreich ist (`globalShortcut.isRegistered`
= `true`); ob der Hotkey/Tray-Klick am Ende tatsaechlich `toggleEditMode()`
ausloest, ist offen. An der Edit-Modus-/Resize-Logik selbst wurde in
diesem Umbau nichts geaendert, nur ein neuer `did-finish-load`-Hook
ergaenzt - das Risiko einer echten Regression ist klein, aber unbewiesen.
Sollte beim naechsten Mal zuerst erneut gegengeprueft werden.

## Bekannte offene Punkte

- **Noch nie gegen echtes iRacing getestet.** Der Sim-Prozess lief bei
  keinem bisherigen Arbeitsschritt (nur Launcher/Client, kein
  `iRacingSim64DX11.exe`) - `IsSimRunning()` liefert bislang immer `false`.
  Als "UNSICHER" markierte SDK-Feldnamen/Semantik (`src/data/types.ts`)
  sowie die komplette Live-Verbindung sind entsprechend nur gegen den
  Demo-Modus verifiziert, nicht gegen echte Daten.
- `irsdk-node`s Umgang mit fehlerhaft formatierter Session-YAML (Sonderzeichen
  in Fahrernamen, Team-Events) ist ungeprueft; IRSDKSharper (C#) patcht dafuer
  bekannte Faelle, ob `irsdk-node` das auch tut, ist offen.
- Mehrere benannte Layout-Profile (je eigene Overlay-Auswahl + eigene
  Fensterpositionen) lassen sich jetzt im Launcher anlegen/umbenennen/
  loeschen/wechseln - **automatisches** Umschalten anhand des gerade
  gefahrenen Autos/der Serie/des Session-Typs ist bewusst noch nicht
  gebaut (Session-Aenderung erkennen + UX fuer "Layout hat sich gerade
  unter dir geaendert" waere ein eigenstaendiges, groesseres Stueck
  Arbeit). Der Profilwechsel ist aktuell manuell.
- Edit-Modus/Tray nach dem IPC-Umbau nicht interaktiv nachgeprueft (siehe
  "Performance" oben) - Eingabe-Simulation versagte in dieser Session
  systemweit, nicht nur fuer diese App.

Geklaert: `irsdk-node`s native Bindings laden ohne Probleme in Electrons
Node-ABI (getestet via `ELECTRON_RUN_AS_NODE=1`) - das Paket wird explizit
mit `--napi --electron-compat` gebaut, N-API ist ABI-stabil ueber Node- und
Electron-Versionen hinweg.
