/**
 * Verteilt Nachrichten an beliebig viele verbundene Widgets/Overlays.
 *
 * Ein Client ist immer nur Empfaenger. Es gibt bewusst keinen Rueckkanal,
 * der etwas an iRacing schicken koennte - die Bridge liest ausschliesslich.
 */

import { WebSocket, WebSocketServer } from 'ws';
import type { BridgeMessage } from '../types.js';

export interface BridgeServerOptions {
  host: string;
  port: number;
  /** Was ein frisch verbundener Client sofort bekommt (z.B. letzter Session-Stand). */
  welcome: () => BridgeMessage[];
}

export class BridgeServer {
  private readonly wss: WebSocketServer;

  constructor(options: BridgeServerOptions) {
    this.wss = new WebSocketServer({ host: options.host, port: options.port });
    this.wss.on('connection', (socket) => {
      for (const message of options.welcome()) {
        socket.send(JSON.stringify(message));
      }
      // Nachrichten von Clients werden nicht ausgewertet; das Handling
      // haelt lediglich die Verbindung offen, bis der Client geht.
    });
  }

  get clientCount(): number {
    return this.wss.clients.size;
  }

  broadcast(message: BridgeMessage): void {
    if (this.wss.clients.size === 0) return;
    const payload = JSON.stringify(message);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.wss.close((err) => (err ? reject(err) : resolve()));
    });
  }
}
