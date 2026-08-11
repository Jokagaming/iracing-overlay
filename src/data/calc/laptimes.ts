/**
 * Haelt die letzten abgeschlossenen Rundenzeiten des Spielers vor - die
 * Telemetrie liefert pro Tick nur die zuletzt abgeschlossene Rundenzeit
 * (`CarIdxLastLapTime`), keine Historie. Analog zu FuelTracker (calc/fuel.ts)
 * deshalb zustandsbehaftet statt eine reine Funktion, und genauso lange
 * lebend wie die Datenquelle selbst.
 */

const HISTORY_LENGTH = 5;

export class LapTimeTracker {
  private currentLap = -1;
  private history: number[] = [];

  /** Einmal pro Tick aufrufen, mit dem aktuellen Rundenstand und der zuletzt abgeschlossenen Rundenzeit des Spielers. */
  update(lap: number, lastLapSec: number | null): void {
    if (this.currentLap === -1) {
      this.currentLap = lap;
      return;
    }

    if (lap !== this.currentLap) {
      // 0/null bedeutet "noch keine gueltige Zeit" (z.B. Formation Lap) -
      // keine Platzhalter-Runde in die Historie aufnehmen.
      if (lastLapSec != null && lastLapSec > 0) {
        this.history.push(lastLapSec);
        if (this.history.length > HISTORY_LENGTH) this.history.shift();
      }
      this.currentLap = lap;
    }
  }

  /** Chronologisch, aelteste zuerst - bis zu den letzten {@link HISTORY_LENGTH} abgeschlossenen Runden. */
  get lastLaps(): number[] {
    return this.history;
  }
}
