/**
 * Baut die Session-Wertung: nach Klasse gruppiert, je Klasse nach Position
 * sortiert.
 *
 * Anders als beim Relative (calc/relative.ts) braucht der Abstand zum
 * Fuehrenden hier keine eigene Umlaufkorrektur - `Driver.gapToLeaderSec`
 * kommt direkt aus `CarIdxF2Time`, das SDK liefert die echte Gesamtzeit
 * bereits fertig (auch ueber mehrere Runden Rueckstand hinweg, wo die
 * Umlaufkorrektur aus gap.ts falsch laege, siehe deren Dokumentation).
 */

import type { CarClass, Driver, TelemetryFrame } from '../types.js';

export interface StandingsGroup {
  /** `null` bei einem Single-Class-Event ohne Klasseninformation. */
  carClass: CarClass | null;
  rows: Driver[];
}

export function buildStandings(frame: TelemetryFrame, carClasses: CarClass[]): StandingsGroup[] {
  const classById = new Map(carClasses.map((c) => [c.id, c]));

  const byClass = new Map<number | null, Driver[]>();
  for (const driver of frame.drivers) {
    if (driver.isPaceCar || driver.isSpectator || driver.trackSurface === 'not_in_world') continue;
    const key = driver.carClassId;
    const list = byClass.get(key);
    if (list) list.push(driver);
    else byClass.set(key, [driver]);
  }

  const groups: StandingsGroup[] = [];
  for (const [classId, drivers] of byClass) {
    const rows = [...drivers].sort((a, b) => (a.classPosition ?? Infinity) - (b.classPosition ?? Infinity));
    groups.push({ carClass: classId != null ? (classById.get(classId) ?? null) : null, rows });
  }

  // Schnellste Klasse zuerst - matcht die Anzeige-Reihenfolge des Relative.
  return groups.sort((a, b) => (b.carClass?.relSpeed ?? 0) - (a.carClass?.relSpeed ?? 0));
}
