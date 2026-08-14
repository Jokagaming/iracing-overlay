/**
 * Felder, die JEDES Overlay automatisch erbt (siehe Aufgabenstellung) -
 * stehen nicht im individuellen Schema eines Overlays, sondern werden vom
 * generischen Renderer/der Persistenz einmal zentral behandelt.
 *
 * Die exakte Fensterposition (xPct/yPct/widthPct/heightPct/displayKey,
 * siehe settings/position.ts) gehoert bewusst NICHT hierher: die wird
 * durch Ziehen/Groesse-Aendern direkt am Fenster gesetzt (siehe
 * main/overlayWindowTarget.ts), nicht ueber ein Formularfeld mit
 * Prozent-Zahlen. Das `displayTarget`-Feld unten deckt den einzigen
 * settings-panel-tauglichen Teil davon ab: grob "auf welchem Monitor" statt
 * der genauen Position.
 */

import type { BooleanField, EnumField, KeybindingValue, NumberField, SettingsField } from './schema.js';

export interface BaseOverlaySettings {
  enabled: boolean;
  autoOpen: boolean;
  locked: boolean;
  scale: number;
  opacityBackground: number;
  opacityContent: number;
  theme: string;
  darkMode: boolean;
  fontFamily: string;
  fontSize: number;
  borderRadius: number;
  backgroundColor: string;
  keybinding: KeybindingValue | null;
}

const enabledField: BooleanField = { key: 'enabled', label: 'Aktiv', type: 'boolean', default: true };
const autoOpenField: BooleanField = {
  key: 'autoOpen',
  label: 'Beim Start automatisch oeffnen',
  type: 'boolean',
  default: true,
};
const lockedField: BooleanField = {
  key: 'locked',
  label: 'Gesperrt (klickdurchlaessig)',
  description: 'Bei "Gesperrt" nimmt das Fenster keine Mausklicks entgegen und laesst sich nicht verschieben.',
  type: 'boolean',
  default: true,
};
const scaleField: NumberField = { key: 'scale', label: 'Skalierung', type: 'number', min: 0.5, max: 2, step: 0.05, default: 1 };
const opacityBackgroundField: NumberField = {
  key: 'opacityBackground',
  label: 'Deckkraft Hintergrund',
  type: 'number',
  min: 0,
  max: 1,
  step: 0.05,
  default: 0.85,
};
const opacityContentField: NumberField = {
  key: 'opacityContent',
  label: 'Deckkraft Inhalt',
  type: 'number',
  min: 0,
  max: 1,
  step: 0.05,
  default: 1,
};
const themeField: EnumField = {
  key: 'theme',
  label: 'Theme',
  type: 'enum',
  options: [{ value: 'default', label: 'Standard' }],
  default: 'default',
};
const darkModeField: BooleanField = { key: 'darkMode', label: 'Dark Mode', type: 'boolean', default: true };
const fontFamilyField: EnumField = {
  key: 'fontFamily',
  label: 'Schriftart',
  type: 'enum',
  options: [{ value: 'system', label: 'System' }],
  default: 'system',
};
const fontSizeField: NumberField = {
  key: 'fontSize',
  label: 'Schriftgroesse',
  type: 'number',
  min: 9,
  max: 24,
  step: 1,
  default: 12,
};
const borderRadiusField: NumberField = {
  key: 'borderRadius',
  label: 'Eckenradius',
  type: 'number',
  min: 0,
  max: 24,
  step: 1,
  default: 6,
};
const backgroundColorField: { key: 'backgroundColor'; label: string; type: 'color'; default: string } = {
  key: 'backgroundColor',
  label: 'Hintergrundfarbe',
  type: 'color',
  default: '#0c0e12',
};
const keybindingField: { key: 'keybinding'; label: string; type: 'keybinding'; default: null } = {
  key: 'keybinding',
  label: 'Sichtbarkeit umschalten',
  type: 'keybinding',
  default: null,
};

export const BASE_SETTINGS_SCHEMA: SettingsField[] = [
  enabledField,
  autoOpenField,
  lockedField,
  scaleField,
  opacityBackgroundField,
  opacityContentField,
  themeField,
  darkModeField,
  fontFamilyField,
  fontSizeField,
  borderRadiusField,
  backgroundColorField,
  keybindingField,
];

export const BASE_DEFAULT_SETTINGS: BaseOverlaySettings = {
  enabled: true,
  autoOpen: true,
  locked: true,
  scale: 1,
  opacityBackground: 0.85,
  opacityContent: 1,
  theme: 'default',
  darkMode: true,
  fontFamily: 'system',
  fontSize: 12,
  borderRadius: 6,
  backgroundColor: '#0c0e12',
  keybinding: null,
};
