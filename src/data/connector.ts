/**
 * Verbindet sich mit der laufenden iRacing-Instanz und liefert normalisierte
 * Nachrichten.
 *
 * Das Beispiel in der irsdk-node-README ruft sich fuer den naechsten Tick
 * selbst rekursiv auf (`loop(sdk)` am Ende von `loop()`). Bei einer
 * mehrstuendigen Session bei 60 Hz waeren das Millionen verschachtelte
 * Aufrufe - V8 optimiert das nicht automatisch weg. Hier gibt es dagegen
 * gar keine Rekursion: `poll()` wird von der Bridge in einer normalen
 * `while`-Schleife aufgerufen, dieses Modul haelt nur Verbindungszustand.
 */

import { IRacingSDK } from 'irsdk-node';
import type { BridgeMessage, DriverRosterEntry } from './types.js';
import { buildSessionState, buildTelemetryFrame } from './normalize/fromSdk.js';
import { FuelTracker } from './calc/fuel.js';
import { LapTimeTracker } from './calc/laptimes.js';
import { MultiCarSectorTracker } from './calc/sectors.js';
import { TrackPositionTracker } from './calc/trackPosition.js';
import { MultiCarPitTracker } from './calc/pitStops.js';

const POLL_TIMEOUT_MS = Math.floor((1 / 60) * 1000); // ~16ms, siehe irsdk-node README
const RECONNECT_DELAY_MS = 1000;

/**
 * Wie viele aufeinanderfolgende `waitForData()`-Fehlschlaege toleriert
 * werden, bevor die Verbindung wirklich als getrennt gilt.
 *
 * Gegen ein echtes, laufendes iRacing verifiziert: direkt nach `startSDK()`
 * schlaegt der ERSTE `waitForData(16ms)`-Aufruf zuverlaessig fehl (die
 * Verbindung braucht minimal laenger als ein einzelnes 16ms-Fenster, um
 * tatsaechlich Daten zu liefern - vermutlich der interne Aufbau der
 * Shared-Memory-Zuordnung). Mit Schwellenwert 1 (der urspruengliche Code)
 * wurde deshalb JEDE Verbindung sofort wieder abgebaut, bevor je ein
 * einziger Frame ankam - die App zeigte dauerhaft "Warte auf iRacing",
 * obwohl der Sim laengst lief. 60 Fehlschlaege in Folge sind bei ~16ms
 * Timeout pro Versuch rund eine Sekunde Toleranz - genug fuer den
 * Verbindungsaufbau, aber immer noch schnell genug, um ein echtes
 * Sim-Ende zeitnah zu erkennen.
 */
const MAX_CONSECUTIVE_MISSES = 60;

/** Gemeinsame Schnittstelle von Live-Verbindung und Mock-/Replay-Quelle. */
export interface DataSource {
  readonly lastSessionMessage: BridgeMessage | null;
  /** Wie lastSessionMessage, aber fuer die Track-Map-Referenz-Polylinie - siehe calc/trackPosition.ts. `null`, solange keine Runde komplett aufgezeichnet ist. */
  readonly lastTrackMapMessage: BridgeMessage | null;
  poll(): Promise<BridgeMessage[]>;
  close(): void;
}

export class IRacingConnector implements DataSource {
  private sdk: IRacingSDK | null = null;
  private seq = 0;
  private roster: DriverRosterEntry[] = [];
  private playerCarIdx = -1;
  private lastSessionVersion = -1;
  private sessionMessage: BridgeMessage | null = null;
  private connected = false;
  private lastConnectAttempt = 0;
  private consecutiveMisses = 0;
  private fuelTracker = new FuelTracker();
  private lapTimeTracker = new LapTimeTracker();
  private sectorTracker = new MultiCarSectorTracker();
  private trackTracker = new TrackPositionTracker();
  private trackMapMessage: BridgeMessage | null = null;
  private pitTracker = new MultiCarPitTracker();

  get lastSessionMessage(): BridgeMessage | null {
    return this.sessionMessage;
  }

  get lastTrackMapMessage(): BridgeMessage | null {
    return this.trackMapMessage;
  }

  close(): void {
    this.sdk?.stopSDK();
    this.sdk = null;
  }

  async poll(): Promise<BridgeMessage[]> {
    try {
      return await this.pollOnce();
    } catch (err) {
      // Ohne diesen Fang wuerde z.B. ein fehlgeschlagenes dlopen der
      // nativen @irsdk-node/native-Bindung (etwa weil sie im gepackten
      // Build nicht aus dem asar-Archiv entpackt wurde) bei jedem Tick
      // erneut als unhandled rejection verpuffen - keine Fehlermeldung im
      // Log, iRacing wird einfach nie erkannt. Hier stattdessen einmalig
      // laut werden und wie bei einem normalen Verbindungsabbruch
      // zuruecksetzen, statt 60x/Sekunde denselben Fehler zu werfen.
      console.error('[connector] poll() fehlgeschlagen, Verbindung wird zurueckgesetzt:', err);
      this.sdk?.stopSDK();
      this.sdk = null;
      this.lastConnectAttempt = Date.now();
      return this.emitConnectionChange(false);
    }
  }

  private async pollOnce(): Promise<BridgeMessage[]> {
    if (!this.sdk) return this.tryConnect();

    const gotData = this.sdk.waitForData(POLL_TIMEOUT_MS);
    if (!gotData) {
      this.consecutiveMisses += 1;
      if (this.consecutiveMisses < MAX_CONSECUTIVE_MISSES) return [];

      // Erst nach wiederholtem Ausbleiben wirklich als getrennt werten,
      // siehe MAX_CONSECUTIVE_MISSES.
      this.sdk.stopSDK();
      this.sdk = null;
      this.consecutiveMisses = 0;
      return this.emitConnectionChange(false);
    }
    this.consecutiveMisses = 0;

    const messages = this.emitConnectionChange(true);
    const sessionMessage = this.maybeSession();
    if (sessionMessage) messages.push(sessionMessage);

    this.seq += 1;
    const frame = buildTelemetryFrame(this.sdk, this.seq, this.roster, this.playerCarIdx);
    this.enrichFuel(frame);
    this.enrichLapTimes(frame);
    this.enrichSectors(frame);
    this.enrichPitStops(frame);
    const trackMapMessage = this.enrichTrackPosition(frame);
    if (trackMapMessage) messages.push(trackMapMessage);
    messages.push({ type: 'telemetry', ...frame });
    return messages;
  }

  /**
   * Verbrauch pro Runde braucht Zustand ueber mehrere Ticks - das gehoert
   * nicht in die sonst zustandslose buildTelemetryFrame(), siehe
   * normalize/fromSdk.ts.
   */
  private enrichFuel(frame: ReturnType<typeof buildTelemetryFrame>): void {
    const me = frame.drivers.find((d) => d.carIdx === frame.player.carIdx);
    this.fuelTracker.update(me?.lap ?? 0, frame.player.fuel.levelLiters, me?.onPitRoad ?? false);
    frame.player.fuel.usePerLapLiters = this.fuelTracker.averagePerLapLiters;
    frame.player.fuel.lapsRemainingOnFuel = this.fuelTracker.averagePerLapLiters
      ? frame.player.fuel.levelLiters / this.fuelTracker.averagePerLapLiters
      : null;
  }

  /** Wie enrichFuel() oben - Historie braucht Zustand ueber mehrere Ticks, siehe calc/laptimes.ts. */
  private enrichLapTimes(frame: ReturnType<typeof buildTelemetryFrame>): void {
    const me = frame.drivers.find((d) => d.carIdx === frame.player.carIdx);
    this.lapTimeTracker.update(me?.lap ?? 0, me?.lastLapSec ?? null);
    frame.player.lastLapTimesSec = this.lapTimeTracker.lastLaps;
  }

  /**
   * Wie enrichFuel() oben - Sektorzeiten aus Uebergaengen brauchen Zustand
   * ueber mehrere Ticks, siehe calc/sectors.ts. Anders als Fuel/Laptimes
   * nicht nur fuers eigene Auto: der Sektor-Vergleich im Relative-Overlay
   * braucht die Sektorzeiten aller sichtbaren Autos.
   */
  private enrichSectors(frame: ReturnType<typeof buildTelemetryFrame>): void {
    for (const driver of frame.drivers) {
      this.sectorTracker.update(driver.carIdx, driver.lapDistPct, frame.sessionTimeSec);
      driver.sectorTimes = this.sectorTracker.resultsFor(driver.carIdx);
    }

    // Feld-Bestzeit nur gegen die eigene Fahrzeugklasse - ein GT4-Sektor
    // gegen einen GT3-Bestwert waere kein sinnvoller Vergleich.
    const playerClassId = frame.drivers.find((d) => d.carIdx === frame.player.carIdx)?.carClassId ?? null;
    const classmateIdx = frame.drivers.filter((d) => d.carClassId === playerClassId).map((d) => d.carIdx);
    const fieldBest = this.sectorTracker.fieldBestByNum(classmateIdx);

    frame.player.sectorTimes = this.sectorTracker
      .resultsFor(frame.player.carIdx)
      .map((sector) => ({ ...sector, fieldBestSec: fieldBest.get(sector.num) ?? null }));
    const num = this.sectorTracker.currentSectorNumFor(frame.player.carIdx);
    const elapsedSec = this.sectorTracker.currentElapsedSecFor(frame.player.carIdx, frame.sessionTimeSec);
    frame.player.currentSector = num != null && elapsedSec != null ? { num, elapsedSec } : null;
  }

  /** Wie enrichSectors() oben - Boxenstopps/Stint-Laenge brauchen Zustand ueber mehrere Ticks und alle Autos, siehe calc/pitStops.ts. */
  private enrichPitStops(frame: ReturnType<typeof buildTelemetryFrame>): void {
    for (const driver of frame.drivers) {
      this.pitTracker.update(driver.carIdx, driver.lap, driver.onPitRoad);
      const info = this.pitTracker.infoFor(driver.carIdx);
      driver.pitStopCount = info.pitStopCount;
      driver.stintLaps = info.stintLaps;
    }
  }

  /**
   * Wie enrichFuel() oben - Dead-Reckoning braucht Integration ueber
   * mehrere Ticks, siehe calc/trackPosition.ts. Andere Autos liefern kein
   * eigenes VelocityX/Y/YawNorth, werden aber trotzdem platziert - per
   * Interpolation auf der vom Spieler aufgezeichneten Referenz-Polylinie
   * anhand ihres lapDistPct. Gibt eine `trackmap`-Nachricht zurueck, wenn
   * die Referenz-Polylinie in diesem Tick gerade erst komplett wurde (eine
   * Runde ist gefahren) - sonst `null`, damit sie nicht bei jedem Tick neu
   * verschickt wird.
   */
  private enrichTrackPosition(frame: ReturnType<typeof buildTelemetryFrame>): BridgeMessage | null {
    const me = frame.drivers.find((d) => d.carIdx === frame.player.carIdx);
    const wasComplete = this.trackTracker.isReferenceComplete;
    this.trackTracker.update(
      frame.player.velocityXMs,
      frame.player.velocityYMs,
      frame.player.yawNorthRad,
      me?.lapDistPct ?? 0,
      frame.sessionTimeSec,
    );

    frame.player.trackPosition = this.trackTracker.current;
    for (const driver of frame.drivers) {
      driver.trackPosition = this.trackTracker.positionForPct(driver.lapDistPct);
    }

    if (!wasComplete && this.trackTracker.isReferenceComplete) {
      const message: BridgeMessage = { type: 'trackmap', points: this.trackTracker.referencePolyline };
      this.trackMapMessage = message;
      return message;
    }
    return null;
  }

  private async tryConnect(): Promise<BridgeMessage[]> {
    const now = Date.now();
    if (now - this.lastConnectAttempt < RECONNECT_DELAY_MS) return [];
    this.lastConnectAttempt = now;

    const simRunning = await IRacingSDK.IsSimRunning();
    if (!simRunning) return [];

    this.sdk = new IRacingSDK({ autoEnableTelemetry: true });
    this.sdk.startSDK();
    this.lastSessionVersion = -1;
    this.consecutiveMisses = 0;
    return [];
  }

  private emitConnectionChange(value: boolean): BridgeMessage[] {
    if (this.connected === value) return [];
    this.connected = value;
    if (!value) this.sessionMessage = null;
    return [{ type: 'connection', connected: value }];
  }

  /**
   * Baut die Session-Nachricht nur bei geaenderter Versionsnummer neu -
   * das YAML zu parsen kostet ein Vielfaches eines Telemetrie-Frames.
   */
  private maybeSession(): BridgeMessage | null {
    if (!this.sdk) return null;
    const version = this.sdk.getSessionVersionNum();
    if (version === this.lastSessionVersion) return null;
    this.lastSessionVersion = version;

    const session = buildSessionState(this.sdk, version);
    this.roster = session.drivers;
    this.playerCarIdx = session.playerCarIdx;
    // Neue Session (anderes Auto, neuer Boxenstopp-Kontext, Neustart,
    // moeglicherweise andere Strecke mit anderen Sektorgrenzen) - alte
    // Verbrauchs-/Rundenzeiten-/Sektor-/Track-Map-Historie ist nicht mehr
    // aussagekraeftig (andere Strecke oder andere Start-/Zielposition).
    this.fuelTracker = new FuelTracker();
    this.lapTimeTracker = new LapTimeTracker();
    this.sectorTracker = new MultiCarSectorTracker();
    this.sectorTracker.setBoundaries(session.sectors);
    this.trackTracker = new TrackPositionTracker();
    this.trackMapMessage = null;
    this.pitTracker = new MultiCarPitTracker();
    const message: BridgeMessage = { type: 'session', ...session };
    this.sessionMessage = message;
    return message;
  }
}
