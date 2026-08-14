/**
 * Verdrahtet Edit-Modus-Anzeige und Resize-Griff fuer ein Overlay.
 *
 * Verschieben laeuft komplett nativ ueber -webkit-app-region: drag (siehe
 * overlay.css) - kein JS noetig. Die Groesse hat das rahmenlose Fenster
 * dagegen ohne eigene Ziehkante nicht, deshalb der Griff: er meldet nur die
 * Mausbewegung als Delta an den Main-Process, der tatsaechlich
 * `win.setBounds()` aufruft (der Renderer kann seine eigene Fenstergroesse
 * nicht selbst setzen).
 */

import type { BridgeMessage } from '../../data/types.js';

// Zentrale Stelle fuer die Form von window.overlayAPI - jedes Overlay
// importiert wireEditMode() von hier, weitere Nutzer (z.B. shared/client.ts
// fuer onTelemetryMessage) importieren nichts Eigenes, sondern verlassen
// sich auf dieses eine `declare global`. Zwei widerspruechliche
// Deklarationen fuer dieselbe globale Eigenschaft wuerden beim Typchecken
// kollidieren.
declare global {
  interface Window {
    overlayAPI: {
      onEditModeChange: (callback: (editMode: boolean) => void) => void;
      resizeBy: (dx: number, dy: number) => void;
      onTelemetryMessage?: (callback: (message: BridgeMessage) => void) => void;
    };
  }
}

export function wireEditMode(widgetEl: HTMLElement, resizeGripEl: HTMLElement): void {
  // Im Layout-Modus laeuft dieses Overlay als <iframe> in layout-window
  // (siehe main/layoutWindowTarget.ts) - Electron fuehrt Preload-Skripte
  // dort nicht aus, `window.overlayAPI` existiert also nicht. Eigene
  // Edit-Anzeige/Resize-Griff sind dort ohnehin ueberfluessig (der
  // Layout-Editor zeichnet seinen eigenen Rahmen/Griff um das iframe herum,
  // siehe renderer/layout-window/main.tsx) - also einfach nichts verdrahten
  // statt mit einer TypeError abzustuerzen (das wuerde auch den danach
  // folgenden TelemetryClient.start()-Aufruf verhindern).
  if (!window.overlayAPI) return;

  window.overlayAPI.onEditModeChange((editMode) => {
    widgetEl.dataset.edit = String(editMode);
  });

  resizeGripEl.addEventListener('mousedown', (startEvent) => {
    startEvent.preventDefault();
    let lastX = startEvent.screenX;
    let lastY = startEvent.screenY;

    function onMove(moveEvent: MouseEvent): void {
      window.overlayAPI.resizeBy(moveEvent.screenX - lastX, moveEvent.screenY - lastY);
      lastX = moveEvent.screenX;
      lastY = moveEvent.screenY;
    }

    function onUp(): void {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
