/**
 * Fragt eine Datenquelle ab und sendet die Nachrichten weiter - gemeinsame
 * Tick-Schleife fuer das eigenstaendige CLI (cli.ts) und den
 * Electron-Main-Process (dataLayer.ts), vorher in beiden getrennt und
 * identisch implementiert.
 *
 * Gemessen (siehe README, "Performance"): mit allen 9 Overlay-Fenstern
 * aktiv und Telemetrie bei 60 Hz lag die CPU-Last bei ~7% statt der
 * angepeilten <2% - jedes Fenster ist ein eigener Chromium-Renderer-
 * Prozess mit eigenem JSON.parse und DOM-Update des vollen Frames, 9-fach.
 * Die Quelle wird trotzdem weiter mit voller Rate abgefragt (`poll()`
 * blockiert beim echten SDK ohnehin im Sim-eigenen Takt, und interner
 * Zustand wie der FuelTracker darf keinen Rundenwechsel verpassen) - nur
 * das tatsaechliche Aussenden von Telemetrie-Nachrichten wird gedrosselt.
 * session/connection-Nachrichten sind davon nicht betroffen, die sind
 * ohnehin selten.
 */

import type { BridgeMessage } from './types.js';
import type { DataSource } from './connector.js';

const POLL_TICK_MS = Math.floor(1000 / 60);

export interface BroadcasterOptions {
  source: DataSource;
  broadcast: (message: BridgeMessage) => void;
  /** Telemetrie-Sendefrequenz in Hz. `null`/`undefined`/`<=0` schaltet die Drosselung ab. */
  telemetryHz?: number | null;
  /** Nur fuer Tests - Standard ist Date.now. */
  now?: () => number;
}

export class TelemetryBroadcaster {
  private readonly source: DataSource;
  private readonly broadcast: (message: BridgeMessage) => void;
  private readonly minIntervalMs: number;
  private readonly now: () => number;
  private lastTelemetrySentAt = -Infinity;
  private running = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(options: BroadcasterOptions) {
    this.source = options.source;
    this.broadcast = options.broadcast;
    this.now = options.now ?? Date.now;
    this.minIntervalMs = options.telemetryHz && options.telemetryHz > 0 ? 1000 / options.telemetryHz : 0;
  }

  start(): void {
    this.running = true;
    this.scheduleTick();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  private scheduleTick(): void {
    if (!this.running) return;
    void this.tick().finally(() => {
      this.timer = setTimeout(() => this.scheduleTick(), POLL_TICK_MS);
    });
  }

  private async tick(): Promise<void> {
    for (const message of await this.source.poll()) {
      if (message.type === 'telemetry' && !this.shouldSendTelemetry()) continue;
      this.broadcast(message);
    }
  }

  private shouldSendTelemetry(): boolean {
    if (this.minIntervalMs <= 0) return true;
    const now = this.now();
    if (now - this.lastTelemetrySentAt < this.minIntervalMs) return false;
    this.lastTelemetrySentAt = now;
    return true;
  }
}
