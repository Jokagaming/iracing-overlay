import { planFuel } from '../../data/calc/fuel.js';
import { TelemetryClient } from '../shared/client.js';
import { wireEditMode } from '../shared/editMode.js';
import * as format from '../shared/format.js';

const params = new URLSearchParams(location.search);
const SAFETY_LAPS = clampSafety(params.get('safety'));
const WS_URL = params.get('ws') ?? 'ws://127.0.0.1:8778';

const widgetEl = document.getElementById('widget') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const bodyEl = document.getElementById('body') as HTMLDivElement;
const resizeGripEl = document.getElementById('resize-grip') as HTMLDivElement;
const levelEl = document.getElementById('level') as HTMLSpanElement;
const usageEl = document.getElementById('usage') as HTMLSpanElement;
const lapsOnFuelEl = document.getElementById('laps-on-fuel') as HTMLSpanElement;
const lapsInRaceEl = document.getElementById('laps-in-race') as HTMLSpanElement;
const addRowEl = document.getElementById('add-row') as HTMLDivElement;
const toAddEl = document.getElementById('to-add') as HTMLSpanElement;

function clampSafety(raw: string | null): number {
  // Number(null) ist 0, nicht NaN - siehe der gleiche Bug im Relative-Overlay.
  if (raw == null || raw === '') return 1;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 1;
}

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
  if (!client.telemetry || !client.session) {
    showStatus('Warte auf Telemetrie ...');
    return;
  }

  statusEl.classList.add('is-hidden');
  bodyEl.classList.remove('is-hidden');

  const { fuel } = client.telemetry.player;
  const plan = planFuel({
    levelLiters: fuel.levelLiters,
    usePerLapLiters: fuel.usePerLapLiters,
    raceLapsRemain: client.telemetry.sessionLapsRemain,
    raceTimeRemainSec: client.telemetry.sessionTimeRemainSec,
    estLapTimeSec: client.session.estLapTimeSec,
    safetyLaps: SAFETY_LAPS,
  });

  setText(levelEl, `${format.liters(fuel.levelLiters)} (${Math.round(fuel.levelPct * 100)}%)`);
  setText(usageEl, fuel.usePerLapLiters != null ? format.liters(fuel.usePerLapLiters) : '--');
  setText(lapsOnFuelEl, format.laps(fuel.lapsRemainingOnFuel));
  setText(lapsInRaceEl, format.laps(plan.lapsRemainingInRace));

  if (plan.litersToAddAtNextStop == null) {
    setText(toAddEl, '--');
    addRowEl.className = 'fuel__row fuel__row--highlight';
  } else if (plan.litersToAddAtNextStop <= 0) {
    setText(toAddEl, 'reicht bis Ende');
    addRowEl.className = 'fuel__row fuel__row--highlight fuel__row--ok';
  } else {
    setText(toAddEl, format.liters(plan.litersToAddAtNextStop));
    addRowEl.className = 'fuel__row fuel__row--highlight fuel__row--warn';
  }
}

wireEditMode(widgetEl, resizeGripEl);
new TelemetryClient(WS_URL).onRender(render).start();
