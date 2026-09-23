import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import { createResizeCoalescer } from './resize-coalescer';
import type { SessionStream } from './session-stream';
import { anchorToBottom, clipAnchoredPane } from './terminal-anchor';
import { classifyKey } from './terminal-keys';
import {
  readTerminalTheme,
  TERMINAL_FONT,
  TERMINAL_FONT_FAMILIES,
  terminalMinimumContrastRatio,
} from './terminal-theme';

export interface TerminalGrid {
  cols: number;
  rows: number;
}

export interface SessionTerminalOptions {
  /** The grid resolved to a new size. */
  onGrid?: (grid: TerminalGrid) => void;
  /**
   * The pane shows the agent's window (window 0), whose prompt takes
   * Shift+Enter as a newline. A shell window gets the chord as typed.
   */
  agentWindow?: boolean;
}

/**
 * One session terminal: xterm.js in `container`, wired to `stream`, until the
 * returned function disposes it.
 *
 * Everything that talks to xterm lives here — the fit and the PTY size, the
 * bottom anchor, the console's keys, the renderer, fonts and theme — so the
 * hook that mounts it holds only a React lifetime and two pieces of state.
 * The stream is the caller's; this never disposes it.
 */
export function mountSessionTerminal(
  container: HTMLElement,
  stream: SessionStream,
  options: SessionTerminalOptions = {},
): () => void {
  const term = new Terminal({
    ...TERMINAL_FONT,
    theme: readTerminalTheme(),
    cursorBlink: true,
    cursorStyle: 'block',
    // A few thousand lines of build output is the normal case; the runner
    // replays its own tail on attach, so this is only what the tab keeps.
    scrollback: 5000,
    // The ramp's bright slots repeat their normal counterparts today. This
    // keeps a program's own colour choice readable until they diverge — at
    // a floor that depends on the terminal's background, because one number
    // cannot serve both themes (see `terminalMinimumContrastRatio`).
    minimumContrastRatio: terminalMinimumContrastRatio(),
    // Unicode11Addon is a proposed API; box drawing and emoji width in
    // agent output are wrong without it.
    allowProposedApi: true,
    convertEol: false,
    // tmux runs with `mouse on`, so a plain drag is the program's. Shift
    // forces a selection everywhere but macOS, where it is Option.
    macOptionClickForcesSelection: true,
  });

  const fit = new FitAddon();
  term.loadAddon(fit);
  const unicode = new Unicode11Addon();
  term.loadAddon(unicode);
  term.unicode.activeVersion = '11';

  clipAnchoredPane(container);
  term.open(container);

  // The console's keys (05), decided before xterm encodes them.
  term.attachCustomKeyEventHandler((event) => {
    const verdict = classifyKey(event, {
      hasSelection: term.hasSelection(),
      agentWindow: options.agentWindow ?? false,
    });
    if (verdict.kind === 'terminal') return true;
    if (verdict.kind === 'send') {
      // Stops the keypress and the textarea input that would follow.
      event.preventDefault();
      stream.send(verdict.data);
    }
    return false;
  });

  // The grid refits on every frame of a drag; the PTY hears the size once
  // the drag settles (02 §5).
  const ptySize = createResizeCoalescer((cols, rows) => stream.resize(cols, rows));
  const refit = () => {
    // fit() throws if the pane has no layout yet (a hidden tab, the frame
    // before the shell measures it). There is nothing to fit to, so skip.
    try {
      fit.fit();
    } catch {
      return;
    }
    options.onGrid?.({ cols: term.cols, rows: term.rows });
    ptySize.request(term.cols, term.rows);
  };

  // One measurement per paint: a burst of output, a drag and a font arriving
  // all collapse into a single refit and anchor.
  let frame: number | null = null;
  let wantsFit = false;
  const nextFrame = (fitToo: boolean) => {
    wantsFit ||= fitToo;
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (wantsFit) {
        wantsFit = false;
        refit();
      }
      anchorToBottom(term);
    });
  };

  // The DOM renderer's cells are not WebGL's, so falling back refits first
  // and repaints the grid it produced.
  const fallBackToDom = () => {
    refit();
    term.refresh(0, term.rows - 1);
    anchorToBottom(term);
  };
  loadWebgl(term, fallBackToDom);

  refit();
  nextFrame(false);

  const resizeObserver = new ResizeObserver(() => nextFrame(true));
  resizeObserver.observe(container);

  // A terminal face that loads after the first paint — the bundled symbols
  // face is fetched only when a glyph in its range is first drawn — leaves
  // the stand-in's glyphs in WebGL's atlas and its metrics in the fit. Only
  // the terminal's own families count: the console loading any other face is
  // no reason to redraw a live session.
  const onFontsLoaded = (event: Event) => {
    const faces = (event as FontFaceSetLoadEvent).fontfaces ?? [];
    if (!faces.some((face) => TERMINAL_FONT_FAMILIES.has(unquote(face.family)))) return;
    term.clearTextureAtlas();
    term.refresh(0, term.rows - 1);
    nextFrame(true);
  };
  document.fonts?.addEventListener('loadingdone', onFontsLoaded);

  // `theme-provider.tsx` toggles `.dark` / `.light` on <html>. xterm holds
  // resolved colour strings, not the tokens, so the ramp is re-read here.
  const themeObserver = new MutationObserver(() => {
    term.options.theme = readTerminalTheme();
    term.options.minimumContrastRatio = terminalMinimumContrastRatio();
  });
  themeObserver.observe(document.documentElement, { attributeFilter: ['class'] });

  // What the anchor reads changes when output is parsed, when the reader
  // scrolls, and when the grid changes shape.
  const parsed = term.onWriteParsed(() => nextFrame(false));
  const scrolled = term.onScroll(() => nextFrame(false));
  const reshaped = term.onResize(() => nextFrame(false));

  // xterm's write callback fires once the parser has drained the chunk:
  // that is the moment the bytes are consumed, and the credit goes with it.
  const offData = stream.onData((chunk, consumed) => term.write(chunk, consumed));
  // The replay a fresh attachment opens with is written into the buffer the
  // same way live output is, and xterm follows output only when the viewport
  // is already at the end — at that moment it sits on line zero. Pinning to
  // the tail when the link reports itself live is what puts a reader at the
  // agent's prompt rather than at the top of a session's history. Scrolling
  // back afterwards is the reader's, and nothing here fights it.
  const offStatus = stream.onStatus((next) => {
    if (next === 'live') term.scrollToBottom();
  });
  const input = term.onData((data) => stream.send(data));

  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    offData();
    offStatus();
    input.dispose();
    parsed.dispose();
    scrolled.dispose();
    reshaped.dispose();
    document.fonts?.removeEventListener('loadingdone', onFontsLoaded);
    themeObserver.disconnect();
    resizeObserver.disconnect();
    ptySize.dispose();
    term.dispose();
  };
}

/**
 * WebGL is the renderer the product wants — a noisy build should not cost
 * CPU — but its constructor throws on some machines and in headless browsers
 * rather than degrading, and the GPU can take a context back later. Either
 * way this terminal stays on the DOM renderer for the rest of its life; the
 * next terminal tries again.
 */
function loadWebgl(term: Terminal, fallBack: () => void) {
  try {
    const addon = new WebglAddon();
    addon.onContextLoss(() => {
      addon.dispose();
      fallBack();
    });
    term.loadAddon(addon);
  } catch {
    fallBack();
  }
}

/** `FontFace.family` comes back quoted in some browsers and bare in others. */
function unquote(family: string): string {
  return family.replace(/^["']|["']$/g, '');
}
