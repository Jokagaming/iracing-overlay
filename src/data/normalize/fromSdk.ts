/**
 * Baut aus den rohen `irsdk-node`-Rueckgaben das normalisierte Modell.
 *
 * Feldnamen sind gegen die generierten Typen in `@irsdk-node/types`
 * geprueft (node_modules/@irsdk-node/types/dist/types/*.d.ts), nicht
 * geraten. Trotzdem als "UNSICHER" markiert bleibt alles, was sich nur
 * gegen eine echte, laufende Session verifizieren laesst - siehe die
 * Kommentare in ../types.ts.
 */

import type { IRacingSDK } from 'irsdk-node';
import type { TelemetryVariable, TelemetryVarList } from '@irsdk-node/types';
import type {
  CarClass,
  Driver,
  DriverRosterEntry,
  PlayerCarInfo,
  PlayerState,
  SectorBoundary,
  SessionSegment,
  SessionState,
  TelemetryFrame,
  TrackInfo,
  WeatherState,
} from '../types.js';
import { decodeCarLeftRight, decodeFlags, decodeSessionState, decodeTrackLocation, decodeTrackWetness, toCssColor } from './enums.js';

// --- Hilfsfunktionen zum Auspacken von TelemetryVariable -------------------

type AnyTelemetryVariable = TelemetryVariable<number[]> | TelemetryVariable<boolean[]> | undefined | null;

function scalarNum(v: AnyTelemetryVariable): number {
  const raw = v?.value?.[0];
  return typeof raw === 'number' ? raw : 0;
}

function arrNum(v: TelemetryVariable<number[]> | undefined | null): number[] {
  return v?.value ?? [];
}

function arrBool(v: TelemetryVariable<boolean[]> | undefined | null): boolean[] {
  return v?.value ?? [];
}

/** Zieht die Zahl aus YAML-Werten wie `"3.70 km"`. */
function numberFromYaml(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const match = /-?\d+(?:\.\d+)?/.exec(value);
  return match ? Number(match[0]) : null;
}

// --- Session (nur bei geaenderter Versionsnummer neu gebaut) --------------

function buildTrack(sdk: IRacingSDK): TrackInfo {
  const weekend = sdk.getWeekendInfo();
  const lengthKm = numberFromYaml(weekend?.TrackLength ?? null);
  return {
    id: weekend?.TrackID ?? 0,
    name: weekend?.TrackDisplayName ?? '',
    config: weekend?.TrackConfigName ?? null,
    lengthMeters: lengthKm != null ? lengthKm * 1000 : 0,
    pitSpeedLimitKph: numberFromYaml(weekend?.TrackPitSpeedLimit ?? null),
  };
}

function buildSessions(sdk: IRacingSDK): SessionSegment[] {
  const list = sdk.getSessionInfo()?.Sessions ?? [];
  return list.map((s) => ({
    num: s.SessionNum,
    type: s.SessionType,
    laps: s.SessionLaps === 'unlimited' ? 'unlimited' : (Number(s.SessionLaps) ?? 0),
    timeSeconds: numberFromYaml(s.SessionTime),
  }));
}

function buildRoster(sdk: IRacingSDK): DriverRosterEntry[] {
  const drivers = sdk.getDriverInfo()?.Drivers ?? [];
  return drivers.map((d) => ({
    carIdx: d.CarIdx,
    isPaceCar: Boolean(d.CarIsPaceCar),
    isSpectator: Boolean(d.IsSpectator),
    isAI: Boolean(d.CarIsAI),
    userName: d.UserName,
    carNumber: d.CarNumber,
    carClassId: d.CarClassID ?? null,
    carName: d.CarScreenNameShort || d.CarScreenName || '',
    iRating: d.IRating ?? null,
    safetyRating: d.LicString ?? null,
    licenseColor: toCssColor(d.LicColor),
  }));
}

function buildCarClasses(sdk: IRacingSDK, roster: DriverRosterEntry[]): CarClass[] {
  const drivers = sdk.getDriverInfo()?.Drivers ?? [];
  const byClassId = new Map(drivers.map((d) => [d.CarClassID, d]));

  const classes = new Map<number, CarClass>();
  for (const driver of roster) {
    if (driver.carClassId == null || driver.isPaceCar) continue;
    const raw = byClassId.get(driver.carClassId);
    const existing = classes.get(driver.carClassId);
    if (existing) {
      existing.carCount += 1;
      continue;
    }
    classes.set(driver.carClassId, {
      id: driver.carClassId,
      name: raw?.CarClassShortName ?? '',
      color: toCssColor(raw?.CarClassColor) ?? '#808080',
      relSpeed: raw?.CarClassRelSpeed ?? 0,
      carCount: 1,
    });
  }

  return [...classes.values()].sort((a, b) => b.relSpeed - a.relSpeed);
}

/** `SplitTimeInfo.Sectors` - nur Grenzen, keine Zeiten (siehe calc/sectors.ts). Sortiert nach `startPct`, falls das SDK sie nicht schon sortiert liefert. */
function buildSectors(sdk: IRacingSDK): SectorBoundary[] {
  const sectors = sdk.getSplitInfo()?.Sectors ?? [];
  return sectors.map((s) => ({ num: s.SectorNum, startPct: s.SectorStartPct })).sort((a, b) => a.startPct - b.startPct);
}

function buildPlayerCar(driverInfo: ReturnType<IRacingSDK['getDriverInfo']>): PlayerCarInfo {
  return {
    idleRpm: driverInfo?.DriverCarIdleRPM ?? 0,
    redLineRpm: driverInfo?.DriverCarRedLine ?? 0,
    shiftLightShiftRpm: driverInfo?.DriverCarSLShiftRPM ?? 0,
    shiftLightBlinkRpm: driverInfo?.DriverCarSLBlinkRPM ?? 0,
  };
}

export function buildSessionState(sdk: IRacingSDK, updateId: number): SessionState {
  const driverInfo = sdk.getDriverInfo();
  const roster = buildRoster(sdk);

  return {
    updateId,
    track: buildTrack(sdk),
    sessions: buildSessions(sdk),
    drivers: roster,
    carClasses: buildCarClasses(sdk, roster),
    playerCarIdx: driverInfo?.DriverCarIdx ?? -1,
    paceCarIdx: driverInfo?.PaceCarIdx ?? null,
    estLapTimeSec: driverInfo?.DriverCarEstLapTime || 90,
    playerCar: buildPlayerCar(driverInfo),
    sectors: buildSectors(sdk),
  };
}

// --- Telemetrie (jeder Tick) ------------------------------------------------

/** Ecken so benannt, wie das SDK sie praefixt. */
const CORNERS = { lf: 'LF', rf: 'RF', lr: 'LR', rr: 'RR' } as const;

function buildTires(t: TelemetryVarList): PlayerState['tires'] {
  const tires = {} as PlayerState['tires'];
  for (const [key, prefix] of Object.entries(CORNERS) as Array<[keyof PlayerState['tires'], string]>) {
    tires[key] = {
      tempInnerC: scalarNum(t[`${prefix}tempCL` as keyof TelemetryVarList]),
      tempMiddleC: scalarNum(t[`${prefix}tempCM` as keyof TelemetryVarList]),
      tempOuterC: scalarNum(t[`${prefix}tempCR` as keyof TelemetryVarList]),
      wearPct:
        (scalarNum(t[`${prefix}wearL` as keyof TelemetryVarList]) +
          scalarNum(t[`${prefix}wearM` as keyof TelemetryVarList]) +
          scalarNum(t[`${prefix}wearR` as keyof TelemetryVarList])) /
        3,
      coldPressureKpa: scalarNum(t[`${prefix}coldPressure` as keyof TelemetryVarList]),
    };
  }
  return tires;
}

function buildPlayer(t: TelemetryVarList, playerCarIdx: number): PlayerState {
  return {
    carIdx: playerCarIdx,
    speedMs: scalarNum(t.Speed),
    rpm: scalarNum(t.RPM),
    gear: scalarNum(t.Gear),
    inputs: {
      throttle: scalarNum(t.Throttle),
      brake: scalarNum(t.Brake),
      clutch: scalarNum(t.Clutch),
      steerRad: scalarNum(t.SteeringWheelAngle),
    },
    fuel: {
      levelLiters: scalarNum(t.FuelLevel),
      levelPct: scalarNum(t.FuelLevelPct),
      usePerHourLiters: scalarNum(t.FuelUsePerHour),
      // Wird vom Connector nach dem Aufruf hier befuellt - der Verbrauch
      // pro Runde braucht Zustand ueber mehrere Ticks hinweg (siehe
      // calc/fuel.ts), das gehoert nicht in diese sonst zustandslose
      // Mapping-Funktion.
      usePerLapLiters: null,
      lapsRemainingOnFuel: null,
    },
    delta: {
      toBestLapSec: scalarNum(t.LapDeltaToBestLap) || null,
      toOptimalLapSec: scalarNum(t.LapDeltaToOptimalLap) || null,
      toSessionBestLapSec: scalarNum(t.LapDeltaToSessionBestLap) || null,
    },
    tires: buildTires(t),
    carLeftRight: decodeCarLeftRight(scalarNum(t.CarLeftRight)),
    // Wird vom Connector nach dem Aufruf hier befuellt - siehe fuel oben,
    // calc/laptimes.ts und calc/sectors.ts, braucht Zustand ueber mehrere Ticks.
    lastLapTimesSec: [],
    sectorTimes: [],
    currentSector: null,
  };
}

function buildWeather(t: TelemetryVarList): WeatherState {
  return {
    airTempC: scalarNum(t.AirTemp),
    trackTempC: scalarNum(t.TrackTempCrew),
    humidityPct: scalarNum(t.RelativeHumidity),
    trackWetness: decodeTrackWetness(scalarNum(t.TrackWetness)),
  };
}

function buildDrivers(t: TelemetryVarList, roster: DriverRosterEntry[], playerCarIdx: number): Driver[] {
  const position = arrNum(t.CarIdxPosition);
  const classPosition = arrNum(t.CarIdxClassPosition);
  const lap = arrNum(t.CarIdxLap);
  const lapDistPct = arrNum(t.CarIdxLapDistPct);
  const estTime = arrNum(t.CarIdxEstTime);
  const onPitRoad = arrBool(t.CarIdxOnPitRoad);
  const trackSurface = arrNum(t.CarIdxTrackSurface);
  const lastLap = arrNum(t.CarIdxLastLapTime);
  const bestLap = arrNum(t.CarIdxBestLapTime);
  const gapToLeader = arrNum(t.CarIdxF2Time);
  const tireCompound = arrNum(t.CarIdxTireCompound);

  return roster
    .filter((entry) => !entry.isSpectator)
    .map((entry) => {
      const i = entry.carIdx;
      return {
        ...entry,
        isPlayer: i === playerCarIdx,
        position: position[i] || null,
        classPosition: classPosition[i] || null,
        lap: lap[i] ?? 0,
        lapDistPct: lapDistPct[i] ?? 0,
        estTimeSec: estTime[i] > 0 ? estTime[i]! : null,
        onPitRoad: Boolean(onPitRoad[i]),
        trackSurface: decodeTrackLocation(trackSurface[i]),
        lastLapSec: lastLap[i] > 0 ? lastLap[i]! : null,
        bestLapSec: bestLap[i] > 0 ? bestLap[i]! : null,
        gapToLeaderSec: gapToLeader[i] ?? null,
        tireCompound: tireCompound[i] != null && tireCompound[i]! >= 0 ? tireCompound[i]! : null,
        // Wird vom Connector nach dem Aufruf hier befuellt - siehe
        // calc/sectors.ts, braucht Zustand ueber mehrere Ticks und alle Autos.
        sectorTimes: [],
      };
    });
}

export function buildTelemetryFrame(
  sdk: IRacingSDK,
  seq: number,
  roster: DriverRosterEntry[],
  playerCarIdx: number,
): TelemetryFrame {
  const t = sdk.getTelemetry();
  return {
    seq,
    sessionTimeSec: scalarNum(t.SessionTime),
    sessionTimeRemainSec: scalarNum(t.SessionTimeRemain) || null,
    sessionLapsRemain: scalarNum(t.SessionLapsRemainEx) || null,
    sessionState: decodeSessionState(scalarNum(t.SessionState)),
    flags: decodeFlags(scalarNum(t.SessionFlags)),
    drivers: buildDrivers(t, roster, playerCarIdx),
    player: buildPlayer(t, playerCarIdx),
    weather: buildWeather(t),
  };
}
