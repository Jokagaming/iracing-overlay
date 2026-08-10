import { describe, expect, it } from 'vitest';
import type { Driver, TelemetryFrame } from '../types.js';
import { buildRelativeRows } from './relative.js';

const LAP_TIME = 100;

function makeDriver(overrides: Partial<Driver> & { carIdx: number }): Driver {
  return {
    isPlayer: false,
    isPaceCar: false,
    isSpectator: false,
    isAI: false,
    userName: `Fahrer ${overrides.carIdx}`,
    carNumber: String(overrides.carIdx),
    carClassId: 1,
    iRating: 3000,
    safetyRating: 'A 3.45',
    licenseColor: '#0153db',
    position: overrides.carIdx + 1,
    classPosition: overrides.carIdx + 1,
    lap: 1,
    lapDistPct: 0,
    estTimeSec: null,
    onPitRoad: false,
    trackSurface: 'on_track',
    lastLapSec: null,
    bestLapSec: null,
    gapToLeaderSec: null,
    ...overrides,
  };
}

/** Baut ein Frame aus `{idx, estTime, lap}`-Kurzangaben. */
function makeFrame(cars: Array<{ idx: number; estTime: number; lap?: number; isPaceCar?: boolean; trackSurface?: Driver['trackSurface'] }>, playerIdx = 0): TelemetryFrame {
  const drivers = cars.map((car) =>
    makeDriver({
      carIdx: car.idx,
      lap: car.lap ?? 1,
      lapDistPct: car.estTime / LAP_TIME,
      estTimeSec: car.estTime,
      isPaceCar: car.isPaceCar ?? false,
      trackSurface: car.trackSurface ?? 'on_track',
    }),
  );

  return {
    seq: 1,
    sessionTimeSec: 0,
    sessionTimeRemainSec: null,
    sessionLapsRemain: null,
    sessionState: 'racing',
    flags: ['green'],
    drivers,
    player: {
      carIdx: playerIdx,
      speedMs: 0,
      rpm: 0,
      gear: 0,
      inputs: { throttle: 0, brake: 0, clutch: 0, steerRad: 0 },
      fuel: { levelLiters: 0, levelPct: 0, usePerHourLiters: 0, usePerLapLiters: null, lapsRemainingOnFuel: null },
      delta: { toBestLapSec: null, toOptimalLapSec: null, toSessionBestLapSec: null },
      tires: {
        lf: { tempInnerC: 0, tempMiddleC: 0, tempOuterC: 0, wearPct: 0, coldPressureKpa: 0 },
        rf: { tempInnerC: 0, tempMiddleC: 0, tempOuterC: 0, wearPct: 0, coldPressureKpa: 0 },
        lr: { tempInnerC: 0, tempMiddleC: 0, tempOuterC: 0, wearPct: 0, coldPressureKpa: 0 },
        rr: { tempInnerC: 0, tempMiddleC: 0, tempOuterC: 0, wearPct: 0, coldPressureKpa: 0 },
      },
    },
    weather: { airTempC: 20, trackTempC: 30, humidityPct: 0.5, trackWetness: 'dry' },
  };
}

describe('buildRelativeRows', () => {
  it('Autos voraus sind negativ, dahinter positiv', () => {
    const frame = makeFrame([
      { idx: 0, estTime: 50 }, // Spieler
      { idx: 1, estTime: 53 }, // 3s voraus
      { idx: 2, estTime: 48 }, // 2s dahinter
    ]);

    const rows = buildRelativeRows(frame, LAP_TIME, { ahead: 3, behind: 3 });
    const byIdx = new Map(rows.map((r) => [r.carIdx, r]));

    expect(byIdx.get(1)?.gapSeconds).toBe(-3);
    expect(byIdx.get(2)?.gapSeconds).toBe(2);
    expect(byIdx.get(0)?.gapSeconds).toBe(0);
  });

  it('Reihenfolge: am weitesten voraus steht oben', () => {
    const frame = makeFrame([
      { idx: 0, estTime: 50 },
      { idx: 1, estTime: 55 },
      { idx: 2, estTime: 52 },
      { idx: 3, estTime: 45 },
    ]);

    const rows = buildRelativeRows(frame, LAP_TIME, { ahead: 3, behind: 3 });
    expect(rows.map((r) => r.carIdx)).toEqual([1, 2, 0, 3]);
  });

  it('Start/Ziel: das Auto dahinter bleibt das Auto dahinter', () => {
    // Spieler ist gerade ueber die Linie (2s in die neue Runde), der andere
    // ist noch 2s davor. Ohne Umlaufkorrektur waeren das 96s Abstand.
    const frame = makeFrame([
      { idx: 0, estTime: 2, lap: 3 },
      { idx: 1, estTime: 98, lap: 2 },
    ]);

    const rows = buildRelativeRows(frame, LAP_TIME, { ahead: 3, behind: 3 });
    const other = rows.find((r) => r.carIdx === 1)!;

    expect(other.gapSeconds).toBe(4);
    expect(rows.indexOf(other)).toBeGreaterThan(rows.findIndex((r) => r.isPlayer));
  });

  it('Start/Ziel: das Auto davor bleibt das Auto davor', () => {
    const frame = makeFrame([
      { idx: 0, estTime: 98, lap: 2 },
      { idx: 1, estTime: 2, lap: 3 },
    ]);

    const rows = buildRelativeRows(frame, LAP_TIME, { ahead: 3, behind: 3 });
    const other = rows.find((r) => r.carIdx === 1)!;

    expect(other.gapSeconds).toBe(-4);
    expect(rows.indexOf(other)).toBeLessThan(rows.findIndex((r) => r.isPlayer));
  });

  it('Rundenrueckstand wird erkannt', () => {
    const frame = makeFrame([
      { idx: 0, estTime: 50, lap: 5 },
      { idx: 1, estTime: 52, lap: 6 }, // eine Runde vor dem Spieler
      { idx: 2, estTime: 48, lap: 4 }, // eine Runde dahinter
    ]);

    const rows = buildRelativeRows(frame, LAP_TIME, { ahead: 3, behind: 3 });
    const byIdx = new Map(rows.map((r) => [r.carIdx, r]));

    expect(byIdx.get(1)?.lapsAhead).toBe(1);
    expect(byIdx.get(2)?.lapsAhead).toBe(-1);
    expect(byIdx.get(0)?.lapsAhead).toBe(0);
  });

  it('Pace Car und Autos ausserhalb der Welt tauchen nicht auf', () => {
    const frame = makeFrame([
      { idx: 0, estTime: 50 },
      { idx: 1, estTime: 52, isPaceCar: true },
      { idx: 2, estTime: 48, trackSurface: 'not_in_world' },
      { idx: 3, estTime: 47 },
    ]);

    const rows = buildRelativeRows(frame, LAP_TIME, { ahead: 3, behind: 3 });
    expect(rows.map((r) => r.carIdx)).toEqual([0, 3]);
  });

  it('Fenstergroesse bleibt konstant, auch als Fuehrender', () => {
    const cars = [{ idx: 0, estTime: 90 }];
    for (let i = 1; i <= 8; i += 1) cars.push({ idx: i, estTime: 90 - i * 3 });

    const rows = buildRelativeRows(makeFrame(cars), LAP_TIME, { ahead: 3, behind: 3 });

    expect(rows).toHaveLength(7);
    expect(rows[0]?.carIdx).toBe(0);
  });

  it('Ohne passenden Spieler-CarIdx kommt eine leere Tabelle statt eines Fehlers', () => {
    const frame = makeFrame([{ idx: 1, estTime: 50 }], /* playerIdx */ 99);
    expect(buildRelativeRows(frame, LAP_TIME)).toEqual([]);
  });

  it('Fehlendes estTimeSec faellt auf lapDistPct * Rundenzeit zurueck', () => {
    const frame = makeFrame([
      { idx: 0, estTime: 50 },
      { idx: 1, estTime: 60 },
    ]);
    // estTimeSec des zweiten Autos manuell entfernen, um den Fallback zu pruefen.
    frame.drivers[1]!.estTimeSec = null;
    frame.drivers[1]!.lapDistPct = 0.6; // 0.6 * LAP_TIME(100) = 60, gleiches Ergebnis erwartet

    const rows = buildRelativeRows(frame, LAP_TIME, { ahead: 3, behind: 3 });
    const other = rows.find((r) => r.carIdx === 1)!;
    expect(other.gapSeconds).toBe(-10);
  });
});
