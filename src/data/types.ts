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
  /**
   * `CarScreenNameShort` - das SDK liefert keine eigene Marke/Hersteller-
   * Feld, das ist die naechstliegende verfuegbare Kurzbezeichnung des
   * Fahrzeugs (z.B. "MX-5 Cup", "Mustang GT3").
   */
  carName: string;

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
  /**
   * `CarIdxTireCompound` - fuer jedes Auto sichtbar (anders als Verschleiss/
   * Temperatur/Druck, die das SDK nur fuers eigene Auto liefert, siehe
   * PlayerState.tires). Nur eine rohe Mischungs-Nummer, das SDK liefert
   * keine Klartext-Zuordnung (z.B. "Weich"/"Hart") dazu - in Serien mit nur
   * einer Mischung ist der Wert fuer alle gleich. `null` ohne Wert vom SDK.
   */
  tireCompound: number | null;
  /**
   * Sektorzeiten dieses Autos in dieser Session - wie
   * `PlayerState.sectorTimes`, aber fuer jedes Auto berechnet (siehe
   * calc/sectors.ts, `MultiCarSectorTracker`). Ermoeglicht den
   * Sektor-Vergleich gegen Vorder-/Hintermann im Relative-Overlay.
   */
  sectorTimes: SectorResult[];
  /**
   * Position auf der Track-Map, siehe calc/trackPosition.ts. Fuer fremde
   * Autos per Interpolation auf der vom Spieler aufgezeichneten
   * Referenz-Polylinie bestimmt (das SDK liefert VelocityX/Y/YawNorth nur
   * fuers eigene Auto) - `null`, solange diese Polylinie noch nicht
   * einmal komplett vorliegt (erste Runde).
   */
  trackPosition: TrackPosition | null;
  /**
   * Boxenstopps und Stint-Laenge dieses Autos in dieser Session - das SDK
   * liefert keinen fertigen Zaehler, nur den aktuellen `onPitRoad`-Status
   * je Tick, siehe calc/pitStops.ts.
   */
  pitStopCount: number;
  stintLaps: number;
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
  carName: string;
  iRating: number | null;
  safetyRating: string | null;
  licenseColor: string | null;
}

export interface PlayerCarInfo {
  idleRpm: number;
  redLineRpm: number;
  /** `DriverCarSLShiftRPM` - ab hier faerbt sich das Schaltlicht gelb. */
  shiftLightShiftRpm: number;
  /** `DriverCarSLBlinkRPM` - ab hier blinkt/rot, jetzt schalten. */
  shiftLightBlinkRpm: number;
}

/** `SplitTimeInfo.Sectors` - Grenzen der Sektoren, keine Zeiten (die liefert das SDK nicht direkt, siehe calc/sectors.ts). */
export interface SectorBoundary {
  num: number;
  /** 0..1, Anteil der Rundendistanz, an dem dieser Sektor beginnt. */
  startPct: number;
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
  playerCar: PlayerCarInfo;
  /** Leer, wenn die Strecke keine Sektoren definiert (z.B. manche Ovale/Testtracks). */
  sectors: SectorBoundary[];
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
  /** 1 = neu, 0 = komplett abgefahren (SDK-Konvention: verbleibende Lauffläche, kein Verschleissbetrag). */
  wearPct: number;
  coldPressureKpa: number;
}

/** Zeit fuer einen einzelnen Sektor in dieser Session, siehe calc/sectors.ts. */
export interface SectorResult {
  num: number;
  /** Letzte gemessene Zeit fuer diesen Sektor. `null`, solange er noch nicht einmal durchfahren wurde. */
  lastSec: number | null;
  /** Schnellste gemessene Zeit fuer diesen Sektor in dieser Session. */
  bestSec: number | null;
  /** `lastSec` ist zugleich die schnellste Messung - fuer die gruene Faerbung im Sektor-Overlay. */
  isPersonalBest: boolean;
}

/**
 * Wie {@link SectorResult}, aber nur fuers eigene Auto: zusaetzlich die
 * Feld-Bestzeit (schnellste Zeit aller Fahrer der eigenen Fahrzeugklasse in
 * dieser Session), siehe `MultiCarSectorTracker.fieldBestByNum()` in
 * calc/sectors.ts. Fuer andere Autos (Driver.sectorTimes) nicht berechnet -
 * das wuerde pro Tick und Auto denselben Feld-Vergleich wiederholen, ohne
 * dass ein Overlay das je anzeigt.
 */
export interface PlayerSectorResult extends SectorResult {
  /** `null` ohne Vergleichswert (z.B. Solo-Session ohne weitere Autos derselben Klasse). */
  fieldBestSec: number | null;
}

/**
 * Punkt auf der per Dead-Reckoning rekonstruierten Track-Map, siehe
 * calc/trackPosition.ts. Beliebige, in sich konsistente Einheit (Meter ab
 * einem willkuerlichen Ursprung an der Start-/Ziellinie) - keine echten
 * Weltkoordinaten. Ohne GPS-Referenz vom SDK ist nicht verifizierbar, ob
 * "oben" auf einer gerenderten Karte Norden oder Sueden entspricht bzw. ob
 * die Karte spiegelverkehrt ist (siehe README) - die *Form* der Strecke
 * und die Positionen der Autos zueinander stimmen trotzdem.
 */
export interface TrackPosition {
  x: number;
  y: number;
}

/**
 * `CarLeftRight` - direkt vom SDK berechnetes Naehe-Signal, kein
 * per-Auto-Array. Das ist die einzige vom SDK selbst gelieferte
 * Seitenposition-Information; es gibt keine Telemetrie, aus der sich die
 * tatsaechliche Spur eines fremden Autos neben einem herleiten liesse -
 * der Radar (siehe renderer/radar/) baut deshalb bewusst NICHT auf
 * geschaetzten Seitenpositionen anderer Autos auf, sondern kombiniert
 * dieses Feld mit dem laengsseitigen Abstand aus calc/relative.ts.
 */
export type CarLeftRight =
  | 'off'
  | 'clear'
  | 'car_left'
  | 'car_right'
  | 'cars_left_right'
  | 'cars_2_left'
  | 'cars_2_right';

export interface PlayerState {
  carIdx: number;
  speedMs: number;
  rpm: number;
  gear: number;
  inputs: { throttle: number; brake: number; clutch: number; steerRad: number };
  fuel: FuelState;
  delta: DeltaState;
  tires: Record<'lf' | 'rf' | 'lr' | 'rr', TireState>;
  carLeftRight: CarLeftRight;
  /**
   * Die letzten abgeschlossenen Rundenzeiten des Spielers, chronologisch
   * (aelteste zuerst), bis zu 5 Stueck - siehe calc/laptimes.ts. Wie
   * `fuel.usePerLapLiters` erst nach `buildTelemetryFrame()` befuellt, weil
   * das Zustand ueber mehrere Ticks braucht.
   */
  lastLapTimesSec: number[];
  /** Ein Eintrag pro Sektor aus `SessionState.sectors`, gleiche Reihenfolge. `[]` ohne definierte Sektoren. */
  sectorTimes: PlayerSectorResult[];
  /** Der gerade laufende Sektor - `null` ohne definierte Sektoren. */
  currentSector: { num: number; elapsedSec: number } | null;
  /**
   * `VelocityX`/`VelocityY` - fahrzeugbezogen (X=vorwaerts, Y=seitlich),
   * nicht weltbezogen. Gegen echte Fahrdaten verifiziert (siehe README):
   * bei einer ~160°-Kursaenderung blieb X klar dominant und Y klein, was
   * bei Weltkoordinaten nicht der Fall waere. Einheit m/s. Rohdaten fuer
   * calc/trackPosition.ts - fuer die meisten Overlays uninteressant.
   */
  velocityXMs: number;
  velocityYMs: number;
  /** `YawNorth` in rad - Kompass-Kurs, Basis fuer die Weltkoordinaten-Rotation in calc/trackPosition.ts. */
  yawNorthRad: number;
  /** Position auf der Track-Map, siehe calc/trackPosition.ts. `null` bevor die erste Runde vollstaendig aufgezeichnet ist. */
  trackPosition: TrackPosition | null;
}

// UNSICHER: Enum-Werte nur fuer Rain-faehige Inhalte belastbar, sonst
// praktisch immer "dry".
export type TrackWetness =
  | 'unknown'
  | 'dry'
  | 'mostly_dry'
  | 'very_lightly_wet'
  | 'lightly_wet'
  | 'moderately_wet'
  | 'very_wet'
  | 'extremely_wet';

export interface WeatherState {
  airTempC: number;
  trackTempC: number;
  humidityPct: number;
  trackWetness: TrackWetness;
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
  | ({ type: 'telemetry' } & TelemetryFrame)
  | { type: 'trackmap'; points: TrackPosition[] };
