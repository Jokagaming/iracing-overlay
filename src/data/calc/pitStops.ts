/**
 * Boxenstopps und Stint-Laenge pro Auto aus `onPitRoad`-Uebergaengen - das
 * SDK liefert keinen fertigen Zaehler dafuer, nur den aktuellen
 * Boxen-Status je Tick (wie Sektorzeiten, siehe calc/sectors.ts).
 */

export interface PitStopInfo {
  /** Anzahl abgeschlossener Boxenein-/ausfahrten in dieser Session. */
  pitStopCount: number;
  /** Runden seit der letzten Boxenausfahrt (bzw. seit Session-Start, falls noch nie geboxt). */
  stintLaps: number;
}

const EMPTY_INFO: PitStopInfo = { pitStopCount: 0, stintLaps: 0 };

class SingleCarPitTracker {
  private wasOnPitRoad = false;
  private pitStopCount = 0;
  private lapAtStintStart = 0;
  private lastLap = 0;

  update(lap: number, onPitRoad: boolean): void {
    this.lastLap = lap;

    if (onPitRoad && !this.wasOnPitRoad) {
      this.pitStopCount += 1;
    }
    if (!onPitRoad && this.wasOnPitRoad) {
      // Boxenausfahrt - ab dieser Runde beginnt ein neuer Stint.
      this.lapAtStintStart = lap;
    }
    this.wasOnPitRoad = onPitRoad;
  }

  get info(): PitStopInfo {
    return { pitStopCount: this.pitStopCount, stintLaps: Math.max(0, this.lastLap - this.lapAtStintStart) };
  }
}

export class MultiCarPitTracker {
  private readonly trackers = new Map<number, SingleCarPitTracker>();

  update(carIdx: number, lap: number, onPitRoad: boolean): void {
    let tracker = this.trackers.get(carIdx);
    if (!tracker) {
      tracker = new SingleCarPitTracker();
      this.trackers.set(carIdx, tracker);
    }
    tracker.update(lap, onPitRoad);
  }

  infoFor(carIdx: number): PitStopInfo {
    return this.trackers.get(carIdx)?.info ?? EMPTY_INFO;
  }
}
