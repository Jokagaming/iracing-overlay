import { describe, expect, it } from 'vitest';
import { TrackPositionTracker } from './trackPosition.js';

describe('TrackPositionTracker', () => {
  it('liefert keine Position, bevor eine Runde vollstaendig aufgezeichnet ist', () => {
    const tracker = new TrackPositionTracker();
    tracker.update(20, 0, 0, 0.5, 0);
    tracker.update(20, 0, 0, 0.6, 0.5);
    expect(tracker.referencePolyline).toEqual([]);
    expect(tracker.positionForPct(0.5)).toBeNull();
  });

  it('verwirft den unvollstaendigen ersten Rundenabschnitt und startet am ersten Rundenwechsel bei (0,0)', () => {
    const tracker = new TrackPositionTracker();
    // Start mitten in einer Runde (z.B. Session-/App-Start mid-lap) - driftet
    // vor sich hin, wird aber nie Teil der Referenz.
    tracker.update(20, 0, 0, 0.5, 0);
    tracker.update(20, 0, 0, 0.9, 20);
    // Erster Rundenwechsel - bekannter Punkt (Start-/Ziellinie).
    tracker.update(20, 0, 0, 0.0, 20.5);
    expect(tracker.current).toEqual({ x: 0, y: 0 });
  });

  it('zeichnet zwischen erstem und zweitem Rundenwechsel eine Referenz-Polylinie auf', () => {
    const tracker = new TrackPositionTracker();
    tracker.update(20, 0, 0, 0.9, 0); // Vorlauf, verworfen
    tracker.update(20, 0, 0, 0.0, 0.5); // 1. Wechsel -> Aufzeichnung startet bei (0,0)
    expect(tracker.referencePolyline).toEqual([]); // noch nicht komplett

    tracker.update(20, 0, 0, 0.9, 1); // dt=0.5s, gerade Fahrt (yaw=0,vy=0): x=10
    tracker.update(20, 0, 0, 0.0, 1.5); // 2. Wechsel -> Referenz jetzt komplett

    expect(tracker.referencePolyline.length).toBeGreaterThan(0);
    expect(tracker.positionForPct(0)).toEqual({ x: 0, y: 0 });
    expect(tracker.positionForPct(0.9)?.x).toBeCloseTo(10, 5);
  });

  it('interpoliert zwischen zwei Referenzpunkten', () => {
    const tracker = new TrackPositionTracker();
    tracker.update(20, 0, 0, 0.9, 0); // Vorlauf
    tracker.update(20, 0, 0, 0.0, 0.5); // 1. Wechsel -> reference[0] = (0,0)
    tracker.update(20, 0, 0, 0.002, 0.6); // dt=0.1s -> x=2, ein Referenz-Intervall weiter -> reference[1] = (2,0)
    tracker.update(20, 0, 0, 0.9, 0.7);
    tracker.update(20, 0, 0, 0.0, 0.8); // 2. Wechsel -> komplett

    // Genau zwischen reference[0]=(0,0) und reference[1]=(2,0).
    const mid = tracker.positionForPct(0.001);
    expect(mid?.x).toBeCloseTo(1, 5);
  });

  it('setzt die Integration bei jedem weiteren Rundenwechsel wieder auf den bekannten Startpunkt zurueck (Drift-Korrektur)', () => {
    const tracker = new TrackPositionTracker();
    tracker.update(20, 0, 0, 0.9, 0);
    tracker.update(20, 0, 0, 0.0, 0.5); // 1. Wechsel
    tracker.update(20, 0, 0, 0.9, 1);
    tracker.update(20, 0, 0, 0.0, 1.5); // 2. Wechsel -> Referenz komplett, Reset auf (0,0)
    expect(tracker.current).toEqual({ x: 0, y: 0 });

    tracker.update(20, 0, 0, 0.9, 2); // driftet weiter
    tracker.update(20, 0, 0, 0.0, 2.5); // 3. Wechsel -> wieder auf (0,0) zurueckgesetzt statt Fehler aufzusummieren
    expect(tracker.current).toEqual({ x: 0, y: 0 });
  });

  it('rotiert fahrzeugbezogene Geschwindigkeit mit YawNorth in Weltkoordinaten', () => {
    const tracker = new TrackPositionTracker();
    const north = Math.PI / 2;
    tracker.update(20, 0, north, 0.9, 0); // Vorlauf
    tracker.update(20, 0, north, 0.0, 0.5); // 1. Wechsel -> reference[0] = (0,0)
    // yawNorth=90° -> "vorwaerts" (vx) zeigt komplett in Welt-Y, nicht Welt-X.
    tracker.update(20, 0, north, 0.3, 1); // dt=0.5s -> (0, 10)
    tracker.update(20, 0, north, 0.9, 1.5);
    tracker.update(20, 0, north, 0.0, 2); // 2. Wechsel -> komplett

    const p = tracker.positionForPct(0.3);
    expect(p?.x).toBeCloseTo(0, 5);
    expect(p?.y).toBeCloseTo(10, 5);
  });
});
