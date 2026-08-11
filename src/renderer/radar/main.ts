import { buildRelativeRows } from '../../data/calc/relative.js';
import { TelemetryClient } from '../shared/client.js';
import { wireEditMode } from '../shared/editMode.js';

const params = new URLSearchParams(location.search);
const RANGE_SEC = clampRange(params.get('range'), 3);
const WS_URL = params.get('ws') ?? 'ws://127.0.0.1:8778';

const widgetEl = document.getElementById('widget') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const bodyEl = document.getElementById('body') as HTMLDivElement;
const resizeGripEl = document.getElementById('resize-grip') as HTMLDivElement;
const trackEl = document.getElementById('track') as HTMLDivElement;
const sideLeftEl = document.getElementById('side-left') as HTMLDivElement;
const sideRightEl = document.getElementById('side-right') as HTMLDivElement;

function clampRange(raw: string | null, fallback: number): number {
  // Number(null) ist 0, nicht NaN - derselbe Bug wie im Relative-Overlay,
  // hier von Anfang an vermieden.
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const dotPool: HTMLDivElement[] = [];

function getDot(index: number): HTMLDivElement {
  if (dotPool[index]) return dotPool[index]!;
  const dot = document.createElement('div');
  dot.className = 'radar__dot';
  trackEl.append(dot);
  dotPool.push(dot);
  return dot;
}

function setText(el: HTMLElement, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}

function showStatus(text: string): void {
  setText(statusEl, text);
  statusEl.classList.remove('is-hidden');
  bodyEl.classList.add('is-hidden');
  // Status (z.B. "Warte auf iRacing") muss auch dann sichtbar sein, wenn
  // der Radar zuvor wegen Ruhe ausgeblendet war - sonst verschwaende die
  // Meldung mitsamt dem restlichen Widget.
  widgetEl.classList.remove('radar--quiet');
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

  // Grosszuegiges Fenster von buildRelativeRows anfordern, dann auf den
  // Radar-Bereich filtern - das vermeidet eine zweite, eigene
  // Naeherungsberechnung fuer denselben Abstand.
  const nearby = buildRelativeRows(client.telemetry, client.session.estLapTimeSec, { ahead: 10, behind: 10 }).filter(
    (row) => !row.isPlayer && Math.abs(row.gapSeconds) <= RANGE_SEC,
  );

  const classes = new Map(client.session.carClasses.map((c) => [c.id, c]));
  nearby.forEach((row, index) => {
    const dot = getDot(index);
    dot.classList.remove('is-hidden');
    // gapSeconds negativ = voraus -> oberere Haelfte, positiv = dahinter -> untere Haelfte.
    const t = 0.5 - (row.gapSeconds / RANGE_SEC) * 0.5;
    dot.style.top = `${Math.max(4, Math.min(96, t * 100))}%`;
    const carClass = row.carClassId != null ? classes.get(row.carClassId) : undefined;
    dot.style.setProperty('--dot-color', carClass?.color ?? '#ffffff');
    dot.title = `#${row.carNumber} ${row.userName}`;
  });
  for (let i = nearby.length; i < dotPool.length; i += 1) {
    dotPool[i]!.classList.add('is-hidden');
  }

  const clr = client.telemetry.player.carLeftRight;
  sideLeftEl.classList.toggle('radar__side--warn', clr === 'car_left' || clr === 'cars_left_right' || clr === 'cars_2_left');
  sideRightEl.classList.toggle(
    'radar__side--warn',
    clr === 'car_right' || clr === 'cars_left_right' || clr === 'cars_2_right',
  );

  // Ohne Auto in der Naehe (weder laengsseitig im Bereich noch das
  // CarLeftRight-Signal aktiv) gibt es nichts zu warnen - das Widget bleibt
  // dann unsichtbar statt einen leeren Rahmen ueber dem Bild zu zeigen. Im
  // Edit-Modus trotzdem sichtbar, sonst liesse es sich nicht positionieren.
  const hasNearbyCar = nearby.length > 0 || (clr !== 'off' && clr !== 'clear');
  widgetEl.classList.toggle('radar--quiet', !hasNearbyCar);
}

wireEditMode(widgetEl, resizeGripEl);
new TelemetryClient(WS_URL).onRender(render).start();
