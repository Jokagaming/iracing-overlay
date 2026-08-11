/**
 * Berechnet Sektorzeiten aus Rundenfortschritt - das SDK liefert nur die
 * Sektorgrenzen (`SplitTimeInfo.Sectors`, siehe types.ts `SectorBoundary`),
 * keine fertigen Zeiten. Ein {@link SectorTracker} beobachtet, wann
 * `lapDistPct` eine Sektorgrenze ueberquert, und misst die vergangene
 * Session-Zeit seit der letzten Ueberquerung - analog zu FuelTracker
 * (calc/fuel.ts) und LapTimeTracker (calc/laptimes.ts) zustandsbehaftet
 * statt eine reine Funktion.
 */

import type { SectorBoundary, SectorResult } from '../types.js';

/** Grosszuegige Obergrenze fuer eine plausible Sektorzeit - filtert Session-Zeit-Ruecksetzer (Reset/Replay) statt sie als Messung zu uebernehmen. */
const MAX_PLAUSIBLE_SECTOR_SEC = 600;

export class SectorTracker {
  private boundaries: SectorBoundary[] = [];
  private currentIndex = -1;
  private sectorStartTimeSec: number | null = null;
  private readonly lastByNum = new Map<number, number>();
  private readonly bestByNum = new Map<number, number>();

  /** Bei Session-/Streckenwechsel aufrufen - die Grenzen koennen sich mit der Strecke aendern. */
  setBoundaries(boundaries: SectorBoundary[]): void {
    this.boundaries = [...boundaries].sort((a, b) => a.startPct - b.startPct);
    this.currentIndex = -1;
    this.sectorStartTimeSec = null;
  }

  private indexFor(lapDistPct: number): number {
    let index = 0;
    for (let i = 0; i < this.boundaries.length; i += 1) {
      if (lapDistPct >= this.boundaries[i]!.startPct) index = i;
    }
    return index;
  }

  /** Einmal pro Tick aufrufen, mit dem aktuellen Rundenfortschritt und der Session-Zeit des Spielers. */
  update(lapDistPct: number, sessionTimeSec: number): void {
    if (this.boundaries.length === 0) return;

    const index = this.indexFor(lapDistPct);

    if (this.currentIndex === -1) {
      this.currentIndex = index;
      this.sectorStartTimeSec = sessionTimeSec;
      return;
    }

    if (index !== this.currentIndex && this.sectorStartTimeSec != null) {
      const elapsed = sessionTimeSec - this.sectorStartTimeSec;
      if (elapsed > 0 && elapsed < MAX_PLAUSIBLE_SECTOR_SEC) {
        const num = this.boundaries[this.currentIndex]!.num;
        this.lastByNum.set(num, elapsed);
        const best = this.bestByNum.get(num);
        if (best == null || elapsed < best) this.bestByNum.set(num, elapsed);
      }
      this.currentIndex = index;
      this.sectorStartTimeSec = sessionTimeSec;
    }
  }

  get results(): SectorResult[] {
    return this.boundaries.map((b) => {
      const lastSec = this.lastByNum.get(b.num) ?? null;
      const bestSec = this.bestByNum.get(b.num) ?? null;
      return { num: b.num, lastSec, bestSec, isPersonalBest: lastSec != null && lastSec === bestSec };
    });
  }

  get currentSectorNum(): number | null {
    return this.currentIndex >= 0 ? (this.boundaries[this.currentIndex]?.num ?? null) : null;
  }

  /** Wie lange der gerade laufende Sektor schon dauert - `null` ohne Sektoren oder vor der ersten Messung. */
  currentElapsedSec(sessionTimeSec: number): number | null {
    return this.sectorStartTimeSec != null ? sessionTimeSec - this.sectorStartTimeSec : null;
  }
}
