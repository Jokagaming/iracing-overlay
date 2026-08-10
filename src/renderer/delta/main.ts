import { TelemetryClient } from '../shared/client.js';
import { wireEditMode } from '../shared/editMode.js';
import * as format from '../shared/format.js';

/** Ab dieser Abweichung ist der Balken komplett ausgefuellt. */
const MAX_BAR_SEC = 2;

const params = new URLSearchParams(location.search);
const WS_URL = params.get('ws') ?? 'ws://127.0.0.1:8778';

const widgetEl = document.getElementById('widget') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const bodyEl = document.getElementById('body') as HTMLDivElement;
const resizeGripEl = document.getElementById('resize-grip') as HTMLDivElement;
const valueEl = document.getElementById('value') as HTMLDivElement;
const fillEl = document.getElementById('fill') as HTMLDivElement;

function setText(el: HTMLElement, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}

function showStatus(text: string): void {
  setText(statusEl, text);
  statusEl.classList.remove('is-hidden');
  bodyEl.classList.add('is-hidden');
}

/**
 * Waechst von der Mitte aus - nach links bei negativem (schnellerem) Delta,
 * nach rechts bei positivem. So ist die Richtung an der Balkenseite
 * erkennbar, nicht nur an der Farbe.
 */
function updateBar(deltaSec: number | null): void {
  const magnitudePct = deltaSec == null ? 0 : Math.min(50, (Math.abs(deltaSec) / MAX_BAR_SEC) * 50);
  const ahead = deltaSec != null && deltaSec < 0;

  fillEl.style.left = ahead ? `${50 - magnitudePct}%` : '50%';
  fillEl.style.width = `${magnitudePct}%`;
  fillEl.className = ahead ? 'delta__fill' : 'delta__fill delta__fill--behind';
}

function render(client: TelemetryClient): void {
  if (!client.bridgeConnected) {
    showStatus('Bridge nicht erreichbar');
    return;
  }
  if (!client.simConnected) {
    showStatus('Warte auf iRacing ...');
    return;
  }
  if (!client.telemetry) {
    showStatus('Warte auf Telemetrie ...');
    return;
  }

  const { toBestLapSec } = client.telemetry.player.delta;
  if (toBestLapSec == null) {
    showStatus('Noch keine Bestzeit');
    return;
  }

  statusEl.classList.add('is-hidden');
  bodyEl.classList.remove('is-hidden');

  setText(valueEl, format.delta(toBestLapSec, 3));
  valueEl.className = 'delta__value ' + (toBestLapSec < 0 ? 'delta__value--ahead' : 'delta__value--behind');
  updateBar(toBestLapSec);
}

wireEditMode(widgetEl, resizeGripEl);
new TelemetryClient(WS_URL).onRender(render).start();
