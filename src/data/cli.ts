/**
 * Eigenstaendiger Einstiegspunkt des Datenlayers - laeuft ohne Electron.
 *
 *   npx tsx src/data/cli.ts                  # live aus iRacing
 *   npx tsx src/data/cli.ts --demo           # simulierte Telemetrie
 *   npx tsx src/data/cli.ts --demo --rate 60 # Telemetrie ungedrosselt senden (Standard: 20Hz)
 */

import { parseArgs } from 'node:util';
import type { BridgeMessage } from './types.js';
import type { DataSource } from './connector.js';
import { BridgeServer } from './server/wsServer.js';
import { TelemetryBroadcaster } from './broadcaster.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8778;
/**
 * Siehe broadcaster.ts und README ("Performance"): 60Hz -> ~7.2% CPU,
 * 30Hz -> ~3.7%, 20Hz -> ~2.6% (9 Fenster aktiv, Demo-Modus). Darunter
 * flacht die Verbesserung ab - ein fixer Sockelverbrauch pro
 * Renderer-Fenster laesst sich per Senderate nicht wegdrosseln. 20Hz ist
 * fuer eine Text-/Zahlen-HUD und den Inputs-Graph visuell nicht von 60Hz
 * zu unterscheiden.
 */
const DEFAULT_TELEMETRY_HZ = 20;

async function buildSource(demo: boolean): Promise<DataSource> {
  if (demo) {
    const { MockSource } = await import('./mock/mockSource.js');
    return new MockSource();
  }
  const { IRacingConnector } = await import('./connector.js');
  return new IRacingConnector();
}

function welcomeMessages(source: DataSource): BridgeMessage[] {
  const messages: BridgeMessage[] = [{ type: 'connection', connected: source.lastSessionMessage != null }];
  if (source.lastSessionMessage) messages.push(source.lastSessionMessage);
  if (source.lastTrackMapMessage) messages.push(source.lastTrackMapMessage);
  return messages;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      demo: { type: 'boolean', default: false },
      host: { type: 'string', default: DEFAULT_HOST },
      port: { type: 'string', default: String(DEFAULT_PORT) },
      rate: { type: 'string', default: String(DEFAULT_TELEMETRY_HZ) },
    },
  });

  const source = await buildSource(values.demo);
  const server = new BridgeServer({
    host: values.host,
    port: Number(values.port),
    welcome: () => welcomeMessages(source),
  });
  const broadcaster = new TelemetryBroadcaster({
    source,
    broadcast: (message) => server.broadcast(message),
    telemetryHz: Number(values.rate),
  });

  console.log(`[data] WebSocket auf ws://${values.host}:${values.port}`);
  console.log(values.demo ? '[data] Demo-Modus: simulierte Telemetrie' : '[data] Warte auf iRacing ...');
  console.log(`[data] Telemetrie-Senderate: ${values.rate}Hz`);

  broadcaster.start();

  await new Promise<void>((resolve) => process.on('SIGINT', resolve));

  broadcaster.stop();
  source.close();
  await server.close();
  console.log('[data] beendet');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
