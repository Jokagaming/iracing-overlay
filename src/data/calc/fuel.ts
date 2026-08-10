/**
 * Sprit-Tracking: wie viel wurde pro Runde verbraucht, und wie viel braucht
 * es noch bis zum Rennende.
 *
 * Anders als calc/gap.ts ist das hier nicht rein - der Verbrauch pro Runde
 * laesst sich nur aus der Differenz zwischen zwei Runden ermitteln, dafuer
 * muss sich etwas den Tankstand der letzten Runde merken. Ein
 * {@link FuelTracker} lebt deshalb so lange wie die Datenquelle selbst
 * (ein Objekt pro Fahrer/Session), nicht pro Tick neu erzeugt.
 */

/** Iracing markiert "kein Rundenlimit" mit diesem Sentinel-Wert (0x7FFF). */
const UNLIMITED_LAPS_SENTINEL = 32767;

/**
 * Sehr grosser Wert fuer SessionTimeRemain wird ebenso als "kein Zeitlimit"
 * gewertet. UNSICHER: der exakte Sentinel des SDK dafuer ist nicht
 * bestaetigt (anders als der Runden-Sentinel oben, der in der
 * iRacing-Community gut dokumentiert ist) - 24h ist eine defensive Grenze,
 * kein verifizierter SDK-Wert.
 */
const IMPLAUSIBLE_TIME_REMAIN_SEC = 24 * 60 * 60;

const HISTORY_LENGTH = 10;

export class FuelTracker {
  private currentLap = -1;
  private levelAtLapStart: number | null = null;
  /** Boxenbesuche verfaelschen den Verbrauch der Runde (Nachtanken, Standzeit) - diese Runden werden verworfen. */
  private pitRoadSeenThisLap = false;
  private history: number[] = [];

  /** Einmal pro Tick aufrufen, mit dem aktuellen Rundenstand des beobachteten Autos. */
  update(lap: number, levelLiters: number, onPitRoad: boolean): void {
    if (onPitRoad) this.pitRoadSeenThisLap = true;

    if (this.currentLap === -1) {
      this.currentLap = lap;
      this.levelAtLapStart = levelLiters;
      return;
    }

    if (lap !== this.currentLap) {
      if (!this.pitRoadSeenThisLap && this.levelAtLapStart != null) {
        const used = this.levelAtLapStart - levelLiters;
        // Nur plausible Werte uebernehmen: negativ oder 0 bedeutet
        // nachgetankt oder Messfehler, kein echter Verbrauch.
        if (used > 0 && used <= this.levelAtLapStart) {
          this.history.push(used);
          if (this.history.length > HISTORY_LENGTH) this.history.shift();
        }
      }
      this.currentLap = lap;
      this.levelAtLapStart = levelLiters;
      this.pitRoadSeenThisLap = false;
    }
  }

  /** Durchschnittsverbrauch der letzten bis zu 10 sauberen Runden. `null` ohne genug Daten. */
  get averagePerLapLiters(): number | null {
    if (this.history.length === 0) return null;
    return this.history.reduce((a, b) => a + b, 0) / this.history.length;
  }
}

export interface FuelPlan {
  /** Restrunden bis Rennende - direkt vom SDK oder aus der Restzeit geschaetzt. `null` wenn beides unbekannt ist. */
  lapsRemainingInRace: number | null;
  litersNeededToFinish: number | null;
  /** Wie viel beim naechsten Stopp nachgetankt werden muss, um sicher bis zum Ende zu kommen. */
  litersToAddAtNextStop: number | null;
}

export interface PlanFuelParams {
  levelLiters: number;
  usePerLapLiters: number | null;
  /** `SessionLapsRemainEx`. */
  raceLapsRemain: number | null;
  /** `SessionTimeRemain`, in Sekunden. */
  raceTimeRemainSec: number | null;
  /** Fuer die Umrechnung Zeit -> Runden bei zeitbasierten Rennen. */
  estLapTimeSec: number;
  /** Sicherheitspuffer in Runden, on top der rechnerisch noetigen Menge. */
  safetyLaps: number;
}

export function planFuel(params: PlanFuelParams): FuelPlan {
  const lapsRemainingInRace = estimateLapsRemaining(params);

  if (params.usePerLapLiters == null || lapsRemainingInRace == null) {
    return { lapsRemainingInRace, litersNeededToFinish: null, litersToAddAtNextStop: null };
  }

  const litersNeededToFinish = (lapsRemainingInRace + params.safetyLaps) * params.usePerLapLiters;
  const litersToAddAtNextStop = Math.max(0, litersNeededToFinish - params.levelLiters);

  return { lapsRemainingInRace, litersNeededToFinish, litersToAddAtNextStop };
}

function estimateLapsRemaining(params: PlanFuelParams): number | null {
  const { raceLapsRemain, raceTimeRemainSec, estLapTimeSec } = params;

  if (raceLapsRemain != null && Number.isFinite(raceLapsRemain) && raceLapsRemain < UNLIMITED_LAPS_SENTINEL) {
    return raceLapsRemain;
  }
  if (raceTimeRemainSec != null && raceTimeRemainSec < IMPLAUSIBLE_TIME_REMAIN_SEC && estLapTimeSec > 0) {
    return Math.ceil(raceTimeRemainSec / estLapTimeSec);
  }
  return null;
}
