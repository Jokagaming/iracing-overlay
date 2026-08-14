/**
 * Auto-Switch: welches Layout soll aktiv sein, abhaengig vom gerade
 * gefahrenen Auto/der Serie/dem Session-Typ (siehe layout.ts,
 * `AutoSwitchRule`). Reine Funktion - main/autoSwitch.ts ruft sie bei
 * jeder Session-Aenderung mit den aktuellen Werten aus der Telemetrie auf.
 *
 * Eine Regel gehoert zu genau dem Layout, in dem sie steht (kein eigenes
 * `layoutId`-Feld noetig) - "passt eine ihrer Regeln, wird dieses Layout
 * aktiv".
 */

import type { AutoSwitchRule, Layout } from './layout.js';

export interface SessionSelectors {
  carName: string;
  seriesName: string;
  sessionType: string;
}

function selectorValue(rule: AutoSwitchRule, selectors: SessionSelectors): string {
  if (rule.selectorType === 'car') return selectors.carName;
  if (rule.selectorType === 'series') return selectors.seriesName;
  return selectors.sessionType;
}

/** Teilstring-Vergleich, ohne Gross-/Kleinschreibung - "GT3" matcht "Mercedes-AMG GT3" genau wie ein exaktes "Mercedes-AMG GT3". */
export function ruleMatches(rule: AutoSwitchRule, selectors: SessionSelectors): boolean {
  if (!rule.matchValue.trim()) return false;
  return selectorValue(rule, selectors).toLowerCase().includes(rule.matchValue.toLowerCase());
}

/**
 * Erstes Layout (in der uebergebenen Reihenfolge), von dem mindestens eine
 * Auto-Switch-Regel passt. `null`, wenn keins passt - der Aufrufer soll
 * dann beim zuletzt aktiven Layout bleiben statt ins Leere zu wechseln.
 */
export function resolveActiveLayoutId(layouts: Layout[], selectors: SessionSelectors): string | null {
  for (const layout of layouts) {
    if (layout.autoSwitchRules.some((rule) => ruleMatches(rule, selectors))) return layout.id;
  }
  return null;
}
