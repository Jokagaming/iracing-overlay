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

Startet Electron im Dev-Modus mit Hot-Reload. Aktuell (Meilenstein 0) oeffnet
sich ein einzelnes Testfenster oben links: transparent, always-on-top,
standardmaessig klickdurchlaessig. `Strg+Alt+E` schaltet einen Edit-Modus um
(gelber Rahmen, Klicks werden dann vom Fenster selbst verarbeitet statt
durchgereicht) — das ist der Kernmechanismus, auf dem alle spaeteren Overlays
aufbauen.

## Status

| Meilenstein | Inhalt | Status |
|---|---|---|
| 0 | Electron-Grundgerued, transparentes Always-on-Top-Testfenster, Hotkey togglet Klickdurchlaessigkeit | **fertig, verifiziert** (Klick bei AN geht durch, bei Edit-Modus kommt er an) |
| 1 | Datenlayer eigenstaendig: SDK-Connector, Mock-Provider, Normalizer, WebSocket-Server | **fertig, verifiziert per Demo-Modus** (Live-Anbindung noch nicht gegen echtes iRacing getestet, siehe unten) |
| 2 | Erstes echtes Overlay (Relative) in Electron eingebunden | offen |
| 3 | Edit-Modus + Layout-Persistenz, Auto-Switch nach Auto/Serie/Session-Typ, **Monitor-Auswahl pro Overlay** | offen |
| 4 | Standings + Fuel-Rechner, SQLite-Rundenzeiten | offen |
| 5 | Input-Telemetrie-Graph + Radar | offen |
| 6 | Track Map, Delta-Bar/Timer/Weather/Flags | offen |
| 7 | Packaging (`electron-builder`), Tray, Start-/CPU-Budget | offen |

## Ordnerstruktur

```
src/
  main/        Electron Main-Process (Fensterverwaltung, Hotkeys)
  preload/     contextBridge-APIs fuer die Renderer
  renderer/    ein Ordner pro Overlay/Fenster, je ein Vite-Eintrag
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

- Als "UNSICHER" markierte SDK-Feldnamen/Semantik (`src/data/types.ts`)
  sind erst gegen echte iRacing-Daten verifiziert, sobald eine Session
  laeuft - bisher nur gegen den Demo-Modus getestet.
- `irsdk-node`s Umgang mit fehlerhaft formatierter Session-YAML (Sonderzeichen
  in Fahrernamen, Team-Events) ist ungeprueft; IRSDKSharper (C#) patcht dafuer
  bekannte Faelle, ob `irsdk-node` das auch tut, ist offen.
- Die Kompatibilitaet von `irsdk-node`s nativen Bindings mit Electrons
  Node-ABI ist noch nicht getestet (relevant fuer Meilenstein 2, wenn der
  Datenlayer in den Electron-Main-Process eingebunden wird).
