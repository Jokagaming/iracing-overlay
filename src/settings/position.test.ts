import { describe, expect, it } from 'vitest';
import { resolveDisplay, toOverlayPosition, toPixelBounds, type DisplayInfo } from './position.js';

const PRIMARY: DisplayInfo = { key: 'primary#1920x1080', bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 };
const SECONDARY: DisplayInfo = {
  key: 'secondary#2560x1440',
  bounds: { x: 1920, y: -200, width: 2560, height: 1440 },
  scaleFactor: 1.5,
};

describe('toOverlayPosition / toPixelBounds', () => {
  it('rechnet Pixelbounds relativ zum Display in Prozent um und zurueck (Rundtrip)', () => {
    const bounds = { x: 480, y: 216, width: 384, height: 216 }; // 25%/20%/20%/20% von 1920x1080
    const position = toOverlayPosition(bounds, PRIMARY);

    expect(position).toEqual({ displayKey: 'primary#1920x1080', xPct: 0.25, yPct: 0.2, widthPct: 0.2, heightPct: 0.2, dpiScaleAtSave: 1 });
    expect(toPixelBounds(position, PRIMARY)).toEqual(bounds);
  });

  it('beruecksichtigt den Display-Offset (Monitor nicht bei 0,0, z.B. links/oben vom Hauptmonitor)', () => {
    const bounds = { x: 1920 + 256, y: -200 + 144, width: 256, height: 144 }; // 10%/10%/10%/10% von 2560x1440
    const position = toOverlayPosition(bounds, SECONDARY);

    expect(position.xPct).toBeCloseTo(0.1, 5);
    expect(position.yPct).toBeCloseTo(0.1, 5);
    expect(toPixelBounds(position, SECONDARY)).toEqual(bounds);
  });

  it('erzwingt eine Mindestgroesse statt ein auf 0 geschrumpftes Fenster zu liefern', () => {
    const position = { displayKey: PRIMARY.key, xPct: 0, yPct: 0, widthPct: 0, heightPct: 0.001, dpiScaleAtSave: 1 };
    const bounds = toPixelBounds(position, PRIMARY);
    expect(bounds.width).toBeGreaterThanOrEqual(40);
    expect(bounds.height).toBeGreaterThanOrEqual(40);
  });
});

describe('resolveDisplay', () => {
  it('findet das passende Display anhand des displayKey', () => {
    const position = toOverlayPosition({ x: 0, y: 0, width: 100, height: 100 }, SECONDARY);
    const result = resolveDisplay(position, [PRIMARY, SECONDARY], PRIMARY);
    expect(result.display).toBe(SECONDARY);
    expect(result.fellBackToPrimary).toBe(false);
  });

  it('faellt auf das Hauptdisplay zurueck, wenn der gespeicherte Monitor nicht mehr angeschlossen ist', () => {
    const position = toOverlayPosition({ x: 0, y: 0, width: 100, height: 100 }, SECONDARY);
    const result = resolveDisplay(position, [PRIMARY], PRIMARY);
    expect(result.display).toBe(PRIMARY);
    expect(result.fellBackToPrimary).toBe(true);
  });
});
