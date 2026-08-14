/**
 * Overlay-Modus: ein natives Fenster pro Overlay - erste (und bisher
 * einzige) Implementierung von `RenderTarget` (siehe renderTarget.ts).
 * Verhalten entspricht dem bisherigen overlayWindow.ts (transparent,
 * always-on-top, rahmenlos, siehe Meilenstein 0), jetzt hinter dem
 * RenderTarget-Interface und mit der neuen prozentualen Positions-
 * Persistenz (settings/position.ts) statt absoluter Pixel.
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';
import type { BridgeMessage } from '../data/types.js';
import type { DisplayInfo, OverlayPosition, Rect } from '../settings/position.js';
import { resolveDisplay, toOverlayPosition, toPixelBounds } from '../settings/position.js';
import { allDisplays, primaryDisplayInfo, stableDisplayKey } from './displays.js';
import type { CreateOverlayOptions, RenderTarget, RenderTargetOverlay } from './renderTarget.js';

const SAVE_DEBOUNCE_MS = 500;
const MIN_WIDTH = 160;
const MIN_HEIGHT = 80;

function displayInfoMatching(bounds: Rect): DisplayInfo {
  const d = screen.getDisplayMatching(bounds);
  return { key: stableDisplayKey(d), bounds: d.bounds, scaleFactor: d.scaleFactor };
}

class OverlayWindowHandle implements RenderTargetOverlay {
  constructor(
    public readonly overlayId: string,
    private readonly win: BrowserWindow,
  ) {}

  setLocked(locked: boolean): void {
    if (this.win.isDestroyed()) return;
    // forward:true laesst Hover-Events weiter beim Renderer ankommen (z.B. fuer :hover-Styles im Edit-Modus).
    this.win.setIgnoreMouseEvents(locked, { forward: true });
    // Der Renderer kennt nur "editMode" (invers zu "locked") - siehe
    // shared/editMode.ts, dort schon vor der Settings-Umstellung etabliert.
    this.win.webContents.send('edit-mode-changed', !locked);
  }

  getPosition(): OverlayPosition {
    const bounds = this.win.getBounds();
    return toOverlayPosition(bounds, displayInfoMatching(bounds));
  }

  show(): void {
    if (!this.win.isDestroyed()) this.win.show();
  }

  hide(): void {
    if (!this.win.isDestroyed()) this.win.hide();
  }

  destroy(): void {
    if (!this.win.isDestroyed()) this.win.destroy();
  }

  isDestroyed(): boolean {
    return this.win.isDestroyed();
  }

  send(message: BridgeMessage): void {
    if (!this.win.isDestroyed()) this.win.webContents.send('bridge-message', message);
  }
}

export class OverlayWindowRenderTarget implements RenderTarget {
  readonly kind = 'overlay-windows';
  private readonly handles = new Set<OverlayWindowHandle>();

  async createOverlay(options: CreateOverlayOptions): Promise<RenderTargetOverlay> {
    const bounds = this.resolveInitialBounds(options);

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
    // Borderless-Windowed-Modus oben (siehe docs/fullscreen-exclusive.md).
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setIgnoreMouseEvents(options.initialLocked, { forward: true });
    win.once('ready-to-show', () => win.show());

    if (process.env.ELECTRON_RENDERER_URL) {
      win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${options.rendererUrlPath}/`);
    } else {
      win.loadFile(join(__dirname, `../renderer/${options.rendererUrlPath}/index.html`));
    }

    // Aequivalent zum WS-"welcome" fuer neu verbundene Clients - ohne das
    // bekaeme ein Fenster, dessen Renderer-JS erst nach der letzten
    // Session-Aenderung zu lauschen beginnt, nie eine session-Nachricht.
    win.webContents.once('did-finish-load', () => {
      for (const message of options.getWelcomeMessages?.() ?? []) win.webContents.send('bridge-message', message);
    });

    this.wirePersistence(win, options.onPositionChange);
    this.wireResizeHandle(win, options.overlayId);

    const handle = new OverlayWindowHandle(options.overlayId, win);
    this.handles.add(handle);
    win.on('closed', () => this.handles.delete(handle));
    return handle;
  }

  dispose(): void {
    for (const handle of this.handles) handle.destroy();
    this.handles.clear();
  }

  private resolveInitialBounds(options: CreateOverlayOptions): Rect {
    if (!options.initialPosition) {
      const primary = primaryDisplayInfo();
      return {
        x: primary.bounds.x + 40,
        y: primary.bounds.y + 40,
        width: options.defaultSize.width,
        height: options.defaultSize.height,
      };
    }

    const resolved = resolveDisplay(options.initialPosition, allDisplays(), primaryDisplayInfo());
    if (resolved.fellBackToPrimary) {
      console.warn(`[position] Monitor fuer "${options.overlayId}" nicht mehr vorhanden, verwende Hauptmonitor`);
    }
    return toPixelBounds(options.initialPosition, resolved.display);
  }

  /** Speichert Position/Groesse entprellt, sobald das Fenster bewegt oder per Griff resized wird. */
  private wirePersistence(win: BrowserWindow, onPositionChange: (position: OverlayPosition) => void): void {
    let timer: NodeJS.Timeout | null = null;
    const scheduleSave = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (win.isDestroyed()) return;
        const bounds = win.getBounds();
        onPositionChange(toOverlayPosition(bounds, displayInfoMatching(bounds)));
      }, SAVE_DEBOUNCE_MS);
    };
    win.on('move', scheduleSave);
    win.on('resize', scheduleSave);
  }

  /**
   * Nimmt Resize-Deltas vom Griff im Renderer entgegen. Ein Griff statt
   * nativer Fenster-Resize-Kante, weil ein rahmenloses, transparentes
   * Fenster keine sichtbare (oder zuverlaessig klickbare) Kante zum Ziehen
   * hat.
   */
  private wireResizeHandle(win: BrowserWindow, overlayId: string): void {
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
}
