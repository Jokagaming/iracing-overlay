/**
 * Auswahl-Fenster: normales, sichtbares Fenster (kein Overlay - Rahmen,
 * Taskleisteneintrag, schliessbar), in dem sich Layout-Profil und die
 * Checkboxen fuer "welches Overlay soll an sein" auswaehlen lassen. Erst
 * ein Klick auf "Start" loest `onStart` aus und damit das tatsaechliche
 * Oeffnen der ausgewaehlten Overlay-Fenster in main/index.ts - vorher ist
 * ausser diesem Fenster nichts sichtbar.
 *
 * Ueber den Tray-Eintrag "Overlays auswaehlen..." laesst sich dasselbe
 * Fenster jederzeit erneut oeffnen, um Auswahl oder Profil zu aendern
 * (Overlays nachtraeglich dazu- oder abschalten, zwischen Profilen wie
 * "Oval"/"Formel" wechseln), ohne die App neu zu starten.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';

export interface LauncherOverlayEntry {
  id: string;
  label: string;
}

export interface LauncherProfile {
  id: string;
  name: string;
  selectedOverlayIds: string[];
}

export interface LauncherOptions {
  overlays: LauncherOverlayEntry[];
  getProfiles: () => LauncherProfile[];
  getActiveProfileId: () => string;
  /** Gerade offene Overlay-Fenster - nur fuer das aktive Profil aussagekraeftig (siehe renderer/launcher/main.ts). */
  getRunningOverlayIds: () => string[];
  onCreateProfile: (name: string) => Promise<LauncherProfile>;
  onRenameProfile: (profileId: string, name: string) => void;
  onDeleteProfile: (profileId: string) => Promise<{ profiles: LauncherProfile[]; activeProfileId: string }>;
  onStart: (profileId: string, selectedIds: string[]) => void;
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
    height: 560,
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
  if (!options) return { overlays: [], profiles: [], activeProfileId: '', runningOverlayIds: [] };
  return {
    overlays: options.overlays,
    profiles: options.getProfiles(),
    activeProfileId: options.getActiveProfileId(),
    runningOverlayIds: options.getRunningOverlayIds(),
  };
});

ipcMain.handle('launcher:create-profile', (_event, name: string) => options?.onCreateProfile(name));

ipcMain.on('launcher:rename-profile', (_event, profileId: string, name: string) => {
  options?.onRenameProfile(profileId, name);
});

ipcMain.handle('launcher:delete-profile', (_event, profileId: string) => options?.onDeleteProfile(profileId));

ipcMain.on('launcher:start', (_event, profileId: string, selectedIds: string[]) => {
  options?.onStart(profileId, selectedIds);
  win?.close();
});
