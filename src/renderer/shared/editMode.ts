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

declare global {
  interface Window {
    overlayAPI: {
      onEditModeChange: (callback: (editMode: boolean) => void) => void;
      resizeBy: (dx: number, dy: number) => void;
    };
  }
}

export function wireEditMode(widgetEl: HTMLElement, resizeGripEl: HTMLElement): void {
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
