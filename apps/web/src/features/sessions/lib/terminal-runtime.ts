import { createResizeCoalescer, type SessionStream } from '@oppenheimer/frontend-consumer';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import { CursorFrames } from './cursor-frames';
import { bindFilePaste } from './terminal-files';
import { classifyKey } from './terminal-keys';
import {
  readTerminalTheme,
  readUserTurnColors,
  TERMINAL_FONT,
  TERMINAL_FONT_FAMILIES,
  terminalMinimumContrastRatio,
} from './terminal-theme';
import { bindUserTurns } from './user-turns';

/** The platform test xterm itself uses to pick its Mac behaviour. */
const IS_MAC = typeof navigator !== 'undefined' && /^Mac/.test(navigator.platform);

export interface SessionTerminalOptions {
  /**
   * The pane shows the agent's window (window 0), whose prompt takes
   * Shift+Enter as a newline. A shell window gets the chord as typed.
   */
  agentWindow?: boolean;
  /**
   * Files were pasted onto the terminal, for the caller to upload to the
   * host (`bindFilePaste`). Without a handler, files are left to xterm,
   * which pastes nothing for them.
   */
  onFiles?: (files: File[]) => void;
  /**
   * The first chunk on this attachment that puts a glyph on the grid; called
   * once. A session is "started" once the host has a tmux session, before the
   * agent has drawn anything (seconds cold, tens on a loaded machine), so the
   * caller uses this to tell a slow start from a broken one.
   */
  onFirstOutput?: () => void;
}

/**
 * One session terminal: xterm.js in `container`, wired to `stream`, until the
 * returned function disposes it. Everything that talks to xterm lives here;
 * the stream is the caller's and this never disposes it.
 *
 * **Nothing moves the picture of the grid.** Claude Code lays its turn out
 * across the whole terminal, so its prompt rests on the last rows; Codex puts
 * its prompt straight after its output, so a short conversation sits at the
 * top. That is ordinary terminal behaviour and Orca's too (it never transforms
 * `.xterm-screen`). Translating the grid down by its empty rows floated Codex
 * under a tall blank band and hid a PTY left at 80x24.
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
      mac: IS_MAC,
    });
    if (verdict.kind === 'terminal') return true;
    if (verdict.kind === 'copy') {
      event.preventDefault();
      copyToClipboard(term.getSelection());
      return false;
    }
    if (verdict.kind === 'selectAll') {
      event.preventDefault();
      term.selectAll();
      return false;
    }
    if (verdict.kind === 'send') {
      // Stops the keypress and the textarea input that would follow.
      event.preventDefault();
      stream.send(verdict.data);
    }
    return false;
  });

  // The reader's messages drawn as the artboard draws them. Only the agent's
  // window: the pointer-on-grey it looks for is Claude Code's.
  const userTurns = options.agentWindow ? bindUserTurns(term, readUserTurnColors) : null;

  const unbindFiles = options.onFiles ? bindFilePaste(container, options.onFiles) : () => {};

  // The wheel scrolls the session, not the program: tmux runs with `mouse on`,
  // so xterm would forward every tick as a mouse report and Codex would move
  // its own cursor instead of the reader scrolling back. The rule is the
  // buffer, not the agent: on the normal buffer the wheel scrolls what was
  // printed; on the alternate buffer it is the program's, since a full-screen
  // application (an editor, a pager, tmux's copy mode) has no scrollback.
  //
  // On the alternate buffer the notches are the program's, but they are not
  // sent one per event. A trackpad emits around a hundred wheel events a
  // second and xterm would report each one separately: a hundred round trips,
  // each making the agent redraw its whole screen (measured: ~1.6KB and ~10ms
  // for one). That is more work per second than a second, so the queue grows
  // and the screen keeps moving after the reader's fingers stop. Batched into
  // one write per frame the notches cost one round trip and one redraw, and
  // the agent still receives every one of them, in order.
  let pendingNotches = 0;
  let wheelCell = { col: 1, row: 1 };
  let wheelFrame: number | null = null;
  const flushNotches = () => {
    wheelFrame = null;
    const notches = pendingNotches;
    pendingNotches = 0;
    if (notches === 0) return;
    // SGR wheel (1006), which is what tmux negotiates and what the measured
    // repaint answered to. The cell is the pointer's, not the origin: a
    // full-screen agent has regions of its own, and a notch reported at 1;1
    // would scroll whichever of them sits in the corner.
    const button = notches < 0 ? 64 : 65;
    const report = `\u001b[<${button};${wheelCell.col};${wheelCell.row}M`;
    stream.send(report.repeat(Math.abs(notches)));
  };

  /** The pointer's cell, 1-based, clamped to the grid. */
  const cellOf = (event: WheelEvent): { col: number; row: number } => {
    const screen = container.querySelector('.xterm-screen');
    const box = (screen ?? container).getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return { col: 1, row: 1 };
    const col = Math.floor(((event.clientX - box.left) / box.width) * term.cols) + 1;
    const row = Math.floor(((event.clientY - box.top) / box.height) * term.rows) + 1;
    return {
      col: Math.min(Math.max(col, 1), term.cols),
      row: Math.min(Math.max(row, 1), term.rows),
    };
  };

  term.attachCustomWheelEventHandler((event) => {
    const lines = wheelLines(event, term.rows);
    if (term.buffer.active.type !== 'normal') {
      // The program's, batched: never xterm's own per-event report.
      if (lines !== 0) {
        wheelCell = cellOf(event);
        pendingNotches += lines;
        wheelFrame ??= requestAnimationFrame(flushNotches);
      }
      return false;
    }
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

  // A tab that comes back from the background can find WebGL's glyph atlas
  // gone bad without the context ever being reported lost (Orca rebuilds on
  // return for the same reason). Rebuilding costs one repaint.
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    term.clearTextureAtlas();
    term.refresh(0, term.rows - 1);
  };
  document.addEventListener('visibilitychange', onVisible);

  // `useAppliedTheme` toggles `.dark` / `.light` on <html>. xterm holds
  // resolved colour strings, not the tokens, so the ramp is re-read here.
  const themeObserver = new MutationObserver(() => {
    term.options.theme = readTerminalTheme();
    term.options.minimumContrastRatio = terminalMinimumContrastRatio();
    userTurns?.repaint();
  });
  themeObserver.observe(document.documentElement, { attributeFilter: ['class'] });

  const cursorFrames = new CursorFrames((data) => term.write(data));
  // Announced from the chunk rather than from the write callback: the reader
  // waits on the far end having something to say, not on the parser draining
  // it. A chunk counts once it carries a glyph (`hasVisibleText`), since an
  // attachment opens with tmux's preamble, which paints nothing.
  let announcedOutput = false;
  const offData = stream.onData((chunk, consumed) => {
    if (!announcedOutput && hasVisibleText(chunk)) {
      announcedOutput = true;
      options.onFirstOutput?.();
    }
    // xterm's write callback fires once the parser has drained the chunk:
    // that is the moment the bytes are consumed, and the credit goes with it.
    term.write(cursorFrames.frame(chunk), consumed);
  });
  // The replay a fresh attachment opens with is written into the buffer the
  // same way live output is, and xterm follows output only when the viewport
  // is already at the end — at that moment it sits on line zero. Pinning to
  // the tail when the link reports itself live is what puts a reader at the
  // agent's prompt rather than at the top of a session's history. Scrolling
  // back afterwards is the reader's, and nothing here fights it.
  const offStatus = stream.onStatus((next) => {
    if (next !== 'live') return;
    // The size is otherwise sent once, from the first fit that succeeds, and
    // the first `fit()` throws (the pane has no layout when React attaches the
    // ref). On a local API the attach ticket can land inside that frame: the
    // relay waits two seconds, attaches at 80x24, and the coalescer never
    // resends an unchanged size, so the agent lays its turn out for 24 rows of
    // a taller grid. A reconnect needs this anyway: the relay opens a fresh
    // attachment, which should be at the size the reader is looking at.
    stream.resize(term.cols, term.rows);
    term.scrollToBottom();
  });
  const input = term.onData((data) => stream.send(data));

  return () => {
    if (wheelFrame !== null) cancelAnimationFrame(wheelFrame);
    if (frame !== null) cancelAnimationFrame(frame);
    unbindFiles();
    userTurns?.dispose();
    offData();
    offStatus();
    input.dispose();
    cursorFrames.dispose();
    document.fonts?.removeEventListener('loadingdone', onFontsLoaded);
    document.removeEventListener('visibilitychange', onVisible);
    themeObserver.disconnect();
    resizeObserver.disconnect();
    ptySize.dispose();
    term.dispose();
  };
}

/**
 * The console's own copy (05): nothing selected copies nothing, and a copy
 * the browser refuses (no clipboard API outside a secure context, a denied
 * permission) is a no-op rather than an error.
 */
function copyToClipboard(text: string) {
  if (!text || !navigator.clipboard) return;
  navigator.clipboard.writeText(text).catch(() => {});
}

/**
 * WebGL is the renderer the product wants — a noisy build should not cost
 * CPU — but its constructor throws on some machines and in headless browsers
 * rather than degrading, and the GPU can take a context back later. Either
 * way this terminal stays on the DOM renderer for the rest of its life; the
 * next terminal tries again.
 *
 * The xterm packages are pinned to the 6.1 / addon-webgl 0.20 betas (Orca's
 * set) on purpose: 0.19 corrupts its glyph atlas when it merges pages, so a
 * long session full of diffs drew its cells as solid blocks (xterm.js #5883,
 * #6055). Move back to a `^` range once a stable release carries the fix.
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

const VISIBLE_TEXT_DECODER = new TextDecoder('utf-8', { fatal: false });

/** The escape grammar, in the order it has to be unwound (see `hasVisibleText`). */
/* biome-ignore-start lint/suspicious/noControlCharactersInRegex: an escape sequence is control characters by definition */
const ESCAPE_PATTERNS = [
  // OSC: ESC ] ... BEL, or ... ST
  /\u001b\][\s\S]*?(?:\u0007|\u001b\\)/g,
  // DCS, SOS, PM, APC: ESC P/X/^/_ ... ST
  /\u001b[P^_X][\s\S]*?(?:\u0007|\u001b\\)/g,
  // CSI: ESC [ parameters intermediates final
  /\u001b\[[0-?]*[ -/]*[@-~]/g,
  // Whatever escape is left is ESC plus one character.
  /\u001b[\s\S]/g,
  // The C0 controls and DEL.
  /[\u0000-\u001f\u007f]/g,
];
/* biome-ignore-end lint/suspicious/noControlCharactersInRegex: an escape sequence is control characters by definition */

/**
 * Whether a chunk from the far end would put a glyph on the grid: anything
 * left once escape sequences, C0 controls and whitespace are taken out (a
 * cleared screen arrives as spaces and newlines). Deliberately a scan, not a
 * parse: it runs only until the first chunk with text, and an escape it fails
 * to recognise can only make it answer late, which is the safe way to be
 * wrong.
 */
export function hasVisibleText(chunk: string | Uint8Array): boolean {
  // The stream hands over whatever the socket carried; a binary frame is
  // decoded loosely here because this only has to decide "is there a glyph",
  // and a multi-byte character split across two chunks still answers yes on
  // one of them.
  const text = typeof chunk === 'string' ? chunk : VISIBLE_TEXT_DECODER.decode(chunk);
  // Taken off in the order the grammar nests: the string-terminated forms
  // first, because their payload may contain anything, then CSI, which ends at
  // its final byte and *not* at the next escape — reading it as "up to the
  // next ESC" swallowed the text after a colour change, which is most of what
  // an agent prints.
  let withoutEscapes = text;
  for (const pattern of ESCAPE_PATTERNS) withoutEscapes = withoutEscapes.replace(pattern, '');
  return withoutEscapes.trim().length > 0;
}
