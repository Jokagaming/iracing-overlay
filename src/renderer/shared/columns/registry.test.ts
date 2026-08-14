import { describe, expect, it } from 'vitest';
import { columnById, columnsFor, COLUMN_REGISTRY, type ColumnContext, type ColumnRow } from './registry.js';
import type { PlayerState, SectorResult } from '../../../data/types.js';

const REQUIRED_COLUMN_IDS = [
  'position',
  'classPosition',
  'carNumber',
  'driverName',
  'countryFlag',
  'iRating',
  'safetyRating',
  'licenseClass',
  'carBrand',
  'tireCompound',
  'stintLaps',
  'lastLap',
  'bestLap',
  'gapToLeader',
  'gapToPlayer',
  'pitStops',
  'driverTag',
  'driverTagNote',
];

function makeRow(overrides: Partial<ColumnRow> & { carIdx: number }): ColumnRow {
  return {
    isPlayer: false,
    isPaceCar: false,
    isSpectator: false,
    isAI: false,
    userName: 'Fahrer',
    carNumber: '7',
    carClassId: 1,
    carName: 'Testwagen',
    iRating: 3000,
    safetyRating: 'A 3.45',
    licenseColor: '#0153db',
    position: 1,
    classPosition: 1,
    lap: 1,
    lapDistPct: 0,
    estTimeSec: null,
    onPitRoad: false,
    trackSurface: 'on_track',
    lastLapSec: null,
    bestLapSec: null,
    gapToLeaderSec: 0,
    tireCompound: null,
    sectorTimes: [],
    trackPosition: null,
    pitStopCount: 0,
    stintLaps: 0,
    ...overrides,
  };
}

function makeContext(overrides: Partial<ColumnContext> = {}): ColumnContext {
  return {
    classes: new Map(),
    player: {} as PlayerState,
    refSectorIndex: null,
    playerRefSec: null,
    driverTags: new Map(),
    classGroupColor: () => '#ffffff',
    ...overrides,
  };
}

describe('COLUMN_REGISTRY', () => {
  it('enthaelt mindestens alle von der Aufgabenstellung geforderten Spalten', () => {
    const ids = COLUMN_REGISTRY.map((c) => c.id);
    for (const required of REQUIRED_COLUMN_IDS) {
      expect(ids).toContain(required);
    }
  });

  it('columnsFor() filtert nach availableFor', () => {
    const relativeOnly = columnsFor('relative').find((c) => c.id === 'sectorDelta');
    const standingsOnly = columnsFor('standings').find((c) => c.id === 'sectorDelta');
    expect(relativeOnly).toBeDefined();
    expect(standingsOnly).toBeUndefined();
  });

  it('columnById() findet eine bekannte Spalte und liefert undefined fuer eine unbekannte', () => {
    expect(columnById('driverName')?.label).toBe('Fahrer');
    expect(columnById('does-not-exist')).toBeUndefined();
  });
});

describe('gapToPlayer', () => {
  const col = columnById('gapToPlayer')!;

  it('zeigt BOX bei Autos in der Box', () => {
    const row = makeRow({ carIdx: 1, onPitRoad: true });
    expect(col.render(row, makeContext())).toEqual({ text: 'BOX', className: 'is-pit' });
  });

  it('zeigt einen Strich fuer die eigene Zeile', () => {
    const row = makeRow({ carIdx: 1, isPlayer: true });
    expect(col.render(row, makeContext())).toEqual({ text: '—', className: 'is-player' });
  });

  it('faerbt negative Gaps als "voraus", positive als "dahinter"', () => {
    const ahead = makeRow({ carIdx: 1, gapSeconds: -1.2 });
    const behind = makeRow({ carIdx: 2, gapSeconds: 1.2 });
    expect(col.render(ahead, makeContext()).className).toBe('is-gap--ahead');
    expect(col.render(behind, makeContext()).className).toBe('is-gap--behind');
  });
});

describe('licenseClass', () => {
  it('extrahiert die Lizenzstufe aus dem SDK-Format "A 3.45"', () => {
    const col = columnById('licenseClass')!;
    const row = makeRow({ carIdx: 1, safetyRating: 'B 2.10' });
    expect(col.render(row, makeContext()).text).toBe('B');
  });
});

describe('driverTag / driverTagNote', () => {
  it('zeigt leer ohne hinterlegten Tag, sonst Label/Notiz aus dem Kontext', () => {
    const tagCol = columnById('driverTag')!;
    const noteCol = columnById('driverTagNote')!;
    const row = makeRow({ carIdx: 1, userName: 'Rivale' });

    expect(tagCol.render(row, makeContext()).text).toBe('');

    const ctx = makeContext({ driverTags: new Map([['Rivale', { label: 'Rival', color: '#ff0000', note: 'bremst spaet' }]]) });
    expect(tagCol.render(row, ctx)).toEqual({ text: 'Rival', style: { color: '#ff0000' } });
    expect(noteCol.render(row, ctx).text).toBe('bremst spaet');
  });
});

describe('sectorDelta', () => {
  it('vergleicht die Zeit im Referenz-Sektor gegen den Spieler', () => {
    const col = columnById('sectorDelta')!;
    const sectorTimes: SectorResult[] = [
      { num: 1, lastSec: 10, bestSec: 10, isPersonalBest: true },
      { num: 2, lastSec: 12, bestSec: 12, isPersonalBest: true },
    ];
    const row = makeRow({ carIdx: 1, sectorTimes });
    const ctx = makeContext({ refSectorIndex: 0, playerRefSec: 9 });

    expect(col.render(row, ctx)).toEqual({ text: '+1.0', className: 'is-gap--behind' });
  });
});
