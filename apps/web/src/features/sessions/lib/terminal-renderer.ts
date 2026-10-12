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
 * (`components/terminal-pane/terminal-visibility-resume.ts`).
 *
 * The atlas has a second way to draw blocks, which the patch on
 * `@xterm/addon-webgl` (`patches/`) removes: the addon built mipmaps on
 * each page upload and sampled them, and glyphs added to the page later
 * (bold runs, a cell redrawn under the hover background) never reached
 * those levels, so Mesa drivers drew them as blocks. The patch samples the
 * atlas with `LINEAR` and builds no mipmaps, as Orca's does (#1743). So:
 *
 * - The DOM renderer draws until the terminal's faces have loaded, or
 *   `FONT_WAIT_MS` has passed; WebGL attaches after, if the policy allows it.
 * - A face that arrives once WebGL is drawing rebuilds the renderer, which
 *   rasterizes afresh. The atlas is never cleared in place.
 * - A constructor that throws, or a context the GPU takes back, leaves the
 *   terminal on the DOM renderer for the rest of its life.
 */

/** What the renderer needs from the page, swapped out by the spec. */
export interface RendererEnvironment {
  webglAllowed: () => boolean;
  fontsReady: () => Promise<void>;
  createWebgl: () => WebglAddon;
  fonts: Pick<FontFaceSet, 'addEventListener' | 'removeEventListener'> | undefined;
}

/**
 * Binds the renderer to `term`; `onCellsChanged` runs whenever the cells may
 * have changed size or look (the renderer switched, a face arrived), for the
 * caller to refit and repaint what it draws on top.
 */
export function bindTerminalRenderer(
  term: Terminal,
  onCellsChanged: () => void,
  env: RendererEnvironment = browserEnvironment(),
): () => void {
  let disposed = false;
  let webgl: WebglAddon | null = null;

  const repaint = () => {
    term.refresh(0, term.rows - 1);
    onCellsChanged();
  };

  const attach = () => {
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

/** `FontFace.family` comes back quoted in some browsers and bare in others. */
function unquote(family: string): string {
  return family.replace(/^["']|["']$/g, '');
}
