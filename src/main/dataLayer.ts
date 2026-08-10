/**
 * Startet den Datenlayer (Connector/Mock + WebSocket-Broadcast) im
 * Electron-Main-Process.
 *
 * Der Datenlayer selbst (`src/data/`) kennt Electron nicht - er laeuft
 * unveraendert genauso wie im eigenstaendigen CLI (`src/data/cli.ts`).
 * Dieses Modul uebernimmt nur den Lifecycle; die Tick-/Broadcast-Schleife
 * kommt aus data/broadcaster.ts, gemeinsam mit dem CLI genutzt.
 *
 * `onMessage` reicht jede Nachricht zusaetzlich zum WS-Broadcast an den
 * Aufrufer durch - main/index.ts nutzt das, um sie per `webContents.send()`
 * direkt an die eigenen Overlay-Fenster zu schicken (kein WS-Umweg fuer
 * die eigenen neun Fenster, siehe README "Performance"). Der WS-Server
 * laeuft trotzdem weiter, fuer externe Verbraucher wie eine kuenftige
 * OBS-Browser-Source.
 */

import type { BridgeMessage } from '../data/types.js';
import type { DataSource } from '../data/connector.js';
import { BridgeServer } from '../data/server/wsServer.js';
import { TelemetryBroadcaster } from '../data/broadcaster.js';

/** Siehe data/cli.ts und README ("Performance") fuer die gemessenen Werte je Rate. */
const DEFAULT_TELEMETRY_HZ = 20;

export interface DataLayerOptions {
  host: string;
  port: number;
  demo: boolean;
  telemetryHz?: number;
  onMessage?: (message: BridgeMessage) => void;
}

export class DataLayer {
  private source: DataSource | null = null;
  private server: BridgeServer | null = null;
  private broadcaster: TelemetryBroadcaster | null = null;

  async start(options: DataLayerOptions): Promise<void> {
    this.source = await this.buildSource(options.demo);
    this.server = new BridgeServer({
      host: options.host,
      port: options.port,
      welcome: () => this.getWelcomeMessages(),
    });
    this.broadcaster = new TelemetryBroadcaster({
      source: this.source,
      broadcast: (message) => {
        this.server?.broadcast(message);
        options.onMessage?.(message);
      },
      telemetryHz: options.telemetryHz ?? DEFAULT_TELEMETRY_HZ,
    });
    this.broadcaster.start();
  }

  async stop(): Promise<void> {
    this.broadcaster?.stop();
    this.source?.close();
    await this.server?.close();
  }

  /**
   * Letzter bekannter connection-/session-Stand - fuer neu verbundene
   * WS-Clients (siehe `welcome` oben) und fuer per IPC angebundene
   * Overlay-Fenster, sobald ihre Seite geladen ist (siehe
   * overlayWindow.ts, `did-finish-load`). Ohne das wuerde ein Fenster, das
   * erst nach der letzten Session-Aenderung zu lauschen beginnt, nie eine
   * session-Nachricht bekommen - die wird nur bei tatsaechlicher Aenderung
   * neu verschickt, nicht periodisch.
   */
  getWelcomeMessages(): BridgeMessage[] {
    const session = this.source?.lastSessionMessage ?? null;
    const messages: BridgeMessage[] = [{ type: 'connection', connected: session != null }];
    if (session) messages.push(session);
    return messages;
  }

  private async buildSource(demo: boolean): Promise<DataSource> {
    if (demo) {
      const { MockSource } = await import('../data/mock/mockSource.js');
      return new MockSource();
    }
    const { IRacingConnector } = await import('../data/connector.js');
    return new IRacingConnector();
  }
}
