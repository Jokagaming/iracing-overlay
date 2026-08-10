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
