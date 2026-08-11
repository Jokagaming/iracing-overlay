/**
 * Auto-Update ueber GitHub Releases (electron-updater). Nur im gepackten
 * Build aktiv - im Dev-Modus gibt es kein `app-update.yml` (das erzeugt
 * electron-builder erst beim Packaging, siehe electron-builder.yml) und
 * keinen Sinn, waehrend der Entwicklung gegen echte Releases zu pruefen.
 *
 * Kein stiller Auto-Restart: die App hat keine Fenster mit
 * Schliessen-Button, ein unangekuendigter Neustart mitten in einer
 * laufenden Session waere ueberraschend. Ist ein Update fertig
 * heruntergeladen, fragt stattdessen ein natives Dialogfenster - lehnt der
 * Nutzer ab, installiert es sich automatisch beim naechsten Beenden der App
 * (`autoInstallOnAppQuit`).
 */

import { app, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // alle 4h erneut pruefen, plus einmal beim Start

let initialized = false;

export function setupAutoUpdate(): void {
  if (!app.isPackaged) {
    console.log('[update] Dev-Modus - kein Auto-Update-Check');
    return;
  }
  if (initialized) return;
  initialized = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    console.error('[update] Fehler:', err);
  });

  autoUpdater.on('update-downloaded', (info) => {
    const response = dialog.showMessageBoxSync({
      type: 'info',
      buttons: ['Jetzt neu starten', 'Spaeter'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update verfuegbar',
      message: `iRacing Overlay ${info.version} ist bereit.`,
      detail:
        'Ein Neustart installiert das Update jetzt. Ohne Neustart wird es automatisch beim naechsten Beenden der App installiert.',
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  checkForUpdates();
  setInterval(checkForUpdates, CHECK_INTERVAL_MS);
}

/** Auch fuer den manuellen Tray-Eintrag "Nach Updates suchen" genutzt. */
export function checkForUpdates(): void {
  if (!app.isPackaged) return;
  autoUpdater.checkForUpdates().catch((err: unknown) => {
    console.error('[update] Check fehlgeschlagen:', err);
  });
}
