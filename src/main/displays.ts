/**
 * Stabile Geraete-Kennung fuer Monitore, siehe settings/position.ts.
 *
 * UNSICHER: Electrons `screen`-API liefert keine EDID-Seriennummer oder
 * sonst eine echte Hardware-ID fuer Displays - `label` (Herstellername/
 * Modellbezeichnung, vom Treiber gemeldet) + Aufloesung ist die
 * stabilste verfuegbare Naeherung, um "derselbe Monitor" ueber Neustarts
 * und Um-/Ansteckvorgaenge hinweg wiederzuerkennen. Zwei baugleiche
 * Monitore mit identischem Label und identischer Aufloesung sind damit
 * NICHT unterscheidbar - in dem (seltenen) Fall greift beim Aufloesen
 * einfach der erste Treffer (siehe settings/position.ts, resolveDisplay).
 */

import { screen, type Display } from 'electron';
import type { DisplayInfo } from '../settings/position.js';

export function stableDisplayKey(display: Display): string {
  return `${display.label || 'display'}#${display.size.width}x${display.size.height}`;
}

function toDisplayInfo(display: Display): DisplayInfo {
  return { key: stableDisplayKey(display), bounds: display.bounds, scaleFactor: display.scaleFactor };
}

export function allDisplays(): DisplayInfo[] {
  return screen.getAllDisplays().map(toDisplayInfo);
}

export function primaryDisplayInfo(): DisplayInfo {
  return toDisplayInfo(screen.getPrimaryDisplay());
}
