/**
 * Abstrahiert, WIE ein Overlay dargestellt wird - heute "ein natives
 * Fenster pro Overlay" (OverlayWindowRenderTarget, siehe
 * overlayWindowTarget.ts). Der Layout-Modus (EIN Fenster fuer alle
 * Overlays zusammen, profilbasiert mit Auto-Switch) wird eine zweite
 * Implementierung desselben Interfaces, perspektivisch auch Browser-Source
 * (OBS) und VR-Overlay - main/index.ts ruft nur `RenderTarget` auf und
 * muss nicht wissen, welche Art gerade aktiv ist.
 */

import type { BridgeMessage } from '../data/types.js';
import type { OverlayPosition } from '../settings/position.js';

export interface RenderTargetOverlay {
  readonly overlayId: string;
  /** `true` = Fenster ist klickdurchlaessig und ignoriert Mausinput (siehe BaseOverlaySettings.locked). */
  setLocked(locked: boolean): void;
  getPosition(): OverlayPosition;
  show(): void;
  hide(): void;
  destroy(): void;
  isDestroyed(): boolean;
  /** Reicht eine Bridge-Nachricht direkt an dieses Overlay weiter - siehe README "Performance" (IPC statt WebSocket fuer die eigenen Fenster). */
  send(message: BridgeMessage): void;
}

export interface CreateOverlayOptions {
  overlayId: string;
  /** Wie das bisherige `config.id` in overlayWindow.ts - Ordnername unter src/renderer/ bzw. Schluessel in electron.vite.config.ts's rendererEntries. */
  rendererUrlPath: string;
  /** `null`, wenn noch nie gespeichert - der RenderTarget-Implementierung ueberlassen, wo/wie gross das Fenster dann initial erscheint. */
  initialPosition: OverlayPosition | null;
  defaultSize: { width: number; height: number };
  initialLocked: boolean;
  onPositionChange: (position: OverlayPosition) => void;
  getWelcomeMessages?: () => BridgeMessage[];
}

export interface RenderTarget {
  readonly kind: string;
  createOverlay(options: CreateOverlayOptions): Promise<RenderTargetOverlay>;
  dispose(): void;
}
