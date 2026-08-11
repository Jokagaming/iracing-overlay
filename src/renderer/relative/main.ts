import type { CarClass, PlayerState } from '../../data/types.js';
import { buildRelativeRows, type RelativeRow } from '../../data/calc/relative.js';
import { TelemetryClient } from '../shared/client.js';
import * as format from '../shared/format.js';
import { wireEditMode } from '../shared/editMode.js';

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
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const settingsPanel = document.getElementById('settings-panel') as HTMLDivElement;
const colCompoundCheckbox = document.getElementById('col-compound') as HTMLInputElement;
const colSectorCheckbox = document.getElementById('col-sector') as HTMLInputElement;

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
  car: HTMLTableCellElement;
  name: HTMLTableCellElement;
  irating: HTMLTableCellElement;
  laps: HTMLTableCellElement;
  compound: HTMLTableCellElement;
  sectorDelta: HTMLTableCellElement;
  gap: HTMLTableCellElement;
}

const rowPool: RowElements[] = [];

/** Welche Extra-Spalten der Nutzer eingeschaltet hat - pro Fenster/Browser-Profil gemerkt, ueberlebt einen Neustart. */
const COLUMNS_STORAGE_KEY = 'iracing-overlay:relative:columns';

interface ColumnSettings {
  compound: boolean;
  sectorDelta: boolean;
}

function loadColumnSettings(): ColumnSettings {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return { compound: false, sectorDelta: false };
    const parsed: unknown = JSON.parse(raw);
    const obj = parsed as Partial<ColumnSettings>;
    return { compound: Boolean(obj.compound), sectorDelta: Boolean(obj.sectorDelta) };
  } catch {
    return { compound: false, sectorDelta: false };
  }
}

function saveColumnSettings(settings: ColumnSettings): void {
  localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(settings));
}

const columns = loadColumnSettings();

function applyColumnVisibility(): void {
  tableEl.classList.toggle('show-compound', columns.compound);
  tableEl.classList.toggle('show-sector', columns.sectorDelta);
}

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
    <td class="relative__car"></td>
    <td class="relative__name"></td>
    <td class="relative__irating"></td>
    <td class="relative__laps"></td>
    <td class="relative__compound"></td>
    <td class="relative__sector-delta"></td>
    <td class="relative__gap"></td>
  `;
  const [classCell, position, number, car, name, irating, laps, compound, sectorDelta, gap] =
    tr.children as unknown as HTMLTableCellElement[];
  const row: RowElements = {
    tr,
    classCell: classCell!,
    position: position!,
    number: number!,
    car: car!,
    name: name!,
    irating: irating!,
    laps: laps!,
    compound: compound!,
    sectorDelta: sectorDelta!,
    gap: gap!,
  };
  rowPool.push(row);
  bodyEl.append(tr);
  return row;
}

/** Setzt Text nur bei echter Aenderung - spart Layout-Arbeit im Browser. */
function setText(el: HTMLElement, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}

/**
 * Sektor, den der Spieler zuletzt abgeschlossen hat - der ist immer einen
 * Index vor dem gerade laufenden (siehe calc/sectors.ts). Referenz fuer den
 * Sektor-Vergleich: derselbe Streckenabschnitt bei allen Zeilen, statt bei
 * jedem Auto seinen jeweils eigenen letzten Sektor zu nehmen (die waeren
 * bei Autos mit groesserem Abstand nicht mehr derselbe Abschnitt).
 */
function referenceSectorIndex(player: PlayerState): number | null {
  if (!player.currentSector || player.sectorTimes.length === 0) return null;
  const idx = player.sectorTimes.findIndex((s) => s.num === player.currentSector!.num);
  if (idx === -1) return null;
  return (idx - 1 + player.sectorTimes.length) % player.sectorTimes.length;
}

function renderRow(row: RowElements, entry: RelativeRow, classes: Map<number, CarClass>, refSectorIndex: number | null, playerRefSec: number | null): void {
  const carClass = entry.carClassId != null ? classes.get(entry.carClassId) : undefined;

  row.tr.classList.toggle('relative__row--player', entry.isPlayer);
  row.tr.classList.toggle('relative__row--pit', entry.onPitRoad || entry.trackSurface === 'in_pit_stall');
  row.tr.classList.remove('is-hidden');

  row.classCell.style.setProperty('--class-color', carClass?.color ?? 'transparent');
  setText(row.position, entry.classPosition ? `P${entry.classPosition}` : '');
  setText(row.number, entry.carNumber ? `#${entry.carNumber}` : '');
  setText(row.car, entry.carName);
  setText(row.name, format.driverName(entry.userName));
  setText(row.irating, format.iRating(entry.iRating));

  setText(row.compound, entry.tireCompound != null ? String(entry.tireCompound) : '');

  if (entry.isPlayer || refSectorIndex == null || playerRefSec == null) {
    setText(row.sectorDelta, entry.isPlayer ? '—' : '');
    row.sectorDelta.className = 'relative__sector-delta';
  } else {
    const rowSec = entry.sectorTimes[refSectorIndex]?.lastSec ?? null;
    if (rowSec == null) {
      setText(row.sectorDelta, '');
      row.sectorDelta.className = 'relative__sector-delta';
    } else {
      const delta = rowSec - playerRefSec;
      setText(row.sectorDelta, format.delta(delta, 1));
      row.sectorDelta.className = 'relative__sector-delta ' + (delta < 0 ? 'relative__sector-delta--ahead' : 'relative__sector-delta--behind');
    }
  }

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
  const refSectorIndex = referenceSectorIndex(client.telemetry.player);
  const playerRefSec = refSectorIndex != null ? (client.telemetry.player.sectorTimes[refSectorIndex]?.lastSec ?? null) : null;

  rows.forEach((entry, index) => {
    renderRow(rowPool[index] ?? createRow(), entry, classes, refSectorIndex, playerRefSec);
  });
  // Uebrige Zeilen aus einem volleren Feld ausblenden statt entfernen -
  // beim naechsten Frame sind sie eventuell wieder gebraucht.
  for (let i = rows.length; i < rowPool.length; i += 1) {
    rowPool[i]!.tr.classList.add('is-hidden');
  }
}

settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.toggle('is-hidden');
});

colCompoundCheckbox.addEventListener('change', () => {
  columns.compound = colCompoundCheckbox.checked;
  applyColumnVisibility();
  saveColumnSettings(columns);
});

colSectorCheckbox.addEventListener('change', () => {
  columns.sectorDelta = colSectorCheckbox.checked;
  applyColumnVisibility();
  saveColumnSettings(columns);
});

colCompoundCheckbox.checked = columns.compound;
colSectorCheckbox.checked = columns.sectorDelta;
applyColumnVisibility();

wireEditMode(widgetEl, resizeGripEl);
// Verlaesst der Nutzer den Edit-Modus, ist der Zahnrad-Knopf ohnehin nicht
// mehr klickbar (siehe relative.css) - das Panel soll dann nicht unsichtbar
// "offen" haengen bleiben, sonst wirkt ein spaeterer Wiedereinstieg in den
// Edit-Modus so, als waere gar nichts passiert.
window.overlayAPI.onEditModeChange((editMode) => {
  if (!editMode) settingsPanel.classList.add('is-hidden');
});

new TelemetryClient(WS_URL).onRender(render).start();
