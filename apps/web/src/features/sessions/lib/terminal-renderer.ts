import { WebglAddon } from '@xterm/addon-webgl';
import type { Terminal } from '@xterm/xterm';

/**
 * Set once WebGL has failed in this tab — a constructor that threw, or a
 * context the GPU took back — so the next terminal goes straight to the DOM
 * renderer instead of failing the same way. Synara and Orca both keep this
 * flag at module level for the same reason: a lost context is usually the
 * machine's answer, not the pane's.
 */
let webglUnavailable = false;

/**
 * Put the WebGL renderer under `term`, or leave the DOM renderer in place.
 *
 * WebGL is the renderer the product wants — a noisy build should not cost
 * CPU — but its constructor throws on some machines and in headless browsers
 * rather than degrading. When the context is lost later the addon is disposed
 * and `onFallback` runs: the DOM renderer measures cells differently, so the
 * grid has to be refitted and repainted or it keeps WebGL's sizes.
 */
export function attachWebglRenderer(term: Terminal, onFallback: () => void): void {
  if (webglUnavailable) return;
  try {
    const addon = new WebglAddon();
    addon.onContextLoss(() => {
      webglUnavailable = true;
      addon.dispose();
      onFallback();
    });
    term.loadAddon(addon);
  } catch {
    webglUnavailable = true;
  }
}
