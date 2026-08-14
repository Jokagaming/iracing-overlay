/**
 * Bestimmt, zu welcher Gruppe eine Zeile fuer die Klassen-Faerbung gehoert
 * - abhaengig vom gewaehlten `classGrouping`-Modus (siehe z.B.
 * relative/settings.ts). `byCarNumberHundreds` hat keine SDK-Fahrzeugklasse
 * als Farbquelle (Ligen definieren eigene Klassen ueber Nummernkreise,
 * #100-199 = eine Klasse, #200-299 die naechste, siehe Aufgabenstellung) -
 * dafuer wird deterministisch aus dem Gruppen-Schluessel eine Farbe erzeugt
 * (siehe hashColor()), statt eine SDK-Farbe zu erfinden, die es nicht gibt.
 */

export type ClassGrouping = 'none' | 'bySimClass' | 'byCarNumberHundreds';

export function classGroupKey(row: { carClassId: number | null; carNumber: string }, mode: ClassGrouping): string | null {
  if (mode === 'none') return null;
  if (mode === 'bySimClass') return row.carClassId != null ? String(row.carClassId) : null;

  const num = Number.parseInt(row.carNumber, 10);
  if (!Number.isFinite(num)) return null;
  return String(Math.floor(num / 100) * 100);
}

/** Deterministische, gut unterscheidbare Farbe aus einem beliebigen String - fuer Gruppen ohne SDK-Farbe (z.B. Startnummer-Hunderter). */
export function hashColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}
