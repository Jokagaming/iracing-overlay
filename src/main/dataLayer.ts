/**
 * Startet den Datenlayer (Connector/Mock + WebSocket-Broadcast) im
 * Electron-Main-Process.
 *
 * Der Datenlayer selbst (`src/data/`) kennt Electron nicht - er laeuft
 * unveraendert genauso wie im eigenstaendigen CLI (`src/data/cli.ts`).
 * Dieses Modul uebernimmt nur den Lifecycle; die Tick-/Broadcast-Schleife
 * kommt aus data/broadcaster.ts, gemeinsam mit dem CLI genutzt.
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
      welcome: () => this.welcomeMessages(),
    });
    this.broadcaster = new TelemetryBroadcaster({
      source: this.source,
      broadcast: (message) => this.server?.broadcast(message),
      telemetryHz: options.telemetryHz ?? DEFAULT_TELEMETRY_HZ,
    });
    this.broadcaster.start();
  }

  async stop(): Promise<void> {
    this.broadcaster?.stop();
    this.source?.close();
    await this.server?.close();
  }

  private async buildSource(demo: boolean): Promise<DataSource> {
    if (demo) {
      const { MockSource } = await import('../data/mock/mockSource.js');
      return new MockSource();
    }
    const { IRacingConnector } = await import('../data/connector.js');
    return new IRacingConnector();
  }

  private welcomeMessages(): BridgeMessage[] {
    const session = this.source?.lastSessionMessage ?? null;
    const messages: BridgeMessage[] = [{ type: 'connection', connected: session != null }];
    if (session) messages.push(session);
    return messages;
  }
}
