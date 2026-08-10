/**
 * Startet den Datenlayer (Connector/Mock + WebSocket-Broadcast) im
 * Electron-Main-Process.
 *
 * Der Datenlayer selbst (`src/data/`) kennt Electron nicht - er laeuft
 * unveraendert genauso wie im eigenstaendigen CLI (`src/data/cli.ts`).
 * Dieses Modul uebernimmt nur die Tick-Schleife und den Lifecycle.
 */

import type { BridgeMessage } from '../data/types.js';
import type { DataSource } from '../data/connector.js';
import { BridgeServer } from '../data/server/wsServer.js';

const TICK_MS = Math.floor(1000 / 60);

export interface DataLayerOptions {
  host: string;
  port: number;
  demo: boolean;
}

export class DataLayer {
  private source: DataSource | null = null;
  private server: BridgeServer | null = null;
  private running = false;
  private tickTimer: NodeJS.Timeout | null = null;

  async start(options: DataLayerOptions): Promise<void> {
    this.source = await this.buildSource(options.demo);
    this.server = new BridgeServer({
      host: options.host,
      port: options.port,
      welcome: () => this.welcomeMessages(),
    });

    this.running = true;
    this.scheduleTick();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.tickTimer) clearTimeout(this.tickTimer);
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

  private scheduleTick(): void {
    if (!this.running) return;
    void this.tick().finally(() => {
      this.tickTimer = setTimeout(() => this.scheduleTick(), TICK_MS);
    });
  }

  private async tick(): Promise<void> {
    if (!this.source || !this.server) return;
    const messages = await this.source.poll();
    for (const message of messages) this.server.broadcast(message);
  }
}
