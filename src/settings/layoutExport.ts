/**
 * Layout-Sharing: Export/Import als einzelne JSON-Datei (siehe
 * Aufgabenstellung). Reine Funktionen ohne fs-Zugriff - main/layoutIpc.ts
 * uebernimmt den eigentlichen Dateidialog/die I/O.
 */

import type { AutoSwitchRule, Layout, LayoutOverlayPlacement } from './layout.js';
import type { OverlayPosition } from './position.js';

export interface LayoutExportFile {
  format: 'iracing-overlay-layout';
  formatVersion: 1;
  exportedAt: string;
  layout: Layout;
}

export function exportLayout(layout: Layout): LayoutExportFile {
  return { format: 'iracing-overlay-layout', formatVersion: 1, exportedAt: new Date().toISOString(), layout };
}

export interface ImportResult {
  layout: Layout;
  /** Menschenlesbare Hinweise auf uebersprungene/angepasste Daten, z.B. unbekannte Overlays - fuer eine Meldung im Launcher, kein harter Fehler. */
  warnings: string[];
}

function isPlacementLike(value: unknown): value is Partial<LayoutOverlayPlacement> {
  return !!value && typeof value === 'object';
}

function isRuleLike(value: unknown): value is AutoSwitchRule {
  if (!value || typeof value !== 'object') return false;
  const rule = value as Partial<AutoSwitchRule>;
  return typeof rule.id === 'string' && typeof rule.selectorType === 'string' && typeof rule.matchValue === 'string';
}

/**
 * Prueft eine importierte Layout-Datei gegen die aktuell bekannten
 * Overlay-IDs. Unbekannte Overlays (aus einer neueren App-Version oder
 * einem inzwischen entfernten Overlay) werden mit einer Warnung
 * uebersprungen statt die App abstuerzen zu lassen. Gibt `null` zurueck,
 * wenn die Datei grundlegend nicht das erwartete Format hat (kein Layout
 * dieser App, oder zu stark beschaedigt, um noch sinnvoll zu sein).
 */
export function validateImportedLayout(raw: unknown, knownOverlayIds: ReadonlySet<string>): ImportResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const file = raw as Partial<LayoutExportFile>;
  if (file.format !== 'iracing-overlay-layout' || !file.layout || typeof file.layout !== 'object') return null;

  const layout = file.layout as Partial<Layout>;
  if (typeof layout.id !== 'string' || typeof layout.name !== 'string' || !Array.isArray(layout.overlays)) return null;

  const warnings: string[] = [];
  const overlays: LayoutOverlayPlacement[] = [];
  for (const entry of layout.overlays) {
    if (!isPlacementLike(entry) || typeof entry.overlayId !== 'string' || !entry.position) continue;
    if (!knownOverlayIds.has(entry.overlayId)) {
      warnings.push(`Unbekanntes Overlay "${entry.overlayId}" wurde uebersprungen.`);
      continue;
    }
    overlays.push({
      overlayId: entry.overlayId,
      position: entry.position as OverlayPosition,
      locked: Boolean(entry.locked),
    });
  }

  const autoSwitchRules = Array.isArray(layout.autoSwitchRules) ? layout.autoSwitchRules.filter(isRuleLike) : [];
  if (Array.isArray(layout.autoSwitchRules) && autoSwitchRules.length < layout.autoSwitchRules.length) {
    warnings.push('Einzelne Auto-Switch-Regeln waren beschaedigt und wurden uebersprungen.');
  }

  return {
    layout: {
      id: layout.id,
      name: layout.name,
      schemaVersion: typeof layout.schemaVersion === 'number' ? layout.schemaVersion : 1,
      overlays,
      gridSize: typeof layout.gridSize === 'number' ? layout.gridSize : 0,
      autoSwitchRules,
    },
    warnings,
  };
}
