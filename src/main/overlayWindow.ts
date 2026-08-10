/**
 * Erzeugt ein Overlay-Fenster: transparent, always-on-top, standardmaessig
 * klickdurchlaessig. Das ist der in Meilenstein 0 verifizierte Mechanismus
 * (siehe README) - jetzt fuer beliebige Overlays statt nur das Testfenster.
 */

import { BrowserWindow } from 'electron';
import { join } from 'node:path';

export interface OverlayWindowConfig {
  /** Muss zum Schluessel in electron.vite.config.ts's rendererEntries passen. */
  entry: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function createOverlayWindow(config: OverlayWindowConfig): BrowserWindow {
  const win = new BrowserWindow({
    x: config.x,
    y: config.y,
    width: config.width,
    height: config.height,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 'screen-saver' haelt das Fenster auch ueber Vollbild-Anwendungen im
  // Borderless-Windowed-Modus oben. Bei echtem Fullscreen-Exclusive greift
  // das nicht mehr (siehe docs/fullscreen-exclusive.md).
  win.setAlwaysOnTop(true, 'screen-saver');

  // Ausserhalb des Edit-Modus muessen Klicks ungehindert zum Sim durchgehen,
  // sonst blockiert das Overlay dessen Bedienung.
  win.setIgnoreMouseEvents(true);

  win.once('ready-to-show', () => win.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${config.entry}/`);
  } else {
    win.loadFile(join(__dirname, `../renderer/${config.entry}/index.html`));
  }

  return win;
}

export function setEditMode(windows: BrowserWindow[], editMode: boolean): void {
  for (const win of windows) {
    // forward:true laesst Hover-Events weiter beim Renderer ankommen, falls
    // spaeter Resize-Handles per CSS :hover reagieren sollen.
    win.setIgnoreMouseEvents(!editMode, { forward: true });
    win.webContents.send('edit-mode-changed', editMode);
  }
}
