import { TelemetryClient } from '../shared/client.js';
import { wireEditMode } from '../shared/editMode.js';
import * as format from '../shared/format.js';

const params = new URLSearchParams(location.search);
const WS_URL = params.get('ws') ?? 'ws://127.0.0.1:8778';

const widgetEl = document.getElementById('widget') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const bodyEl = document.getElementById('body') as HTMLDivElement;
const resizeGripEl = document.getElementById('resize-grip') as HTMLDivElement;
const list = document.getElementById('list') as HTMLUListElement;
const liveRow = document.getElementById('live-row') as HTMLDivElement;
const liveNumEl = document.getElementById('live-num') as HTMLSpanElement;
const liveTimeEl = document.getElementById('live-time') as HTMLSpanElement;

interface RowElements {
  li: HTMLLIElement;
  num: HTMLSpanElement;
  last: HTMLSpanElement;
  session: HTMLSpanElement;
  field: HTMLSpanElement;
}

/** Wiederverwendeter Pool statt bei jedem Frame neu zu bauen (siehe relative/main.ts). */
const rowPool: RowElements[] = [];

function setText(el: HTMLElement, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}

function showStatus(text: string): void {
  setText(statusEl, text);
  statusEl.classList.remove('is-hidden');
  bodyEl.classList.add('is-hidden');
}

function createRow(): RowElements {
  const li = document.createElement('li');
  li.className = 'sectors__row';
  li.innerHTML = `<span class="sectors__num"></span><span class="sectors__time"></span><span class="sectors__time sectors__time--session"></span><span class="sectors__time"></span>`;
  const [num, last, session, field] = li.children as unknown as HTMLSpanElement[];
  const row: RowElements = { li, num: num!, last: last!, session: session!, field: field! };
  rowPool.push(row);
  list.append(li);
  return row;
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

  const { sectorTimes, currentSector } = client.telemetry.player;
  if (sectorTimes.length === 0) {
    showStatus('Keine Sektoren fuer diese Strecke definiert');
    return;
  }

  statusEl.classList.add('is-hidden');
  bodyEl.classList.remove('is-hidden');

  sectorTimes.forEach((sector, index) => {
    const row = rowPool[index] ?? createRow();
    row.li.classList.remove('is-hidden');
    setText(row.num, `S${sector.num}`);
    setText(row.last, sector.lastSec != null ? format.gap(sector.lastSec, 2) : '--');
    // Feld-Bestzeit geschlagen wiegt schwerer als nur die eigene Bestzeit -
    // lila statt gruen, sim-racing-uebliche Konvention (siehe overlay.css).
    const beatField = sector.fieldBestSec != null && sector.lastSec != null && sector.lastSec <= sector.fieldBestSec;
    row.last.classList.toggle('sectors__time--best', sector.isPersonalBest && !beatField);
    row.last.classList.toggle('sectors__time--field-best', beatField);
    setText(row.session, sector.bestSec != null ? format.gap(sector.bestSec, 2) : '--');
    setText(row.field, sector.fieldBestSec != null ? format.gap(sector.fieldBestSec, 2) : '--');
    row.field.classList.toggle('sectors__time--field-best', sector.fieldBestSec != null);
  });
  for (let i = sectorTimes.length; i < rowPool.length; i += 1) rowPool[i]!.li.classList.add('is-hidden');

  if (currentSector) {
    liveRow.classList.remove('is-hidden');
    setText(liveNumEl, `S${currentSector.num}`);
    setText(liveTimeEl, format.gap(currentSector.elapsedSec, 1));
  } else {
    liveRow.classList.add('is-hidden');
  }
}

wireEditMode(widgetEl, resizeGripEl);
new TelemetryClient(WS_URL).onRender(render).start();
