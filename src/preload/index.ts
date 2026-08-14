import { contextBridge, ipcRenderer } from 'electron';
import type { BridgeMessage } from '../data/types.js';

// Der Kanalname traegt die Overlay-ID, damit der Main-Process in
// overlayWindow.ts das Resize-Event eindeutig einem Fenster zuordnen kann,
// sobald es mehrere Overlays gibt.
//
// Im Dev-Modus ist die URL "http://localhost:5173/relative/" (Ordnername
// ist das letzte Segment), im Produktions-Build ein file://-Pfad wie
// ".../out/renderer/relative/index.html" (Ordnername steht vor
// "index.html"). Beide Faelle muessen abgedeckt sein.
const pathSegments = location.pathname.split('/').filter(Boolean);
const lastSegment = pathSegments.at(-1);
const OVERLAY_ID = (lastSegment === 'index.html' ? pathSegments.at(-2) : lastSegment) ?? 'unknown';

contextBridge.exposeInMainWorld('overlayAPI', {
  onEditModeChange: (callback: (editMode: boolean) => void) => {
    ipcRenderer.on('edit-mode-changed', (_event, editMode: boolean) => callback(editMode));
  },
  /** Vergroessert/verkleinert das Fenster um (dx, dy) Pixel - fuer den Resize-Griff im Edit-Modus. */
  resizeBy: (dx: number, dy: number) => {
    ipcRenderer.send(`overlay:resize-delta:${OVERLAY_ID}`, { dx, dy });
  },
  /**
   * Telemetrie direkt per IPC statt ueber den WebSocket-Umweg - kein
   * eigener Kanal pro Fenster noetig, `webContents.send()` im Main-Process
   * adressiert im main-process ohnehin nur das jeweils eigene Fenster.
   */
  onTelemetryMessage: (callback: (message: BridgeMessage) => void) => {
    ipcRenderer.on('bridge-message', (_event, message: BridgeMessage) => callback(message));
  },
});

// Nur vom Relative-Overlay genutzt - erster echter Konsument des
// generischen Settings-Systems (siehe main/relativeSettingsIpc.ts). Noch
// bewusst overlay-spezifisch statt eines generischen `settingsAPI` fuer
// alle Overlays - erst wenn ein zweites Overlay ein eigenes Schema bekommt,
// lohnt sich die Verallgemeinerung.
contextBridge.exposeInMainWorld('relativeSettingsAPI', {
  load: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('relative-settings:load'),
  save: (values: Record<string, unknown>): void => {
    ipcRenderer.send('relative-settings:save', values);
  },
});

export interface LayoutOverlayPayload {
  overlayId: string;
  src: string;
  position: { displayKey: string; xPct: number; yPct: number; widthPct: number; heightPct: number; dpiScaleAtSave: number };
  locked: boolean;
}

// Nur vom Layout-Fenster genutzt (src/renderer/layout-window) - dem
// zweiten RenderTarget (siehe main/layoutWindowTarget.ts). Anders als
// overlayAPI/relativeSettingsAPI oben nicht generisch fuer alle
// Overlay-Fenster gedacht: das Layout-Fenster ist ein Einzelstueck (ein
// Fenster fuer den ganzen Layout-Modus), kein Muster, das noch oefter
// vorkommt.
contextBridge.exposeInMainWorld('layoutWindowAPI', {
  /** Signalisiert dem Main-Process, dass der Renderer gemountet ist und ab jetzt "layout:add-overlay" empfangen kann - siehe main/layoutWindowTarget.ts fuer den Grund (Race Condition mit did-finish-load). */
  notifyReady: (): void => {
    ipcRenderer.send('layout:renderer-ready');
  },
  onAddOverlay: (callback: (overlay: LayoutOverlayPayload) => void) => {
    ipcRenderer.on('layout:add-overlay', (_event, overlay: LayoutOverlayPayload) => callback(overlay));
  },
  onSetLocked: (callback: (overlayId: string, locked: boolean) => void) => {
    ipcRenderer.on('layout:set-locked', (_event, overlayId: string, locked: boolean) => callback(overlayId, locked));
  },
  onSetVisible: (callback: (overlayId: string, visible: boolean) => void) => {
    ipcRenderer.on('layout:set-visible', (_event, overlayId: string, visible: boolean) => callback(overlayId, visible));
  },
  onRemoveOverlay: (callback: (overlayId: string) => void) => {
    ipcRenderer.on('layout:remove-overlay', (_event, overlayId: string) => callback(overlayId));
  },
  onEditModeChanged: (callback: (editMode: boolean) => void) => {
    ipcRenderer.on('layout:edit-mode-changed', (_event, editMode: boolean) => callback(editMode));
  },
  reportPositionChange: (overlayId: string, position: LayoutOverlayPayload['position']): void => {
    ipcRenderer.send('layout:position-changed', overlayId, position);
  },
  /** Schaltet Klickdurchlaessigkeit dynamisch um, je nachdem ob die Maus gerade ueber einem (entsperrten) Overlay steht - siehe renderer/layout-window/main.tsx fuer die Hit-Test-Logik. */
  setIgnoreMouse: (ignore: boolean): void => {
    ipcRenderer.send('layout:set-ignore-mouse', ignore);
  },
});

export interface LauncherProfile {
  id: string;
  name: string;
  selectedOverlayIds: string[];
}

// Nur vom Launcher-Fenster genutzt (src/renderer/launcher) - in den
// Overlay-Fenstern ungenutzt, aber unschaedlich, da alle Fenster dasselbe
// Preload-Skript laden.
contextBridge.exposeInMainWorld('launcherAPI', {
  getConfig: (): Promise<{
    overlays: { id: string; label: string }[];
    profiles: LauncherProfile[];
    activeProfileId: string;
    runningOverlayIds: string[];
  }> => ipcRenderer.invoke('launcher:get-config'),
  createProfile: (name: string): Promise<LauncherProfile> => ipcRenderer.invoke('launcher:create-profile', name),
  renameProfile: (profileId: string, name: string): void => {
    ipcRenderer.send('launcher:rename-profile', profileId, name);
  },
  deleteProfile: (profileId: string): Promise<{ profiles: LauncherProfile[]; activeProfileId: string }> =>
    ipcRenderer.invoke('launcher:delete-profile', profileId),
  start: (profileId: string, selectedIds: string[]): void => {
    ipcRenderer.send('launcher:start', profileId, selectedIds);
  },
});
