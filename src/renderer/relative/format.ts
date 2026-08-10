/** Formatierungen fuers Relative-Overlay. */

/** Abstand in Sekunden mit Vorzeichen weggelassen, z.B. "1.2". */
export function gap(seconds: number, digits = 1): string {
  if (!Number.isFinite(seconds)) return '';
  // Ohne die Null-Korrektur zeigt Math.abs(-0.04).toFixed(1) ein "-0.0".
  const value = Math.abs(seconds) < 0.05 ? 0 : seconds;
  return value.toFixed(digits);
}

/** iRating kompakt: "4.2k". */
export function iRating(value: number | null): string {
  if (!value || value <= 0) return '';
  return `${(value / 1000).toFixed(1)}k`;
}

/** Kuerzt lange Fahrernamen auf "M. Mustermann". */
export function driverName(name: string, maxLength = 18): string {
  if (!name) return '';
  if (name.length <= maxLength) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.slice(0, maxLength);
  const last = parts.at(-1)!;
  return `${parts[0]![0]}. ${last}`.slice(0, maxLength);
}
