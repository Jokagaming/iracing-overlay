/**
 * Deklaratives Schema fuer Overlay-Einstellungen.
 *
 * Ein Overlay definiert NUR sein Schema (Feldliste, Typen, Defaults,
 * Migrationen) - die tatsaechliche UI dafuer entsteht generisch daraus
 * (siehe renderer/shared/settings/SettingsPanel.tsx). Neues Overlay = neue
 * Schema-Datei, kein neuer UI-Code. "Basis-Settings", die jedes Overlay
 * automatisch erbt (enabled, position, opacity, ...), sind bewusst NICHT
 * hier - die kommen mit der Fenster-/Positionsverwaltung, siehe
 * baseSchema.ts.
 */

export type SettingsPrimitive = boolean | number | string | string[] | KeybindingValue | null;

/**
 * Roh genug, um Tastatur, Lenkradtasten, Button-Boxen und USB-Controller
 * gleich zu behandeln (siehe Key-Bindings-Anforderung) - `code` ist ein
 * geraeteabhaengiger Bezeichner (z.B. "KeyE" fuer Tastatur, "Btn12" fuer
 * ein HID-Geraet), `device` identifiziert die Quelle. Wie genau HID-Geraete
 * erkannt/benannt werden, ist Sache des Key-Bindings-Systems (spaeterer
 * Schritt) - dieser Typ ist nur der Wert, den ein Settings-Feld haelt.
 */
export interface KeybindingValue {
  device: 'keyboard' | 'hid';
  code: string;
  modifiers?: Array<'ctrl' | 'alt' | 'shift'>;
}

export interface EnumOption {
  value: string;
  label: string;
}

/** Bedingung auf ein ANDERES Feld desselben Schemas - Feld nur sichtbar/aktiv, wenn erfuellt. */
export type VisibleIf = { key: string; equals: SettingsPrimitive } | { key: string; notEquals: SettingsPrimitive };

interface FieldBase {
  key: string;
  label: string;
  description?: string;
  visibleIf?: VisibleIf;
  /** Nur in einer kuenftigen Pro-Version nutzbar - der generische Renderer zeigt das Feld ausgegraut mit Hinweis statt es zu verstecken. */
  pro?: boolean;
}

export interface BooleanField extends FieldBase {
  type: 'boolean';
  default: boolean;
}

export interface NumberField extends FieldBase {
  type: 'number';
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface EnumField extends FieldBase {
  type: 'enum';
  options: EnumOption[];
  default: string;
}

export interface ColorField extends FieldBase {
  type: 'color';
  /** CSS-Hex, z.B. "#ffd640". */
  default: string;
}

export interface KeybindingField extends FieldBase {
  type: 'keybinding';
  default: KeybindingValue | null;
}

export interface ColumnListField extends FieldBase {
  type: 'columnList';
  /**
   * Spalten aus der Column-Registry (siehe data/columns.ts), die fuer
   * DIESES Overlay ueberhaupt infrage kommen - nicht jede Spalte passt zu
   * jedem Overlay. `value`/`label` wie bei EnumOption, damit der generische
   * Renderer ohne Extra-Lookup ein Label anzeigen kann.
   */
  availableColumns: EnumOption[];
  /** Startreihenfolge (ausgewaehlte Spalten-IDs, in dieser Reihenfolge). */
  default: string[];
}

export interface DisplayTargetField extends FieldBase {
  type: 'displayTarget';
  /** `null` = "automatisch" (Hauptmonitor bzw. zuletzt bekannte Position). */
  default: null;
}

/** Rein visuelle Gliederung im generischen Renderer - kein eigener Wert, nur verschachtelte Felder. */
export interface GroupField extends FieldBase {
  type: 'group';
  fields: SettingsField[];
}

export type SettingsField =
  | BooleanField
  | NumberField
  | EnumField
  | ColorField
  | KeybindingField
  | ColumnListField
  | DisplayTargetField
  | GroupField;

/**
 * Eine Migrationsfunktion je Versionssprung. `migrations[0]` hebt v1->v2,
 * `migrations[1]` v2->v3, usw. (Index = alte Version - 1). Bekommt die
 * ROHEN, ungeprueften alten Settings (koennen aus einer viel aelteren
 * Version stammen und Felder haben, die es im aktuellen Schema nicht mehr
 * gibt) - gibt die Werte auf dem naechsthoeheren Versionsstand zurueck.
 * Siehe migrate.ts fuer die Anwendung der ganzen Kette.
 */
export type SettingsMigration = (previous: Record<string, unknown>) => Record<string, unknown>;

export interface OverlaySettingsDefinition<TSettings extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  name: string;
  schemaVersion: number;
  settingsSchema: SettingsField[];
  defaultSettings: TSettings;
  migrations: SettingsMigration[];
}

/** Flache Liste aller Felder eines Schemas, inkl. der in `group`-Feldern verschachtelten - fuer den generischen Renderer und fuer Validierung/Defaults-Aufbau. */
export function flattenFields(fields: SettingsField[]): SettingsField[] {
  return fields.flatMap((field) => (field.type === 'group' ? [field, ...flattenFields(field.fields)] : [field]));
}
