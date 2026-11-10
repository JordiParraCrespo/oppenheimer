/**
 * The part of noVNC's RFB client the desktop viewer uses (`docs/API.md` in
 * `@novnc/novnc`, which ships no types). An `EventTarget` that draws into
 * `target` and speaks RFB over `channel`: a WebSocket URL, or any object of
 * a WebSocket's shape.
 */
declare module '@novnc/novnc' {
  export default class RFB extends EventTarget {
    constructor(target: HTMLElement, channel: string | object, options?: { shared?: boolean });
    viewOnly: boolean;
    scaleViewport: boolean;
    clipViewport: boolean;
    resizeSession: boolean;
    focusOnClick: boolean;
    showDotCursor: boolean;
    background: string;
    qualityLevel: number;
    compressionLevel: number;
    disconnect(): void;
    focus(): void;
    clipboardPasteFrom(text: string): void;
  }
}
