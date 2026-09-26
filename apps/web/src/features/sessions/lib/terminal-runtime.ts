import { createResizeCoalescer, type SessionStream } from '@oppenheimer/frontend-consumer';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import { CursorFrames } from './cursor-frames';
import { bindImageGestures } from './terminal-images';
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
  /**
   * An image was pasted or dropped onto the terminal. The agent cannot read
   * the browser's clipboard, so the caller uploads it and the runner pastes
   * its path into the prompt (05). Without a handler, images are left to
   * xterm, which pastes nothing for them.
   */
  onImage?: (image: File) => void;
}

/**
 * One session terminal: xterm.js in `container`, wired to `stream`, until the
 * returned function disposes it.
 *
 * Everything that talks to xterm lives here — the fit and the PTY size, the
 * console's keys, the renderer, fonts and theme — so the hook that mounts it
 * holds only a React lifetime and two pieces of state. The stream is the
 * caller's; this never disposes it.
 *
 * **Nothing moves the picture of the grid**, which is what decides where a
 * prompt sits, and the two agents land differently on purpose. Claude Code
 * lays its turn out across the whole terminal it is told about, so its prompt
 * and status band come to rest on the last rows and the pane reads as full.
 * Codex prints its output and puts the prompt straight after it, so a short
 * conversation sits at the top with the rest of the pane empty — the ordinary
 * behaviour of a terminal, and what Orca shows too: it reads `.xterm-screen`
 * for cell metrics and mouse maths and never transforms it. A console that
 * translated the grid down by its empty rows made Codex float at the bottom
 * under a tall blank band, and hid a PTY that had been left at 80x24.
 */
export function mountSessionTerminal(
  container: HTMLElement,
  stream: SessionStream,
  options: SessionTerminalOptions = {},
): () => void {
  const term = new Terminal({
    ...TERMINAL_FONT,
    theme: readTerminalTheme(),
    cursorBlink: false,
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

  // Images, pasted or dropped, go to the caller rather than to xterm.
  const unbindImages = options.onImage ? bindImageGestures(container, options.onImage) : () => {};

  // The wheel scrolls the session, not the program.
  //
  // tmux runs with `mouse on`, so it turns mouse tracking on and xterm
  // faithfully forwards every wheel tick to it as a mouse report. Codex reads
  // those and moves its own cursor, so a reader trying to look back over a
  // session drove the agent's UI instead of the scrollback — and Claude Code,
  // which ignores them, simply did nothing.
  //
  // The rule is the buffer, not the agent: on the normal buffer the wheel is
  // the reader's, and scrolls what has been printed. On the alternate buffer
  // it is the program's, because a full-screen application — an editor, a
  // pager, tmux's own copy mode — has no scrollback for us to move and draws
  // its own idea of a viewport. Nothing here is per-agent; the two land
  // differently because they use the terminal differently.
  term.attachCustomWheelEventHandler((event) => {
    if (term.buffer.active.type !== 'normal') return true;
    const lines = wheelLines(event, term.rows);
    if (lines !== 0) term.scrollLines(lines);
    // Ours: xterm neither reports it to the program nor scrolls again.
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

  // One measurement per paint: a drag and a font arriving collapse into one
  // refit.
  let frame: number | null = null;
  const nextFrame = () => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      refit();
    });
  };

  // The DOM renderer's cells are not WebGL's, so falling back refits first
  // and repaints the grid it produced.
  const fallBackToDom = () => {
    refit();
    term.refresh(0, term.rows - 1);
  };
  loadWebgl(term, fallBackToDom);

  refit();
  nextFrame();

  const resizeObserver = new ResizeObserver(() => nextFrame());
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
    nextFrame();
  };
  document.fonts?.addEventListener('loadingdone', onFontsLoaded);

  // `theme-provider.tsx` toggles `.dark` / `.light` on <html>. xterm holds
  // resolved colour strings, not the tokens, so the ramp is re-read here.
  const themeObserver = new MutationObserver(() => {
    term.options.theme = readTerminalTheme();
    term.options.minimumContrastRatio = terminalMinimumContrastRatio();
  });
  themeObserver.observe(document.documentElement, { attributeFilter: ['class'] });

  // xterm's write callback fires once the parser has drained the chunk:
  // that is the moment the bytes are consumed, and the credit goes with it.
  // A TUI's hide, draw, show painted as one frame (02 §6).
  const cursorFrames = new CursorFrames((data) => term.write(data));
  const offData = stream.onData((chunk, consumed) =>
    term.write(cursorFrames.frame(chunk), consumed),
  );
  // The replay a fresh attachment opens with is written into the buffer the
  // same way live output is, and xterm follows output only when the viewport
  // is already at the end — at that moment it sits on line zero. Pinning to
  // the tail when the link reports itself live is what puts a reader at the
  // agent's prompt rather than at the top of a session's history. Scrolling
  // back afterwards is the reader's, and nothing here fights it.
  const offStatus = stream.onStatus((next) => {
    if (next !== 'live') return;
    // The viewport, asserted on every connect.
    //
    // The size is otherwise sent once, from the first fit that succeeds — and
    // the first `fit()` throws, because React has only just attached the ref
    // and the pane has no layout yet, so the first real measurement lands a
    // frame later. Minting an attach ticket is one request, which on a local
    // API can finish inside that frame: the socket opens with no viewport to
    // announce, the relay waits two seconds and attaches the classic 80x24,
    // and the coalescer never sends the size again because it has not changed.
    //
    // Everything downstream then compounds it. The agent lays its turn out for
    // the terminal it was told about, so Claude Code fills 24 rows of a
    // 56-row grid, and the anchor below — correctly — pushes those 24 rows to
    // the bottom, leaving a tall blank band where the session should start.
    // The anchor was not the fault; this was.
    //
    // Saying it here costs one message per connect and is what a reconnect
    // needs anyway: the relay opens a fresh attachment, and it should be
    // opened at the size the reader is actually looking at.
    stream.resize(term.cols, term.rows);
    term.scrollToBottom();
  });
  const input = term.onData((data) => stream.send(data));

  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    unbindImages();
    offData();
    offStatus();
    input.dispose();
    cursorFrames.dispose();
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

/**
 * A wheel event in rows.
 *
 * `deltaMode` is the browser's unit and all three occur in the wild: pixels
 * from a trackpad, lines from a wheel, pages from some mice and from
 * accessibility settings. A page is capped to the grid so one notch cannot
 * throw a reader further than a screen.
 */
function wheelLines(event: WheelEvent, rows: number): number {
  const perLine = 16;
  switch (event.deltaMode) {
    case WheelEvent.DOM_DELTA_PAGE:
      return Math.trunc(event.deltaY) * Math.max(rows - 1, 1);
    case WheelEvent.DOM_DELTA_LINE:
      return Math.trunc(event.deltaY);
    default:
      return Math.trunc(event.deltaY / perLine);
  }
}
