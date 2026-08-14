/**
 * Individuelles Settings-Schema des Relative-Overlays - erster echter
 * Konsument der Column-Registry (siehe shared/columns/registry.ts) und
 * des generischen Settings-Systems (siehe settings/schema.ts).
 *
 * Framework-/Electron-unabhaengig: main-process (IPC-Handler, siehe
 * main/relativeSettingsIpc.ts) und Renderer (SettingsPanel) importieren
 * dieselbe Definition, damit Schema und Defaults nie auseinanderlaufen.
 */

import type { OverlaySettingsDefinition } from '../../settings/schema.js';
import { columnsFor } from '../shared/columns/registry.js';
import type { ClassGrouping } from '../shared/columns/classGrouping.js';

export interface RelativeSettings extends Record<string, unknown> {
  columns: string[];
  minVisibleDrivers: number;
  classGrouping: ClassGrouping;
}

const DEFAULT_COLUMNS = [
  'classColor',
  'classPosition',
  'carNumber',
  'carBrand',
  'driverName',
  'iRating',
  'lapsAhead',
  'tireCompound',
  'sectorDelta',
  'gapToPlayer',
];

export const RELATIVE_DEFAULT_SETTINGS: RelativeSettings = {
  columns: DEFAULT_COLUMNS,
  minVisibleDrivers: 0,
  classGrouping: 'none',
};

export const RELATIVE_SETTINGS: OverlaySettingsDefinition<RelativeSettings> = {
  id: 'relative',
  name: 'Relative',
  schemaVersion: 1,
  settingsSchema: [
    {
      key: 'columns',
      label: 'Spalten',
      type: 'columnList',
      availableColumns: columnsFor('relative').map((c) => ({ value: c.id, label: c.label || c.id })),
      default: DEFAULT_COLUMNS,
    },
    {
      key: 'minVisibleDrivers',
      label: 'Mindestanzahl Zeilen',
      description: '0 = aus. Erzwingt eine Mindestanzahl angezeigter Fahrer, auch am Feldanfang/-ende.',
      type: 'number',
      min: 0,
      max: 20,
      step: 1,
      default: 0,
    },
    {
      key: 'classGrouping',
      label: 'Klassen-Gruppierung',
      description: '"Nach Startnummer" gruppiert nach der Hunderterstelle (#100-199, #200-299, ...) - fuer Ligen mit eigenen Klassen ueber Nummernkreise.',
      type: 'enum',
      options: [
        { value: 'none', label: 'Keine' },
        { value: 'bySimClass', label: 'Nach Sim-Klasse' },
        { value: 'byCarNumberHundreds', label: 'Nach Startnummer (100er)' },
      ],
      default: 'none',
    },
  ],
  defaultSettings: RELATIVE_DEFAULT_SETTINGS,
  migrations: [],
};
