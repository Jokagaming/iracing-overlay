import { TelemetryClient } from '../shared/client.js';
import { wireEditMode } from '../shared/editMode.js';
import * as format from '../shared/format.js';

const params = new URLSearchParams(location.search);
const WS_URL = params.get('ws') ?? 'ws://127.0.0.1:8778';

const widgetEl = document.getElementById('widget') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const bodyEl = document.getElementById('body') as HTMLDivElement;
const resizeGripEl = document.getElementById('resize-grip') as HTMLDivElement;
const chartEl = document.getElementById('chart') as HTMLDivElement;
const bestEl = document.getElementById('best') as HTMLSpanElement;

/** Deckt sich mit der Historienlaenge in data/calc/laptimes.ts. */
const SLOTS = 5;

interface Column {
  col: HTMLDivElement;
  bar: HTMLDivElement;
  label: HTMLSpanElement;
}

/** Feste Anzahl Saeulen statt eines wachsenden Pools (siehe relative/main.ts) - die Historienlaenge ist konstant. */
const columns: Column[] = Array.from({ length: SLOTS }, () => {
  const col = document.createElement('div');
  col.className = 'laptimes__col';

  const bar = document.createElement('div');
  bar.className = 'laptimes__bar';

  const label = document.createElement('span');
  label.className = 'laptimes__label';

  col.append(bar, label);
  chartEl.append(col);
  return { col, bar, label };
});

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

  const laps = client.telemetry.player.lastLapTimesSec;
  const shown = laps.slice(-SLOTS);
  // Leere Slots stehen links, die neueste Runde landet immer ganz rechts -
  // so wandert eine gerade gefahrene Runde sichtbar ans Ende statt die
  // ganze Reihe ruckartig neu anzuordnen.
  const padding = SLOTS - shown.length;
  const best = shown.length > 0 ? Math.min(...shown) : null;
  const worst = shown.length > 0 ? Math.max(...shown) : null;
  const spread = best != null && worst != null ? worst - best : 0;

  setText(bestEl, best != null ? format.lapTime(best) : '');

  columns.forEach((column, i) => {
    const value = i >= padding ? (shown[i - padding] ?? null) : null;
    const isBest = value != null && value === best;

    column.col.classList.toggle('is-empty', value == null);
    column.bar.classList.toggle('laptimes__bar--best', isBest);
    // Balkenhoehe nach Abstand zur schnellsten der 5 Runden, mit
    // Mindesthoehe - sonst waere die schnellste Runde selbst nur ein
    // unsichtbarer Strich (Abstand zu sich selbst = 0).
    const pct = value == null ? 0 : spread > 0 ? 12 + ((value - best!) / spread) * 88 : 100;
    column.bar.style.height = `${pct}%`;
    setText(column.label, format.lapTime(value));
  });
}

wireEditMode(widgetEl, resizeGripEl);
new TelemetryClient(WS_URL).onRender(render).start();
