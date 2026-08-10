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
  Renderer-Bundles).
- Geplant: `better-sqlite3` fuer das Rundenzeiten-Log (Meilenstein 4).

Nur Borderless Windowed wird unterstuetzt — siehe
[docs/fullscreen-exclusive.md](docs/fullscreen-exclusive.md) fuer den Grund
(Windows komposittet im echten Fullscreen-Exclusive-Modus nicht mehr, das
betrifft jedes Overlay-Fenster, nicht nur dieses).

## Setup

```
npm install
npm run dev
```

Startet Electron im Dev-Modus mit Hot-Reload, verbindet sich mit einer
laufenden iRacing-Instanz und zeigt das Relative-Overlay: transparent,
always-on-top, standardmaessig klickdurchlaessig. `Strg+Alt+E` schaltet
einen Edit-Modus um (gelber Rahmen). Im Edit-Modus laesst sich das Fenster
per Ziehen am Fenster verschieben (auch auf einen anderen Monitor - das
*ist* die Monitor-Auswahl, es gibt dafuer kein eigenes Dropdown) und per
Eck-Griff unten rechts in der Groesse aendern. Beides wird automatisch
gespeichert (`%APPDATA%/iracing-overlay/layouts/default.json`) und beim
naechsten Start wiederhergestellt - haengt der gespeicherte Monitor nicht
mehr dran, faellt die Position auf den Standardwert zurueck.

Ohne laufendes iRacing testen:

```
npx electron-vite dev -- --demo
```

Der Datenlayer laeuft dabei direkt im Electron-Main-Process (nicht als
separater Prozess wie `src/data/cli.ts`) - der Code ist identisch, nur der
Aufrufer ist ein anderer, siehe `src/main/dataLayer.ts`.

## Status

| Meilenstein | Inhalt | Status |
|---|---|---|
| 0 | Electron-Grundgerued, transparentes Always-on-Top-Testfenster, Hotkey togglet Klickdurchlaessigkeit | **fertig, verifiziert** (Klick bei AN geht durch, bei Edit-Modus kommt er an) |
| 1 | Datenlayer eigenstaendig: SDK-Connector, Mock-Provider, Normalizer, WebSocket-Server | **fertig, verifiziert per Demo-Modus** (Live-Anbindung noch nicht gegen echtes iRacing getestet, siehe unten) |
| 2 | Erstes echtes Overlay (Relative) in Electron eingebunden | **fertig, verifiziert** (Datenlayer laeuft im Main-Process, Relative-Fenster zeigt korrekt sortierte Zeilen, Edit-Modus-Hotkey funktioniert am echten Overlay) |
| 3 | Edit-Modus wird nutzbar (Verschieben, Groesse aendern), Layout-Persistenz, Monitor-Auswahl | **teilweise fertig, verifiziert** - Auto-Switch nach Auto/Serie/Session-Typ fehlt noch, siehe unten |
| 4 | Standings + Fuel-Rechner, SQLite-Rundenzeiten | offen |
| 5 | Input-Telemetrie-Graph + Radar | offen |
| 6 | Track Map, Delta-Bar/Timer/Weather/Flags | offen |
| 7 | Packaging (`electron-builder`), Tray, Start-/CPU-Budget | offen |

## Ordnerstruktur

```
src/
  main/        Electron Main-Process
                 index.ts          App-Lifecycle, Hotkey, Fenster erzeugen
                 overlayWindow.ts  Fenster erzeugen, Drag/Resize, Persistenz verdrahten
                 layoutStore.ts    Fenstergeometrie als JSON im Nutzerprofil
                 dataLayer.ts      startet den Datenlayer im Main-Process
  preload/     contextBridge-APIs fuer die Renderer
  renderer/    ein Ordner pro Overlay/Fenster, je ein Vite-Eintrag
                 relative/         erstes echtes Overlay (Meilenstein 2)
  data/        Datenlayer, eigenstaendig lauffaehig ohne Electron:
                 types.ts        normalisiertes Modell
                 calc/            reine Funktionen (Relative-Gap, ...), getestet
                 normalize/       SDK-Rohdaten -> normalisiertes Modell
                 mock/            simulierte Telemetrie ohne iRacing
                 server/          WebSocket-Broadcast
                 connector.ts     Live-Verbindung ueber irsdk-node
                 cli.ts           Einstiegspunkt: `npx tsx src/data/cli.ts [--demo]`
docs/          Architektur- und SDK-Notizen
```

## Datenlayer selbststaendig testen

```
npx tsx src/data/cli.ts --demo
```

Startet den WebSocket-Server auf `ws://127.0.0.1:8778` mit simulierter
Telemetrie (20 Autos, 3 Klassen) - kein iRacing noetig. Ohne `--demo`
verbindet er sich mit einer laufenden iRacing-Instanz.

```
npx vitest run
```

Testet die reinen Berechnungsfunktionen (`src/data/calc/`).

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
- Auto-Switch der Layouts nach Auto/Serie/Session-Typ (mehrere benannte
  Profile) ist noch nicht gebaut - dafuer fehlt jede UI, mit der man
  ueberhaupt mehrere Layouts anlegen und benennen koennte. Aktuell gibt es
  genau ein Profil ("default"), das alle Overlay-Positionen haelt.

Geklaert: `irsdk-node`s native Bindings laden ohne Probleme in Electrons
Node-ABI (getestet via `ELECTRON_RUN_AS_NODE=1`) - das Paket wird explizit
mit `--napi --electron-compat` gebaut, N-API ist ABI-stabil ueber Node- und
Electron-Versionen hinweg.
