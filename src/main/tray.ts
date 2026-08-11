/**
 * System-Tray-Icon. Die App hat keine sichtbaren Fensterrahmen (alle
 * Overlays sind frameless + skipTaskbar) - der Tray ist damit die einzige
 * Stelle, an der sich die App ueberhaupt "anfassen" laesst (Edit-Modus,
 * Beenden). Ohne ihn gaebe es keine Moeglichkeit, die App sauber zu
 * beenden, ausser sie im Task-Manager abzuschiessen.
 */

import { Menu, Tray, app } from 'electron';
import { resourcePath } from './resources.js';

export interface TrayOptions {
  onToggleEditMode: () => void;
  isEditMode: () => boolean;
  onOpenLauncher: () => void;
  onCheckForUpdates: () => void;
}

export function createTray(options: TrayOptions): Tray {
  const tray = new Tray(resourcePath('tray-icon.png'));
  tray.setToolTip('iRacing Overlay');

  const rebuildMenu = (): void => {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Overlays auswaehlen...', click: options.onOpenLauncher },
        { type: 'separator' },
        {
          label: 'Edit-Modus',
          type: 'checkbox',
          checked: options.isEditMode(),
          accelerator: 'Ctrl+Alt+E',
          click: options.onToggleEditMode,
        },
        { type: 'separator' },
        { label: 'Nach Updates suchen', click: options.onCheckForUpdates },
        { type: 'separator' },
        { label: 'Beenden', click: () => app.quit() },
      ]),
    );
  };

  rebuildMenu();
  // Der Haken beim Edit-Modus-Eintrag soll den echten Zustand zeigen, auch
  // wenn er ueber den globalen Hotkey (nicht ueber den Tray) umgeschaltet
  // wurde - deshalb bei jedem Oeffnen neu aufbauen statt den Menuepunkt
  // einmalig zu erzeugen. Rechtsklick zeigt das per setContextMenu gesetzte
  // Menue automatisch (Windows-Konvention); Linksklick tut das nicht von
  // selbst, deshalb hier explizit angestossen.
  tray.on('right-click', rebuildMenu);
  tray.on('click', () => {
    rebuildMenu();
    tray.popUpContextMenu();
  });

  return tray;
}
