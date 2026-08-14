import { describe, expect, it } from 'vitest';
import render from 'preact-render-to-string';
import { SettingsPanel } from './SettingsPanel.js';
import type { SettingsField } from '../../../settings/schema.js';

const FIELDS: SettingsField[] = [
  { key: 'showIcon', label: 'Icon zeigen', type: 'boolean', default: true },
  { key: 'rows', label: 'Zeilen', type: 'number', min: 1, max: 10, step: 1, default: 5 },
  {
    key: 'mode',
    label: 'Modus',
    type: 'enum',
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ],
    default: 'a',
  },
  { key: 'color', label: 'Farbe', type: 'color', default: '#ffd640' },
  { key: 'hotkey', label: 'Hotkey', type: 'keybinding', default: null },
  {
    key: 'columns',
    label: 'Spalten',
    type: 'columnList',
    availableColumns: [
      { value: 'pos', label: 'Position' },
      { value: 'name', label: 'Name' },
    ],
    default: ['pos'],
  },
  { key: 'display', label: 'Anzeige', type: 'displayTarget', default: null },
  {
    key: 'advanced',
    label: 'Erweitert',
    type: 'group',
    fields: [{ key: 'proOnly', label: 'Nur Pro', type: 'boolean', default: false, pro: true }],
  },
];

describe('SettingsPanel', () => {
  it('rendert jeden Feldtyp ohne zu werfen', () => {
    const html = render(<SettingsPanel fields={FIELDS} values={{}} onChange={() => {}} />);
    expect(html).toContain('Icon zeigen');
    expect(html).toContain('Zeilen');
    expect(html).toContain('Modus');
    expect(html).toContain('Farbe');
    expect(html).toContain('Hotkey');
    expect(html).toContain('Nicht belegt');
    expect(html).toContain('Spalten');
    expect(html).toContain('Position');
    expect(html).toContain('Anzeige');
    expect(html).toContain('Automatisch (Hauptmonitor)');
    expect(html).toContain('Erweitert');
    expect(html).toContain('Nur Pro');
    expect(html).toContain('PRO');
  });

  it('blendet ein Feld mit nicht erfuellter visibleIf-Bedingung aus', () => {
    const fields: SettingsField[] = [
      { key: 'mode', label: 'Modus', type: 'enum', options: [{ value: 'a', label: 'A' }], default: 'a' },
      {
        key: 'extra',
        label: 'Nur bei Modus B',
        type: 'boolean',
        default: false,
        visibleIf: { key: 'mode', equals: 'b' },
      },
    ];
    const html = render(<SettingsPanel fields={fields} values={{ mode: 'a' }} onChange={() => {}} />);
    expect(html).not.toContain('Nur bei Modus B');
  });

  it('zeigt ausgewaehlte Spalten in der gespeicherten Reihenfolge, Rest als inaktiv', () => {
    const field: SettingsField = {
      key: 'columns',
      label: 'Spalten',
      type: 'columnList',
      availableColumns: [
        { value: 'pos', label: 'Position' },
        { value: 'name', label: 'Name' },
        { value: 'gap', label: 'Abstand' },
      ],
      default: ['pos'],
    };
    const html = render(<SettingsPanel fields={[field]} values={{ columns: ['name', 'pos'] }} onChange={() => {}} />);
    // Name vor Position (gespeicherte Reihenfolge), Abstand nicht ausgewaehlt -> "is-inactive".
    expect(html.indexOf('Name')).toBeLessThan(html.indexOf('Position'));
    expect(html).toContain('is-inactive');
  });
});
