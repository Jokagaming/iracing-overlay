/**
 * Datenmodell fuer den Layout-Modus: EIN Fenster, das die gesamte
 * virtuelle Desktopflaeche ueberspannt, mit Overlays als Kinder darin
 * (siehe main/layoutWindowTarget.ts) - im Unterschied zum Overlay-Modus
 * (ein natives Fenster pro Overlay, siehe main/overlayWindowTarget.ts).
 * Profilbasiert: genau ein Layout ist aktiv, Auto-Switch-Regeln koennen
 * automatisch zwischen Layouts wechseln (Auto/Serie/Session-Typ).
 */

import type { OverlayPosition } from './position.js';

export interface LayoutOverlayPlacement {
  overlayId: string;
  /** Relativ zur virtuellen Desktopflaeche (siehe position.ts, unionBounds()) statt zu einem einzelnen Display - das Layout-Fenster deckt ja alle Monitore ab. `displayKey` ist dafuer immer der Sentinel-Wert "virtual-desktop". */
  position: OverlayPosition;
  locked: boolean;
}

export type AutoSwitchSelectorType = 'car' | 'series' | 'sessionType';

export interface AutoSwitchRule {
  id: string;
  selectorType: AutoSwitchSelectorType;
  /** Freitext-Vergleichswert gegen die laufende Session (Fahrzeugname/Seriename/Session-Typ) - siehe main/autoSwitch.ts fuer den Abgleich. */
  matchValue: string;
}

export interface Layout {
  id: string;
  name: string;
  schemaVersion: number;
  overlays: LayoutOverlayPlacement[];
  /** Rastergroesse in Pixeln fuer den Layout-Editor, siehe layoutGrid.ts. 0 = kein Snapping. */
  gridSize: number;
  autoSwitchRules: AutoSwitchRule[];
}

/** Sentinel-Wert fuer `OverlayPosition.displayKey` im Layout-Modus - dort gibt es kein einzelnes Display, sondern die gesamte virtuelle Desktopflaeche als Bezugsrahmen. */
export const VIRTUAL_DESKTOP_DISPLAY_KEY = 'virtual-desktop';

export function createEmptyLayout(id: string, name: string): Layout {
  return { id, name, schemaVersion: 1, overlays: [], gridSize: 20, autoSwitchRules: [] };
}
