import { TelemetryClient } from '../shared/client.js';
import { wireEditMode } from '../shared/editMode.js';
import type { PlayerState, TireState } from '../../data/types.js';

const params = new URLSearchParams(location.search);
const WS_URL = params.get('ws') ?? 'ws://127.0.0.1:8778';

const widgetEl = document.getElementById('widget') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const bodyEl = document.getElementById('body') as HTMLDivElement;
const resizeGripEl = document.getElementById('resize-grip') as HTMLDivElement;

type Corner = keyof PlayerState['tires'];
const CORNERS: Corner[] = ['lf', 'rf', 'lr', 'rr'];

interface CornerElements {
  inner: HTMLSpanElement;
  middle: HTMLSpanElement;
  outer: HTMLSpanElement;
  wearFill: HTMLDivElement;
  wearLabel: HTMLSpanElement;
  pressure: HTMLSpanElement;
}

function cornerElements(corner: Corner): CornerElements {
  return {
    inner: document.getElementById(`${corner}-inner`) as HTMLSpanElement,
    middle: document.getElementById(`${corner}-middle`) as HTMLSpanElement,
    outer: document.getElementById(`${corner}-outer`) as HTMLSpanElement,
    wearFill: document.getElementById(`${corner}-wear-fill`) as HTMLDivElement,
    wearLabel: document.getElementById(`${corner}-wear-label`) as HTMLSpanElement,
    pressure: document.getElementById(`${corner}-pressure`) as HTMLSpanElement,
  };
}

const elements = Object.fromEntries(CORNERS.map((corner) => [corner, cornerElements(corner)])) as Record<Corner, CornerElements>;

function setText(el: HTMLElement, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}

function showStatus(text: string): void {
  setText(statusEl, text);
  statusEl.classList.remove('is-hidden');
  bodyEl.classList.add('is-hidden');
}

/**
 * Grobe Temperaturbaender nur fuer die Faerbung - das SDK liefert kein
 * "optimales" Fenster pro Reifen/Fahrzeug, das ist eine plausible
 * Naeherung fuer Rennslicks (aehnlich der Lenkwinkel-Naeherung im
 * Inputs-Graph, siehe renderer/inputs/main.ts).
 */
function tempClass(celsius: number): string {
  if (celsius < 70) return 'tires__temp--cold';
  if (celsius > 110) return 'tires__temp--hot';
  return 'tires__temp--optimal';
}

function renderTemp(el: HTMLSpanElement, celsius: number): void {
  setText(el, String(Math.round(celsius)));
  el.className = `tires__temp ${tempClass(celsius)}`;
}

function renderCorner(corner: Corner, tire: TireState): void {
  const els = elements[corner];
  renderTemp(els.inner, tire.tempInnerC);
  renderTemp(els.middle, tire.tempMiddleC);
  renderTemp(els.outer, tire.tempOuterC);

  // wearPct: 1 = neu, 0 = komplett abgefahren (siehe types.ts) - hier als
  // verbleibende Lauffläche in Prozent angezeigt.
  const remainingPct = Math.max(0, Math.min(1, tire.wearPct)) * 100;
  els.wearFill.style.width = `${remainingPct}%`;
  els.wearFill.classList.toggle('tires__wear-fill--warn', remainingPct < 50);
  els.wearFill.classList.toggle('tires__wear-fill--crit', remainingPct < 20);
  setText(els.wearLabel, `${Math.round(remainingPct)}%`);

  setText(els.pressure, `${Math.round(tire.coldPressureKpa)} kPa`);
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

  const { tires } = client.telemetry.player;
  for (const corner of CORNERS) renderCorner(corner, tires[corner]);
}

wireEditMode(widgetEl, resizeGripEl);
new TelemetryClient(WS_URL).onRender(render).start();
