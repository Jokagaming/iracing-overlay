import { describe, expect, it } from 'vitest';
import { MultiCarSectorTracker, SectorTracker } from './sectors.js';

const BOUNDARIES = [
  { num: 1, startPct: 0 },
  { num: 2, startPct: 0.33 },
  { num: 3, startPct: 0.66 },
];

describe('SectorTracker', () => {
  it('bleibt leer ohne definierte Sektorgrenzen', () => {
    const tracker = new SectorTracker();
    tracker.update(0.5, 10);
    expect(tracker.results).toEqual([]);
    expect(tracker.currentSectorNum).toBeNull();
  });

  it('misst Sektorzeiten aus den Uebergaengen, inkl. Rundenwechsel', () => {
    const tracker = new SectorTracker();
    tracker.setBoundaries(BOUNDARIES);

    tracker.update(0, 0); // Start, Sektor 1 beginnt
    tracker.update(0.33, 10); // Sektor 1: 10s, Sektor 2 beginnt
    tracker.update(0.66, 25); // Sektor 2: 15s, Sektor 3 beginnt
    tracker.update(0.99, 40); // noch in Sektor 3
    tracker.update(0, 55); // Rundenwechsel: Sektor 3: 30s, neuer Sektor 1 beginnt

    const byNum = new Map(tracker.results.map((r) => [r.num, r]));
    expect(byNum.get(1)?.lastSec).toBe(10);
    expect(byNum.get(2)?.lastSec).toBe(15);
    expect(byNum.get(3)?.lastSec).toBe(30);

    expect(tracker.currentSectorNum).toBe(1);
    expect(tracker.currentElapsedSec(60)).toBe(5);
  });

  it('haelt die schnellste Zeit pro Sektor fest, auch wenn die letzte langsamer war', () => {
    const tracker = new SectorTracker();
    tracker.setBoundaries(BOUNDARIES);

    tracker.update(0, 0);
    tracker.update(0.33, 10); // Sektor 1, Runde 1: 10s (Bestzeit)
    tracker.update(0.66, 25);
    tracker.update(0, 40); // Sektor 3, Runde 1: 15s

    tracker.update(0.33, 55); // Sektor 1, Runde 2: 15s (langsamer)

    const byNum = new Map(tracker.results.map((r) => [r.num, r]));
    expect(byNum.get(1)?.lastSec).toBe(15);
    expect(byNum.get(1)?.bestSec).toBe(10);
    expect(byNum.get(1)?.isPersonalBest).toBe(false);
  });

  it('verwirft implausible Sektorzeiten (Session-Zeit-Ruecksetzer)', () => {
    const tracker = new SectorTracker();
    tracker.setBoundaries(BOUNDARIES);

    tracker.update(0, 100); // Sektor 1 beginnt bei t=100
    tracker.update(0.33, 90); // Session-Zeit "zurueckgesprungen" - verworfen statt negativer Zeit

    const byNum = new Map(tracker.results.map((r) => [r.num, r]));
    expect(byNum.get(1)?.lastSec).toBeNull();
    expect(byNum.get(1)?.bestSec).toBeNull();
  });
});

describe('MultiCarSectorTracker', () => {
  it('trackt mehrere Autos unabhaengig voneinander', () => {
    const tracker = new MultiCarSectorTracker();
    tracker.setBoundaries(BOUNDARIES);

    // Auto 1: schneller Sektor 1
    tracker.update(1, 0, 0);
    tracker.update(1, 0.33, 8);
    // Auto 2: langsamerer Sektor 1
    tracker.update(2, 0, 0);
    tracker.update(2, 0.33, 12);

    const byNum1 = new Map(tracker.resultsFor(1).map((r) => [r.num, r]));
    const byNum2 = new Map(tracker.resultsFor(2).map((r) => [r.num, r]));
    expect(byNum1.get(1)?.lastSec).toBe(8);
    expect(byNum2.get(1)?.lastSec).toBe(12);
  });

  it('liefert leere Ergebnisse fuer ein noch nie gesehenes Auto', () => {
    const tracker = new MultiCarSectorTracker();
    tracker.setBoundaries(BOUNDARIES);
    expect(tracker.resultsFor(99)).toEqual([]);
    expect(tracker.currentSectorNumFor(99)).toBeNull();
  });

  it('liefert die schnellste Zeit je Sektor ueber mehrere Autos (Feld-Bestzeit)', () => {
    const tracker = new MultiCarSectorTracker();
    tracker.setBoundaries(BOUNDARIES);

    // Auto 1: Sektor 1 in 8s (schneller)
    tracker.update(1, 0, 0);
    tracker.update(1, 0.33, 8);
    // Auto 2: Sektor 1 in 12s (langsamer)
    tracker.update(2, 0, 0);
    tracker.update(2, 0.33, 12);

    expect(tracker.fieldBestByNum([1, 2]).get(1)).toBe(8);
  });

  it('ignoriert Autos ausserhalb der uebergebenen Liste (z.B. andere Fahrzeugklasse)', () => {
    const tracker = new MultiCarSectorTracker();
    tracker.setBoundaries(BOUNDARIES);

    tracker.update(1, 0, 0);
    tracker.update(1, 0.33, 8);
    tracker.update(2, 0, 0);
    tracker.update(2, 0.33, 12);

    expect(tracker.fieldBestByNum([2]).get(1)).toBe(12);
  });

  it('liefert eine leere Map ohne Vergleichswerte', () => {
    const tracker = new MultiCarSectorTracker();
    tracker.setBoundaries(BOUNDARIES);
    expect(tracker.fieldBestByNum([1, 2]).size).toBe(0);
  });

  it('gibt neu geaenderte Sektorgrenzen an bereits bekannte Autos weiter', () => {
    const tracker = new MultiCarSectorTracker();
    tracker.setBoundaries(BOUNDARIES);
    tracker.update(1, 0, 0);

    tracker.setBoundaries([{ num: 1, startPct: 0 }]);
    tracker.update(1, 0.5, 5);

    // Nur noch ein Sektor definiert - das Auto darf keine Ergebnisse fuer die alten Sektoren 2/3 mehr zeigen.
    expect(tracker.resultsFor(1).map((r) => r.num)).toEqual([1]);
  });
});
