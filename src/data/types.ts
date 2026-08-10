/**
 * Normalisiertes Datenmodell. Alle Overlays konsumieren nur das hier - nie
 * die rohen `irsdk-node`-Rueckgabewerte.
 *
 * Feldnamen wie `CarIdxEstTime` oder `CarClassColor` sind gegen die
 * generierten Typen in `@irsdk-node/types` geprueft (nicht geraten).
 */

export type TrackLocation = 'not_in_world' | 'off_track' | 'in_pit_stall' | 'approaching_pits' | 'on_track';

export interface CarClass {
  id: number;
  name: string;
  color: string; // css-hex
  relSpeed: number; // Sortierschluessel fuer Multiclass
  carCount: number;
}

export interface Driver {
  carIdx: number;
  isPlayer: boolean;
  isPaceCar: boolean;
  isSpectator: boolean;
  isAI: boolean;

  userName: string;
  carNumber: string;
  carClassId: number | null;

  iRating: number | null;
  // Format z.B. "A 3.45" - UNSICHER: noch nicht gegen echte Lizenzstufen
  // < A (Rookie/D/C/B) geprueft, ob das Format durchgehend gleich ist.
  safetyRating: string | null;
  licenseColor: string | null;

  position: number | null;
  classPosition: number | null;
  lap: number;
  lapDistPct: number; // 0..1
  /**
   * Sekunden, die dieses Auto fuer seine aktuelle Position auf der Runde
   * gebraucht hat (`CarIdxEstTime`) - keine Rundenzeit. Praeziser als
   * `lapDistPct * Rundenzeit`, weil Brems-/Beschleunigungszonen eingehen.
   * `null`, wenn das SDK nichts liefert; Verbraucher fallen dann auf
   * `lapDistPct` zurueck, siehe calc/relative.ts.
   */
  estTimeSec: number | null;
  onPitRoad: boolean;
  trackSurface: TrackLocation;

  lastLapSec: number | null;
  bestLapSec: number | null;
  /**
   * `CarIdxF2Time` - laut SDK-Doku "race time behind leader or fastest lap
   * time otherwise". UNSICHER: was genau "otherwise" bedeutet (ausserhalb
   * eines laufenden Rennens, z.B. Qualifying) ist nicht verifiziert -
   * fuer Standings nur im Rennen verwenden, bis das an echten Daten
   * geprueft ist.
   */
  gapToLeaderSec: number | null;
}

export interface TrackInfo {
  id: number;
  name: string;
  config: string | null;
  lengthMeters: number;
  pitSpeedLimitKph: number | null;
}

export interface SessionSegment {
  num: number;
  // UNSICHER: vollstaendige Werteliste noch nicht gegen ein echtes
  // Multi-Session-Event (Practice/Quali/Race in Folge) geprueft.
  type: string;
  laps: number | 'unlimited';
  timeSeconds: number | null;
}

/**
 * Statischer Teil eines Fahrers aus der Session-YAML - ohne die Live-Felder,
 * die nur die Telemetrie liefert (Position, Runde, Boxenstatus, ...).
 * Der Connector fuehrt das pro Tick mit den `CarIdx*`-Telemetriearrays zu
 * einem vollstaendigen {@link Driver} zusammen.
 */
export interface DriverRosterEntry {
  carIdx: number;
  isPaceCar: boolean;
  isSpectator: boolean;
  isAI: boolean;
  userName: string;
  carNumber: string;
  carClassId: number | null;
  iRating: number | null;
  safetyRating: string | null;
  licenseColor: string | null;
}

export interface SessionState {
  updateId: number;
  track: TrackInfo;
  sessions: SessionSegment[];
  drivers: DriverRosterEntry[];
  carClasses: CarClass[];
  playerCarIdx: number;
  paceCarIdx: number | null;
  /** `DriverCarEstLapTime` - Basis fuer die Relative-Gap-Berechnung. */
  estLapTimeSec: number;
}

export interface FuelState {
  levelLiters: number;
  levelPct: number;
  usePerHourLiters: number;
  /** Verbrauch der letzten abgeschlossenen Runden im Schnitt (bis zu 10). `null` bis genug Runden vorliegen. */
  usePerLapLiters: number | null;
  /** Restrunden bei aktuellem Tempo und Tankstand. `null` ohne Verbrauchsdaten. */
  lapsRemainingOnFuel: number | null;
}

export interface DeltaState {
  toBestLapSec: number | null;
  toOptimalLapSec: number | null;
  toSessionBestLapSec: number | null;
}

export interface TireState {
  tempInnerC: number;
  tempMiddleC: number;
  tempOuterC: number;
  wearPct: number;
  coldPressureKpa: number;
}

export interface PlayerState {
  carIdx: number;
  speedMs: number;
  rpm: number;
  gear: number;
  inputs: { throttle: number; brake: number; clutch: number; steerRad: number };
  fuel: FuelState;
  delta: DeltaState;
  tires: Record<'lf' | 'rf' | 'lr' | 'rr', TireState>;
}

export interface WeatherState {
  airTempC: number;
  trackTempC: number;
  humidityPct: number;
  // UNSICHER: Enum-Werte nur fuer Rain-faehige Inhalte belastbar, sonst
  // praktisch immer "dry".
  trackWetness: string;
}

export type SdkSessionState =
  | 'invalid'
  | 'get_in_car'
  | 'warmup'
  | 'parade_laps'
  | 'racing'
  | 'checkered'
  | 'cool_down';

export interface TelemetryFrame {
  seq: number;
  sessionTimeSec: number;
  /** `SessionTimeRemain`. `null` bei rundenbasierten Sessions ohne Zeitlimit. */
  sessionTimeRemainSec: number | null;
  /** `SessionLapsRemainEx` - loest die aeltere, jetzt veraltete `SessionLapsRemain` ab. `null` bei zeitbasierten Sessions. */
  sessionLapsRemain: number | null;
  sessionState: SdkSessionState;
  flags: string[];
  drivers: Driver[]; // vollstaendig, inkl. Live-Felder
  player: PlayerState;
  weather: WeatherState;
}

/** Was die Bridge tatsaechlich ueber WebSocket verschickt. */
export type BridgeMessage =
  | { type: 'connection'; connected: boolean }
  | ({ type: 'session' } & SessionState)
  | ({ type: 'telemetry' } & TelemetryFrame);
