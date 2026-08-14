/**
 * Persistiert Overlay-Positionen im neuen prozentualen Format (siehe
 * settings/position.ts) - Nachfolger von layoutStore.ts, das absolute
 * Pixel + einen numerischen Electron-`display.id` speicherte. Weiterhin
 * eine Datei pro Layout-Profil (`positions/<profilId>.json`), damit jedes
 * Profil (z.B. "Oval", "Formel") seine eigenen Positionen behaelt.
 *
 * Migration: existiert noch keine Position im neuen Format, aber eine im
 * alten (layoutStore.ts, bestehende Installationen), wird die alte
 * einmalig uebernommen. Der alte numerische `displayId` laesst sich nicht
 * auf den neuen stabilen displayKey abbilden (siehe main/displays.ts) -
 * die alten Pixelwerte werden deshalb als relativ zum HAUPTdisplay
 * interpretiert statt den Monitor zu erraten. Nach dem naechsten
 * Verschieben/Resize speichert sich die Position sofort im neuen Format,
 * der alte Wert wird dann nicht mehr gelesen.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import type { OverlayPosition } from '../settings/position.js';
import { toOverlayPosition } from '../settings/position.js';
import { primaryDisplayInfo } from './displays.js';
import { loadWindowLayout } from './layoutStore.js';

type PositionFile = Record<string, OverlayPosition>;

function positionDir(): string {
  return join(app.getPath('userData'), 'positions');
}

function positionPath(profileId: string): string {
  return join(positionDir(), `${profileId}.json`);
}

async function readPositionFile(profileId: string): Promise<PositionFile> {
  try {
    const raw = await readFile(positionPath(profileId), 'utf-8');
    return JSON.parse(raw) as PositionFile;
  } catch {
    return {};
  }
}

export async function loadOverlayPosition(profileId: string, overlayId: string): Promise<OverlayPosition | undefined> {
  const file = await readPositionFile(profileId);
  if (file[overlayId]) return file[overlayId];

  const legacy = await loadWindowLayout(profileId, overlayId);
  if (!legacy) return undefined;
  return toOverlayPosition(legacy, primaryDisplayInfo());
}

export async function saveOverlayPosition(profileId: string, overlayId: string, position: OverlayPosition): Promise<void> {
  const file = await readPositionFile(profileId);
  file[overlayId] = position;
  await mkdir(positionDir(), { recursive: true });
  await writeFile(positionPath(profileId), JSON.stringify(file, null, 2), 'utf-8');
}

/** Wird beim Loeschen eines Profils aufgerufen (siehe profileStore.ts) - hinterlaesst keine verwaiste Datei. */
export async function deletePositionFile(profileId: string): Promise<void> {
  await rm(positionPath(profileId), { force: true });
}
