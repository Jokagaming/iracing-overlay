/**
 * Uebersetzt die numerischen Enums aus `@irsdk-node/types` in die
 * lesbaren String-Werte des normalisierten Modells.
 *
 * Die Enum-Werte selbst (z.B. `GlobalFlags.Green = 4`) sind von
 * `@irsdk-node/types` generiert, nicht von Hand abgetippt - siehe
 * node_modules/@irsdk-node/types/dist/types/defines.d.ts.
 */

import {
  CarLeftRight as SdkCarLeftRight,
  GlobalFlags,
  SessionState as SdkSessionStateEnum,
  TrackLocation as SdkTrackLocation,
  TrackWetness as SdkTrackWetness,
} from '@irsdk-node/types';
import type { CarLeftRight, SdkSessionState, TrackLocation, TrackWetness } from '../types.js';

const FLAG_BITS: Array<[string, number]> = Object.entries(GlobalFlags)
  .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
  .sort((a, b) => a[1] - b[1]);

/** "CautionWaving" -> "caution_waving", passend zum Rest des JSON-Protokolls. */
function toSnakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/** Aktive Streckenflaggen. iRacing setzt mehrere Bits gleichzeitig. */
export function decodeFlags(value: number | null | undefined): string[] {
  if (!value) return [];
  return FLAG_BITS.filter(([, bit]) => (value & bit) !== 0).map(([name]) => toSnakeCase(name));
}

const TRACK_LOCATION: Record<number, TrackLocation> = {
  [SdkTrackLocation.NotInWorld]: 'not_in_world',
  [SdkTrackLocation.OffTrack]: 'off_track',
  [SdkTrackLocation.InPitStall]: 'in_pit_stall',
  [SdkTrackLocation.ApproachingPits]: 'approaching_pits',
  [SdkTrackLocation.OnTrack]: 'on_track',
};

/** Wo sich ein Auto befindet: Strecke, Boxengasse, Box, ausserhalb der Welt. */
export function decodeTrackLocation(value: number | null | undefined): TrackLocation {
  if (value == null) return 'not_in_world';
  return TRACK_LOCATION[value] ?? 'not_in_world';
}

const SESSION_STATE: Record<number, SdkSessionState> = {
  [SdkSessionStateEnum.Invalid]: 'invalid',
  [SdkSessionStateEnum.GetInCar]: 'get_in_car',
  [SdkSessionStateEnum.Warmup]: 'warmup',
  [SdkSessionStateEnum.ParadeLaps]: 'parade_laps',
  [SdkSessionStateEnum.Racing]: 'racing',
  [SdkSessionStateEnum.Checkered]: 'checkered',
  [SdkSessionStateEnum.CoolDown]: 'cool_down',
};

/** Phase der Session: Warmup, Paradenrunden, Rennen, abgewinkt. */
export function decodeSessionState(value: number | null | undefined): SdkSessionState {
  if (value == null) return 'invalid';
  return SESSION_STATE[value] ?? 'invalid';
}

/**
 * Macht aus den Farbwerten der Session-YAML etwas, das CSS direkt versteht.
 * `CarClassColor` kommt als Dezimalzahl (0xRRGGBB) aus dem SDK.
 */
export function toCssColor(value: number | null | undefined): string | null {
  if (value == null) return null;
  return `#${(value & 0xffffff).toString(16).padStart(6, '0')}`;
}

const CAR_LEFT_RIGHT: Record<number, CarLeftRight> = {
  [SdkCarLeftRight.Off]: 'off',
  [SdkCarLeftRight.Clear]: 'clear',
  [SdkCarLeftRight.CarLeft]: 'car_left',
  [SdkCarLeftRight.CarRight]: 'car_right',
  [SdkCarLeftRight.CarLeftRight]: 'cars_left_right',
  [SdkCarLeftRight.Cars2Left]: 'cars_2_left',
  [SdkCarLeftRight.Cars2Right]: 'cars_2_right',
};

/** Direktes SDK-Signal fuer Autos neben dem Spieler - siehe types.ts, CarLeftRight. */
export function decodeCarLeftRight(value: number | null | undefined): CarLeftRight {
  if (value == null) return 'off';
  return CAR_LEFT_RIGHT[value] ?? 'off';
}

const TRACK_WETNESS: Record<number, TrackWetness> = {
  [SdkTrackWetness.UNKNOWN]: 'unknown',
  [SdkTrackWetness.Dry]: 'dry',
  [SdkTrackWetness.MostlyDry]: 'mostly_dry',
  [SdkTrackWetness.VeryLightlyWet]: 'very_lightly_wet',
  [SdkTrackWetness.LightlyWet]: 'lightly_wet',
  [SdkTrackWetness.ModeratelyWet]: 'moderately_wet',
  [SdkTrackWetness.VeryWet]: 'very_wet',
  [SdkTrackWetness.ExtremelyWet]: 'extremely_wet',
};

/**
 * Nasszustand der Strecke. UNSICHER: nur fuer Rain-faehige Inhalte
 * belastbar, sonst praktisch immer "dry" (siehe types.ts).
 */
export function decodeTrackWetness(value: number | null | undefined): TrackWetness {
  if (value == null) return 'unknown';
  return TRACK_WETNESS[value] ?? 'unknown';
}
