/**
 * Layout-Modus: EIN Fenster, das die gesamte virtuelle Desktopflaeche
 * ueberspannt, Overlays als `<iframe>`-Kinder darin (siehe
 * renderer/layout-window/main.ts) - zweite Implementierung von
 * `RenderTarget` (siehe renderTarget.ts), neben dem Overlay-Modus
 * (overlayWindowTarget.ts, ein natives Fenster pro Overlay).
 *
 * Telemetrie erreicht die Overlay-Iframes NICHT per IPC: Electron fuehrt
 * Preload-Skripte standardmaessig nicht in Subframes aus (nur im
 * Hauptframe), `window.overlayAPI` existiert dort also nicht. Die
 * Overlays selbst brauchen dafuer keine Anpassung - ihr
 * TelemetryClient (shared/client.ts) faellt automatisch auf den
 * WebSocket-Transport zurueck, der ohnehin fuer externe Verbraucher
 * laeuft. Kostet die IPC-Performance-Optimierung aus dem Overlay-Modus
 * (siehe README "Performance"), fuer den neuen, noch experimentellen
 * Layout-Modus ein bewusst akzeptierter Trade-off.
 */

import { BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';
import type { BridgeMessage } from '../data/types.js';
import { unionBounds, type OverlayPosition } from '../settings/position.js';
import { VIRTUAL_DESKTOP_DISPLAY_KEY } from '../settings/layout.js';
import { allDisplays, primaryDisplayInfo } from './displays.js';
import type { CreateOverlayOptions, RenderTarget, RenderTargetOverlay } from './renderTarget.js';

class LayoutOverlayHandle implements RenderTargetOverlay {
  private destroyed = false;

  constructor(
    public readonly overlayId: string,
    private readonly getWindow: () => BrowserWindow | null,
    private position: OverlayPosition,
  ) {}

  setLocked(locked: boolean): void {
    this.getWindow()?.webContents.send('layout:set-locked', this.overlayId, locked);
  }

  getPosition(): OverlayPosition {
    return this.position;
  }

  /** Von LayoutWindowRenderTarget aufgerufen, wenn der Editor im Renderer eine neue Position meldet (siehe wirePositionReports()). */
  updatePosition(position: OverlayPosition): void {
    this.position = position;
  }

  show(): void {
    this.getWindow()?.webContents.send('layout:set-visible', this.overlayId, true);
  }

  hide(): void {
    this.getWindow()?.webContents.send('layout:set-visible', this.overlayId, false);
  }

  destroy(): void {
    this.destroyed = true;
    this.getWindow()?.webContents.send('layout:remove-overlay', this.overlayId);
  }

  isDestroyed(): boolean {
    return this.destroyed || this.getWindow() == null;
  }

  send(_message: BridgeMessage): void {
    // Bewusst leer - siehe Dateikommentar oben (WS-Fallback statt IPC).
  }
}

interface AddOverlayPayload {
  overlayId: string;
  src: string;
  position: OverlayPosition;
  locked: boolean;
}

export class LayoutWindowRenderTarget implements RenderTarget {
  readonly kind = 'layout-window';
  private win: BrowserWindow | null = null;
  private readonly handles = new Map<string, LayoutOverlayHandle>();
  private readonly onPositionChangeByOverlay = new Map<string, (position: OverlayPosition) => void>();
  private listenersWired = false;
  /**
   * `did-finish-load` (Netzwerk-Ebene, feuert oft schon bevor ein
   * `type="module"`-Skript ueberhaupt ausgefuehrt wird) ist zu frueh, um
   * `layout:add-overlay` zu schicken - der Preact-Renderer hat seinen
   * IPC-Listener dann noch nicht registriert, die Nachricht ginge verloren
   * (kein Nachlade-Puffer fuer ipcRenderer.on()). Stattdessen meldet sich
   * der Renderer selbst per `layout:renderer-ready`, sobald er gemountet
   * ist; bis dahin werden Overlays hier gepuffert und danach in einem
   * Rutsch nachgeliefert.
   */
  private rendererReady = false;
  private readonly pendingPayloads = new Map<string, AddOverlayPayload>();

  private ensureWindow(): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) return this.win;

    const bounds = unionBounds(allDisplays());
    // Bei mehreren Monitoren, deren Anordnung keine einfache Reihe/Spalte
    // ergibt, kann die obere linke Ecke der Union-Flaeche in einer "Luecke"
    // liegen, die zu keinem echten Monitor gehoert (z.B. Monitor A oben
    // links, B unten rechts versetzt). Windows sanitisiert dann offenbar
    // die Groesse eines *neu erstellten* Fensters, dessen Startpunkt dort
    // liegt (beobachtet: Breite/Hoehe auf die Groesse des naechsten echten
    // Monitors verkleinert). Workaround: zuerst an einem garantiert
    // gueltigen Punkt (Hauptdisplay) erstellen, dann per setBounds() auf
    // die eigentliche Zielgroesse strecken - setBounds() nach der Erstellung
    // unterliegt dieser Sanitisierung nicht.
    const primary = primaryDisplayInfo();
    const win = new BrowserWindow({
      x: primary.bounds.x,
      y: primary.bounds.y,
      width: primary.bounds.width,
      height: primary.bounds.height,
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
    win.setBounds(bounds);
    win.setAlwaysOnTop(true, 'screen-saver');
    // Start klickdurchlaessig - der Renderer schaltet dynamisch um, sobald
    // die Maus ueber einem entsperrten Overlay steht (Hit-Test per
    // elementFromPoint(), siehe renderer/layout-window/main.tsx). Ein
    // einzelnes BrowserWindow kennt kein "klickdurchlaessig ausser in
    // diesem Teilbereich" - das ist der ueblich Weg dafuer.
    win.setIgnoreMouseEvents(true, { forward: true });
    const setIgnoreMouseListener = (_event: Electron.IpcMainEvent, ignore: boolean) => {
      if (!win.isDestroyed()) win.setIgnoreMouseEvents(ignore, { forward: true });
    };
    ipcMain.on('layout:set-ignore-mouse', setIgnoreMouseListener);
    win.once('ready-to-show', () => win.show());
    win.webContents.on('did-fail-load', (_e, code, desc) => {
      console.error(`[layout-window] Laden fehlgeschlagen (${code}): ${desc}`);
    });

    this.rendererReady = false;
    const readyListener = () => {
      this.rendererReady = true;
      for (const payload of this.pendingPayloads.values()) win.webContents.send('layout:add-overlay', payload);
      this.pendingPayloads.clear();
    };
    ipcMain.on('layout:renderer-ready', readyListener);

    if (process.env.ELECTRON_RENDERER_URL) {
      win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/layout-window/`);
    } else {
      win.loadFile(join(__dirname, '../renderer/layout-window/index.html'));
    }

    // Bei Aenderung der Monitor-Konfiguration (An-/Abstecken) das Fenster
    // neu ueber die dann gueltige virtuelle Desktopflaeche spannen.
    const resizeToDisplays = () => {
      if (win.isDestroyed()) return;
      win.setBounds(unionBounds(allDisplays()));
    };
    screen.on('display-added', resizeToDisplays);
    screen.on('display-removed', resizeToDisplays);
    win.on('closed', () => {
      screen.removeListener('display-added', resizeToDisplays);
      screen.removeListener('display-removed', resizeToDisplays);
      ipcMain.removeListener('layout:set-ignore-mouse', setIgnoreMouseListener);
      ipcMain.removeListener('layout:renderer-ready', readyListener);
      this.rendererReady = false;
      this.win = null;
    });

    this.win = win;
    this.wirePositionReports();
    return win;
  }

  /** Einmalig registriert (nicht pro Overlay) - ordnet gemeldete Positionsaenderungen anhand der overlayId dem richtigen Callback zu. */
  private wirePositionReports(): void {
    if (this.listenersWired) return;
    this.listenersWired = true;
    ipcMain.on('layout:position-changed', (_event, overlayId: string, position: OverlayPosition) => {
      this.handles.get(overlayId)?.updatePosition(position);
      this.onPositionChangeByOverlay.get(overlayId)?.(position);
    });
  }

  async createOverlay(options: CreateOverlayOptions): Promise<RenderTargetOverlay> {
    const win = this.ensureWindow();
    const position = options.initialPosition ?? this.defaultPosition(this.handles.size);

    const handle = new LayoutOverlayHandle(options.overlayId, () => this.win, position);
    this.handles.set(options.overlayId, handle);
    this.onPositionChangeByOverlay.set(options.overlayId, options.onPositionChange);

    const payload: AddOverlayPayload = {
      overlayId: options.overlayId,
      src: this.overlayUrl(options.rendererUrlPath),
      position,
      locked: options.initialLocked,
    };
    // Solange der Renderer sich noch nicht per "layout:renderer-ready"
    // gemeldet hat, nur puffern - siehe Kommentar bei `rendererReady` oben.
    if (this.rendererReady) {
      win.webContents.send('layout:add-overlay', payload);
    } else {
      this.pendingPayloads.set(options.overlayId, payload);
    }

    return handle;
  }

  dispose(): void {
    this.win?.destroy();
    this.win = null;
    this.handles.clear();
    this.onPositionChangeByOverlay.clear();
  }

  /** Editor-Modus fuer ALLE Overlays im Layout-Fenster gleichzeitig umschalten - analog zu setEditMode() im Overlay-Modus (overlayWindowTarget.ts). */
  setEditMode(editMode: boolean): void {
    this.win?.webContents.send('layout:edit-mode-changed', editMode);
  }

  /** Wie overlayWindowTarget.ts's URL-Aufloesung (Dev-Server vs. file://), nur relativ statt absolut, da die Iframe-src innerhalb derselben out/renderer-Struktur aufgeloest wird. */
  private overlayUrl(rendererUrlPath: string): string {
    if (process.env.ELECTRON_RENDERER_URL) {
      return `${process.env.ELECTRON_RENDERER_URL}/${rendererUrlPath}/`;
    }
    return `../${rendererUrlPath}/index.html`;
  }

  private defaultPosition(index: number): OverlayPosition {
    return {
      displayKey: VIRTUAL_DESKTOP_DISPLAY_KEY,
      xPct: 0.03 + (index % 5) * 0.14,
      yPct: 0.05 + Math.floor(index / 5) * 0.18,
      widthPct: 0.18,
      heightPct: 0.14,
      dpiScaleAtSave: 1,
    };
  }
}
