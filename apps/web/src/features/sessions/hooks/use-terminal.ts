import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef, useState } from 'react';
import type { SessionStream, StreamEnd, StreamStatus } from '../lib/session-stream';
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
 * pane, a `MutationObserver` on the theme class, and the stream itself —
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
    });

    const fit = new FitAddon();
    term.loadAddon(fit);

    const unicode = new Unicode11Addon();
    term.loadAddon(unicode);
    term.unicode.activeVersion = '11';

    term.open(container);

    // WebGL is the renderer the product wants — a noisy build should not cost
    // CPU — but it is unavailable on some machines and in headless browsers,
    // and its constructor throws there rather than degrading. The DOM renderer
    // is the fallback, and it is correct, just slower.
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      term.loadAddon(webgl);
    } catch {
      // Fallback renderer already in place.
    }

    const applyFit = () => {
      // fit() throws if the pane has no layout yet (a hidden tab, the frame
      // before the shell measures it). There is nothing to fit to, so skip.
      try {
        fit.fit();
        setGrid({ cols: term.cols, rows: term.rows });
        stream.resize(term.cols, term.rows);
      } catch {
        // Measured again on the next resize.
      }
    };

    applyFit();

    const resizeObserver = new ResizeObserver(applyFit);
    resizeObserver.observe(container);

    // `theme-provider.tsx` toggles `.dark` / `.light` on <html>. xterm holds
    // resolved colour strings, not the tokens, so the ramp is re-read here.
    const themeObserver = new MutationObserver(() => {
      term.options.theme = readTerminalTheme();
      term.options.minimumContrastRatio = terminalMinimumContrastRatio();
    });
    themeObserver.observe(document.documentElement, { attributeFilter: ['class'] });

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
      offData();
      offStatus();
      offEnd();
      input.dispose();
      themeObserver.disconnect();
      resizeObserver.disconnect();
      term.dispose();
      stream.dispose();
      streamRef.current = null;
    };
  }, [createStream]);

  return { containerRef, status, grid };
}
