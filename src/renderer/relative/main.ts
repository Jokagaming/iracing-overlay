/**
 * Relative-Overlay - erster echter Konsument der Column-Registry
 * (shared/columns/registry.ts) und des generischen Settings-Systems
 * (settings/schema.ts). Die Tabellen-Zeilen bleiben bewusst Vanilla-DOM
 * (hohe Frequenz, siehe README) - nur das Einstellungs-Panel wird generisch
 * aus dem Schema gerendert, per Preact (`h()`/`render()` statt JSX - kein
 * Grund, die ganze Datei auf .tsx umzustellen).
 */

import { h, render as preactRender } from 'preact';
import type { CarClass, TelemetryFrame } from '../../data/types.js';
import { buildRelativeRows, resolveAheadBehind, type RelativeRow } from '../../data/calc/relative.js';
import { TelemetryClient } from '../shared/client.js';
import { wireEditMode } from '../shared/editMode.js';
import { SettingsPanel } from '../shared/settings/SettingsPanel.js';
import { columnById, type ColumnContext, type ColumnDefinition } from '../shared/columns/registry.js';
import { classGroupKey, hashColor } from '../shared/columns/classGrouping.js';
import { RELATIVE_SETTINGS, RELATIVE_DEFAULT_SETTINGS, type RelativeSettings } from './settings.js';

declare global {
  interface Window {
    relativeSettingsAPI: {
      load: () => Promise<Record<string, unknown>>;
      save: (values: Record<string, unknown>) => void;
    };
  }
}

const params = new URLSearchParams(location.search);
const BASE_AHEAD = clampCount(params.get('ahead'), 4);
const BASE_BEHIND = clampCount(params.get('behind'), 4);
const WS_URL = params.get('ws') ?? 'ws://127.0.0.1:8778';

const widgetEl = document.getElementById('widget') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const tableEl = document.getElementById('table') as HTMLTableElement;
const bodyEl = document.getElementById('rows') as HTMLTableSectionElement;
const sessionEl = document.getElementById('session') as HTMLSpanElement;
const resizeGripEl = document.getElementById('resize-grip') as HTMLDivElement;
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const settingsPanelEl = document.getElementById('settings-panel') as HTMLDivElement;

function clampCount(raw: string | null, fallback: number): number {
  // Number(null) ist 0, nicht NaN - ohne den expliziten null-Check wuerde
  // ein fehlender Query-Parameter also "0 Zeilen" statt des Fallbacks
  // ergeben.
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.min(Math.trunc(value), 15);
}

/** Zeilen (samt Zellen) werden wiederverwendet statt bei jedem Frame neu gebaut - siehe rebuildRowCells(). */
interface RowHandle {
  tr: HTMLTableRowElement;
  cells: Map<string, HTMLTableCellElement>;
}

const rowPool: RowHandle[] = [];
let activeColumns: ColumnDefinition[] = [];
let settings: RelativeSettings = RELATIVE_DEFAULT_SETTINGS;

/** Baut die Zellen einer (wiederverwendeten) Zeile passend zur aktuellen Spaltenauswahl neu auf. */
function rebuildRowCells(row: RowHandle): void {
  row.tr.replaceChildren();
  row.cells.clear();
  for (const col of activeColumns) {
    const td = document.createElement('td');
    row.cells.set(col.id, td);
    row.tr.append(td);
  }
}

function createRow(): RowHandle {
  const tr = document.createElement('tr');
  tr.className = 'relative__row';
  const row: RowHandle = { tr, cells: new Map() };
  rebuildRowCells(row);
  rowPool.push(row);
  bodyEl.append(tr);
  return row;
}

/** Wird bei jeder Aenderung der Spaltenauswahl aufgerufen - alle gepoolten Zeilen muessen ihre Zellenstruktur neu aufbauen. */
function applyActiveColumns(): void {
  activeColumns = settings.columns.map((id) => columnById(id)).filter((c): c is ColumnDefinition => c != null);
  for (const row of rowPool) rebuildRowCells(row);
}

function resolveClassColor(row: RelativeRow, classes: Map<number, CarClass>): string {
  const key = classGroupKey(row, settings.classGrouping);
  if (key == null) return (row.carClassId != null ? classes.get(row.carClassId)?.color : undefined) ?? 'transparent';
  if (settings.classGrouping === 'bySimClass') {
    return classes.get(Number(key))?.color ?? hashColor(key);
  }
  return hashColor(key);
}

/**
 * Sektor, den der Spieler zuletzt abgeschlossen hat - der ist immer einen
 * Index vor dem gerade laufenden (siehe calc/sectors.ts). Referenz fuer den
 * Sektor-Vergleich: derselbe Streckenabschnitt bei allen Zeilen, statt bei
 * jedem Auto seinen jeweils eigenen letzten Sektor zu nehmen (die waeren
 * bei Autos mit groesserem Abstand nicht mehr derselbe Abschnitt).
 */
function referenceSectorIndex(player: TelemetryFrame['player']): number | null {
  if (!player.currentSector || player.sectorTimes.length === 0) return null;
  const idx = player.sectorTimes.findIndex((s) => s.num === player.currentSector!.num);
  if (idx === -1) return null;
  return (idx - 1 + player.sectorTimes.length) % player.sectorTimes.length;
}

function renderRow(row: RowHandle, entry: RelativeRow, ctx: ColumnContext): void {
  row.tr.classList.toggle('relative__row--player', entry.isPlayer);
  row.tr.classList.toggle('relative__row--pit', entry.onPitRoad || entry.trackSurface === 'in_pit_stall');
  row.tr.classList.remove('is-hidden');

  for (const col of activeColumns) {
    const td = row.cells.get(col.id);
    if (!td) continue;
    const cell = col.render(entry, ctx);
    if (td.textContent !== cell.text) td.textContent = cell.text;
    td.className = cell.className ? `relative__cell ${cell.className}` : 'relative__cell';
    td.style.cssText = `width:${col.width};text-align:${col.align};`;
    if (cell.style) {
      for (const [key, value] of Object.entries(cell.style)) td.style.setProperty(key, value);
    }
  }
}

function setText(el: HTMLElement, value: string): void {
  if (el.textContent !== value) el.textContent = value;
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

  const { ahead, behind } = resolveAheadBehind(BASE_AHEAD, BASE_BEHIND, settings.minVisibleDrivers);
  const rows = buildRelativeRows(client.telemetry, client.session.estLapTimeSec, { ahead, behind });
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

  const ctx: ColumnContext = {
    classes,
    player: client.telemetry.player,
    refSectorIndex,
    playerRefSec,
    // Noch keine Persistenz/UI zum Setzen eines Tags, siehe shared/columns/registry.ts.
    driverTags: new Map(),
    classGroupColor: (row) => resolveClassColor(row as RelativeRow, classes),
  };

  rows.forEach((entry, index) => {
    renderRow(rowPool[index] ?? createRow(), entry, ctx);
  });
  // Uebrige Zeilen aus einem volleren Feld ausblenden statt entfernen -
  // beim naechsten Frame sind sie eventuell wieder gebraucht.
  for (let i = rows.length; i < rowPool.length; i += 1) {
    rowPool[i]!.tr.classList.add('is-hidden');
  }
}

function persistSettings(): void {
  window.relativeSettingsAPI.save(settings);
}

function renderSettingsPanel(): void {
  preactRender(
    h(SettingsPanel, {
      fields: RELATIVE_SETTINGS.settingsSchema,
      // RelativeSettings hat konkrete Feldtypen (string[]/number/enum), die
      // alle in SettingsPrimitive passen - der generische Renderer kennt
      // aber nur die breite Record-Form.
      values: settings as unknown as Record<string, import('../../settings/schema.js').SettingsPrimitive>,
      onChange: (key, value) => {
        settings = { ...settings, [key]: value };
        if (key === 'columns') applyActiveColumns();
        persistSettings();
        renderSettingsPanel();
      },
    }),
    settingsPanelEl,
  );
}

async function init(): Promise<void> {
  try {
    const loaded = await window.relativeSettingsAPI.load();
    settings = { ...RELATIVE_DEFAULT_SETTINGS, ...loaded } as RelativeSettings;
  } catch (err) {
    console.error('[relative] Settings konnten nicht geladen werden, nutze Defaults:', err);
  }
  applyActiveColumns();
  renderSettingsPanel();

  settingsBtn.addEventListener('click', () => {
    settingsPanelEl.classList.toggle('is-hidden');
  });

  wireEditMode(widgetEl, resizeGripEl);
  // Verlaesst der Nutzer den Edit-Modus, ist der Zahnrad-Knopf ohnehin nicht
  // mehr klickbar (siehe relative.css) - das Panel soll dann nicht unsichtbar
  // "offen" haengen bleiben, sonst wirkt ein spaeterer Wiedereinstieg in den
  // Edit-Modus so, als waere gar nichts passiert.
  window.overlayAPI.onEditModeChange((editMode) => {
    if (!editMode) settingsPanelEl.classList.add('is-hidden');
  });

  new TelemetryClient(WS_URL).onRender(render).start();
}

void init();
