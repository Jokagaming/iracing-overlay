/**
 * Uebersetzt ein Settings-Schema (settings/schema.ts) generisch in ein
 * Formular - EINE Komponente fuer alle Overlays, kein Dialog pro Overlay.
 * Neues Feld im Schema = erscheint automatisch hier, ohne Aenderung an
 * dieser Datei (solange der Feldtyp existiert).
 *
 * Einzelne Feldtypen sind hier bewusst nur so weit gebaut, wie es ohne die
 * jeweils zustaendigen spaeteren Bausteine sinnvoll ist:
 * - `columnList` zeigt An/Aus + Auf/Ab-Reorder, echtes Drag&Drop kommt mit
 *   der Column-Registry (naechster Schritt).
 * - `displayTarget` zeigt nur "Automatisch" - ein echter Monitor-Picker
 *   braucht die Fenster-/Positionsverwaltung (uebernaechster Schritt).
 * - `keybinding` faengt nur Tastatur ab - Lenkrad/Button-Box/USB-Controller
 *   kommen mit dem eigenstaendigen Key-Bindings-System.
 */

import { useState } from 'preact/hooks';
import type {
  ColumnListField,
  EnumField,
  KeybindingValue,
  NumberField,
  SettingsField,
  SettingsPrimitive,
} from '../../../settings/schema.js';

export interface SettingsPanelProps {
  fields: SettingsField[];
  values: Record<string, SettingsPrimitive>;
  onChange: (key: string, value: SettingsPrimitive) => void;
}

function isVisible(field: SettingsField, values: Record<string, SettingsPrimitive>): boolean {
  if (!field.visibleIf) return true;
  const actual = values[field.visibleIf.key];
  return 'equals' in field.visibleIf ? actual === field.visibleIf.equals : actual !== field.visibleIf.notEquals;
}

export function SettingsPanel({ fields, values, onChange }: SettingsPanelProps) {
  return (
    <div class="settings-panel">
      {fields.map((field) =>
        isVisible(field, values) ? <SettingsFieldRow key={field.key} field={field} values={values} onChange={onChange} /> : null,
      )}
    </div>
  );
}

function SettingsFieldRow({
  field,
  values,
  onChange,
}: Pick<SettingsPanelProps, 'values' | 'onChange'> & { field: SettingsField }) {
  if (field.type === 'group') {
    return (
      <fieldset class="settings-group">
        <legend>{field.label}</legend>
        <SettingsPanel fields={field.fields} values={values} onChange={onChange} />
      </fieldset>
    );
  }

  const value = values[field.key] ?? field.default;
  const disabled = Boolean(field.pro);

  return (
    <div class={`settings-row settings-row--${field.type}`} title={field.description}>
      <span class="settings-row__label">
        {field.label}
        {field.pro && <span class="settings-row__pro-badge">PRO</span>}
      </span>
      <div class="settings-row__control">
        <FieldControl field={field} value={value} disabled={disabled} onChange={(v) => onChange(field.key, v)} />
      </div>
    </div>
  );
}

interface ControlProps<F extends SettingsField> {
  field: F;
  value: SettingsPrimitive;
  disabled: boolean;
  onChange: (value: SettingsPrimitive) => void;
}

function FieldControl(props: ControlProps<SettingsField>) {
  switch (props.field.type) {
    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={Boolean(props.value)}
          disabled={props.disabled}
          onChange={(e) => props.onChange(e.currentTarget.checked)}
        />
      );
    case 'number':
      return <NumberControl {...(props as ControlProps<NumberField>)} />;
    case 'enum':
      return <EnumControl {...(props as ControlProps<EnumField>)} />;
    case 'color':
      return (
        <input
          type="color"
          value={String(props.value)}
          disabled={props.disabled}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      );
    case 'keybinding':
      return <KeybindingControl {...props} />;
    case 'columnList':
      return <ColumnListControl {...(props as ControlProps<ColumnListField>)} />;
    case 'displayTarget':
      // Platzhalter bis zur echten Fenster-/Positionsverwaltung - siehe Dateikommentar oben.
      return <span class="settings-row__hint">Automatisch (Hauptmonitor)</span>;
    default:
      return null;
  }
}

function NumberControl({ field, value, disabled, onChange }: ControlProps<NumberField>) {
  const numeric = typeof value === 'number' ? value : field.default;
  return (
    <div class="settings-row__number">
      <input
        type="range"
        min={field.min}
        max={field.max}
        step={field.step}
        value={numeric}
        disabled={disabled}
        onInput={(e) => onChange(Number(e.currentTarget.value))}
      />
      <input
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={numeric}
        disabled={disabled}
        onInput={(e) => onChange(Number(e.currentTarget.value))}
      />
    </div>
  );
}

function EnumControl({ field, value, disabled, onChange }: ControlProps<EnumField>) {
  return (
    <select value={String(value)} disabled={disabled} onChange={(e) => onChange(e.currentTarget.value)}>
      {field.options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function formatKeybinding(v: KeybindingValue | null): string {
  if (!v) return 'Nicht belegt';
  const mods = v.modifiers?.length ? v.modifiers.join('+') + '+' : '';
  return `${mods}${v.code}`;
}

function KeybindingControl({ value, disabled, onChange }: ControlProps<SettingsField>) {
  const [listening, setListening] = useState(false);
  const current = (value ?? null) as KeybindingValue | null;

  return (
    <div class="settings-row__keybinding">
      <button
        type="button"
        disabled={disabled}
        class={listening ? 'is-listening' : ''}
        onClick={() => setListening(true)}
        onKeyDown={(e) => {
          if (!listening) return;
          e.preventDefault();
          const modifiers: Array<'ctrl' | 'alt' | 'shift'> = [];
          if (e.ctrlKey) modifiers.push('ctrl');
          if (e.altKey) modifiers.push('alt');
          if (e.shiftKey) modifiers.push('shift');
          if (['Control', 'Alt', 'Shift'].includes(e.key)) return;
          onChange({ device: 'keyboard', code: e.code, modifiers });
          setListening(false);
        }}
        onBlur={() => setListening(false)}
      >
        {listening ? 'Taste druecken ...' : formatKeybinding(current)}
      </button>
      {current && (
        <button type="button" class="settings-row__clear" disabled={disabled} onClick={() => onChange(null)}>
          Loeschen
        </button>
      )}
    </div>
  );
}

function ColumnListControl({ field, value, disabled, onChange }: ControlProps<ColumnListField>) {
  const selected = Array.isArray(value) ? (value as string[]) : field.default;
  const labelFor = (id: string) => field.availableColumns.find((c) => c.value === id)?.label ?? id;

  function toggle(id: string): void {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  function move(index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  return (
    <ul class="settings-row__columns">
      {selected.map((id, index) => (
        <li key={id}>
          <label>
            <input type="checkbox" checked disabled={disabled} onChange={() => toggle(id)} />
            {labelFor(id)}
          </label>
          <span class="settings-row__columns-reorder">
            <button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)}>
              ↑
            </button>
            <button type="button" disabled={disabled || index === selected.length - 1} onClick={() => move(index, 1)}>
              ↓
            </button>
          </span>
        </li>
      ))}
      {field.availableColumns
        .filter((c) => !selected.includes(c.value))
        .map((c) => (
          <li key={c.value} class="is-inactive">
            <label>
              <input type="checkbox" disabled={disabled} onChange={() => toggle(c.value)} />
              {c.label}
            </label>
          </li>
        ))}
    </ul>
  );
}
