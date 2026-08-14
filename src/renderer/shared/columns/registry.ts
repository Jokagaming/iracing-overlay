/**
 * Column-Registry statt fester Tabellen-Templates (siehe Aufgabenstellung).
 * Ein Overlay mit einer Fahrer-Liste (Relative, kuenftig Standings/
 * Leaderboard/Overtake Alert) waehlt eine geordnete Teilmenge von
 * Spalten-IDs aus dieser Liste aus (siehe settings/schema.ts,
 * `columnList`-Feldtyp) - neue Spalte = neuer Eintrag hier, kein neuer
 * Tabellen-Code im jeweiligen Overlay.
 *
 * Datenluecken, ehrlich dokumentiert statt stillschweigend geraten:
 * - `countryFlag`: das SDK liefert kein Land/keine Nationalitaet - Spalte
 *   existiert, zeigt aber immer leer.
 * - `carBrand`: das SDK liefert keine Marke/Hersteller (siehe types.ts,
 *   `Driver.carName`) - zeigt ersatzweise den Fahrzeugnamen.
 * - `driverTag`/`driverTagNote`: Datenmodell + Spalte existieren
 *   (`ColumnContext.driverTags`), aber noch keine Persistenz/UI zum
 *   Setzen eines Tags - zeigt bis dahin immer leer. Siehe README.
 */

import type { CarClass, Driver, PlayerState } from '../../../data/types.js';
import * as format from '../format.js';

export type ColumnAlign = 'left' | 'center' | 'right';

/** Row-Typ, den alle Spalten mindestens verstehen - RelativeRow (calc/relative.ts) erfuellt das, ein blanker Driver mit isPlayer=false ebenso. */
export interface ColumnRow extends Driver {
  isPlayer: boolean;
  /** Nur in einem Relative-artigen Kontext vorhanden - Standings-artige Overlays lassen das weg. */
  gapSeconds?: number;
  lapsAhead?: number;
}

export interface DriverTag {
  label: string;
  color: string;
  note: string;
}

export interface ColumnContext {
  classes: Map<number, CarClass>;
  player: PlayerState;
  /** Sektor-Vergleich (siehe calc/sectors.ts) - `null` ohne definierte Sektoren oder ausserhalb eines Relative-artigen Overlays. */
  refSectorIndex: number | null;
  playerRefSec: number | null;
  /** Vom Nutzer vergebene Fahrer-Markierungen, Schluessel = `Driver.userName`. Aktuell immer leer - siehe Dateikommentar. */
  driverTags: Map<string, DriverTag>;
  /** Farbe fuer die Klassen-Markierung einer Zeile - beruecksichtigt `classGrouping` (siehe settings des jeweiligen Overlays), nicht immer identisch mit `classes.get(carClassId)?.color`. */
  classGroupColor: (row: ColumnRow) => string;
}

export interface ColumnCell {
  text: string;
  className?: string;
  style?: Record<string, string>;
}

export interface ColumnDefinition {
  id: string;
  label: string;
  /** CSS-Breite der Spalte, z.B. "48px" oder "1fr". */
  width: string;
  align: ColumnAlign;
  render: (row: ColumnRow, ctx: ColumnContext) => ColumnCell;
  /** Overlay-IDs, fuer die diese Spalte ueberhaupt sinnvoll ist. */
  availableFor: string[];
}

const DRIVER_LIST_OVERLAYS = ['relative', 'standings'];

/** Format "A 3.45" (siehe types.ts, `Driver.safetyRating`) - erstes Token ist die Lizenzstufe. */
function licenseClassOf(safetyRating: string | null): string {
  if (!safetyRating) return '';
  return safetyRating.split(' ')[0] ?? '';
}

function gapClass(seconds: number, prefix: string): string {
  return seconds < 0 ? `${prefix}--ahead` : `${prefix}--behind`;
}

export const COLUMN_REGISTRY: ColumnDefinition[] = [
  {
    id: 'classColor',
    label: 'Klassenfarbe',
    width: '4px',
    align: 'center',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row, ctx) => ({ text: '', style: { '--class-color': ctx.classGroupColor(row) } }),
  },
  {
    id: 'position',
    label: 'Pos',
    width: '32px',
    align: 'right',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row) => ({ text: row.position ? `P${row.position}` : '' }),
  },
  {
    id: 'classPosition',
    label: 'KlPos',
    width: '32px',
    align: 'right',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row) => ({ text: row.classPosition ? `P${row.classPosition}` : '' }),
  },
  {
    id: 'carNumber',
    label: 'Nr',
    width: '36px',
    align: 'right',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row) => ({ text: row.carNumber ? `#${row.carNumber}` : '' }),
  },
  {
    id: 'driverName',
    label: 'Fahrer',
    width: '1fr',
    align: 'left',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row) => ({ text: format.driverName(row.userName) }),
  },
  {
    id: 'countryFlag',
    label: 'Land',
    width: '24px',
    align: 'center',
    availableFor: DRIVER_LIST_OVERLAYS,
    // Das SDK liefert keine Nationalitaet - siehe Dateikommentar oben.
    render: () => ({ text: '' }),
  },
  {
    id: 'iRating',
    label: 'iR',
    width: '48px',
    align: 'right',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row) => ({ text: format.iRating(row.iRating) }),
  },
  {
    id: 'safetyRating',
    label: 'SR',
    width: '56px',
    align: 'right',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row) => ({ text: row.safetyRating ?? '' }),
  },
  {
    id: 'licenseClass',
    label: 'Lizenz',
    width: '32px',
    align: 'center',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row) => ({ text: licenseClassOf(row.safetyRating) }),
  },
  {
    id: 'carBrand',
    label: 'Marke',
    width: '96px',
    align: 'left',
    availableFor: DRIVER_LIST_OVERLAYS,
    // Keine eigene Marke vom SDK - Fahrzeugname als naechstbeste Naeherung, siehe Dateikommentar.
    render: (row) => ({ text: row.carName }),
  },
  {
    id: 'tireCompound',
    label: 'Reifen',
    width: '48px',
    align: 'center',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row) => ({ text: row.tireCompound != null ? String(row.tireCompound) : '' }),
  },
  {
    id: 'stintLaps',
    label: 'Stint',
    width: '40px',
    align: 'right',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row) => ({ text: format.laps(row.stintLaps) }),
  },
  {
    id: 'lastLap',
    label: 'Letzte',
    width: '72px',
    align: 'right',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row) => ({ text: format.lapTime(row.lastLapSec) }),
  },
  {
    id: 'bestLap',
    label: 'Beste',
    width: '72px',
    align: 'right',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row) => ({ text: format.lapTime(row.bestLapSec) }),
  },
  {
    id: 'gapToLeader',
    label: 'Fuehrung',
    width: '64px',
    align: 'right',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row) => ({ text: row.gapToLeaderSec != null ? format.gap(row.gapToLeaderSec, 1) : '' }),
  },
  {
    id: 'gapToPlayer',
    label: 'Abstand',
    width: '64px',
    align: 'right',
    availableFor: ['relative'],
    render: (row) => {
      if (row.onPitRoad || row.trackSurface === 'in_pit_stall') return { text: 'BOX', className: 'is-pit' };
      if (row.isPlayer) return { text: '—', className: 'is-player' };
      if (row.gapSeconds == null) return { text: '' };
      return { text: format.gap(row.gapSeconds), className: gapClass(row.gapSeconds, 'is-gap') };
    },
  },
  {
    id: 'pitStops',
    label: 'Stopps',
    width: '48px',
    align: 'right',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row) => ({ text: String(row.pitStopCount) }),
  },
  {
    id: 'driverTag',
    label: 'Tag',
    width: '56px',
    align: 'left',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row, ctx) => {
      const tag = ctx.driverTags.get(row.userName);
      return tag ? { text: tag.label, style: { color: tag.color } } : { text: '' };
    },
  },
  {
    id: 'driverTagNote',
    label: 'Notiz',
    width: '1fr',
    align: 'left',
    availableFor: DRIVER_LIST_OVERLAYS,
    render: (row, ctx) => ({ text: ctx.driverTags.get(row.userName)?.note ?? '' }),
  },
  {
    id: 'lapsAhead',
    label: '+/-',
    width: '32px',
    align: 'right',
    availableFor: ['relative'],
    render: (row) => {
      const value = row.lapsAhead ?? 0;
      if (value === 0) return { text: '' };
      return { text: value > 0 ? `+${value}` : String(value), className: value > 0 ? 'is-lap-up' : 'is-lap-down' };
    },
  },
  {
    id: 'sectorDelta',
    label: 'Sektor-Δ',
    width: '56px',
    align: 'right',
    availableFor: ['relative'],
    render: (row, ctx) => {
      if (row.isPlayer) return { text: '—' };
      if (ctx.refSectorIndex == null || ctx.playerRefSec == null) return { text: '' };
      const rowSec = row.sectorTimes[ctx.refSectorIndex]?.lastSec ?? null;
      if (rowSec == null) return { text: '' };
      const delta = rowSec - ctx.playerRefSec;
      return { text: format.delta(delta, 1), className: gapClass(delta, 'is-gap') };
    },
  },
];

export function columnsFor(overlayId: string): ColumnDefinition[] {
  return COLUMN_REGISTRY.filter((c) => c.availableFor.includes(overlayId));
}

export function columnById(id: string): ColumnDefinition | undefined {
  return COLUMN_REGISTRY.find((c) => c.id === id);
}
