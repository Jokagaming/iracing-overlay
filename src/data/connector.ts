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

const POLL_TIMEOUT_MS = Math.floor((1 / 60) * 1000); // ~16ms, siehe irsdk-node README
const RECONNECT_DELAY_MS = 1000;

/** Gemeinsame Schnittstelle von Live-Verbindung und Mock-/Replay-Quelle. */
export interface DataSource {
  readonly lastSessionMessage: BridgeMessage | null;
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
  private fuelTracker = new FuelTracker();

  get lastSessionMessage(): BridgeMessage | null {
    return this.sessionMessage;
  }

  close(): void {
    this.sdk?.stopSDK();
    this.sdk = null;
  }

  async poll(): Promise<BridgeMessage[]> {
    if (!this.sdk) return this.tryConnect();

    const gotData = this.sdk.waitForData(POLL_TIMEOUT_MS);
    if (!gotData) {
      // Sim beendet oder Timeout ohne neue Daten - Verbindung neu aufbauen.
      this.sdk.stopSDK();
      this.sdk = null;
      return this.emitConnectionChange(false);
    }

    const messages = this.emitConnectionChange(true);
    const sessionMessage = this.maybeSession();
    if (sessionMessage) messages.push(sessionMessage);

    this.seq += 1;
    const frame = buildTelemetryFrame(this.sdk, this.seq, this.roster, this.playerCarIdx);
    this.enrichFuel(frame);
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

  private async tryConnect(): Promise<BridgeMessage[]> {
    const now = Date.now();
    if (now - this.lastConnectAttempt < RECONNECT_DELAY_MS) return [];
    this.lastConnectAttempt = now;

    const simRunning = await IRacingSDK.IsSimRunning();
    if (!simRunning) return [];

    this.sdk = new IRacingSDK({ autoEnableTelemetry: true });
    this.sdk.startSDK();
    this.lastSessionVersion = -1;
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
    // Neue Session (anderes Auto, neuer Boxenstopp-Kontext, Neustart) -
    // alte Verbrauchshistorie ist nicht mehr aussagekraeftig.
    this.fuelTracker = new FuelTracker();
    const message: BridgeMessage = { type: 'session', ...session };
    this.sessionMessage = message;
    return message;
  }
}
