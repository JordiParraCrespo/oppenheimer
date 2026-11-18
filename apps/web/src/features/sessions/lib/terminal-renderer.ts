import { WebglAddon } from '@xterm/addon-webgl';
import type { Terminal } from '@xterm/xterm';
import { TERMINAL_FONT, TERMINAL_FONT_FAMILIES } from './terminal-theme';
import { terminalWebglAllowed } from './terminal-webgl-policy';

/**
 * When a session terminal draws with WebGL, and when it stops.
 *
 * WebGL is the renderer the product wants (a noisy build should not cost
 * CPU), but it draws every glyph from an atlas it rasterizes once. Wiping
 * that atlas while output streams (`clearTextureAtlas`) races xterm's page
 * merge (xterm.js #4480) and draws letters as blocks; Orca allows the wipe
 * only on a real wake for that reason
 * (`components/terminal-pane/terminal-visibility-resume.ts`). So:
 *
 * - The DOM renderer draws until the terminal's faces have loaded, or
 *   `FONT_WAIT_MS` has passed; WebGL attaches after, if the policy allows it.
 * - A face that arrives once WebGL is drawing rebuilds the renderer, which
 *   rasterizes afresh. The atlas is never cleared in place.
 * - A face that arrives, on either renderer, has xterm measure its cells
 *   again (`remeasure`).
 * - A constructor that throws, or a context the GPU takes back, leaves the
 *   terminal on the DOM renderer for the rest of its life.
 *
 * Atlas mipmaps are a second cause of block letters, removed by the patch
 * on `@xterm/addon-webgl` (`patches/`, guarded by
 * `terminal-webgl-atlas-patch.spec.ts`).
 */

/** What the renderer needs from the page, swapped out by the spec. */
export interface RendererEnvironment {
  webglAllowed: () => boolean;
  fontsReady: () => Promise<void>;
  createWebgl: () => WebglAddon;
  fonts: Pick<FontFaceSet, 'addEventListener' | 'removeEventListener'> | undefined;
}

/** Which renderer draws the grid. */
export type TerminalRendererKind = 'webgl' | 'dom';

/**
 * Binds the renderer to `term`; `onCellsChanged` runs whenever the cells may
 * have changed size or look (the renderer switched, a face arrived), with the
 * renderer now drawing, for the caller to refit and repaint what it draws on
 * top.
 */
export function bindTerminalRenderer(
  term: Terminal,
  onCellsChanged: (renderer: TerminalRendererKind) => void,
  env: RendererEnvironment = browserEnvironment(),
): () => void {
  let disposed = false;
  let webgl: WebglAddon | null = null;

  const repaint = () => {
    term.refresh(0, term.rows - 1);
    onCellsChanged(webgl ? 'webgl' : 'dom');
  };

  const attach = () => {
    remeasure(term);
    try {
      const addon = env.createWebgl();
      addon.onContextLoss(() => {
        addon.dispose();
        webgl = null;
        repaint();
      });
      term.loadAddon(addon);
      webgl = addon;
    } catch {
      webgl = null;
    }
    repaint();
  };

  if (env.webglAllowed()) {
    void env.fontsReady().then(() => {
      if (!disposed) attach();
    });
  }

  // Only the terminal's own families count: the console loading any other
  // face is no reason to redraw a live session.
  const onFontsLoaded = (event: Event) => {
    const faces = (event as FontFaceSetLoadEvent).fontfaces ?? [];
    if (!faces.some((face) => TERMINAL_FONT_FAMILIES.has(unquote(face.family)))) return;
    if (webgl) {
      webgl.dispose();
      attach();
    } else {
      remeasure(term);
      repaint();
    }
  };
  env.fonts?.addEventListener('loadingdone', onFontsLoaded);

  return () => {
    disposed = true;
    env.fonts?.removeEventListener('loadingdone', onFontsLoaded);
  };
}

/**
 * Glyphs from each block the bundled symbols face claims (`globals.css`), so
 * asking for them fetches it: a face with a `unicode-range` loads only once
 * text in its range is requested.
 */
const SYMBOL_SAMPLE = '⏺✻❯─█■☐→⬢';

/** How long WebGL waits for the faces before drawing with what it has. */
const FONT_WAIT_MS = 1500;

function browserEnvironment(): RendererEnvironment {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  return {
    webglAllowed: terminalWebglAllowed,
    fontsReady: () => {
      if (!fonts) return Promise.resolve();
      const spec = `${TERMINAL_FONT.fontSize}px ${TERMINAL_FONT.fontFamily}`;
      // A face that fails to load is drawn with the fallback, as it would be anyway.
      const loads = Promise.all([fonts.load(spec, 'Ag'), fonts.load(spec, SYMBOL_SAMPLE)]).then(
        () => {},
        () => {},
      );
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_WAIT_MS));
      return Promise.race([loads, timeout]);
    },
    createWebgl: () => new WebglAddon(),
    fonts,
  };
}

/**
 * Has xterm measure its character box again, on the faces the page has now.
 *
 * xterm measures the box once, when it opens, and again only for a change of
 * `fontFamily` or `fontSize`; a face that loads after keeps the fallback's
 * box. The WebGL renderer places every glyph by that box, while the
 * typeahead's canvas measures the face it draws with
 * (`typeahead-paint.ts`), so on a face taller or shorter than the fallback
 * each guessed letter sat a few pixels off its echo and dropped into place
 * when the echo landed. A different `fontFamily` string, set and set back,
 * is the measurement's public trigger; the second set measures the same box
 * and changes nothing. Run with WebGL detached, so the option change never
 * reaches its atlas.
 */
function remeasure(term: Terminal): void {
  const family = term.options.fontFamily ?? '';
  term.options.fontFamily = `${family} `;
  term.options.fontFamily = family;
}

/** `FontFace.family` comes back quoted in some browsers and bare in others. */
function unquote(family: string): string {
  return family.replace(/^["']|["']$/g, '');
}
