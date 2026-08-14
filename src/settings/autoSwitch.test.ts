import { describe, expect, it } from 'vitest';
import { resolveActiveLayoutId, ruleMatches } from './autoSwitch.js';
import { createEmptyLayout, type Layout } from './layout.js';

const SELECTORS = { carName: 'Mercedes-AMG GT3', seriesName: 'IMSA Weekly', sessionType: 'Race' };

describe('ruleMatches', () => {
  it('vergleicht als Teilstring ohne Gross-/Kleinschreibung', () => {
    expect(ruleMatches({ id: '1', selectorType: 'car', matchValue: 'gt3' }, SELECTORS)).toBe(true);
    expect(ruleMatches({ id: '1', selectorType: 'car', matchValue: 'GT4' }, SELECTORS)).toBe(false);
  });

  it('prueft das richtige Feld je selectorType', () => {
    expect(ruleMatches({ id: '1', selectorType: 'series', matchValue: 'imsa' }, SELECTORS)).toBe(true);
    expect(ruleMatches({ id: '1', selectorType: 'sessionType', matchValue: 'qualify' }, SELECTORS)).toBe(false);
    expect(ruleMatches({ id: '1', selectorType: 'sessionType', matchValue: 'race' }, SELECTORS)).toBe(true);
  });

  it('matcht nie bei leerem Vergleichswert (verhindert, dass eine unausgefuellte Regel ungewollt immer passt)', () => {
    expect(ruleMatches({ id: '1', selectorType: 'car', matchValue: '' }, SELECTORS)).toBe(false);
    expect(ruleMatches({ id: '1', selectorType: 'car', matchValue: '   ' }, SELECTORS)).toBe(false);
  });
});

describe('resolveActiveLayoutId', () => {
  it('liefert das erste Layout, dessen Regel passt', () => {
    const oval: Layout = { ...createEmptyLayout('oval', 'Oval'), autoSwitchRules: [{ id: '1', selectorType: 'car', matchValue: 'Oval-Auto' }] };
    const gt3: Layout = { ...createEmptyLayout('gt3', 'GT3'), autoSwitchRules: [{ id: '2', selectorType: 'car', matchValue: 'GT3' }] };

    expect(resolveActiveLayoutId([oval, gt3], SELECTORS)).toBe('gt3');
  });

  it('liefert null, wenn kein Layout passt - Aufrufer soll dann beim aktiven Layout bleiben', () => {
    const oval: Layout = { ...createEmptyLayout('oval', 'Oval'), autoSwitchRules: [{ id: '1', selectorType: 'car', matchValue: 'Oval-Auto' }] };
    expect(resolveActiveLayoutId([oval], SELECTORS)).toBeNull();
  });

  it('ignoriert Layouts ohne Auto-Switch-Regeln', () => {
    const manual = createEmptyLayout('manual', 'Manuell');
    expect(resolveActiveLayoutId([manual], SELECTORS)).toBeNull();
  });
});
