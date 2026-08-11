/**
 * Auswahl-Fenster: normales, sichtbares Fenster (kein Overlay - Rahmen,
 * Taskleisteneintrag, schliessbar), in dem die Checkboxen fuer "welches
 * Overlay soll an sein" angezeigt werden. Erst ein Klick auf "Start" loest
 * `onStart` aus und damit das tatsaechliche Oeffnen der ausgewaehlten
 * Overlay-Fenster in main/index.ts - vorher ist ausser diesem Fenster
 * nichts sichtbar.
 *
 * Ueber den Tray-Eintrag "Overlays auswaehlen..." laesst sich dasselbe
 * Fenster jederzeit erneut oeffnen, um die Auswahl zu aendern (Overlays
 * nachtraeglich dazu- oder abschalten), ohne die App neu zu starten.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';

export interface LauncherOverlayEntry {
  id: string;
  label: string;
}

export interface LauncherOptions {
  overlays: LauncherOverlayEntry[];
  /** Liefert die aktuell gewuenschte Checkbox-Vorauswahl - bereits laufende Overlays, sonst die gespeicherte/Standard-Auswahl. */
  getSelected: () => string[];
  onStart: (selectedIds: string[]) => void;
}

let win: BrowserWindow | null = null;
let options: LauncherOptions | null = null;

function loadContent(target: BrowserWindow): void {
  if (process.env.ELECTRON_RENDERER_URL) {
    target.loadURL(`${process.env.ELECTRON_RENDERER_URL}/launcher/`);
  } else {
    target.loadFile(join(__dirname, '../renderer/launcher/index.html'));
  }
}

export function createLauncherWindow(opts: LauncherOptions): BrowserWindow {
  options = opts;

  win = new BrowserWindow({
    width: 360,
    height: 520,
    resizable: false,
    center: true,
    title: 'iRacing Overlay',
    autoHideMenuBar: true,
    backgroundColor: '#14161b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Die Overlay-Fenster laufen mit 'screen-saver'-Level always-on-top
  // (siehe overlayWindow.ts) - ohne das hier waere der Launcher beim
  // erneuten Oeffnen ueber den Tray hinter ihnen verdeckt.
  win.setAlwaysOnTop(true);

  loadContent(win);
  win.on('closed', () => {
    win = null;
  });

  return win;
}

export function showLauncherWindow(): void {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    return;
  }
  if (options) createLauncherWindow(options);
}

ipcMain.handle('launcher:get-config', () => {
  if (!options) return { overlays: [], selected: [] };
  return { overlays: options.overlays, selected: options.getSelected() };
});

ipcMain.on('launcher:start', (_event, selectedIds: string[]) => {
  options?.onStart(selectedIds);
  win?.close();
});
