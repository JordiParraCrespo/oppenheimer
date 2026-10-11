/**
 * Which renderer a session terminal draws with, and when.
 *
 * xterm's WebGL renderer draws every glyph from a texture atlas it rasterizes
 * once. Two ways that atlas goes bad show up as letters drawn as solid blocks
 * or missing outright while the buffer underneath is correct. Both are
 * handled the way Orca handles them
 * (`src/renderer/src/lib/pane-manager/terminal-webgl-auto-policy.ts`,
 * `components/terminal-pane/terminal-visibility-resume.ts`):
 *
 * - On Linux a software or unidentified GL stack keeps the context alive with
 *   bad glyphs and never reports a context loss, so there is nothing to fall
 *   back on. WebGL there is for a hardware renderer that names itself; the
 *   rest stay on the DOM renderer, which has no atlas.
 * - Wiping the atlas while output streams (`clearTextureAtlas`) races xterm's
 *   page merge (xterm.js #4480) and leaves glyphs garbled. The atlas is built
 *   once the terminal's faces have loaded instead of being rebuilt after.
 */

export interface GlRendererInfo {
  webgl2: boolean;
  /** `vendor renderer` from `WEBGL_debug_renderer_info`; null when the browser withholds it. */
  identity: string | null;
}

const SOFTWARE_RENDERER =
  /\b(swiftshader|llvmpipe|softpipe|software rasterizer|software adapter|basic render|virgl|svga3d)\b/i;

/** Whether WebGL may draw the terminal on this machine. */
export function webglAllowed(platform: { linux: boolean }, gl: () => GlRendererInfo): boolean {
  if (!platform.linux) return true;
  const info = gl();
  if (!info.webgl2 || !info.identity) return false;
  return !SOFTWARE_RENDERER.test(info.identity);
}

function isLinuxHost(): boolean {
  if (typeof navigator === 'undefined') return false;
  // Android reports Linux too; its Chromium is the same GL path.
  return navigator.platform.includes('Linux') || navigator.userAgent.includes('Linux');
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

/**
 * Glyphs from each block the bundled symbols face claims (`globals.css`), so
 * asking for them fetches it: a face with a `unicode-range` loads only once
 * text in its range is requested.
 */
const SYMBOL_SAMPLE = '⏺✻❯─█■☐→⬢';

/** How long the terminal waits for its faces before drawing with what it has. */
const FONT_WAIT_MS = 1500;

/**
 * Resolves once the faces the terminal draws with are loaded, or after
 * `FONT_WAIT_MS`, whichever is first. Never rejects: a face that fails to
 * load is drawn with the fallback, as it would be anyway.
 */
export function terminalFontsReady(font: { fontFamily: string; fontSize: number }): Promise<void> {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts) return Promise.resolve();
  const spec = `${font.fontSize}px ${font.fontFamily}`;
  const loads = Promise.all([fonts.load(spec, 'Ag'), fonts.load(spec, SYMBOL_SAMPLE)]).then(
    () => {},
    () => {},
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_WAIT_MS));
  return Promise.race([loads, timeout]);
}
