/**
 * Simulierte Telemetrie ohne laufendes iRacing.
 *
 * Erzeugt dieselben Nachrichten wie die Live-Quelle (Connector), nur aus
 * einer einfachen Simulation. Damit lassen sich Overlays entwickeln und
 * stylen, ohne das Spiel zu starten oder selbst zu fahren - Portierung
 * des `--demo`-Modus aus dem archivierten Python-Prototyp.
 */

import type { BridgeMessage, CarLeftRight, Driver, DriverRosterEntry, SessionState, TelemetryFrame } from '../types.js';
import type { DataSource } from '../connector.js';
import { FuelTracker } from '../calc/fuel.js';

const TRACK_LENGTH_M = 5793;
const LAP_TIME_BASE = 103.5;
const PLAYER_IDX = 2;
const RACE_DURATION_SEC = 3600;
/** Deckt sich mit dem realen SDK-Sentinel fuer "kein Rundenlimit", siehe calc/fuel.ts. */
const UNLIMITED_LAPS_SENTINEL = 32767;

const CLASSES = [
  { id: 4011, name: 'GTP', color: '#ff5b3a', relSpeed: 100, lapTime: 96 },
  { id: 2708, name: 'GT3', color: '#3ad1ff', relSpeed: 80, lapTime: 103.5 },
  { id: 3200, name: 'GT4', color: '#9dff3a', relSpeed: 60, lapTime: 112 },
];

const NAMES = [
  'Lena Hoffmann', 'Marco Feldt', 'Justin Gawlik', 'Ayla Soenmez', 'Piet Bergmann',
  'Nils Kaminski', 'Tomas Vrba', 'Rui Alcantara', 'Sofia Marchetti', 'Ben Ottinger',
  'Kasper Lund', 'Ivo Petrov', 'Malte Riedel', 'Yuki Hasegawa', 'Chris Delaney',
  'Ronja Falk', 'Damien Roux', 'Ola Nyberg', 'Tarek Aziz', 'Greta Wolf',
];

interface MockCar {
  idx: number;
  carClass: (typeof CLASSES)[number];
  lapTime: number;
  offset: number;
  name: string;
  number: string;
  iRating: number;
}

/** Deterministischer Zufallszahlengenerator (mulberry32), fuer reproduzierbare Demo-Daten. */
function makeRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MockSource implements DataSource {
  private readonly cars: MockCar[];
  private readonly sessionMessage: BridgeMessage & { type: 'session' };
  private readonly startedAt = performance.now();
  private readonly fuelTracker = new FuelTracker();
  private seq = 0;
  private sessionSent = false;

  constructor(carCount = 20) {
    const rng = makeRng(1995);
    const count = Math.min(carCount, NAMES.length);

    this.cars = Array.from({ length: count }, (_, idx) => {
      const carClass = CLASSES[idx % CLASSES.length]!;
      return {
        idx,
        carClass,
        // Leicht unterschiedliches Tempo pro Auto, damit sich das Feld
        // ueber die Zeit auseinanderzieht und Ueberrundungen entstehen.
        lapTime: carClass.lapTime * (0.995 + rng() * 0.025),
        offset: idx * 0.011,
        name: NAMES[idx]!,
        number: String(1 + Math.floor(rng() * 98)),
        iRating: 1200 + Math.floor(rng() * 6600),
      };
    });

    this.sessionMessage = { type: 'session', ...this.buildSessionState() };
  }

  get lastSessionMessage(): BridgeMessage | null {
    return this.sessionMessage;
  }

  close(): void {
    /* nichts zu tun */
  }

  async poll(): Promise<BridgeMessage[]> {
    this.seq += 1;
    const elapsedSec = (performance.now() - this.startedAt) / 1000;

    const messages: BridgeMessage[] = [];
    if (!this.sessionSent) {
      this.sessionSent = true;
      messages.push(this.sessionMessage);
    }
    messages.push({ type: 'telemetry', ...this.buildTelemetryFrame(elapsedSec) });
    return messages;
  }

  private buildRoster(): DriverRosterEntry[] {
    return this.cars.map((car) => ({
      carIdx: car.idx,
      isPaceCar: false,
      isSpectator: false,
      isAI: car.idx !== PLAYER_IDX,
      userName: car.name,
      carNumber: car.number,
      carClassId: car.carClass.id,
      iRating: car.iRating,
      safetyRating: 'A 3.45',
      licenseColor: '#0153db',
    }));
  }

  private buildSessionState(): SessionState {
    const roster = this.buildRoster();
    const classCounts = new Map<number, number>();
    for (const car of this.cars) classCounts.set(car.carClass.id, (classCounts.get(car.carClass.id) ?? 0) + 1);

    return {
      updateId: 1,
      track: {
        id: 0,
        name: 'Demodrom Grand Prix',
        config: 'Grand Prix',
        lengthMeters: TRACK_LENGTH_M,
        pitSpeedLimitKph: 80,
      },
      sessions: [{ num: 0, type: 'Race', laps: 'unlimited', timeSeconds: RACE_DURATION_SEC }],
      drivers: roster,
      carClasses: CLASSES.filter((c) => classCounts.has(c.id))
        .map((c) => ({ id: c.id, name: c.name, color: c.color, relSpeed: c.relSpeed, carCount: classCounts.get(c.id)! }))
        .sort((a, b) => b.relSpeed - a.relSpeed),
      playerCarIdx: PLAYER_IDX,
      paceCarIdx: null,
      estLapTimeSec: LAP_TIME_BASE,
      playerCar: { idleRpm: 1200, redLineRpm: 7800, shiftLightShiftRpm: 7400, shiftLightBlinkRpm: 7700 },
    };
  }

  /** Gefahrene Runden als Kommazahl (2.37 = Runde 3, 37 Prozent). */
  private progressOf(car: MockCar, elapsedSec: number): number {
    return elapsedSec / car.lapTime - car.offset;
  }

  private buildTelemetryFrame(elapsedSec: number): TelemetryFrame {
    const progress = new Map(this.cars.map((car) => [car.idx, this.progressOf(car, elapsedSec)]));
    const order = [...this.cars].sort((a, b) => progress.get(b.idx)! - progress.get(a.idx)!);
    const positions = new Map(order.map((car, i) => [car.idx, i + 1]));

    const classPositions = new Map<number, number>();
    const seenPerClass = new Map<number, number>();
    const classLeaderIdx = new Map<number, number>();
    for (const car of order) {
      const seen = (seenPerClass.get(car.carClass.id) ?? 0) + 1;
      seenPerClass.set(car.carClass.id, seen);
      classPositions.set(car.idx, seen);
      if (seen === 1) classLeaderIdx.set(car.carClass.id, car.idx);
    }

    const drivers: Driver[] = this.cars.map((car) => {
      const p = progress.get(car.idx)!;
      const lapDistPct = p - Math.floor(p);
      const lap = Math.floor(p) + 1;
      // Direkt aus der kontinuierlichen Fortschrittsdifferenz, nicht ueber
      // die Umlaufkorrektur aus calc/gap.ts - die ist nur fuer Autos nahe
      // beieinander gedacht (Relative), hier kann der Fuehrende mehrere
      // Runden voraus sein. Bildet CarIdxF2Time nach, das im echten SDK
      // schon die korrekte Gesamtzeit liefert.
      const leaderIdx = classLeaderIdx.get(car.carClass.id)!;
      const gapToLeaderSec = leaderIdx === car.idx ? 0 : (progress.get(leaderIdx)! - p) * car.lapTime;
      return {
        carIdx: car.idx,
        isPlayer: car.idx === PLAYER_IDX,
        isPaceCar: false,
        isSpectator: false,
        isAI: car.idx !== PLAYER_IDX,
        userName: car.name,
        carNumber: car.number,
        carClassId: car.carClass.id,
        iRating: car.iRating,
        safetyRating: 'A 3.45',
        licenseColor: '#0153db',
        position: positions.get(car.idx) ?? null,
        classPosition: classPositions.get(car.idx) ?? null,
        lap,
        lapDistPct,
        estTimeSec: lapDistPct * car.lapTime,
        onPitRoad: false,
        trackSurface: 'on_track',
        lastLapSec: lap > 1 ? car.lapTime : null,
        bestLapSec: lap > 1 ? car.lapTime * 0.99 : null,
        gapToLeaderSec,
      };
    });

    const playerProgress = progress.get(PLAYER_IDX)!;
    // Wegen car.offset ist playerProgress kurz nach dem Start negativ. Ohne
    // die Untergrenze zaehlt das als Rundenwechsel 0->1 nach nur ~2s und
    // der FuelTracker haette eine erste "Runde" mit fast null Verbrauch im
    // Mittelwert - reines Artefakt des Demo-Setups, kein echtes Renngeschehen.
    const playerLap = Math.max(1, Math.floor(playerProgress) + 1);
    const lapPct = playerProgress - Math.floor(playerProgress);
    const phase = lapPct * Math.PI * 2;
    // Zwei ueberlagerte Sinuswellen ergeben ein Rundenprofil mit
    // Vollgas- und Bremszonen statt einer platten Geraden.
    const corner = (Math.sin(phase * 6) + Math.sin(phase * 2.5)) / 2;
    const throttle = Math.max(0, Math.min(1, 0.55 + 0.45 * corner));
    const brake = corner < -0.15 ? Math.max(0, Math.min(1, -corner * 0.9)) : 0;
    const speed = 30 + 65 * throttle * (1 - brake);

    const fuelLevelLiters = Math.max(0, 78 - playerProgress * 2.9);
    this.fuelTracker.update(playerLap, fuelLevelLiters, false);
    const usePerLapLiters = this.fuelTracker.averagePerLapLiters;
    const carLeftRight = this.simulateCarLeftRight(progress);

    return {
      seq: this.seq,
      sessionTimeSec: elapsedSec,
      sessionTimeRemainSec: Math.max(0, RACE_DURATION_SEC - elapsedSec),
      // Zeitbasiertes Rennen in diesem Demo-Setup - kein Rundenlimit.
      sessionLapsRemain: UNLIMITED_LAPS_SENTINEL,
      sessionState: 'racing',
      flags: ['green'],
      drivers,
      player: {
        carIdx: PLAYER_IDX,
        speedMs: speed,
        rpm: 1200 + 6600 * (0.3 + 0.7 * throttle),
        gear: Math.max(1, Math.min(6, Math.floor(speed / 13) + 1)),
        inputs: { throttle, brake, clutch: 0, steerRad: Math.sin(phase * 6) * 0.6 },
        fuel: {
          levelLiters: fuelLevelLiters,
          levelPct: fuelLevelLiters / 110,
          usePerHourLiters: 101,
          usePerLapLiters,
          lapsRemainingOnFuel: usePerLapLiters ? fuelLevelLiters / usePerLapLiters : null,
        },
        delta: {
          toBestLapSec: Math.sin(phase * 3) * 0.4,
          toOptimalLapSec: Math.sin(phase * 3) * 0.4 + 0.12,
          toSessionBestLapSec: 0.35 + Math.sin(phase * 3) * 0.4,
        },
        tires: {
          lf: { tempInnerC: 82, tempMiddleC: 79, tempOuterC: 75, wearPct: Math.max(0, 1 - playerProgress * 0.0035), coldPressureKpa: 165 },
          rf: { tempInnerC: 85, tempMiddleC: 82, tempOuterC: 78, wearPct: Math.max(0, 1 - playerProgress * 0.0035), coldPressureKpa: 165 },
          lr: { tempInnerC: 88, tempMiddleC: 85, tempOuterC: 81, wearPct: Math.max(0, 1 - playerProgress * 0.0035), coldPressureKpa: 165 },
          rr: { tempInnerC: 91, tempMiddleC: 88, tempOuterC: 84, wearPct: Math.max(0, 1 - playerProgress * 0.0035), coldPressureKpa: 165 },
        },
        carLeftRight,
      },
      weather: { airTempC: 24, trackTempC: 34.5, humidityPct: 0.45, trackWetness: 'dry' },
    };
  }

  /**
   * Nur fuer die Demo: laengsseitige Naehe (aus dem ohnehin vorhandenen
   * Fortschritts-Fenster) als grobe Annaeherung an "irgendwer koennte gerade
   * daneben sein". Im echten Connector kommt CarLeftRight direkt vom SDK -
   * dort wird nichts geschaetzt (siehe types.ts, CarLeftRight-Kommentar).
   */
  private simulateCarLeftRight(progress: Map<number, number>): CarLeftRight {
    const playerProgress = progress.get(PLAYER_IDX)!;
    let nearestAheadSec = Infinity;
    let nearestBehindSec = Infinity;

    for (const car of this.cars) {
      if (car.idx === PLAYER_IDX) continue;
      const diffSec = (progress.get(car.idx)! - playerProgress) * car.lapTime;
      if (diffSec > 0) nearestAheadSec = Math.min(nearestAheadSec, diffSec);
      else nearestBehindSec = Math.min(nearestBehindSec, -diffSec);
    }

    const right = nearestAheadSec < 1;
    const left = nearestBehindSec < 1;
    if (left && right) return 'cars_left_right';
    if (left) return 'car_left';
    if (right) return 'car_right';
    return 'clear';
  }
}
