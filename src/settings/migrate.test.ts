import { describe, expect, it } from 'vitest';
import { migrateSettings } from './migrate.js';
import type { SettingsMigration } from './schema.js';

const DEFAULTS = { showIcon: true, rows: 5, label: 'Standard' };

describe('migrateSettings', () => {
  it('liefert die Defaults, wenn noch nichts gespeichert wurde', () => {
    expect(migrateSettings(null, 1, [], DEFAULTS)).toEqual(DEFAULTS);
    expect(migrateSettings(undefined, 1, [], DEFAULTS)).toEqual(DEFAULTS);
  });

  it('behaelt gespeicherte Werte auf aktueller Version, Defaults nur fuer fehlende Keys', () => {
    const stored = { schemaVersion: 1, values: { showIcon: false } };
    expect(migrateSettings(stored, 1, [], DEFAULTS)).toEqual({ showIcon: false, rows: 5, label: 'Standard' });
  });

  it('wendet die Migrationskette der Reihe nach an, bis die aktuelle Version erreicht ist', () => {
    // v1 hatte "count" statt "rows" - Migration benennt das Feld um.
    const v1ToV2: SettingsMigration = (prev) => {
      const { count, ...rest } = prev as { count?: number };
      return { ...rest, rows: count ?? 5 };
    };
    // v2 fuegte "label" neu ein - keine echte Umformung noetig, nur zur Demonstration einer zweiten Stufe.
    const v2ToV3: SettingsMigration = (prev) => ({ ...prev, label: 'Migriert' });

    const stored = { schemaVersion: 1, values: { showIcon: false, count: 8 } };
    const result = migrateSettings(stored, 3, [v1ToV2, v2ToV3], DEFAULTS);

    expect(result).toEqual({ showIcon: false, rows: 8, label: 'Migriert' });
    expect(result).not.toHaveProperty('count');
  });

  it('bricht sauber ab, wenn eine Migration in der Kette fehlt, statt falsche Werte zu produzieren', () => {
    const stored = { schemaVersion: 1, values: { showIcon: false } };
    // Nur ein Migrator fuer 3 noetige Versionssprünge - migrateSettings darf nicht endlos schleifen oder crashen.
    const result = migrateSettings(stored, 4, [(prev) => ({ ...prev, rows: 99 })], DEFAULTS);

    expect(result).toEqual({ showIcon: false, rows: 99, label: 'Standard' });
  });

  it('behaelt unbekannte Keys aus einer neueren Version (Downgrade-Sicherheit)', () => {
    const stored = { schemaVersion: 2, values: { showIcon: true, rows: 3, label: 'Alt', neuesFeature: 'x' } };
    const result = migrateSettings(stored, 1, [], DEFAULTS);

    expect(result).toMatchObject({ neuesFeature: 'x' });
  });

  it('migriert nicht rueckwaerts, wenn die gespeicherte Version hoeher ist als die aktuelle', () => {
    const migrateThatShouldNotRun: SettingsMigration = () => {
      throw new Error('darf bei Downgrade nicht aufgerufen werden');
    };
    const stored = { schemaVersion: 5, values: { showIcon: false, rows: 10, label: 'Neu' } };

    expect(() => migrateSettings(stored, 2, [migrateThatShouldNotRun], DEFAULTS)).not.toThrow();
    expect(migrateSettings(stored, 2, [migrateThatShouldNotRun], DEFAULTS)).toEqual({
      showIcon: false,
      rows: 10,
      label: 'Neu',
    });
  });
});
