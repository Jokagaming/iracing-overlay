/**
 * Speichert Fenstergeometrie pro Overlay in einer JSON-Datei im
 * Nutzerprofil - ueberlebt Updates und laesst sich exportieren/teilen.
 *
 * Auto-Switch nach Auto/Serie/Session-Typ (mehrere benannte Profile) ist
 * noch nicht Teil davon - dafuer fehlt bisher jede UI, mit der man mehrere
 * Layouts anlegen und benennen koennte. Aktuell gibt es genau ein Profil
 * ("default"), das alle Overlay-Positionen haelt.
 */

import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface WindowLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * Electron `display.id` - identifiziert einen Monitor unabhaengig von
   * seiner Position im virtuellen Desktop. Wird beim Laden geprueft: haengt
   * der Monitor nicht mehr dran (Laptop im Dock vs. unterwegs), faellt die
   * Position auf den Standardwert zurueck statt off-screen zu landen.
   */
  displayId: number;
}

type LayoutFile = Record<string, WindowLayout>;

function layoutDir(): string {
  return join(app.getPath('userData'), 'layouts');
}

function layoutPath(): string {
  return join(layoutDir(), 'default.json');
}

async function readLayoutFile(): Promise<LayoutFile> {
  try {
    const raw = await readFile(layoutPath(), 'utf-8');
    return JSON.parse(raw) as LayoutFile;
  } catch {
    // Datei fehlt beim ersten Start oder ist beschaedigt - beides ist kein
    // Fehlerfall, dann gibt es eben noch keine gespeicherten Positionen.
    return {};
  }
}

export async function loadWindowLayout(overlayId: string): Promise<WindowLayout | undefined> {
  const file = await readLayoutFile();
  return file[overlayId];
}

export async function saveWindowLayout(overlayId: string, layout: WindowLayout): Promise<void> {
  const file = await readLayoutFile();
  file[overlayId] = layout;
  await mkdir(layoutDir(), { recursive: true });
  await writeFile(layoutPath(), JSON.stringify(file, null, 2), 'utf-8');
}
