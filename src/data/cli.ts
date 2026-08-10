/**
 * Eigenstaendiger Einstiegspunkt des Datenlayers - laeuft ohne Electron.
 *
 *   npx tsx src/data/cli.ts            # live aus iRacing
 *   npx tsx src/data/cli.ts --demo     # simulierte Telemetrie
 */

import { parseArgs } from 'node:util';
import type { BridgeMessage } from './types.js';
import type { DataSource } from './connector.js';
import { BridgeServer } from './server/wsServer.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8778;
const TICK_MS = Math.floor(1000 / 60);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  return messages;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      demo: { type: 'boolean', default: false },
      host: { type: 'string', default: DEFAULT_HOST },
      port: { type: 'string', default: String(DEFAULT_PORT) },
    },
  });

  const source = await buildSource(values.demo);
  const server = new BridgeServer({
    host: values.host,
    port: Number(values.port),
    welcome: () => welcomeMessages(source),
  });

  console.log(`[data] WebSocket auf ws://${values.host}:${values.port}`);
  console.log(values.demo ? '[data] Demo-Modus: simulierte Telemetrie' : '[data] Warte auf iRacing ...');

  let running = true;
  process.on('SIGINT', () => {
    running = false;
  });

  while (running) {
    const tickStart = Date.now();
    const messages = await source.poll();
    for (const message of messages) server.broadcast(message);

    const elapsed = Date.now() - tickStart;
    await delay(Math.max(0, TICK_MS - elapsed));
  }

  source.close();
  await server.close();
  console.log('[data] beendet');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
