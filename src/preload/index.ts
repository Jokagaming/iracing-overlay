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
