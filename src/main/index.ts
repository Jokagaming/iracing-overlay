import { app, globalShortcut } from 'electron';
import type { BrowserWindow, Tray } from 'electron';
import { DataLayer } from './dataLayer.js';
import { createOverlayWindow, setEditMode } from './overlayWindow.js';
import { createTray } from './tray.js';

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

const dataLayer = new DataLayer();
let overlayWindows: BrowserWindow[] = [];
let editMode = false;
// Muss am Leben gehalten werden - ein garbage-collectes Tray-Objekt laesst
// das Icon kommentarlos aus der Taskleiste verschwinden.
let tray: Tray | null = null;

function toggleEditMode(): void {
  editMode = !editMode;
  setEditMode(overlayWindows, editMode);
  console.log(`[main] edit mode -> ${editMode}`);
}

app.whenReady().then(async () => {
  overlayWindows = await Promise.all(OVERLAY_WINDOWS.map((config) => createOverlayWindow(config)));

  const registered = globalShortcut.register(EDIT_MODE_HOTKEY, toggleEditMode);
  if (!registered) {
    console.error(`[main] Hotkey ${EDIT_MODE_HOTKEY} konnte nicht registriert werden`);
  }

  tray = createTray({ onToggleEditMode: toggleEditMode, isEditMode: () => editMode });

  // --demo laesst die App ohne laufendes iRacing testen, z.B. via
  // `npm run dev -- --demo` im electron-vite-Entwicklungsmodus.
  const demo = process.argv.includes('--demo');
  await dataLayer.start({ host: DATA_HOST, port: DATA_PORT, demo });
  console.log(`[main] Datenlayer auf ws://${DATA_HOST}:${DATA_PORT}${demo ? ' (Demo-Modus)' : ''}`);
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
