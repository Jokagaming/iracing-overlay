import { describe, expect, it } from 'vitest';
import { classGroupKey, hashColor } from './classGrouping.js';

describe('classGroupKey', () => {
  it('liefert null im Modus "none"', () => {
    expect(classGroupKey({ carClassId: 5, carNumber: '123' }, 'none')).toBeNull();
  });

  it('nutzt die SDK-Fahrzeugklasse im Modus "bySimClass"', () => {
    expect(classGroupKey({ carClassId: 2708, carNumber: '7' }, 'bySimClass')).toBe('2708');
    expect(classGroupKey({ carClassId: null, carNumber: '7' }, 'bySimClass')).toBeNull();
  });

  it('gruppiert nach der Hunderterstelle der Startnummer im Modus "byCarNumberHundreds"', () => {
    expect(classGroupKey({ carClassId: null, carNumber: '142' }, 'byCarNumberHundreds')).toBe('100');
    expect(classGroupKey({ carClassId: null, carNumber: '278' }, 'byCarNumberHundreds')).toBe('200');
    expect(classGroupKey({ carClassId: null, carNumber: '7' }, 'byCarNumberHundreds')).toBe('0');
  });

  it('liefert null fuer eine nicht-numerische Startnummer im Hunderter-Modus', () => {
    expect(classGroupKey({ carClassId: null, carNumber: '' }, 'byCarNumberHundreds')).toBeNull();
  });
});

describe('hashColor', () => {
  it('liefert fuer denselben Schluessel immer dieselbe Farbe', () => {
    expect(hashColor('100')).toBe(hashColor('100'));
  });

  it('liefert fuer unterschiedliche Schluessel meist unterschiedliche Farben', () => {
    expect(hashColor('100')).not.toBe(hashColor('200'));
  });

  it('liefert einen gueltigen CSS-hsl()-String', () => {
    expect(hashColor('300')).toMatch(/^hsl\(\d+, 70%, 55%\)$/);
  });
});
