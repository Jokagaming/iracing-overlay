import type { CarClass } from '../../data/types.js';
import { buildRelativeRows, type RelativeRow } from '../../data/calc/relative.js';
import { TelemetryClient } from './client.js';
import * as format from './format.js';

export {};

declare global {
  interface Window {
    overlayAPI: {
      onEditModeChange: (callback: (editMode: boolean) => void) => void;
      resizeBy: (dx: number, dy: number) => void;
    };
  }
}

const params = new URLSearchParams(location.search);
const AHEAD = clampCount(params.get('ahead'), 4);
const BEHIND = clampCount(params.get('behind'), 4);
const WS_URL = params.get('ws') ?? 'ws://127.0.0.1:8778';

const widgetEl = document.getElementById('widget') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const tableEl = document.getElementById('table') as HTMLTableElement;
const bodyEl = document.getElementById('rows') as HTMLTableSectionElement;
const sessionEl = document.getElementById('session') as HTMLSpanElement;
const resizeGripEl = document.getElementById('resize-grip') as HTMLDivElement;

/**
 * Zeilen werden wiederverwendet statt bei jedem Frame neu gebaut. Bei 60
 * Bildern pro Sekunde wuerde staendiges Neuerzeugen den Browser unnoetig
 * beschaeftigen und laesst Text kurz flackern.
 */
interface RowElements {
  tr: HTMLTableRowElement;
  classCell: HTMLTableCellElement;
  position: HTMLTableCellElement;
  number: HTMLTableCellElement;
  name: HTMLTableCellElement;
  irating: HTMLTableCellElement;
  laps: HTMLTableCellElement;
  gap: HTMLTableCellElement;
}

const rowPool: RowElements[] = [];

function clampCount(raw: string | null, fallback: number): number {
  // Number(null) ist 0, nicht NaN - ohne den expliziten null-Check wuerde
  // ein fehlender Query-Parameter also "0 Zeilen" statt des Fallbacks
  // ergeben.
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.min(Math.trunc(value), 15);
}

function createRow(): RowElements {
  const tr = document.createElement('tr');
  tr.className = 'relative__row';
  tr.innerHTML = `
    <td class="relative__class"></td>
    <td class="relative__position"></td>
    <td class="relative__number"></td>
    <td class="relative__name"></td>
    <td class="relative__irating"></td>
    <td class="relative__laps"></td>
    <td class="relative__gap"></td>
  `;
  const [classCell, position, number, name, irating, laps, gap] = tr.children as unknown as HTMLTableCellElement[];
  const row: RowElements = { tr, classCell: classCell!, position: position!, number: number!, name: name!, irating: irating!, laps: laps!, gap: gap! };
  rowPool.push(row);
  bodyEl.append(tr);
  return row;
}

/** Setzt Text nur bei echter Aenderung - spart Layout-Arbeit im Browser. */
function setText(el: HTMLElement, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}

function renderRow(row: RowElements, entry: RelativeRow, classes: Map<number, CarClass>): void {
  const carClass = entry.carClassId != null ? classes.get(entry.carClassId) : undefined;

  row.tr.classList.toggle('relative__row--player', entry.isPlayer);
  row.tr.classList.toggle('relative__row--pit', entry.onPitRoad || entry.trackSurface === 'in_pit_stall');
  row.tr.classList.remove('is-hidden');

  row.classCell.style.setProperty('--class-color', carClass?.color ?? 'transparent');
  setText(row.position, entry.classPosition ? `P${entry.classPosition}` : '');
  setText(row.number, entry.carNumber ? `#${entry.carNumber}` : '');
  setText(row.name, format.driverName(entry.userName));
  setText(row.irating, format.iRating(entry.iRating));

  const laps = entry.lapsAhead;
  setText(row.laps, laps === 0 ? '' : laps > 0 ? `+${laps}` : String(laps));
  row.laps.classList.toggle('relative__laps--up', laps > 0);
  row.laps.classList.toggle('relative__laps--down', laps < 0);

  if (entry.onPitRoad || entry.trackSurface === 'in_pit_stall') {
    setText(row.gap, 'BOX');
    row.gap.className = 'relative__gap relative__pit';
  } else if (entry.isPlayer) {
    setText(row.gap, '—');
    row.gap.className = 'relative__gap relative__gap--player';
  } else {
    setText(row.gap, format.gap(entry.gapSeconds));
    row.gap.className = 'relative__gap ' + (entry.gapSeconds < 0 ? 'relative__gap--ahead' : 'relative__gap--behind');
  }
}

function showStatus(text: string): void {
  setText(statusEl, text);
  statusEl.classList.remove('is-hidden');
  tableEl.classList.add('is-hidden');
}

function renderSessionLabel(client: TelemetryClient): void {
  const flags = client.telemetry?.flags ?? [];
  const parts: string[] = [];
  // Nur die Flaggen zeigen, die das Fahren betreffen - die Startampel-Bits
  // stehen dauerhaft an und waeren reines Rauschen.
  if (flags.includes('caution') || flags.includes('caution_waving')) parts.push('GELB');
  if (flags.includes('checkered')) parts.push('ZIEL');
  setText(sessionEl, parts.join('  '));
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

  const rows = buildRelativeRows(client.telemetry, client.session.estLapTimeSec, { ahead: AHEAD, behind: BEHIND });
  if (rows.length === 0) {
    showStatus('Keine Autos auf der Strecke');
    return;
  }

  statusEl.classList.add('is-hidden');
  tableEl.classList.remove('is-hidden');
  renderSessionLabel(client);

  const classes = new Map(client.session.carClasses.map((c) => [c.id, c]));
  rows.forEach((entry, index) => {
    renderRow(rowPool[index] ?? createRow(), entry, classes);
  });
  // Uebrige Zeilen aus einem volleren Feld ausblenden statt entfernen -
  // beim naechsten Frame sind sie eventuell wieder gebraucht.
  for (let i = rows.length; i < rowPool.length; i += 1) {
    rowPool[i]!.tr.classList.add('is-hidden');
  }
}

window.overlayAPI.onEditModeChange((editMode) => {
  widgetEl.dataset.edit = String(editMode);
});

/**
 * Verschieben laeuft komplett nativ ueber -webkit-app-region: drag (siehe
 * relative.css) - kein JS noetig. Die Groesse hat das rahmenlose Fenster
 * dagegen ohne eigene Ziehkante nicht, deshalb dieser Griff: er meldet nur
 * die Mausbewegung als Delta an den Main-Process, der tatsaechlich
 * `win.setBounds()` aufruft (der Renderer kann seine eigene Fenstergroesse
 * nicht selbst setzen).
 */
resizeGripEl.addEventListener('mousedown', (startEvent) => {
  startEvent.preventDefault();
  let lastX = startEvent.screenX;
  let lastY = startEvent.screenY;

  function onMove(moveEvent: MouseEvent): void {
    window.overlayAPI.resizeBy(moveEvent.screenX - lastX, moveEvent.screenY - lastY);
    lastX = moveEvent.screenX;
    lastY = moveEvent.screenY;
  }

  function onUp(): void {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
});

new TelemetryClient(WS_URL).onRender(render).start();
