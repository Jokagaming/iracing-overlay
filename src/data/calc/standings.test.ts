import { describe, expect, it } from 'vitest';
import type { Driver, TelemetryFrame } from '../types.js';
import { buildStandings } from './standings.js';

function makeDriver(overrides: Partial<Driver> & { carIdx: number }): Driver {
  return {
    isPlayer: false,
    isPaceCar: false,
    isSpectator: false,
    isAI: false,
    userName: `Fahrer ${overrides.carIdx}`,
    carNumber: String(overrides.carIdx),
    carClassId: 1,
    carName: 'Testwagen',
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
    gapToLeaderSec: 0,
    ...overrides,
  };
}

function makeFrame(drivers: Driver[]): TelemetryFrame {
  return {
    seq: 1,
    sessionTimeSec: 0,
    sessionTimeRemainSec: null,
    sessionLapsRemain: null,
    sessionState: 'racing',
    flags: ['green'],
    drivers,
    player: {
      carIdx: 0,
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
      carLeftRight: 'clear',
      lastLapTimesSec: [],
      sectorTimes: [],
      currentSector: null,
    },
    weather: { airTempC: 20, trackTempC: 30, humidityPct: 0.5, trackWetness: 'dry' },
  };
}

describe('buildStandings', () => {
  it('sortiert jede Klasse nach Position', () => {
    const frame = makeFrame([
      makeDriver({ carIdx: 0, classPosition: 3 }),
      makeDriver({ carIdx: 1, classPosition: 1 }),
      makeDriver({ carIdx: 2, classPosition: 2 }),
    ]);

    const groups = buildStandings(frame, []);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.rows.map((r) => r.carIdx)).toEqual([1, 2, 0]);
  });

  it('gruppiert nach Klasse und zeigt die schnellste zuerst', () => {
    const frame = makeFrame([
      makeDriver({ carIdx: 0, carClassId: 10, classPosition: 1 }),
      makeDriver({ carIdx: 1, carClassId: 20, classPosition: 1 }),
    ]);
    const carClasses = [
      { id: 10, name: 'GT4', color: '#0f0', relSpeed: 60, carCount: 1 },
      { id: 20, name: 'GTP', color: '#f00', relSpeed: 100, carCount: 1 },
    ];

    const groups = buildStandings(frame, carClasses);
    expect(groups.map((g) => g.carClass?.name)).toEqual(['GTP', 'GT4']);
  });

  it('nutzt gapToLeaderSec direkt, ohne es neu zu berechnen', () => {
    const frame = makeFrame([
      makeDriver({ carIdx: 0, classPosition: 1, gapToLeaderSec: 0 }),
      makeDriver({ carIdx: 1, classPosition: 2, gapToLeaderSec: 42.7 }),
    ]);

    const groups = buildStandings(frame, []);
    expect(groups[0]!.rows.map((r) => r.gapToLeaderSec)).toEqual([0, 42.7]);
  });

  it('Pace Car, Zuschauer und Autos ausserhalb der Welt tauchen nicht auf', () => {
    const frame = makeFrame([
      makeDriver({ carIdx: 0, classPosition: 1 }),
      makeDriver({ carIdx: 1, classPosition: 2, isPaceCar: true }),
      makeDriver({ carIdx: 2, classPosition: 3, isSpectator: true }),
      makeDriver({ carIdx: 3, classPosition: 4, trackSurface: 'not_in_world' }),
    ]);

    const groups = buildStandings(frame, []);
    expect(groups[0]!.rows.map((r) => r.carIdx)).toEqual([0]);
  });

  it('Klasse ohne Eintrag in carClasses faellt auf null statt zu crashen', () => {
    const frame = makeFrame([makeDriver({ carIdx: 0, carClassId: 999, classPosition: 1 })]);
    const groups = buildStandings(frame, []);
    expect(groups[0]!.carClass).toBeNull();
  });
});
