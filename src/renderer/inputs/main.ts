import type { PlayerCarInfo } from '../../data/types.js';
import { TelemetryClient } from '../shared/client.js';
import { wireEditMode } from '../shared/editMode.js';

const params = new URLSearchParams(location.search);
const WINDOW_SEC = clampSeconds(params.get('window'), 8);
const WS_URL = params.get('ws') ?? 'ws://127.0.0.1:8778';

const widgetEl = document.getElementById('widget') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const bodyEl = document.getElementById('body') as HTMLDivElement;
const resizeGripEl = document.getElementById('resize-grip') as HTMLDivElement;
const gearRpmEl = document.getElementById('gear-rpm') as HTMLSpanElement;
const rpmFillEl = document.getElementById('rpm-fill') as HTMLDivElement;
const canvas = document.getElementById('graph') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

interface Sample {
  throttle: number;
  brake: number;
  /** Auf -1..1 genormt, angenommen ueber ein ungefaehres Lenkwinkel-Maximum
   *  - das SDK liefert kein tatsaechliches Maximum des jeweiligen Fahrzeugs
   *  ueber diesen Kanal, daher eine feste Naeherung statt eines exakten Werts. */
  steer: number;
}

/** Naeherung fuer den sichtbaren Lenkbereich, da kein echtes Maximum vorliegt. */
const ASSUMED_STEER_RANGE_RAD = 3.5;

const samples: Sample[] = [];
const maxSamples = Math.round(WINDOW_SEC * 60);

function clampSeconds(raw: string | null, fallback: number): number {
  // Number(null) ist 0, nicht NaN - derselbe Bug wie im Relative-Overlay,
  // hier von Anfang an vermieden.
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function setText(el: HTMLElement, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}

function showStatus(text: string): void {
  setText(statusEl, text);
  statusEl.classList.remove('is-hidden');
  bodyEl.classList.add('is-hidden');
}

/**
 * Zieht das Canvas-Backing auf die tatsaechliche Pixeldichte hoch - ohne
 * das wirkt der Graph auf hochaufloesenden Monitoren verwaschen, weil ein
 * CSS-Pixel dort aus mehreren echten Pixeln besteht.
 */
function resizeCanvas(): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawFilledTrace(values: number[], color: string, width: number, height: number): void {
  if (values.length < 2) return;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - Math.max(0, Math.min(1, v)) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawLineTrace(values: number[], color: string, width: number, height: number): void {
  if (values.length < 2) return;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - Math.max(0, Math.min(1, v)) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function gearLabel(gear: number): string {
  if (gear < 0) return 'R';
  if (gear === 0) return 'N';
  return String(gear);
}

function rpmFillClass(rpm: number, car: PlayerCarInfo): string {
  if (car.shiftLightBlinkRpm > 0 && rpm >= car.shiftLightBlinkRpm) return 'inputs__rpm-fill--blink';
  if (car.shiftLightShiftRpm > 0 && rpm >= car.shiftLightShiftRpm) return 'inputs__rpm-fill--shift';
  return 'inputs__rpm-fill--ok';
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

  const { player } = client.telemetry;
  samples.push({
    throttle: player.inputs.throttle,
    brake: player.inputs.brake,
    steer: player.inputs.steerRad / ASSUMED_STEER_RANGE_RAD,
  });
  if (samples.length > maxSamples) samples.splice(0, samples.length - maxSamples);

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
    resizeCanvas();
  }

  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  drawFilledTrace(
    samples.map((s) => s.brake),
    'rgba(255, 77, 109, 0.55)',
    w,
    h,
  );
  drawFilledTrace(
    samples.map((s) => s.throttle),
    'rgba(87, 224, 138, 0.5)',
    w,
    h,
  );
  // Lenkwinkel als duenne Linie mittig durchs Bild statt als Flaeche -
  // negative Werte (Lenken nach links) sollen nicht wie "kein Wert" aussehen.
  drawLineTrace(
    samples.map((s) => s.steer * 0.5 + 0.5),
    'rgba(111, 211, 255, 0.9)',
    w,
    h,
  );

  setText(gearRpmEl, `${gearLabel(player.gear)} · ${Math.round(player.rpm)}`);

  if (client.session) {
    const { playerCar } = client.session;
    const pct = playerCar.redLineRpm > 0 ? Math.max(0, Math.min(1, player.rpm / playerCar.redLineRpm)) : 0;
    rpmFillEl.style.width = `${pct * 100}%`;
    rpmFillEl.className = `inputs__rpm-fill ${rpmFillClass(player.rpm, playerCar)}`;
  }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
wireEditMode(widgetEl, resizeGripEl);
new TelemetryClient(WS_URL).onRender(render).start();
