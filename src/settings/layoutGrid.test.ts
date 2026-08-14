import { describe, expect, it } from 'vitest';
import { snapRectToGrid, snapToGrid } from './layoutGrid.js';

describe('snapToGrid', () => {
  it('rundet auf das naechste Vielfache der Rastergroesse', () => {
    expect(snapToGrid(23, 10)).toBe(20);
    expect(snapToGrid(27, 10)).toBe(30);
    expect(snapToGrid(25, 10)).toBe(30); // Math.round rundet .5 aufwaerts
  });

  it('laesst den Wert unveraendert, wenn Snapping aus ist (gridSize <= 0)', () => {
    expect(snapToGrid(23, 0)).toBe(23);
    expect(snapToGrid(23, -5)).toBe(23);
  });
});

describe('snapRectToGrid', () => {
  it('snapt Position und Groesse gemeinsam, sodass beide Kanten rasterkonform bleiben', () => {
    const rect = { x: 23, y: 47, width: 103, height: 58 };
    const snapped = snapRectToGrid(rect, 10);
    // x=20, rechte Kante 126->130 (width=110); y=50, untere Kante 105->110 (height=60)
    expect(snapped).toEqual({ x: 20, y: 50, width: 110, height: 60 });
  });

  it('laesst ein Rechteck unveraendert, wenn Snapping aus ist', () => {
    const rect = { x: 23, y: 47, width: 103, height: 58 };
    expect(snapRectToGrid(rect, 0)).toEqual(rect);
  });
});
