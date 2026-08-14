/**
 * Berechnet die Relative-Tabelle: welche Autos sind auf der Strecke gerade
 * vor und hinter dem Spieler, und wie viele Sekunden liegen dazwischen.
 *
 * Portiert aus dem archivierten Python/Browser-Prototyp
 * (widgets/lib/relative.js im iracing-overlay-python-poc-Repo), dort mit
 * 8 Tests gegen Start/Ziel-Umlauf, Rundenrueckstand und Multiclass
 * abgesichert. Die Tests wandern mit, siehe relative.test.ts.
 */

import type { Driver, TelemetryFrame } from '../types.js';
import { gapSeconds, lapsAhead } from './gap.js';

export interface RelativeRow extends Driver {
  isPlayer: boolean;
  gapSeconds: number;
  /** 0 = gleiche Runde wie der Spieler, positiv = Auto liegt eine Runde vor ihm. */
  lapsAhead: number;
}

export interface RelativeOptions {
  ahead?: number;
  behind?: number;
}

/**
 * Erweitert `ahead`/`behind` bei Bedarf, damit insgesamt mindestens
 * `minVisibleDrivers` Zeilen angezeigt werden (siehe Relative-Settings,
 * `minVisibleDrivers`) - `windowAroundPlayer()` erzwingt zwar bereits
 * "genau `ahead+behind+1` Zeilen wo moeglich, auch am Feldanfang/-ende",
 * aber nicht ein Minimum UEBER die konfigurierten ahead/behind-Werte
 * hinaus. Verteilt die zusaetzlich noetigen Zeilen etwa gleichmaessig auf
 * beide Seiten.
 */
export function resolveAheadBehind(ahead: number, behind: number, minVisibleDrivers: number): { ahead: number; behind: number } {
  const extra = minVisibleDrivers - (ahead + behind + 1);
  if (extra <= 0) return { ahead, behind };
  const addAhead = Math.ceil(extra / 2);
  const addBehind = extra - addAhead;
  return { ahead: ahead + addAhead, behind: behind + addBehind };
}

/**
 * Schneidet das Fenster um den Spieler heraus.
 *
 * Sind nach vorn oder hinten weniger Autos da als gewuenscht, wird auf der
 * anderen Seite aufgefuellt, damit die Zeilenzahl im Overlay konstant
 * bleibt und die Fenstergroesse waehrend der Fahrt nicht springt.
 */
function windowAroundPlayer<T extends { isPlayer: boolean }>(entries: T[], ahead: number, behind: number): T[] {
  const playerRow = entries.findIndex((entry) => entry.isPlayer);
  if (playerRow === -1) return entries.slice(0, ahead + behind + 1);

  const size = Math.min(ahead + behind + 1, entries.length);
  let start = playerRow - ahead;
  let end = playerRow + behind + 1;

  if (start < 0) {
    end -= start;
    start = 0;
  }
  if (end > entries.length) {
    start -= end - entries.length;
    end = entries.length;
  }
  start = Math.max(0, start);

  return entries.slice(start, start + size);
}

/**
 * Baut die Zeilen des Relative aus einem Telemetrie-Frame.
 */
export function buildRelativeRows(
  frame: TelemetryFrame,
  estLapTimeSec: number,
  { ahead = 4, behind = 4 }: RelativeOptions = {},
): RelativeRow[] {
  const me = frame.drivers.find((d) => d.carIdx === frame.player.carIdx);
  if (!me) return [];

  const entries: RelativeRow[] = [];
  for (const driver of frame.drivers) {
    // Pace Car und Autos ausserhalb der Welt gehoeren nicht in eine Tabelle,
    // die zeigt, mit wem der Spieler auf der Strecke gerade zu tun hat.
    if (driver.isPaceCar || driver.trackSurface === 'not_in_world') continue;

    const isPlayer = driver.carIdx === me.carIdx;
    entries.push({
      ...driver,
      isPlayer,
      gapSeconds: isPlayer ? 0 : gapSeconds(driver, me, estLapTimeSec),
      lapsAhead: isPlayer ? 0 : lapsAhead(driver, me),
    });
  }

  entries.sort((a, b) => a.gapSeconds - b.gapSeconds);
  return windowAroundPlayer(entries, ahead, behind);
}
