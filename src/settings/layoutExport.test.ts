import { describe, expect, it } from 'vitest';
import { exportLayout, validateImportedLayout } from './layoutExport.js';
import { createEmptyLayout, type Layout } from './layout.js';

const POSITION = { displayKey: 'virtual-desktop', xPct: 0.1, yPct: 0.1, widthPct: 0.2, heightPct: 0.2, dpiScaleAtSave: 1 };
const KNOWN_IDS = new Set(['relative', 'standings']);

describe('exportLayout / validateImportedLayout', () => {
  it('rundtrip: exportiertes Layout laesst sich unveraendert wieder importieren', () => {
    const layout: Layout = {
      ...createEmptyLayout('oval', 'Oval'),
      overlays: [{ overlayId: 'relative', position: POSITION, locked: true }],
    };
    const file = exportLayout(layout);
    const result = validateImportedLayout(file, KNOWN_IDS);

    expect(result?.layout).toEqual(layout);
    expect(result?.warnings).toEqual([]);
  });

  it('liefert null fuer eine Datei, die kein Layout dieser App ist', () => {
    expect(validateImportedLayout({ foo: 'bar' }, KNOWN_IDS)).toBeNull();
    expect(validateImportedLayout(null, KNOWN_IDS)).toBeNull();
    expect(validateImportedLayout('nicht mal ein Objekt', KNOWN_IDS)).toBeNull();
  });

  it('ueberspringt unbekannte Overlay-IDs mit einer Warnung statt zu crashen', () => {
    const layout: Layout = {
      ...createEmptyLayout('oval', 'Oval'),
      overlays: [
        { overlayId: 'relative', position: POSITION, locked: false },
        { overlayId: 'ein-zukuenftiges-overlay', position: POSITION, locked: false },
      ],
    };
    const result = validateImportedLayout(exportLayout(layout), KNOWN_IDS);

    expect(result?.layout.overlays).toHaveLength(1);
    expect(result?.layout.overlays[0]?.overlayId).toBe('relative');
    expect(result?.warnings).toHaveLength(1);
  });

  it('fuellt fehlende Felder mit sinnvollen Defaults statt abzustuerzen', () => {
    const raw = {
      format: 'iracing-overlay-layout',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      layout: { id: 'x', name: 'X', overlays: [] },
    };
    const result = validateImportedLayout(raw, KNOWN_IDS);
    expect(result?.layout.gridSize).toBe(0);
    expect(result?.layout.schemaVersion).toBe(1);
    expect(result?.layout.autoSwitchRules).toEqual([]);
  });

  it('ignoriert einzelne beschaedigte Autoswitch-Regeln statt das ganze Layout zu verwerfen', () => {
    const raw = {
      format: 'iracing-overlay-layout',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      layout: {
        id: 'x',
        name: 'X',
        overlays: [],
        autoSwitchRules: [{ id: '1', selectorType: 'car', matchValue: 'GT3' }, { broken: true }],
      },
    };
    const result = validateImportedLayout(raw, KNOWN_IDS);
    expect(result?.layout.autoSwitchRules).toHaveLength(1);
    expect(result?.warnings.length).toBeGreaterThan(0);
  });
});
