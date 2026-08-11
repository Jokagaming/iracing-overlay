import { app, globalShortcut } from 'electron';
import type { BrowserWindow, Tray } from 'electron';
import { DataLayer } from './dataLayer.js';
import { createOverlayWindow, setEditMode } from './overlayWindow.js';
import { createTray } from './tray.js';
import { createLauncherWindow, showLauncherWindow } from './launcherWindow.js';
import { loadSelection, saveSelection } from './selectionStore.js';

const EDIT_MODE_HOTKEY = 'Control+Alt+E';
const DATA_HOST = '127.0.0.1';
const DATA_PORT = 8778;
// Startpositionen, falls noch kein Layout gespeichert ist (erster Start).
const OVERLAY_WINDOWS = [
  { id: 'relative', x: 40, y: 40, width: 340, height: 260 },
  { id: 'standings', x: 400, y: 40, width: 360, height: 320 },
  { id: 'fuel', x: 40, y: 320, width: 220, height: 190 },
  { id: 'inputs', x: 780, y: 40, width: 300, height: 150 },
  { id: 'radar', x: 780, y: 210, width: 150, height: 220 },
  { id: 'delta', x: 40, y: 530, width: 180, height: 90 },
  { id: 'timer', x: 240, y: 530, width: 150, height: 100 },
  { id: 'weather', x: 410, y: 530, width: 190, height: 130 },
  { id: 'flags', x: 620, y: 530, width: 160, height: 60 },
];

// Deutsche Anzeigenamen fuer das Auswahl-Menue (launcherWindow.ts) - hat
// sonst keinen Bezug zu OVERLAY_WINDOWS, nur ueber die id verknuepft.
const OVERLAY_LABELS: Record<string, string> = {
  relative: 'Relative (Autos vor/hinter mir)',
  standings: 'Wertung',
  fuel: 'Sprit',
  inputs: 'Eingaben (Gas/Bremse/Lenkung)',
  radar: 'Radar',
  delta: 'Delta (Bestzeit-Abstand)',
  timer: 'Session-Timer',
  weather: 'Wetter',
  flags: 'Flaggen',
};

const dataLayer = new DataLayer();
// Nur die gerade offenen Overlay-Fenster, per id - der Launcher schaltet
// einzelne davon an/aus, ohne die App neu zu starten.
const overlayWindows = new Map<string, BrowserWindow>();
let editMode = false;
// Muss am Leben gehalten werden - ein garbage-collectes Tray-Objekt laesst
// das Icon kommentarlos aus der Taskleiste verschwinden.
let tray: Tray | null = null;

/** `--rate 20` -> 20. Ungueltig oder fehlend -> undefined (DataLayer nutzt dann seinen Standard). */
function parseRateArg(argv: string[]): number | undefined {
  const index = argv.indexOf('--rate');
  if (index === -1 || index + 1 >= argv.length) return undefined;
  const value = Number(argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function toggleEditMode(): void {
  editMode = !editMode;
  setEditMode([...overlayWindows.values()], editMode);
  console.log(`[main] edit mode -> ${editMode}`);
}

async function openOverlay(id: string): Promise<void> {
  const config = OVERLAY_WINDOWS.find((w) => w.id === id);
  if (!config) return;
  const win = await createOverlayWindow(config, () => dataLayer.getWelcomeMessages());
  if (editMode) setEditMode([win], true);
  overlayWindows.set(id, win);
}

/** Wird vom Launcher-Fenster mit der Checkbox-Auswahl aufgerufen: schliesst Abgewaehltes, oeffnet Neues, speichert die Auswahl. */
async function applySelection(selectedIds: string[]): Promise<void> {
  const selected = new Set(selectedIds);

  for (const [id, win] of overlayWindows) {
    if (!selected.has(id)) {
      win.close();
      overlayWindows.delete(id);
    }
  }

  for (const id of selected) {
    if (!overlayWindows.has(id)) await openOverlay(id);
  }

  await saveSelection([...selected]);
}

const DEFAULT_TELEMETRY_HZ = 20;

app.whenReady().then(async () => {
  const savedSelection = await loadSelection();
  // Erster Start (noch keine gespeicherte Auswahl): alle Overlays vorausgewaehlt.
  const initialSelection = savedSelection ?? OVERLAY_WINDOWS.map((w) => w.id);

  createLauncherWindow({
    overlays: OVERLAY_WINDOWS.map((w) => ({ id: w.id, label: OVERLAY_LABELS[w.id] ?? w.id })),
    getSelected: () => (overlayWindows.size > 0 ? [...overlayWindows.keys()] : initialSelection),
    onStart: (selectedIds) => {
      void applySelection(selectedIds);
    },
  });

  const registered = globalShortcut.register(EDIT_MODE_HOTKEY, toggleEditMode);
  if (!registered) {
    console.error(`[main] Hotkey ${EDIT_MODE_HOTKEY} konnte nicht registriert werden`);
  }

  tray = createTray({
    onToggleEditMode: toggleEditMode,
    isEditMode: () => editMode,
    onOpenLauncher: showLauncherWindow,
  });

  // --demo laesst die App ohne laufendes iRacing testen, z.B. via
  // `npm run dev -- --demo` im electron-vite-Entwicklungsmodus.
  const demo = process.argv.includes('--demo');
  const telemetryHz = parseRateArg(process.argv);
  await dataLayer.start({
    host: DATA_HOST,
    port: DATA_PORT,
    demo,
    telemetryHz,
    // Direkt an die eigenen Fenster statt nur ueber WS - siehe
    // dataLayer.ts und README ("Performance"). Der WS-Server laeuft
    // trotzdem weiter, fuer externe Verbraucher. Laeuft unabhaengig von
    // der Launcher-Auswahl - erst offene Overlay-Fenster bekommen etwas
    // zu sehen.
    onMessage: (message) => {
      for (const win of overlayWindows.values()) {
        if (!win.isDestroyed()) win.webContents.send('bridge-message', message);
      }
    },
  });
  console.log(
    `[main] Datenlayer auf ws://${DATA_HOST}:${DATA_PORT}${demo ? ' (Demo-Modus)' : ''}, Telemetrie ${telemetryHz ?? DEFAULT_TELEMETRY_HZ}Hz`,
  );
});

// Bewusst KEIN app.quit() bei window-all-closed: die Overlays haben weder
// Rahmen noch Schliessen-Button, die App soll ausschliesslich ueber den
// Tray ("Beenden") oder Strg+C im Terminal enden - alles andere waere
// ueberraschend fuer eine Tray-App.

app.on('will-quit', async () => {
  globalShortcut.unregisterAll();
  tray?.destroy();
  await dataLayer.stop();
});
