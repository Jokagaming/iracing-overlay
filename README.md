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

Startet Electron im Dev-Modus mit Hot-Reload, verbindet sich mit einer
laufenden iRacing-Instanz und zeigt neun Overlays (Relative, Standings,
Fuel, Inputs, Radar, Delta, Session-Timer, Weather, Flags): transparent,
always-on-top, standardmaessig klickdurchlaessig. `Strg+Alt+E` schaltet
einen Edit-Modus um (gelber Rahmen). Im Edit-Modus laesst sich jedes
Fenster einzeln per Ziehen verschieben (auch auf einen anderen Monitor -
das *ist* die Monitor-Auswahl, es gibt dafuer kein eigenes Dropdown) und
per Eck-Griff unten rechts in der Groesse aendern. Beides wird automatisch
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
| 4 | Standings + Fuel-Rechner | **fertig, verifiziert per Demo-Modus** - SQLite-Rundenzeiten bewusst zurueckgestellt (kein Verbraucher dafuer), siehe unten |
| 5 | Input-Telemetrie-Graph + Radar | **fertig, verifiziert per Demo-Modus** - Radar zeigt bewusst keine geschaetzten Seitenpositionen anderer Autos, siehe unten |
| 6 | Delta-Bar, Session-Timer, Weather, Flags | **fertig, verifiziert per Demo-Modus** - Track Map bewusst zurueckgestellt (SDK-Datengrundlage ungeklaert), siehe unten |
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
                 shared/           Overlay-uebergreifend: WS-Client, Formatierung,
                                    Edit-Modus-Verdrahtung, Basis-CSS
                 relative/         Autos vor/hinter dem Spieler (Meilenstein 2)
                 standings/        Session-Wertung nach Klasse (Meilenstein 4)
                 fuel/             Verbrauch, Restrunden, Nachtankmenge (Meilenstein 4)
                 inputs/           Gas/Bremse/Lenkung als Graph, Gang+Drehzahl (Meilenstein 5)
                 radar/            Naehe-Warnung + Autos in der Umgebung (Meilenstein 5)
                 delta/            Abstand zur eigenen Bestzeit (Meilenstein 6)
                 timer/            Session-Countdown, Runden/Zeit (Meilenstein 6)
                 weather/          Luft-/Streckentemperatur, Nasszustand (Meilenstein 6)
                 flags/            Aktive Streckenflaggen (Meilenstein 6)
  data/        Datenlayer, eigenstaendig lauffaehig ohne Electron:
                 types.ts        normalisiertes Modell
                 calc/            reine Funktionen (Relative-Gap, Fuel-Planung, Standings), getestet
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

Testet die reinen Berechnungsfunktionen (`src/data/calc/`): Relative-Gap,
Fuel-Tracking/-Planung, Standings-Gruppierung.

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
