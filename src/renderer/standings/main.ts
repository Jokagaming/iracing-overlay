import type { Driver } from '../../data/types.js';
import { buildStandings, type StandingsGroup } from '../../data/calc/standings.js';
import { TelemetryClient } from '../shared/client.js';
import { wireEditMode } from '../shared/editMode.js';
import * as format from '../shared/format.js';

const params = new URLSearchParams(location.search);
const WS_URL = params.get('ws') ?? 'ws://127.0.0.1:8778';

const widgetEl = document.getElementById('widget') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const tableEl = document.getElementById('table') as HTMLTableElement;
const bodyEl = document.getElementById('rows') as HTMLTableSectionElement;
const resizeGripEl = document.getElementById('resize-grip') as HTMLDivElement;

type RowSpec = { kind: 'header'; group: StandingsGroup } | { kind: 'data'; driver: Driver; playerCarIdx: number };

/**
 * Ein Pool-Eintrag merkt sich, welche Art Zeile zuletzt dort stand. Aendert
 * sich die Art (z.B. weil sich die Anzahl Klassen aendert), wird die Zeile
 * neu aufgebaut - sonst werden nur die Textinhalte aktualisiert. Das haelt
 * die DOM-Arbeit bei 60 Hz klein, ohne fuer den selteneren Fall einer sich
 * aendernden Struktur einen komplizierteren Diff-Algorithmus zu brauchen.
 */
interface PoolEntry {
  tr: HTMLTableRowElement;
  kind: 'header' | 'data' | null;
  cells: HTMLTableCellElement[];
}

const rowPool: PoolEntry[] = [];

function setText(el: HTMLElement, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}

function getPoolRow(index: number): PoolEntry {
  if (rowPool[index]) return rowPool[index];
  const tr = document.createElement('tr');
  const entry: PoolEntry = { tr, kind: null, cells: [] };
  rowPool.push(entry);
  bodyEl.append(tr);
  return entry;
}

function renderHeaderRow(entry: PoolEntry, group: StandingsGroup): void {
  if (entry.kind !== 'header') {
    entry.tr.className = 'standings__class-header';
    entry.tr.innerHTML = '<td colspan="7"></td>';
    entry.cells = [entry.tr.firstElementChild as HTMLTableCellElement];
    entry.kind = 'header';
  }
  entry.tr.style.setProperty('--class-color', group.carClass?.color ?? 'transparent');
  const label = group.carClass ? `${group.carClass.name} · ${group.rows.length}` : `Alle · ${group.rows.length}`;
  setText(entry.cells[0]!, label);
}

function renderDataRow(entry: PoolEntry, driver: Driver, playerCarIdx: number): void {
  if (entry.kind !== 'data') {
    entry.tr.className = 'standings__row';
    entry.tr.innerHTML = `
      <td class="standings__position"></td>
      <td class="standings__number"></td>
      <td class="standings__name"></td>
      <td class="standings__last"></td>
      <td class="standings__best"></td>
      <td class="standings__gap"></td>
      <td class="standings__pit-cell"></td>
    `;
    entry.cells = [...entry.tr.children] as HTMLTableCellElement[];
    entry.kind = 'data';
  }

  const [position, number, name, last, best, gap, pit] = entry.cells;
  const isPlayer = driver.carIdx === playerCarIdx;
  const inPit = driver.onPitRoad || driver.trackSurface === 'in_pit_stall';

  entry.tr.classList.toggle('standings__row--player', isPlayer);
  entry.tr.classList.toggle('standings__row--pit', inPit);

  setText(position!, driver.classPosition ? `P${driver.classPosition}` : '');
  setText(number!, driver.carNumber ? `#${driver.carNumber}` : '');
  setText(name!, format.driverName(driver.userName));
  setText(last!, format.lapTime(driver.lastLapSec));
  setText(best!, format.lapTime(driver.bestLapSec));
  setText(pit!, inPit ? 'BOX' : '');
  pit!.className = 'standings__pit-cell standings__pit';

  if (driver.classPosition === 1) {
    setText(gap!, '—');
    gap!.className = 'standings__gap standings__gap--leader';
  } else {
    setText(gap!, driver.gapToLeaderSec != null ? format.gap(driver.gapToLeaderSec) : '');
    gap!.className = 'standings__gap';
  }
}

function showStatus(text: string): void {
  setText(statusEl, text);
  statusEl.classList.remove('is-hidden');
  tableEl.classList.add('is-hidden');
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

  const groups = buildStandings(client.telemetry, client.session.carClasses);
  if (groups.length === 0) {
    showStatus('Keine Autos auf der Strecke');
    return;
  }

  statusEl.classList.add('is-hidden');
  tableEl.classList.remove('is-hidden');

  // Klassen-Header nur zeigen, wenn es mehr als eine Klasse gibt - bei
  // einem Single-Class-Event waere er reine Wiederholung des Fensterinhalts.
  const showHeaders = groups.length > 1;
  const specs: RowSpec[] = [];
  for (const group of groups) {
    if (showHeaders) specs.push({ kind: 'header', group });
    for (const driver of group.rows) specs.push({ kind: 'data', driver, playerCarIdx: client.telemetry.player.carIdx });
  }

  specs.forEach((spec, index) => {
    const entry = getPoolRow(index);
    entry.tr.classList.remove('is-hidden');
    if (spec.kind === 'header') renderHeaderRow(entry, spec.group);
    else renderDataRow(entry, spec.driver, spec.playerCarIdx);
  });
  for (let i = specs.length; i < rowPool.length; i += 1) {
    rowPool[i]!.tr.classList.add('is-hidden');
  }
}

wireEditMode(widgetEl, resizeGripEl);
new TelemetryClient(WS_URL).onRender(render).start();
