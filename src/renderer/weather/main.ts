import type { TrackWetness } from '../../data/types.js';
import { TelemetryClient } from '../shared/client.js';
import { wireEditMode } from '../shared/editMode.js';

const params = new URLSearchParams(location.search);
const WS_URL = params.get('ws') ?? 'ws://127.0.0.1:8778';

const widgetEl = document.getElementById('widget') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const bodyEl = document.getElementById('body') as HTMLDivElement;
const resizeGripEl = document.getElementById('resize-grip') as HTMLDivElement;
const airEl = document.getElementById('air') as HTMLSpanElement;
const trackEl = document.getElementById('track') as HTMLSpanElement;
const humidityEl = document.getElementById('humidity') as HTMLSpanElement;
const wetnessEl = document.getElementById('wetness') as HTMLSpanElement;

const WETNESS_LABELS: Record<TrackWetness, string> = {
  unknown: '?',
  dry: 'Trocken',
  mostly_dry: 'Meist trocken',
  very_lightly_wet: 'Minimal nass',
  lightly_wet: 'Leicht nass',
  moderately_wet: 'Nass',
  very_wet: 'Sehr nass',
  extremely_wet: 'Durchnaesst',
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

  const { weather } = client.telemetry;
  setText(airEl, `${weather.airTempC.toFixed(1)}°C`);
  setText(trackEl, `${weather.trackTempC.toFixed(1)}°C`);
  setText(humidityEl, `${Math.round(weather.humidityPct * 100)}%`);
  setText(wetnessEl, WETNESS_LABELS[weather.trackWetness]);
  wetnessEl.className = 'weather__value' + (weather.trackWetness !== 'dry' ? ' weather__value--wet' : '');
}

wireEditMode(widgetEl, resizeGripEl);
new TelemetryClient(WS_URL).onRender(render).start();
