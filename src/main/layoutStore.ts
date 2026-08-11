/**
 * Speichert Fenstergeometrie pro Overlay in einer JSON-Datei im
 * Nutzerprofil - ueberlebt Updates und laesst sich exportieren/teilen.
 *
 * Eine Datei pro Layout-Profil (`layouts/<profilId>.json`, siehe
 * profileStore.ts) - so behaelt jedes Profil (z.B. "Oval", "Formel") seine
 * eigenen Fensterpositionen, unabhaengig von den anderen. Das Standard-
 * Profil nutzt weiterhin `layouts/default.json`, damit bestehende
 * Installationen ohne Migration weiterlaufen.
 */

import { app } from 'electron';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

function layoutPath(profileId: string): string {
  return join(layoutDir(), `${profileId}.json`);
}

async function readLayoutFile(profileId: string): Promise<LayoutFile> {
  try {
    const raw = await readFile(layoutPath(profileId), 'utf-8');
    return JSON.parse(raw) as LayoutFile;
  } catch {
    // Datei fehlt beim ersten Start eines Profils oder ist beschaedigt -
    // beides ist kein Fehlerfall, dann gibt es eben noch keine
    // gespeicherten Positionen fuer dieses Profil.
    return {};
  }
}

export async function loadWindowLayout(profileId: string, overlayId: string): Promise<WindowLayout | undefined> {
  const file = await readLayoutFile(profileId);
  return file[overlayId];
}

export async function saveWindowLayout(profileId: string, overlayId: string, layout: WindowLayout): Promise<void> {
  const file = await readLayoutFile(profileId);
  file[overlayId] = layout;
  await mkdir(layoutDir(), { recursive: true });
  await writeFile(layoutPath(profileId), JSON.stringify(file, null, 2), 'utf-8');
}

/** Wird beim Loeschen eines Profils aufgerufen (siehe profileStore.ts) - hinterlaesst keine verwaiste Datei. */
export async function deleteLayoutFile(profileId: string): Promise<void> {
  await rm(layoutPath(profileId), { force: true });
}
