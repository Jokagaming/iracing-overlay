/**
 * Erzeugt ein Overlay-Fenster: transparent, always-on-top, standardmaessig
 * klickdurchlaessig. Das ist der in Meilenstein 0 verifizierte Mechanismus.
 *
 * Im Edit-Modus laesst sich das Fenster verschieben (natives
 * `-webkit-app-region: drag` im Renderer-CSS - kein Code hier noetig) und
 * per Eck-Griff in der Groesse aendern (siehe resizeBy unten). Beides wird
 * entprellt in layoutStore.ts persistiert; das Verschieben auf einen
 * anderen Monitor ist damit gleichzeitig die Monitor-Auswahl - es braucht
 * dafuer kein eigenes Dropdown.
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';
import { loadWindowLayout, saveWindowLayout, type WindowLayout } from './layoutStore.js';
import type { BridgeMessage } from '../data/types.js';

const SAVE_DEBOUNCE_MS = 500;
const MIN_WIDTH = 160;
const MIN_HEIGHT = 80;

export interface OverlayWindowConfig {
  /** Eindeutige ID des Overlays - Schluessel in layouts/default.json UND
   *  muss zum Schluessel in electron.vite.config.ts's rendererEntries passen. */
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function currentDisplayId(bounds: { x: number; y: number; width: number; height: number }): number {
  return screen.getDisplayMatching(bounds).id;
}

/** Nutzt die gespeicherte Position, wenn ihr Monitor noch existiert - sonst den Fallback. */
function resolveInitialBounds(config: OverlayWindowConfig, saved: WindowLayout | undefined) {
  if (!saved) return config;

  const displayExists = screen.getAllDisplays().some((d) => d.id === saved.displayId);
  if (!displayExists) {
    console.warn(
      `[layout] Monitor fuer "${config.id}" (id=${saved.displayId}) nicht mehr vorhanden, verwende Standardposition`,
    );
    return config;
  }

  return { x: saved.x, y: saved.y, width: saved.width, height: saved.height };
}

export async function createOverlayWindow(
  config: OverlayWindowConfig,
  getWelcomeMessages?: () => BridgeMessage[],
): Promise<BrowserWindow> {
  const saved = await loadWindowLayout(config.id);
  const bounds = resolveInitialBounds(config, saved);

  const win = new BrowserWindow({
    ...bounds,
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
  win.setIgnoreMouseEvents(true);
  win.once('ready-to-show', () => win.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${config.id}/`);
  } else {
    win.loadFile(join(__dirname, `../renderer/${config.id}/index.html`));
  }

  // Ohne das wuerde ein Fenster, dessen Renderer-JS erst nach der letzten
  // Session-Aenderung zu lauschen beginnt, nie eine session-Nachricht
  // bekommen - die wird per IPC nur bei tatsaechlicher Aenderung
  // verschickt, nicht periodisch (Aequivalent zum "welcome" fuer neu
  // verbundene WS-Clients, siehe DataLayer.getWelcomeMessages()).
  win.webContents.once('did-finish-load', () => {
    for (const message of getWelcomeMessages?.() ?? []) win.webContents.send('bridge-message', message);
  });

  wirePersistence(win, config.id);
  wireResizeHandle(win, config.id);

  return win;
}

/** Speichert Position/Groesse entprellt, sobald das Fenster bewegt oder per Griff resized wird. */
function wirePersistence(win: BrowserWindow, overlayId: string): void {
  let timer: NodeJS.Timeout | null = null;

  const scheduleSave = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (win.isDestroyed()) return;
      const b = win.getBounds();
      const layout: WindowLayout = { ...b, displayId: currentDisplayId(b) };
      saveWindowLayout(overlayId, layout).catch((err: unknown) => {
        console.error(`[layout] Speichern fuer "${overlayId}" fehlgeschlagen:`, err);
      });
    }, SAVE_DEBOUNCE_MS);
  };

  win.on('move', scheduleSave);
  win.on('resize', scheduleSave);
}

/**
 * Nimmt Resize-Deltas vom Griff im Renderer entgegen. Ein Griff statt
 * nativer Fenster-Resize-Kante, weil ein rahmenloses, transparentes Fenster
 * keine sichtbare (oder zuverlaessig klickbare) Kante zum Ziehen hat.
 */
function wireResizeHandle(win: BrowserWindow, overlayId: string): void {
  const channel = `overlay:resize-delta:${overlayId}`;
  const listener = (event: Electron.IpcMainEvent, delta: { dx: number; dy: number }) => {
    if (BrowserWindow.fromWebContents(event.sender) !== win) return;
    const b = win.getBounds();
    win.setBounds({
      ...b,
      width: Math.max(MIN_WIDTH, b.width + delta.dx),
      height: Math.max(MIN_HEIGHT, b.height + delta.dy),
    });
  };

  ipcMain.on(channel, listener);
  win.on('closed', () => ipcMain.removeListener(channel, listener));
}

export function setEditMode(windows: BrowserWindow[], editMode: boolean): void {
  for (const win of windows) {
    // forward:true laesst Hover-Events weiter beim Renderer ankommen.
    win.setIgnoreMouseEvents(!editMode, { forward: true });
    win.webContents.send('edit-mode-changed', editMode);
  }
}
