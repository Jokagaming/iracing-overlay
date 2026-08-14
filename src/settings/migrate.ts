/**
 * Zieht gespeicherte Overlay-Settings auf die aktuelle Schema-Version hoch.
 *
 * Bewusst als reine Funktion ohne fs/Electron-Bezug (wie calc/*.ts im
 * Datenlayer) - die eigentliche Datei-Persistenz sitzt in
 * main/settingsStore.ts und ruft nur diese Funktion auf. So ist die
 * Migrationslogik isoliert testbar, ohne eine Nutzerdatei anzulegen.
 */

import type { SettingsMigration } from './schema.js';

export interface StoredSettingsFile {
  schemaVersion: number;
  values: Record<string, unknown>;
}

/**
 * @param stored Rohdaten aus der Settings-Datei, oder `null`/`undefined` beim allerersten Laden (noch keine Datei).
 * @param currentSchemaVersion Die `schemaVersion` aus der aktuellen `OverlaySettingsDefinition`.
 * @param migrations Siehe `SettingsMigration` - Index = alte Version - 1.
 * @param defaultSettings Aktuelle Defaults - fuellen fehlende Keys nach der Migration auf.
 * @returns Migrierte, vollstaendige Settings. Unbekannte Keys aus `stored.values`
 *   bleiben erhalten (Downgrade-Sicherheit: ein spaeteres Update mit mehr
 *   Feldern verliert seine Werte nicht, nur weil eine aeltere Version die
 *   Datei zwischenzeitlich nochmal speichert).
 */
export function migrateSettings(
  stored: StoredSettingsFile | null | undefined,
  currentSchemaVersion: number,
  migrations: SettingsMigration[],
  defaultSettings: Record<string, unknown>,
): Record<string, unknown> {
  if (!stored) return { ...defaultSettings };

  let values = { ...stored.values };
  let version = stored.schemaVersion;

  // Downgrade-Fall (gespeicherte Version > aktuelle): Schleife laeuft gar
  // nicht erst an, Werte werden unveraendert uebernommen (siehe Rueckgabe
  // unten) - kein Versuch, "rueckwaerts" zu migrieren.
  while (version < currentSchemaVersion) {
    const migrate = migrations[version - 1];
    if (!migrate) {
      // Keine Migration fuer diesen Sprung hinterlegt (Luecke in der Kette,
      // z.B. vergessen anzulegen) - hier haengenbleiben statt mit falschen
      // oder fehlenden Werten weiterzumachen. defaultSettings unten fuellt
      // wenigstens neu hinzugekommene Felder auf.
      break;
    }
    values = migrate(values);
    version += 1;
  }

  return { ...defaultSettings, ...values };
}
