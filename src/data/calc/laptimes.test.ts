import { describe, expect, it } from 'vitest';
import { LapTimeTracker } from './laptimes.js';

describe('LapTimeTracker', () => {
  it('braucht keine Daten fuer die erste beobachtete Runde', () => {
    const tracker = new LapTimeTracker();
    tracker.update(1, null);
    expect(tracker.lastLaps).toEqual([]);
  });

  it('uebernimmt die Rundenzeit erst beim Rundenwechsel', () => {
    const tracker = new LapTimeTracker();
    tracker.update(1, null);
    tracker.update(1, null); // noch in Runde 1
    tracker.update(2, 95.4); // Rundenwechsel: Runde 1 abgeschlossen mit 95.4s

    expect(tracker.lastLaps).toEqual([95.4]);
  });

  it('sammelt mehrere Runden in chronologischer Reihenfolge', () => {
    const tracker = new LapTimeTracker();
    tracker.update(1, null);
    tracker.update(2, 95.4);
    tracker.update(3, 94.8);
    tracker.update(4, 96.1);

    expect(tracker.lastLaps).toEqual([95.4, 94.8, 96.1]);
  });

  it('haelt nur die letzten 5 Runden', () => {
    const tracker = new LapTimeTracker();
    tracker.update(0, null);
    for (let lap = 1; lap <= 7; lap += 1) {
      tracker.update(lap, 90 + lap);
    }

    expect(tracker.lastLaps).toEqual([93, 94, 95, 96, 97]);
  });

  it('ignoriert ungueltige Rundenzeiten (null oder 0)', () => {
    const tracker = new LapTimeTracker();
    tracker.update(1, null);
    tracker.update(2, 0);
    tracker.update(3, 95);

    expect(tracker.lastLaps).toEqual([95]);
  });
});
