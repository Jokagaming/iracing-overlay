/**
 * Zeichnet die per Dead-Reckoning rekonstruierte Streckenform
 * (calc/trackPosition.ts) plus die Position aller sichtbaren Autos.
 *
 * Ohne GPS-Referenz vom SDK ist nicht verifizierbar, ob "oben" auf dieser
 * Karte wirklich Norden ist oder die Karte spiegelverkehrt ist (siehe
 * README "Track Map") - die Form der Strecke und die Positionen der Autos
 * zueinander stimmen trotzdem. Bis eine ganze Runde gefahren ist, gibt es
 * noch keine Referenz-Polylinie (`client.trackMap`) - bis dahin nur ein
 * Hinweistext statt einer leeren Flaeche.
 */

import { TelemetryClient } from '../shared/client.js';
import { wireEditMode } from '../shared/editMode.js';
import type { TrackPosition } from '../../data/types.js';

const params = new URLSearchParams(location.search);
const WS_URL = params.get('ws') ?? 'ws://127.0.0.1:8778';

const widgetEl = document.getElementById('widget') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const bodyEl = document.getElementById('body') as HTMLDivElement;
const resizeGripEl = document.getElementById('resize-grip') as HTMLDivElement;
const canvas = document.getElementById('map') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const PADDING_FRACTION = 0.12;
const DOT_RADIUS_PX = 4;
const PLAYER_DOT_RADIUS_PX = 5;

function showStatus(text: string): void {
  statusEl.textContent = text;
  statusEl.classList.remove('is-hidden');
  bodyEl.classList.add('is-hidden');
}

/** Passt die Canvas-Aufloesung an die tatsaechliche Anzeigegroesse an - sonst wirkt die Karte bei hochaufloesenden Monitoren unscharf/verpixelt. */
function resizeCanvasIfNeeded(): void {
  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.round(canvas.clientWidth * dpr);
  const targetHeight = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function boundsOf(points: TrackPosition[]): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

/** Weltkoordinaten -> Canvas-Pixel, zentriert und mit gleichem Massstab in beide Richtungen (sonst wirkt die Strecke gestaucht/gestreckt). */
function makeProjector(bounds: Bounds, canvasWidth: number, canvasHeight: number): (p: TrackPosition) => [number, number] {
  const worldWidth = Math.max(1, bounds.maxX - bounds.minX);
  const worldHeight = Math.max(1, bounds.maxY - bounds.minY);
  const availableWidth = canvasWidth * (1 - PADDING_FRACTION * 2);
  const availableHeight = canvasHeight * (1 - PADDING_FRACTION * 2);
  const scale = Math.min(availableWidth / worldWidth, availableHeight / worldHeight);
  const worldCenterX = (bounds.minX + bounds.maxX) / 2;
  const worldCenterY = (bounds.minY + bounds.maxY) / 2;

  return (p: TrackPosition) => [
    canvasWidth / 2 + (p.x - worldCenterX) * scale,
    // Bildschirm-Y waechst nach unten, Welt-Y in unserer Integration nach
    // "oben" (Standard-Rotationsmatrix) - spiegeln, sonst liefe die Karte
    // beim Zeichnen auf dem Kopf.
    canvasHeight / 2 - (p.y - worldCenterY) * scale,
  ];
}

function classColor(session: TelemetryClient['session'], carClassId: number | null): string {
  if (!session || carClassId == null) return '#ffffff';
  return session.carClasses.find((c) => c.id === carClassId)?.color ?? '#ffffff';
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
  if (!client.trackMap || client.trackMap.length < 2) {
    showStatus('Fahre eine Runde, um die Karte aufzuzeichnen ...');
    return;
  }

  statusEl.classList.add('is-hidden');
  bodyEl.classList.remove('is-hidden');
  resizeCanvasIfNeeded();

  const bounds = boundsOf(client.trackMap);
  const project = makeProjector(bounds, canvas.width, canvas.height);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  client.trackMap.forEach((p, i) => {
    const [x, y] = project(p);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = Math.max(2, canvas.width * 0.012);
  ctx.lineJoin = 'round';
  ctx.stroke();

  for (const driver of client.telemetry.drivers) {
    if (driver.isSpectator || driver.isPaceCar || !driver.trackPosition) continue;
    const [x, y] = project(driver.trackPosition);
    ctx.beginPath();
    const radius = driver.isPlayer ? PLAYER_DOT_RADIUS_PX : DOT_RADIUS_PX;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = driver.isPlayer ? '#ffd640' : classColor(client.session, driver.carClassId);
    ctx.fill();
    if (driver.isPlayer) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.stroke();
    }
  }
}

wireEditMode(widgetEl, resizeGripEl);
new TelemetryClient(WS_URL).onRender(render).start();
