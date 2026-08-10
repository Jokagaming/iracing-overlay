import { IMPLAUSIBLE_TIME_REMAIN_SEC, UNLIMITED_LAPS_SENTINEL } from '../../data/calc/fuel.js';
import type { SdkSessionState } from '../../data/types.js';
import { TelemetryClient } from '../shared/client.js';
import { wireEditMode } from '../shared/editMode.js';
import * as format from '../shared/format.js';

const params = new URLSearchParams(location.search);
const WS_URL = params.get('ws') ?? 'ws://127.0.0.1:8778';

const widgetEl = document.getElementById('widget') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const bodyEl = document.getElementById('body') as HTMLDivElement;
const resizeGripEl = document.getElementById('resize-grip') as HTMLDivElement;
const stateEl = document.getElementById('state') as HTMLSpanElement;
const clockEl = document.getElementById('clock') as HTMLDivElement;
const subEl = document.getElementById('sub') as HTMLDivElement;

const SESSION_STATE_LABELS: Record<SdkSessionState, string> = {
  invalid: '',
  get_in_car: 'EINSTEIGEN',
  warmup: 'WARMUP',
  parade_laps: 'PARADE',
  racing: 'RACE',
  checkered: 'ZIEL',
  cool_down: 'COOLDOWN',
};

function setText(el: HTMLElement, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}

function showStatus(text: string): void {
  setText(statusEl, text);
  statusEl.classList.remove('is-hidden');
  bodyEl.classList.add('is-hidden');
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

  statusEl.classList.add('is-hidden');
  bodyEl.classList.remove('is-hidden');

  const { sessionLapsRemain, sessionTimeRemainSec, sessionState } = client.telemetry;
  setText(stateEl, SESSION_STATE_LABELS[sessionState] ?? '');

  const hasLapLimit = sessionLapsRemain != null && sessionLapsRemain < UNLIMITED_LAPS_SENTINEL;
  const hasTimeLimit = sessionTimeRemainSec != null && sessionTimeRemainSec < IMPLAUSIBLE_TIME_REMAIN_SEC;

  if (hasLapLimit) {
    // Rundenbasiertes Rennen: die Rundenzahl ist die eigentliche Grenze,
    // die Uhr (falls vorhanden) nur eine Nebeninfo.
    setText(clockEl, format.laps(sessionLapsRemain));
    setText(subEl, hasTimeLimit ? `Runden · ${format.clock(sessionTimeRemainSec)}` : 'Runden');
  } else if (hasTimeLimit) {
    setText(clockEl, format.clock(sessionTimeRemainSec));
    setText(subEl, 'verbleibend');
  } else {
    setText(clockEl, '--:--');
    setText(subEl, '');
  }

  const nearEnd = (hasLapLimit && sessionLapsRemain! <= 3) || (hasTimeLimit && sessionTimeRemainSec! <= 120);
  clockEl.className = 'timer__clock' + (nearEnd ? ' timer__clock--warn' : '');
}

wireEditMode(widgetEl, resizeGripEl);
new TelemetryClient(WS_URL).onRender(render).start();
