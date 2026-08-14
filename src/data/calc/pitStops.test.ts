import { describe, expect, it } from 'vitest';
import { MultiCarPitTracker } from './pitStops.js';

describe('MultiCarPitTracker', () => {
  it('liefert 0/0 fuer ein noch nie gesehenes Auto', () => {
    const tracker = new MultiCarPitTracker();
    expect(tracker.infoFor(99)).toEqual({ pitStopCount: 0, stintLaps: 0 });
  });

  it('zaehlt einen Boxenstopp bei einem false->true Uebergang', () => {
    const tracker = new MultiCarPitTracker();
    tracker.update(1, 3, false);
    tracker.update(1, 3, true); // Boxeneinfahrt
    tracker.update(1, 3, true); // bleibt in der Box - kein zweiter Stopp
    expect(tracker.infoFor(1).pitStopCount).toBe(1);
  });

  it('zaehlt mehrere Boxenstopps als getrennte Ereignisse', () => {
    const tracker = new MultiCarPitTracker();
    tracker.update(1, 1, false);
    tracker.update(1, 1, true);
    tracker.update(1, 1, false);
    tracker.update(1, 5, true);
    expect(tracker.infoFor(1).pitStopCount).toBe(2);
  });

  it('zaehlt stintLaps seit der letzten Boxenausfahrt', () => {
    const tracker = new MultiCarPitTracker();
    tracker.update(1, 1, false);
    tracker.update(1, 3, true); // Boxeneinfahrt in Runde 3
    tracker.update(1, 3, false); // Ausfahrt in Runde 3 - neuer Stint beginnt hier
    tracker.update(1, 8, false); // 5 Runden spaeter, noch im Stint

    expect(tracker.infoFor(1).stintLaps).toBe(5);
  });

  it('zaehlt stintLaps seit Session-Start, wenn noch nie geboxt wurde', () => {
    const tracker = new MultiCarPitTracker();
    tracker.update(1, 0, false);
    tracker.update(1, 6, false);
    expect(tracker.infoFor(1).stintLaps).toBe(6);
  });

  it('trackt mehrere Autos unabhaengig voneinander', () => {
    const tracker = new MultiCarPitTracker();
    tracker.update(1, 5, true);
    tracker.update(2, 5, false);

    expect(tracker.infoFor(1).pitStopCount).toBe(1);
    expect(tracker.infoFor(2).pitStopCount).toBe(0);
  });
});
