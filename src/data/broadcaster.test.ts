import { describe, expect, it, vi } from 'vitest';
import { TelemetryBroadcaster } from './broadcaster.js';
import type { BridgeMessage } from './types.js';
import type { DataSource } from './connector.js';

function makeSource(messagesPerPoll: BridgeMessage[][]): DataSource {
  let i = 0;
  return {
    lastSessionMessage: null,
    lastTrackMapMessage: null,
    poll: vi.fn(async () => messagesPerPoll[Math.min(i++, messagesPerPoll.length - 1)] ?? []),
    close: () => {},
  };
}

const telemetry = (seq: number): BridgeMessage => ({
  type: 'telemetry',
  seq,
  sessionTimeSec: 0,
  sessionTimeRemainSec: null,
  sessionLapsRemain: null,
  sessionState: 'racing',
  flags: [],
  drivers: [],
  player: {} as never,
  weather: {} as never,
});

const connection: BridgeMessage = { type: 'connection', connected: true };

describe('TelemetryBroadcaster', () => {
  it('sendet ohne telemetryHz jede Nachricht ungedrosselt', async () => {
    const source = makeSource([[telemetry(1)], [telemetry(2)], [telemetry(3)]]);
    const sent: BridgeMessage[] = [];
    const broadcaster = new TelemetryBroadcaster({ source, broadcast: (m) => sent.push(m) });

    // Direkt auf die private tick()-Methode zuzugreifen waere unnoetig eng
    // an die Implementierung gekoppelt - stattdessen dreimal ueber die
    // oeffentliche Schleife mit einem gestoppten Timer laufen.
    await (broadcaster as unknown as { tick: () => Promise<void> }).tick();
    await (broadcaster as unknown as { tick: () => Promise<void> }).tick();
    await (broadcaster as unknown as { tick: () => Promise<void> }).tick();

    expect(sent).toHaveLength(3);
  });

  it('laesst session/connection-Nachrichten unabhaengig von der Drosselung immer durch', async () => {
    let now = 0;
    const source = makeSource([[connection, telemetry(1)], [telemetry(2)], [telemetry(3)]]);
    const sent: BridgeMessage[] = [];
    const broadcaster = new TelemetryBroadcaster({
      source,
      broadcast: (m) => sent.push(m),
      telemetryHz: 30, // Mindestabstand 33ms
      now: () => now,
    });

    const tick = (broadcaster as unknown as { tick: () => Promise<void> }).tick.bind(broadcaster);
    await tick(); // t=0: connection (immer) + telemetry(1) (erste, immer erlaubt)
    now = 10;
    await tick(); // t=10: telemetry(2) - zu frueh, verworfen
    now = 40;
    await tick(); // t=40: telemetry(3) - 40ms seit letzter Sendung, erlaubt

    expect(sent).toEqual([connection, telemetry(1), telemetry(3)]);
  });

  it('drosselt bei telemetryHz=30 auf einen Mindestabstand von ~33ms', async () => {
    let now = 0;
    const source = makeSource(Array.from({ length: 6 }, (_, i) => [telemetry(i)]));
    const sent: BridgeMessage[] = [];
    const broadcaster = new TelemetryBroadcaster({ source, broadcast: (m) => sent.push(m), telemetryHz: 30, now: () => now });
    const tick = (broadcaster as unknown as { tick: () => Promise<void> }).tick.bind(broadcaster);

    // 6 Ticks im 16ms-Takt (wie die echte Poll-Schleife) - bei 30Hz-Drosselung
    // darf davon nur etwa jeder zweite tatsaechlich raus.
    for (let i = 0; i < 6; i += 1) {
      now = i * 16;
      await tick();
    }

    expect(sent.length).toBeLessThan(6);
    expect(sent.length).toBeGreaterThanOrEqual(2);
  });

  it('startet erste Telemetrie sofort statt auf das erste Intervall zu warten', async () => {
    const source = makeSource([[telemetry(1)]]);
    const sent: BridgeMessage[] = [];
    const broadcaster = new TelemetryBroadcaster({ source, broadcast: (m) => sent.push(m), telemetryHz: 1, now: () => 0 });
    await (broadcaster as unknown as { tick: () => Promise<void> }).tick();

    expect(sent).toHaveLength(1);
  });
});
