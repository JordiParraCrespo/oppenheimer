import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef, useState } from 'react';
import { createResizeCoalescer } from '../lib/resize-coalescer';
import type { SessionStream, StreamEnd, StreamStatus } from '../lib/session-stream';
import { emptyRowsBelowContent } from '../lib/terminal-anchor';
import { classifyKey } from '../lib/terminal-keys';
import { attachWebglRenderer } from '../lib/terminal-renderer';
import {
  readTerminalTheme,
  TERMINAL_FONT,
  terminalMinimumContrastRatio,
} from '../lib/terminal-theme';

export interface TerminalGrid {
  cols: number;
  rows: number;
}

/**
 * Mounts an xterm.js terminal in `containerRef` and wires it to a stream.
 *
 * Everything here is a synchronisation with something outside React —
 * an imperative library that owns its own DOM, a `ResizeObserver` on the
 * pane, a `MutationObserver` on the theme class, the document's font loading,
 * animation frames, and the stream itself —
 * which is why it is one effect in a `hooks/` file rather than anything in
 * the component tree.
 *
 * The stream is *created* here rather than passed in, so that one effect owns
 * one lifetime. A stream held in state and closed by a second effect does not
 * survive StrictMode's remount: the cleanup closes it, and the terminal that
 * mounts next subscribes to something already shut, which renders blank in
 * development and nowhere else. `createStream` must be a stable reference.
 */
export function useTerminal(
  createStream: () => SessionStream,
  onEnd?: (reason: StreamEnd) => void,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<SessionStream | null>(null);
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [grid, setGrid] = useState<TerminalGrid>({ cols: 0, rows: 0 });
  // Read through a ref so a new callback identity never rebuilds the terminal.
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const stream = createStream();
    streamRef.current = stream;

    const term = new Terminal({
      ...TERMINAL_FONT,
      theme: readTerminalTheme(),
      cursorBlink: true,
      cursorStyle: 'block',
      // A few thousand lines of build output is the normal case. Under
      // `tmux attach` the grid is tmux's alternate screen and this stays
      // empty — tmux keeps the history — so it matters only for output
      // written outside it.
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

    // Keys the console answers before xterm encodes them (`terminal-keys.ts`).
    term.attachCustomKeyEventHandler((event) => {
      const verdict = classifyKey(event, { hasSelection: term.hasSelection() });
      if (verdict.kind === 'terminal') return true;
      if (verdict.kind === 'send') {
        // Stops the keypress and the textarea input that would follow.
        event.preventDefault();
        stream.send(verdict.data);
      }
      return false;
    });

    // Frames, not events: a burst of output, a drag and a font arriving all
    // collapse into one measurement per paint.
    let frame: number | null = null;
    let wantsFit = false;
    const nextFrame = (fitToo: boolean) => {
      wantsFit ||= fitToo;
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (wantsFit) {
          wantsFit = false;
          applyFit();
        }
        anchor();
      });
    };

    // The PTY hears the size once a drag settles (`resize-coalescer.ts`); the
    // grid on screen refits every frame of it.
    const ptySize = createResizeCoalescer((cols, rows) => stream.resize(cols, rows));

    const applyFit = () => {
      // fit() throws if the pane has no layout yet (a hidden tab, the frame
      // before the shell measures it). There is nothing to fit to, so skip.
      try {
        fit.fit();
        setGrid({ cols: term.cols, rows: term.rows });
        ptySize.request(term.cols, term.rows);
      } catch {
        // Measured again on the next resize.
      }
    };

    // Bottom-anchoring (`terminal-anchor.ts`): the picture moves down by the
    // empty rows below the content, so the agent's prompt sits on the pane's
    // last rows whatever height the pane is.
    //
    // The empty rows it pushes past the grid are clipped here, with `clip`
    // rather than `hidden`. A `hidden` box is still a scroll container, and
    // xterm's input textarea follows the cursor: the moment it took focus the
    // browser scrolled that box to reveal it, which undid most of the shift.
    // `clip` clips the same pixels and leaves nothing to scroll.
    container.style.overflow = 'clip';
    let anchoredPx = 0;
    const anchor = () => {
      const element = term.element;
      const screen = element?.querySelector<HTMLElement>('.xterm-screen');
      if (!element || !screen || term.rows < 1) return;
      const buffer = term.buffer.active;
      const rows = emptyRowsBelowContent({
        rows: term.rows,
        baseY: buffer.baseY,
        viewportY: buffer.viewportY,
        cursorY: buffer.cursorY,
        rowText: (y) => buffer.getLine(buffer.baseY + y)?.translateToString(true) ?? '',
      });
      // Pixels, not rows: a font change moves the cell height under an
      // unchanged row count.
      const px = Math.round((rows * screen.offsetHeight) / term.rows);
      if (px === anchoredPx) return;
      anchoredPx = px;
      element.style.transform = px > 0 ? `translateY(${px}px)` : '';
    };

    // `term.dispose()` releases the addon with every other one.
    attachWebglRenderer(term, () => {
      // The DOM renderer's cells are not WebGL's: refit, then repaint.
      nextFrame(true);
      term.refresh(0, term.rows - 1);
    });

    applyFit();
    nextFrame(false);

    const resizeObserver = new ResizeObserver(() => nextFrame(true));
    resizeObserver.observe(container);

    // A face that arrives after the first paint — the bundled symbols face is
    // fetched only when a glyph in its range is first drawn — leaves the
    // stand-in's glyphs cached in WebGL's atlas and its metrics in the fit.
    // Both are dropped once the document says a font finished loading.
    const onFontsLoaded = () => {
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
      setStatus(next);
      if (next === 'live') term.scrollToBottom();
    });
    const offEnd = stream.onEnd((reason) => onEndRef.current?.(reason));
    const input = term.onData((data) => stream.send(data));

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      offData();
      offStatus();
      offEnd();
      input.dispose();
      parsed.dispose();
      scrolled.dispose();
      reshaped.dispose();
      document.fonts?.removeEventListener('loadingdone', onFontsLoaded);
      themeObserver.disconnect();
      resizeObserver.disconnect();
      ptySize.dispose();
      term.dispose();
      stream.dispose();
      streamRef.current = null;
    };
  }, [createStream]);

  return { containerRef, status, grid };
}
