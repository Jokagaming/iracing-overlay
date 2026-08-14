/**
 * Reine Umrechnung zwischen Fenster-Pixelbounds und prozentualen,
 * Display-relativen Positionen. Positionen werden NIE als absolute Pixel
 * gespeichert (siehe Aufgabenstellung) - ein Wert wie "x=1920" ist auf
 * einem anderen Monitor/einer anderen Aufloesung bedeutungslos oder landet
 * ausserhalb des sichtbaren Bereichs.
 *
 * Framework-/Electron-unabhaengig und daher isoliert testbar (wie
 * calc/*.ts im Datenlayer) - die Electron-spezifische Display-Erkennung
 * (stabile Geraete-Kennung, `screen.getAllDisplays()`) sitzt in
 * main/displays.ts und baut auf den Typen hier auf.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Gespeicherte Position eines Overlay-Fensters. `displayKey` ist eine
 * stabile Geraete-Kennung (siehe main/displays.ts) - NICHT der
 * Display-Index, der sich beim An-/Abstecken eines Monitors verschieben
 * kann. `dpiScaleAtSave` steht fuer Aufrufer bereit, die bei einer
 * extremen Skalierungsaenderung seit dem Speichern zusaetzlich reagieren
 * wollen - die Prozentwerte selbst sind relativ zur Display-Groesse in
 * logischen Pixeln und damit bereits aufloesungsunabhaengig.
 */
export interface OverlayPosition {
  displayKey: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  dpiScaleAtSave: number;
}

export interface DisplayInfo {
  key: string;
  bounds: Rect;
  scaleFactor: number;
}

/** Verhindert ein auf 0 geschrumpftes, nicht mehr greifbares Fenster bei kaputten/extremen gespeicherten Prozentwerten. */
const MIN_SIZE_PX = 40;

/** Fenster-Pixelbounds -> prozentuale Position relativ zum angegebenen Display. */
export function toOverlayPosition(bounds: Rect, display: DisplayInfo): OverlayPosition {
  return {
    displayKey: display.key,
    xPct: (bounds.x - display.bounds.x) / display.bounds.width,
    yPct: (bounds.y - display.bounds.y) / display.bounds.height,
    widthPct: bounds.width / display.bounds.width,
    heightPct: bounds.height / display.bounds.height,
    dpiScaleAtSave: display.scaleFactor,
  };
}

/** Prozentuale Position -> Fenster-Pixelbounds auf dem angegebenen (aktuellen) Display. */
export function toPixelBounds(position: OverlayPosition, display: DisplayInfo): Rect {
  const width = Math.max(MIN_SIZE_PX, Math.round(position.widthPct * display.bounds.width));
  const height = Math.max(MIN_SIZE_PX, Math.round(position.heightPct * display.bounds.height));
  return {
    x: Math.round(display.bounds.x + position.xPct * display.bounds.width),
    y: Math.round(display.bounds.y + position.yPct * display.bounds.height),
    width,
    height,
  };
}

export interface ResolvedDisplay {
  display: DisplayInfo;
  /** `true`, wenn der gespeicherte Monitor nicht mehr angeschlossen ist und stattdessen das Hauptdisplay verwendet wurde. */
  fellBackToPrimary: boolean;
}

/**
 * Findet das Display fuer eine gespeicherte Position. Haengt der Monitor
 * nicht mehr dran, faellt die Funktion auf das Hauptdisplay zurueck (siehe
 * Vorgabe "Overlay sichtbar auf dem Hauptmonitor platzieren statt ins
 * Leere") statt eine ungueltige/leere Position zu liefern.
 */
export function resolveDisplay(position: OverlayPosition, displays: DisplayInfo[], primary: DisplayInfo): ResolvedDisplay {
  const match = displays.find((d) => d.key === position.displayKey);
  return match ? { display: match, fellBackToPrimary: false } : { display: primary, fellBackToPrimary: true };
}
