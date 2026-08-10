import { describe, expect, it } from 'vitest';
import { FuelTracker, planFuel } from './fuel.js';

describe('FuelTracker', () => {
  it('braucht keine Daten fuer die erste beobachtete Runde', () => {
    const tracker = new FuelTracker();
    tracker.update(1, 80, false);
    expect(tracker.averagePerLapLiters).toBeNull();
  });

  it('berechnet den Verbrauch aus der Differenz zwischen zwei Runden', () => {
    const tracker = new FuelTracker();
    tracker.update(1, 80, false);
    tracker.update(1, 77, false); // noch in Runde 1, wird nicht gezaehlt
    tracker.update(2, 76.9, false); // Rundenwechsel: 80 - 76.9 = 3.1 L

    expect(tracker.averagePerLapLiters).toBeCloseTo(3.1, 5);
  });

  it('mittelt ueber mehrere Runden', () => {
    const tracker = new FuelTracker();
    tracker.update(1, 80, false);
    tracker.update(2, 77, false); // 3.0 L
    tracker.update(3, 73.5, false); // 3.5 L

    expect(tracker.averagePerLapLiters).toBeCloseTo(3.25, 5);
  });

  it('verwirft Runden mit Boxenbesuch statt sie als Verbrauch zu werten', () => {
    const tracker = new FuelTracker();
    tracker.update(1, 80, false);
    tracker.update(1, 76, true); // Boxenstopp waehrend Runde 1
    tracker.update(2, 96, false); // nachgetankt auf 96 L - keine Runde ins Mittel aufnehmen

    expect(tracker.averagePerLapLiters).toBeNull();
  });

  it('erholt sich nach einer Box-Runde und trackt wieder normal weiter', () => {
    const tracker = new FuelTracker();
    tracker.update(1, 80, false);
    tracker.update(1, 76, true); // Box
    tracker.update(2, 96, false); // verworfen (Box in Runde 1)
    tracker.update(3, 92.8, false); // saubere Runde: 96 - 92.8 = 3.2 L

    expect(tracker.averagePerLapLiters).toBeCloseTo(3.2, 5);
  });

  it('verwirft implausible Werte (nachgetankt ohne erkannten Boxenbesuch, negativ)', () => {
    const tracker = new FuelTracker();
    tracker.update(1, 50, false);
    tracker.update(2, 55, false); // mehr Sprit als vorher -> kein echter Verbrauch

    expect(tracker.averagePerLapLiters).toBeNull();
  });

  it('haelt nur die letzten 10 Runden im Mittelwert', () => {
    const tracker = new FuelTracker();
    tracker.update(0, 200, false);
    // 5 Runden a 5 L, dann 10 Runden a 3 L - der Mittelwert soll sich den
    // aelteren, hoeheren Verbrauch nicht mehr anrechnen.
    let level = 200;
    for (let lap = 1; lap <= 5; lap += 1) {
      level -= 5;
      tracker.update(lap, level, false);
    }
    for (let lap = 6; lap <= 15; lap += 1) {
      level -= 3;
      tracker.update(lap, level, false);
    }

    expect(tracker.averagePerLapLiters).toBeCloseTo(3, 5);
  });
});

describe('planFuel', () => {
  const base = {
    levelLiters: 40,
    usePerLapLiters: 3,
    raceLapsRemain: null as number | null,
    raceTimeRemainSec: null as number | null,
    estLapTimeSec: 100,
    safetyLaps: 1,
  };

  it('nutzt die Rundenzahl direkt, wenn das Rennen rundenbasiert ist', () => {
    const plan = planFuel({ ...base, raceLapsRemain: 10 });
    expect(plan.lapsRemainingInRace).toBe(10);
    // (10 + 1 Sicherheitsrunde) * 3 L = 33 L
    expect(plan.litersNeededToFinish).toBeCloseTo(33, 5);
    expect(plan.litersToAddAtNextStop).toBeCloseTo(0, 5); // 40 L sind schon genug
  });

  it('schaetzt Runden aus der Restzeit, wenn kein Rundenlimit gilt (Sentinel 32767)', () => {
    const plan = planFuel({ ...base, raceLapsRemain: 32767, raceTimeRemainSec: 950 });
    // 950s / 100s Rundenzeit = 9.5 -> aufgerundet 10 Runden
    expect(plan.lapsRemainingInRace).toBe(10);
  });

  it('verlangt Nachtanken, wenn der aktuelle Tankstand nicht reicht', () => {
    const plan = planFuel({ ...base, levelLiters: 10, raceLapsRemain: 10 });
    expect(plan.litersNeededToFinish).toBeCloseTo(33, 5);
    expect(plan.litersToAddAtNextStop).toBeCloseTo(23, 5);
  });

  it('liefert null-Werte ohne Verbrauchsdaten statt zu raten', () => {
    const plan = planFuel({ ...base, usePerLapLiters: null, raceLapsRemain: 10 });
    expect(plan.litersNeededToFinish).toBeNull();
    expect(plan.litersToAddAtNextStop).toBeNull();
    // Restrundenzahl selbst ist trotzdem bekannt.
    expect(plan.lapsRemainingInRace).toBe(10);
  });

  it('liefert komplett null, wenn weder Runden noch Zeit bekannt sind', () => {
    const plan = planFuel(base);
    expect(plan.lapsRemainingInRace).toBeNull();
    expect(plan.litersNeededToFinish).toBeNull();
    expect(plan.litersToAddAtNextStop).toBeNull();
  });
});
