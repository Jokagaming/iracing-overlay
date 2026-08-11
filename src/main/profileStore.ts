/**
 * Mehrere benannte Layout-Profile (z.B. "Oval", "Formel", "Standard") -
 * jedes traegt seine eigene Overlay-Auswahl. Die Fensterpositionen selbst
 * bleiben in layoutStore.ts, dort aber pro Profil in einer eigenen Datei
 * (layouts/<profilId>.json) statt immer in layouts/default.json.
 *
 * Migriert automatisch von der alten Einzel-Auswahl (layouts/selection.json,
 * aus der Version vor den Profilen) beim ersten Start nach diesem Update -
 * siehe loadProfiles(). Bestehende Fensterpositionen brauchen keine
 * Migration: das "Standard"-Profil bekommt bewusst die id "default" und
 * trifft damit direkt auf die schon vorhandene layouts/default.json.
 */

import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface Profile {
  id: string;
  name: string;
  selectedOverlayIds: string[];
}

export interface ProfilesFile {
  activeProfileId: string;
  profiles: Profile[];
}

export const DEFAULT_PROFILE_ID = 'default';
const DEFAULT_PROFILE_NAME = 'Standard';

function layoutDir(): string {
  return join(app.getPath('userData'), 'layouts');
}

function profilesPath(): string {
  return join(layoutDir(), 'profiles.json');
}

function legacySelectionPath(): string {
  return join(layoutDir(), 'selection.json');
}

async function readLegacySelection(): Promise<string[] | undefined> {
  try {
    const raw = await readFile(legacySelectionPath(), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : undefined;
  } catch {
    return undefined;
  }
}

function isValidProfilesFile(value: unknown): value is ProfilesFile {
  if (!value || typeof value !== 'object') return false;
  const file = value as Partial<ProfilesFile>;
  return typeof file.activeProfileId === 'string' && Array.isArray(file.profiles) && file.profiles.length > 0;
}

/** `allOverlayIds` ist der Default fuer ein komplett neues "Standard"-Profil (kein Vorlauf, keine Legacy-Datei). */
export async function loadProfiles(allOverlayIds: string[]): Promise<ProfilesFile> {
  try {
    const raw = await readFile(profilesPath(), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (isValidProfilesFile(parsed)) return parsed;
  } catch {
    // Datei fehlt beim ersten Start oder ist beschaedigt - unten neu anlegen.
  }

  const legacySelection = await readLegacySelection();
  const file: ProfilesFile = {
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [
      {
        id: DEFAULT_PROFILE_ID,
        name: DEFAULT_PROFILE_NAME,
        selectedOverlayIds: legacySelection ?? allOverlayIds,
      },
    ],
  };
  await saveProfiles(file);
  return file;
}

export async function saveProfiles(file: ProfilesFile): Promise<void> {
  await mkdir(layoutDir(), { recursive: true });
  await writeFile(profilesPath(), JSON.stringify(file, null, 2), 'utf-8');
}

/** URL-/dateisystemsichere id aus dem Profilnamen - z.B. "GT3 Oval" -> "gt3-oval". */
function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'profil';
}

/** Haengt bei Kollision -2, -3, ... an, damit jedes Profil eine eigene Layout-Datei bekommt. */
export function uniqueProfileId(name: string, existing: Profile[]): string {
  const base = slugify(name);
  let id = base;
  let suffix = 2;
  while (existing.some((p) => p.id === id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}
