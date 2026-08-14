/**
 * Datei-Persistenz fuer Overlay-Settings, ein JSON pro Overlay
 * (settings/<overlayId>.json). Reine I/O-Huelle - die eigentliche
 * Migrations-/Auffuell-Logik sitzt in settings/migrate.ts (dort auch
 * getestet, ohne Electron-Main-Kontext).
 *
 * Analog zu profileStore.ts/layoutStore.ts: gleiche Struktur (readFile mit
 * try/catch-Fallback, mkdir vor writeFile), bewusst nicht mit denen
 * zusammengelegt - Overlay-Settings sind pro Overlay-ID versioniert und
 * migriert, Profile/Layouts nicht.
 */

import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { migrateSettings, type StoredSettingsFile } from '../settings/migrate.js';
import type { OverlaySettingsDefinition } from '../settings/schema.js';

function settingsDir(): string {
  return join(app.getPath('userData'), 'settings');
}

function settingsPath(overlayId: string): string {
  return join(settingsDir(), `${overlayId}.json`);
}

function isValidStoredFile(value: unknown): value is StoredSettingsFile {
  if (!value || typeof value !== 'object') return false;
  const file = value as Partial<StoredSettingsFile>;
  return typeof file.schemaVersion === 'number' && typeof file.values === 'object' && file.values !== null;
}

/**
 * Laedt die Settings eines Overlays, migriert sie bei Bedarf auf
 * `defn.schemaVersion` und schreibt das Ergebnis zurueck, wenn sich die
 * Version geaendert hat - sonst wuerde die naechste Migration wieder bei
 * der alten Version ansetzen.
 */
export async function loadSettings<T extends Record<string, unknown>>(defn: OverlaySettingsDefinition<T>): Promise<T> {
  let stored: StoredSettingsFile | null = null;
  try {
    const raw = await readFile(settingsPath(defn.id), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (isValidStoredFile(parsed)) stored = parsed;
  } catch {
    // Datei fehlt beim ersten Start oder ist beschaedigt - unten Defaults verwenden.
  }

  const migrated = migrateSettings(stored, defn.schemaVersion, defn.migrations, defn.defaultSettings) as T;
  if (!stored || stored.schemaVersion !== defn.schemaVersion) {
    await saveSettings(defn.id, defn.schemaVersion, migrated);
  }
  return migrated;
}

export async function saveSettings(overlayId: string, schemaVersion: number, values: Record<string, unknown>): Promise<void> {
  await mkdir(settingsDir(), { recursive: true });
  const file: StoredSettingsFile = { schemaVersion, values };
  await writeFile(settingsPath(overlayId), JSON.stringify(file, null, 2), 'utf-8');
}
