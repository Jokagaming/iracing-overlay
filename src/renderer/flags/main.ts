import { TelemetryClient } from '../shared/client.js';
import { wireEditMode } from '../shared/editMode.js';

const params = new URLSearchParams(location.search);
const WS_URL = params.get('ws') ?? 'ws://127.0.0.1:8778';

const widgetEl = document.getElementById('widget') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const bodyEl = document.getElementById('body') as HTMLDivElement;
const resizeGripEl = document.getElementById('resize-grip') as HTMLDivElement;

interface BadgeSpec {
  label: string;
  modifier: string;
  /** Mehrere rohe Flag-Bits koennen dieselbe Badge ausloesen (z.B. yellow + caution_waving) - nur einmal anzeigen. */
  matches: string[];
}

// Reihenfolge = Anzeigereihenfolge. Reine Verwaltungs-Bits (Start-Lichter,
// Disqualifikation, Service-erlaubt-Flag) sind bewusst ausgelassen - fuers
// Fahren waehrend der Session sind sie kein Signal, das eine Reaktion braucht.
const BADGES: BadgeSpec[] = [
  { label: 'ROT', modifier: 'red', matches: ['red'] },
  { label: 'SCHWARZ', modifier: 'black', matches: ['black'] },
  { label: 'GELB', modifier: 'yellow', matches: ['yellow', 'yellow_waving', 'caution', 'caution_waving'] },
  { label: 'TRÜMMER', modifier: 'yellow', matches: ['debris'] },
  { label: 'BLAU', modifier: 'blue', matches: ['blue'] },
  { label: '1 RUNDE BIS GRÜN', modifier: 'green', matches: ['one_lap_to_green'] },
  { label: 'GRÜN', modifier: 'green', matches: ['green', 'green_held'] },
  { label: 'LETZTE RUNDE', modifier: 'white', matches: ['white'] },
  { label: 'ZIEL', modifier: 'checkered', matches: ['checkered'] },
  { label: 'NOCH 10', modifier: '', matches: ['ten_to_go'] },
  { label: 'NOCH 5', modifier: '', matches: ['five_to_go'] },
];

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

  const active = new Set(client.telemetry.flags);
  const badges = BADGES.filter((b) => b.matches.some((m) => active.has(m)));

  if (badges.length === 0) {
    showStatus('Keine aktiven Flaggen');
    return;
  }

  statusEl.classList.add('is-hidden');
  bodyEl.classList.remove('is-hidden');

  bodyEl.innerHTML = badges
    .map((b) => `<span class="flags__badge${b.modifier ? ` flags__badge--${b.modifier}` : ''}">${b.label}</span>`)
    .join('');
}

wireEditMode(widgetEl, resizeGripEl);
new TelemetryClient(WS_URL).onRender(render).start();
