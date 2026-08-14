/**
 * IPC-Bruecke fuer die Relative-Overlay-Settings (siehe
 * renderer/relative/settings.ts) - erster echter Konsument des generischen
 * Settings-Systems (settings/schema.ts, settings/migrate.ts,
 * main/settingsStore.ts).
 *
 * Bewusst als eigene, kleine Datei statt in main/index.ts eingebaut: nur
 * NEUE IPC-Kanaele werden registriert, die bestehende Fenstererzeugung
 * (overlayWindow.ts) bleibt unangetastet - siehe README fuer den Stand der
 * groesseren RenderTarget-Umstellung (noch nicht produktiv verdrahtet).
 */

import { ipcMain } from 'electron';
import { RELATIVE_SETTINGS, type RelativeSettings } from '../renderer/relative/settings.js';
import { loadSettings, saveSettings } from './settingsStore.js';

export function registerRelativeSettingsIpc(): void {
  ipcMain.handle('relative-settings:load', () => loadSettings(RELATIVE_SETTINGS));
  ipcMain.on('relative-settings:save', (_event, values: RelativeSettings) => {
    saveSettings(RELATIVE_SETTINGS.id, RELATIVE_SETTINGS.schemaVersion, values).catch((err: unknown) => {
      console.error('[relative-settings] Speichern fehlgeschlagen:', err);
    });
  });
}
