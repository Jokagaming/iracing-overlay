/** Formatierungen, die mehrere Overlays brauchen. */

/** Abstand in Sekunden ohne Vorzeichen, z.B. "1.2". */
export function gap(seconds: number, digits = 1): string {
  if (!Number.isFinite(seconds)) return '';
  // Ohne die Null-Korrektur zeigt Math.abs(-0.04).toFixed(1) ein "-0.0".
  const value = Math.abs(seconds) < 0.05 ? 0 : seconds;
  return value.toFixed(digits);
}

/** Abstand mit explizitem Vorzeichen, z.B. "+0.31". */
export function delta(seconds: number | null, digits = 2): string {
  if (seconds == null || !Number.isFinite(seconds)) return '';
  const value = Math.abs(seconds) < 5e-3 ? 0 : seconds;
  return (value >= 0 ? '+' : '') + value.toFixed(digits);
}

/** Rundenzeit als "1:43.512". Ungueltige Zeiten werden zu "--:--.---". */
export function lapTime(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '--:--.---';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(3).padStart(6, '0')}`;
}

/**
 * iRating kompakt: "4.2k". Werte unter 100 kommen in der Praxis nur als
 * SDK-Platzhalter vor (z.B. `1` in "Offline Testing", wo iRating nicht
 * zutrifft) - eine echte Wertung faengt praktisch nie so niedrig an, und
 * `(1/1000).toFixed(1)` ergaebe ohnehin nur ein nichtssagendes "0.0k".
 */
export function iRating(value: number | null): string {
  if (!value || value < 100) return '';
  return `${(value / 1000).toFixed(1)}k`;
}

/** Restzeit einer Session als "42:07" bzw. "1:12:30". */
export function clock(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '--:--';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
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

/** Liter mit einer Nachkommastelle, z.B. "42.3 L". Ohne Wert ein Platzhalter. */
export function liters(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '--';
  return `${value.toFixed(1)} L`;
}

/** Rundenzahl abgerundet, da eine angebrochene Runde nicht "sicher geschafft" ist. */
export function laps(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '--';
  return String(Math.floor(value));
}
