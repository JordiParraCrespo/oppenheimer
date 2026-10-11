/**
 * Whether xterm's WebGL renderer may draw the terminal on this machine.
 *
 * On Linux a software or unidentified GL stack keeps the context alive while
 * the glyph atlas draws letters as blocks, and never reports a context loss,
 * so there is nothing to fall back on. WebGL there is for a hardware renderer
 * that names itself; the rest stay on the DOM renderer, which has no atlas.
 * This is Orca's auto policy
 * (`src/renderer/src/lib/pane-manager/terminal-webgl-auto-policy.ts`) without
 * its Wayland check, which a browser cannot see.
 */

export interface GlRendererInfo {
  webgl2: boolean;
  /** `vendor renderer` from `WEBGL_debug_renderer_info`; null when the browser withholds it. */
  identity: string | null;
}

const SOFTWARE_RENDERER =
  /\b(swiftshader|llvmpipe|softpipe|software rasterizer|software adapter|basic render|virgl|svga3d)\b/i;

export function webglAllowed(platform: { linux: boolean }, gl: () => GlRendererInfo): boolean {
  if (!platform.linux) return true;
  const info = gl();
  if (!info.webgl2 || !info.identity) return false;
  return !SOFTWARE_RENDERER.test(info.identity);
}

/** Chromium on Linux reports `navigator.platform` as `Linux x86_64` (or `Linux aarch64`). */
function isLinuxHost(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.platform.includes('Linux');
}

/** The GL stack the browser hands a canvas, read once from a throwaway context. */
function readGlRendererInfo(): GlRendererInfo {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return { webgl2: false, identity: null };
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const identity = debug
      ? `${gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) ?? ''} ${gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) ?? ''}`.trim()
      : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { webgl2: true, identity: identity || null };
  } catch {
    return { webgl2: false, identity: null };
  }
}

let cachedVerdict: boolean | undefined;

/** `webglAllowed` for this browser, decided once per page. */
export function terminalWebglAllowed(): boolean {
  cachedVerdict ??= webglAllowed({ linux: isLinuxHost() }, readGlRendererInfo);
  return cachedVerdict;
}
