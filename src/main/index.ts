import { app, globalShortcut } from 'electron';
import type { BrowserWindow } from 'electron';
import { DataLayer } from './dataLayer.js';
import { createOverlayWindow, setEditMode } from './overlayWindow.js';

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
];

const dataLayer = new DataLayer();
let overlayWindows: BrowserWindow[] = [];
let editMode = false;

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

  // --demo laesst die App ohne laufendes iRacing testen, z.B. via
  // `npm run dev -- --demo` im electron-vite-Entwicklungsmodus.
  const demo = process.argv.includes('--demo');
  await dataLayer.start({ host: DATA_HOST, port: DATA_PORT, demo });
  console.log(`[main] Datenlayer auf ws://${DATA_HOST}:${DATA_PORT}${demo ? ' (Demo-Modus)' : ''}`);
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', async () => {
  globalShortcut.unregisterAll();
  await dataLayer.stop();
});
