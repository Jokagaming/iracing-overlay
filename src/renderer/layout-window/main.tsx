/**
 * Layout-Modus-Fenster: EIN Fenster, das die gesamte virtuelle
 * Desktopflaeche ueberspannt, Overlays als `<iframe>`-Kinder darin (siehe
 * main/layoutWindowTarget.ts). Bewusst Preact statt Vanilla-DOM (siehe
 * README) - deutlich mehr dynamischer, interaktiver Zustand als ein
 * einzelnes Overlay-Widget (Drag/Resize/Grid-Snap fuer beliebig viele
 * Kind-Overlays gleichzeitig).
 *
 * Klickdurchlaessigkeit funktioniert hier anders als im Overlay-Modus:
 * ein einzelnes BrowserWindow kennt kein "klickdurchlaessig ausser in
 * diesem Teilbereich". Stattdessen testet dieses Modul bei jeder
 * Mausbewegung per `elementFromPoint()`, ob die Maus gerade ueber einem
 * entsperrten Overlay steht, und schaltet `setIgnoreMouseEvents` im
 * Main-Process dynamisch um (siehe main/layoutWindowTarget.ts).
 */

import { h, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { snapRectToGrid, type SnappableRect } from '../../settings/layoutGrid.js';

interface OverlayPositionPct {
  displayKey: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  dpiScaleAtSave: number;
}

interface AddOverlayPayload {
  overlayId: string;
  src: string;
  position: OverlayPositionPct;
  locked: boolean;
}

declare global {
  interface Window {
    layoutWindowAPI: {
      notifyReady: () => void;
      onAddOverlay: (callback: (overlay: AddOverlayPayload) => void) => void;
      onSetLocked: (callback: (overlayId: string, locked: boolean) => void) => void;
      onSetVisible: (callback: (overlayId: string, visible: boolean) => void) => void;
      onRemoveOverlay: (callback: (overlayId: string) => void) => void;
      onEditModeChanged: (callback: (editMode: boolean) => void) => void;
      reportPositionChange: (overlayId: string, position: OverlayPositionPct) => void;
      setIgnoreMouse: (ignore: boolean) => void;
    };
  }
}

interface Placement {
  overlayId: string;
  src: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  locked: boolean;
  visible: boolean;
}

/**
 * Rastergroesse fuer den Layout-Editor (siehe settings/layoutGrid.ts).
 * TODO: aus dem aktiven Layout uebernehmen (Layout.gridSize), sobald der
 * Launcher ein Layout tatsaechlich auswaehlbar macht - bis dahin ein fixer,
 * sinnvoller Standardwert.
 */
const GRID_SIZE_PX = 20;
const MIN_WIDTH_PX = 80;
const MIN_HEIGHT_PX = 40;

function containerRectOf(el: HTMLElement): DOMRect {
  return (el.closest('.layout-window__container') as HTMLElement).getBoundingClientRect();
}

interface OverlayBoxProps {
  placement: Placement;
  editMode: boolean;
  onPositionChange: (rectPx: SnappableRect) => void;
}

function OverlayBox({ placement, editMode, onPositionChange }: OverlayBoxProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  // "editMode" hebt die Sperre aller Overlays vorruebergehend auf, analog
  // zu setEditMode() im Overlay-Modus (siehe overlayWindowTarget.ts) - der
  // persistierte `locked`-Wert selbst aendert sich dadurch nicht.
  const effectivelyLocked = editMode ? false : placement.locked;

  function currentRectPx(): SnappableRect {
    const el = boxRef.current;
    if (!el) return { x: 0, y: 0, width: 0, height: 0 };
    const container = containerRectOf(el);
    return {
      x: placement.xPct * container.width,
      y: placement.yPct * container.height,
      width: placement.widthPct * container.width,
      height: placement.heightPct * container.height,
    };
  }

  function onDragStart(e: MouseEvent): void {
    if (effectivelyLocked) return;
    e.preventDefault();
    const startMouse = { x: e.clientX, y: e.clientY };
    const startRect = currentRectPx();

    function onMove(moveEvent: MouseEvent): void {
      onPositionChange(
        snapRectToGrid(
          { ...startRect, x: startRect.x + (moveEvent.clientX - startMouse.x), y: startRect.y + (moveEvent.clientY - startMouse.y) },
          GRID_SIZE_PX,
        ),
      );
    }
    function onUp(): void {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function onResizeStart(e: MouseEvent): void {
    e.stopPropagation();
    if (effectivelyLocked) return;
    e.preventDefault();
    const startMouse = { x: e.clientX, y: e.clientY };
    const startRect = currentRectPx();

    function onMove(moveEvent: MouseEvent): void {
      const width = Math.max(MIN_WIDTH_PX, startRect.width + (moveEvent.clientX - startMouse.x));
      const height = Math.max(MIN_HEIGHT_PX, startRect.height + (moveEvent.clientY - startMouse.y));
      onPositionChange(snapRectToGrid({ ...startRect, width, height }, GRID_SIZE_PX));
    }
    function onUp(): void {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  if (!placement.visible) return null;

  return h(
    'div',
    {
      ref: boxRef,
      class: `layout-overlay${editMode ? ' is-edit' : ''}`,
      style: {
        left: `${placement.xPct * 100}%`,
        top: `${placement.yPct * 100}%`,
        width: `${placement.widthPct * 100}%`,
        height: `${placement.heightPct * 100}%`,
      },
      'data-interactive': effectivelyLocked ? undefined : 'true',
      onMouseDown: editMode ? onDragStart : undefined,
    },
    [
      h('iframe', { key: 'iframe', class: 'layout-overlay__iframe', src: placement.src }),
      editMode && !effectivelyLocked
        ? h('div', { key: 'grip', class: 'layout-overlay__resize-grip', onMouseDown: onResizeStart })
        : null,
    ],
  );
}

function App() {
  const [placements, setPlacements] = useState<Map<string, Placement>>(new Map());
  const [editMode, setEditMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.layoutWindowAPI.onAddOverlay((overlay) => {
      setPlacements((prev) => {
        const next = new Map(prev);
        next.set(overlay.overlayId, {
          overlayId: overlay.overlayId,
          src: overlay.src,
          xPct: overlay.position.xPct,
          yPct: overlay.position.yPct,
          widthPct: overlay.position.widthPct,
          heightPct: overlay.position.heightPct,
          locked: overlay.locked,
          visible: true,
        });
        return next;
      });
    });
    window.layoutWindowAPI.onSetLocked((overlayId, locked) => {
      setPlacements((prev) => {
        const entry = prev.get(overlayId);
        if (!entry) return prev;
        return new Map(prev).set(overlayId, { ...entry, locked });
      });
    });
    window.layoutWindowAPI.onSetVisible((overlayId, visible) => {
      setPlacements((prev) => {
        const entry = prev.get(overlayId);
        if (!entry) return prev;
        return new Map(prev).set(overlayId, { ...entry, visible });
      });
    });
    window.layoutWindowAPI.onRemoveOverlay((overlayId) => {
      setPlacements((prev) => {
        if (!prev.has(overlayId)) return prev;
        const next = new Map(prev);
        next.delete(overlayId);
        return next;
      });
    });
    window.layoutWindowAPI.onEditModeChanged(setEditMode);
    // Erst jetzt, nach dem Registrieren aller Listener, dem Main-Process
    // signalisieren, dass gepufferte "layout:add-overlay"-Nachrichten
    // nachgeliefert werden koennen - siehe main/layoutWindowTarget.ts.
    window.layoutWindowAPI.notifyReady();
  }, []);

  // Hit-Test bei jeder Mausbewegung - siehe Dateikommentar oben.
  useEffect(() => {
    // Nur bei tatsaechlicher Aenderung einen IPC-Aufruf ausloesen, nicht
    // bei jedem einzelnen mousemove-Event.
    let lastInteractive: boolean | null = null;
    function onMove(e: MouseEvent): void {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const interactive = Boolean((el as HTMLElement | null)?.closest('[data-interactive="true"]'));
      if (interactive === lastInteractive) return;
      lastInteractive = interactive;
      window.layoutWindowAPI.setIgnoreMouse(!interactive);
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  function handlePositionChange(overlayId: string, rectPx: SnappableRect): void {
    const container = containerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const position: OverlayPositionPct = {
      displayKey: 'virtual-desktop',
      xPct: rectPx.x / bounds.width,
      yPct: rectPx.y / bounds.height,
      widthPct: rectPx.width / bounds.width,
      heightPct: rectPx.height / bounds.height,
      dpiScaleAtSave: window.devicePixelRatio || 1,
    };
    setPlacements((prev) => {
      const entry = prev.get(overlayId);
      if (!entry) return prev;
      return new Map(prev).set(overlayId, { ...entry, ...position });
    });
    window.layoutWindowAPI.reportPositionChange(overlayId, position);
  }

  return h(
    'div',
    { ref: containerRef, class: 'layout-window__container' },
    [...placements.values()].map((p) =>
      h(OverlayBox, { key: p.overlayId, placement: p, editMode, onPositionChange: (rect) => handlePositionChange(p.overlayId, rect) }),
    ),
  );
}

render(h(App, {}), document.getElementById('root')!);
