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
| 1 | Datenlayer eigenstaendig: SDK-Connector, Mock/Replay-Provider, Normalizer, WebSocket-Server | offen |
| 2 | Erstes echtes Overlay (Relative) in Electron eingebunden | offen |
| 3 | Edit-Modus + Layout-Persistenz, Auto-Switch nach Auto/Serie/Session-Typ | offen |
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
docs/          Architektur- und SDK-Notizen
```

Der Datenlayer (`packages/data/` — SDK-Connector, Normalizer, Berechnungen,
WebSocket-Server) kommt in Meilenstein 1 als eigenstaendiges, ohne Electron
lauffaehiges Paket dazu.

## Bekannte offene Punkte

Als "UNSICHER" markierte SDK-Feldnamen/Semantik werden erst gegen echte
iRacing-Daten verifiziert, sobald eine Session verfuegbar ist — siehe
Kommentare im normalisierten Datenmodell (`packages/data/src/normalize/types.ts`,
entsteht in Meilenstein 1).
