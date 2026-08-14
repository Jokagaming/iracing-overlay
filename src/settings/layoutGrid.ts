/** Rasterfang (Grid-Snapping) fuer den Layout-Editor - reine Rechenfunktion, siehe main/layoutEditorIpc.ts bzw. renderer/layout-editor. */

/** `gridSize <= 0` bedeutet "kein Snapping" - Wert unveraendert zurueckgeben statt durch 0 zu teilen. */
export function snapToGrid(value: number, gridSize: number): number {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

export interface SnappableRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Snappt alle vier Kanten eines Rechtecks - x/y (Position) und die Kante gegenueber x/y (x+width, y+height), damit auch die Groesse rasterkonform bleibt statt nur die obere linke Ecke. */
export function snapRectToGrid(rect: SnappableRect, gridSize: number): SnappableRect {
  const x = snapToGrid(rect.x, gridSize);
  const y = snapToGrid(rect.y, gridSize);
  const right = snapToGrid(rect.x + rect.width, gridSize);
  const bottom = snapToGrid(rect.y + rect.height, gridSize);
  return { x, y, width: Math.max(gridSize > 0 ? gridSize : 1, right - x), height: Math.max(gridSize > 0 ? gridSize : 1, bottom - y) };
}
