/**
 * Rekonstruiert die 2D-Position des Spielers auf der Strecke per
 * Dead-Reckoning aus `VelocityX`/`VelocityY` (fahrzeugbezogen: X=vorwaerts,
 * Y=seitlich) und `YawNorth` (Kompass-Kurs) - das SDK liefert keine
 * direkten Weltkoordinaten (kein PositionX/Y, kein Lat/Lon). Gegen echte
 * Fahrdaten verifiziert (siehe README "Track Map"): bei einer ~160°-
 * Kursaenderung blieb VelocityX klar dominant und VelocityY klein, was bei
 * weltbezogenen Achsen nicht der Fall waere - die Rotation mit YawNorth ist
 * also der richtige Schritt von fahrzeug- zu weltbezogen. Ohne GPS-Referenz
 * bleibt offen, ob "oben" auf der Karte wirklich Norden ist oder die Karte
 * spiegelverkehrt ist - die *Form* der Strecke und die Position der Autos
 * zueinander sind trotzdem korrekt.
 *
 * Reine Integration driftet ueber eine Runde spuerbar (Messrauschen,
 * Euler-Integration bei ~60Hz). Deshalb: waehrend der ersten Runde ab dem
 * ersten beobachteten Rundenwechsel (bekannter Startpunkt) eine
 * Referenz-Polylinie aufzeichnen (lapDistPct -> x,y); ab da bei jedem
 * weiteren Rundenwechsel die Integration wieder auf den bekannten
 * Startpunkt zuruecksetzen, statt den Fehler ueber mehrere Runden
 * aufzusummieren.
 *
 * Die Referenz-Polylinie hat einen zweiten Zweck: andere Autos liefern kein
 * eigenes VelocityX/Y/YawNorth (nur CarIdx-Arrays wie LapDistPct), lassen
 * sich damit aber trotzdem auf der Karte platzieren - jedes Auto faehrt
 * dieselbe physische Strecke, also reicht Interpolation auf derselben
 * Polylinie anhand seines lapDistPct.
 */

import type { TrackPosition } from '../types.js';

/** Alle ~0.2% Rundendistanz ein Referenzpunkt - 500 Punkte/Runde, fein genug fuer eine Kartendarstellung. */
const REFERENCE_INTERVAL_PCT = 0.002;
const REFERENCE_POINTS = Math.round(1 / REFERENCE_INTERVAL_PCT);
/** Grosszuegige Obergrenze fuer ein plausibles dt zwischen zwei Ticks - filtert Aussetzer/Pausen statt sie als Bewegung zu integrieren. */
const MAX_PLAUSIBLE_DT_SEC = 1;

export class TrackPositionTracker {
  private x = 0;
  private y = 0;
  private lastLapDistPct: number | null = null;
  private lastSessionTimeSec: number | null = null;
  private reference: (TrackPosition | undefined)[] = [];
  private nextReferenceIndex = 0;
  /** Zwischen dem ersten beobachteten Rundenwechsel (bekannter Startpunkt) und dem zweiten (Polylinie komplett). */
  private recording = false;
  private referenceComplete = false;

  update(velocityXMs: number, velocityYMs: number, yawNorthRad: number, lapDistPct: number, sessionTimeSec: number): void {
    if (this.lastSessionTimeSec == null) {
      this.lastSessionTimeSec = sessionTimeSec;
      this.lastLapDistPct = lapDistPct;
      return;
    }

    const dt = sessionTimeSec - this.lastSessionTimeSec;
    this.lastSessionTimeSec = sessionTimeSec;
    if (dt > 0 && dt < MAX_PLAUSIBLE_DT_SEC) {
      const worldVx = velocityXMs * Math.cos(yawNorthRad) - velocityYMs * Math.sin(yawNorthRad);
      const worldVy = velocityXMs * Math.sin(yawNorthRad) + velocityYMs * Math.cos(yawNorthRad);
      this.x += worldVx * dt;
      this.y += worldVy * dt;
    }

    const wrapped = this.lastLapDistPct != null && lapDistPct < this.lastLapDistPct - 0.5;
    this.lastLapDistPct = lapDistPct;

    if (wrapped) {
      if (this.recording && !this.referenceComplete) this.referenceComplete = true;
      if (!this.recording) {
        this.recording = true;
        this.nextReferenceIndex = 0;
      }
      if (this.recording) {
        // Bekannter Punkt (Start-/Ziellinie) - Integrationsfehler kann sich
        // dadurch nie ueber mehr als eine Runde aufsummieren.
        this.x = 0;
        this.y = 0;
      }
    }

    if (this.recording && !this.referenceComplete) {
      const index = Math.min(REFERENCE_POINTS - 1, Math.floor(lapDistPct / REFERENCE_INTERVAL_PCT));
      while (this.nextReferenceIndex <= index) {
        this.reference[this.nextReferenceIndex] = { x: this.x, y: this.y };
        this.nextReferenceIndex += 1;
      }
    }
  }

  get current(): TrackPosition {
    return { x: this.x, y: this.y };
  }

  get isReferenceComplete(): boolean {
    return this.referenceComplete;
  }

  /** Fertige Polylinie fuer Kartendarstellung/Interpolation - `[]` bevor eine Runde komplett aufgezeichnet ist. Ueberspringt vereinzelte Luecken (letzter Punkt vor dem Rundenwechsel wird nicht immer exakt getroffen). */
  get referencePolyline(): TrackPosition[] {
    if (!this.referenceComplete) return [];
    return this.reference.filter((p): p is TrackPosition => p != null);
  }

  /** Interpoliert eine Position anhand von lapDistPct auf der Referenz-Polylinie - fuer Autos ohne eigene Velocity-Telemetrie. `null`, solange die Polylinie nicht fertig ist. */
  positionForPct(lapDistPct: number): TrackPosition | null {
    const points = this.referencePolyline;
    if (points.length < 2) return null;
    const rawIndex = ((lapDistPct % 1) + 1) % 1 / REFERENCE_INTERVAL_PCT;
    const i0 = Math.floor(rawIndex) % points.length;
    const i1 = (i0 + 1) % points.length;
    const frac = rawIndex - Math.floor(rawIndex);
    const p0 = points[i0]!;
    const p1 = points[i1]!;
    return { x: p0.x + (p1.x - p0.x) * frac, y: p0.y + (p1.y - p0.y) * frac };
  }
}
