/**
 * Streckenabstand zwischen zwei Positionen, in Sekunden. Gemeinsame Basis
 * fuer Relative (Abstand zum Spieler) und spaeter Standings (Abstand zum
 * Fuehrenden) - beide brauchen dieselbe Umlaufkorrektur, nur mit
 * unterschiedlicher Referenzposition.
 */

export interface TrackPosition {
  lap: number;
  lapDistPct: number;
  /**
   * `CarIdxEstTime` - Sekunden, die dieses Auto fuer seine aktuelle Position
   * auf der Runde gebraucht hat. Praeziser als `lapDistPct * Rundenzeit`,
   * weil Brems-/Beschleunigungszonen eingehen. `null`, wenn das SDK nichts
   * liefert.
   */
  estTimeSec: number | null;
}

/** Faellt auf den Rundenanteil zurueck, wenn `estTimeSec` fehlt. */
function estTimeOf(pos: TrackPosition, lapTimeSec: number): number {
  if (pos.estTimeSec != null && Number.isFinite(pos.estTimeSec) && pos.estTimeSec > 0) {
    return pos.estTimeSec;
  }
  return pos.lapDistPct * lapTimeSec;
}

/**
 * Legt einen Abstand auf das Fenster [-halbe Runde, +halbe Runde] um.
 *
 * Ohne das erscheint ein Auto, das kurz vor Start/Ziel liegt waehrend die
 * Referenz die Linie gerade ueberquert hat, als eine ganze Runde entfernt
 * statt als das Auto unmittelbar davor/dahinter.
 */
function wrapToLap(seconds: number, lapTimeSec: number): number {
  const half = lapTimeSec / 2;
  if (seconds > half) return seconds - lapTimeSec;
  if (seconds < -half) return seconds + lapTimeSec;
  return seconds;
}

/**
 * Abstand von `target` zu `reference`, in Sekunden.
 *
 * Vorzeichen wie in iRacing: liegt `target` vor `reference`, ist das
 * Ergebnis negativ (target ist so viele Sekunden voraus).
 */
export function gapSeconds(target: TrackPosition, reference: TrackPosition, lapTimeSec: number): number {
  return wrapToLap(estTimeOf(reference, lapTimeSec) - estTimeOf(target, lapTimeSec), lapTimeSec);
}

/** Volle Runden Unterschied. Positiv = target liegt eine Runde vor reference. */
export function lapsAhead(target: TrackPosition, reference: TrackPosition): number {
  return Math.round(target.lap + target.lapDistPct - (reference.lap + reference.lapDistPct));
}
