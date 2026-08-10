/**
 * Verbindung eines Overlays zur Telemetrie-Bridge.
 *
 * Haelt den letzten bekannten Zustand vor und ruft die Render-Funktion
 * nicht bei jeder Nachricht auf, sondern einmal pro Bildwiederholung -
 * bei 60 Hz Telemetrie und einem schnelleren Monitor waere alles andere
 * verschwendete Arbeit.
 */

import type { BridgeMessage, SessionState, TelemetryFrame } from '../../data/types.js';

const RETRY_MIN_MS = 500;
const RETRY_MAX_MS = 5000;

export class TelemetryClient {
  session: SessionState | null = null;
  telemetry: TelemetryFrame | null = null;
  /** Ob die Bridge selbst iRacing sieht - nicht, ob der Renderer die Bridge sieht. */
  simConnected = false;
  /** Ob der Renderer mit der Bridge verbunden ist. */
  bridgeConnected = false;

  private socket: WebSocket | null = null;
  private retryDelay = RETRY_MIN_MS;
  private renderers: Array<(client: TelemetryClient) => void> = [];
  private frameRequested = false;

  constructor(private readonly url: string) {}

  onRender(fn: (client: TelemetryClient) => void): this {
    this.renderers.push(fn);
    return this;
  }

  start(): this {
    this.connect();
    return this;
  }

  private connect(): void {
    this.socket = new WebSocket(this.url);

    this.socket.addEventListener('open', () => {
      this.bridgeConnected = true;
      this.retryDelay = RETRY_MIN_MS;
      this.requestRender();
    });

    this.socket.addEventListener('message', (event) => {
      this.handleMessage(JSON.parse(event.data as string) as BridgeMessage);
    });

    this.socket.addEventListener('close', () => {
      this.bridgeConnected = false;
      this.simConnected = false;
      this.requestRender();
      this.scheduleReconnect();
    });

    // Ohne diesen Handler protokolliert der Browser bei jedem fehlgeschlagenen
    // Versuch einen Fehler in die Konsole. Die Bridge darf auch mal nicht
    // laufen, das ist erwartetes Verhalten und kein Fehlerfall.
    this.socket.addEventListener('error', () => {});
  }

  private scheduleReconnect(): void {
    setTimeout(() => this.connect(), this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX_MS);
  }

  private handleMessage(message: BridgeMessage): void {
    switch (message.type) {
      case 'connection':
        this.simConnected = message.connected;
        break;
      case 'session':
        this.session = message;
        break;
      case 'telemetry':
        this.telemetry = message;
        break;
    }
    this.requestRender();
  }

  private requestRender(): void {
    if (this.frameRequested) return;
    this.frameRequested = true;
    requestAnimationFrame(() => {
      this.frameRequested = false;
      for (const render of this.renderers) render(this);
    });
  }
}
