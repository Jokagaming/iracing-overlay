/**
 * IPC-Bruecke fuer Layout-Modus-Layouts: Liste/Speichern/Loeschen, aktives
 * Layout, Export/Import (Layout-Sharing) und den Editor-Zustand. Wie
 * relativeSettingsIpc.ts nur NEUE Kanaele, keine Aenderung an der
 * bestehenden Fenstererzeugung.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import type { Layout } from '../settings/layout.js';
import { exportLayout, validateImportedLayout } from '../settings/layoutExport.js';
import { deleteLayout, listLayouts, loadActiveLayoutId, saveActiveLayoutId, saveLayout } from './layoutDefinitionStore.js';

export interface LayoutIpcOptions {
  /** Alle aktuell bekannten Overlay-IDs - fuer die Validierung beim Import (siehe layoutExport.ts). */
  knownOverlayIds: () => Set<string>;
  onEditModeChanged?: (editMode: boolean) => void;
}

export function registerLayoutIpc(options: LayoutIpcOptions): void {
  ipcMain.handle('layout-mode:list', async () => ({
    layouts: await listLayouts(),
    activeLayoutId: await loadActiveLayoutId(),
  }));

  ipcMain.handle('layout-mode:save', async (_event, layout: Layout) => {
    await saveLayout(layout);
  });

  ipcMain.handle('layout-mode:delete', async (_event, id: string) => {
    await deleteLayout(id);
  });

  ipcMain.handle('layout-mode:set-active', async (_event, id: string) => {
    await saveActiveLayoutId(id);
  });

  ipcMain.handle('layout-mode:export', async (_event, layout: Layout) => {
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions = {
      title: 'Layout exportieren',
      defaultPath: `${layout.name}.json`,
      filters: [{ name: 'Layout', extensions: ['json'] }],
    };
    const result = win ? await dialog.showSaveDialog(win, dialogOptions) : await dialog.showSaveDialog(dialogOptions);
    if (result.canceled || !result.filePath) return { ok: false as const };
    await writeFile(result.filePath, JSON.stringify(exportLayout(layout), null, 2), 'utf-8');
    return { ok: true as const, path: result.filePath };
  });

  ipcMain.handle('layout-mode:import', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const dialogOptions: Electron.OpenDialogOptions = {
      title: 'Layout importieren',
      properties: ['openFile'],
      filters: [{ name: 'Layout', extensions: ['json'] }],
    };
    const result = win ? await dialog.showOpenDialog(win, dialogOptions) : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths.length === 0) return { ok: false as const };

    try {
      const raw = JSON.parse(await readFile(result.filePaths[0]!, 'utf-8')) as unknown;
      const imported = validateImportedLayout(raw, options.knownOverlayIds());
      if (!imported) return { ok: false as const, error: 'Keine gueltige Layout-Datei.' };
      await saveLayout(imported.layout);
      return { ok: true as const, layout: imported.layout, warnings: imported.warnings };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.on('layout-mode:set-edit-mode', (_event, editMode: boolean) => {
    options.onEditModeChanged?.(editMode);
  });
}
