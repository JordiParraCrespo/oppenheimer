import { Unicode11Addon } from '@xterm/addon-unicode11';
import { type ITerminalInitOnlyOptions, type ITerminalOptions, Terminal } from '@xterm/xterm';
import { readTerminalTheme, TERMINAL_FONT, terminalMinimumContrastRatio } from './terminal-theme';

/**
 * An xterm drawn the way every session terminal is: the terminal ramp's face,
 * colours and contrast floor, no blinking cursor, and Unicode 11 widths (box
 * drawing and emoji in agent output are wrong without it, and it is a
 * proposed API). `options` adds what one terminal needs on top: the live
 * session's grid (`mountSessionTerminal`) and a watcher's scrollback page
 * (`bindWatcherHistory`) are both made here, so they draw the same.
 */
export function createThemedTerminal(
  options: ITerminalOptions & ITerminalInitOnlyOptions = {},
): Terminal {
  const term = new Terminal({
    ...TERMINAL_FONT,
    theme: readTerminalTheme(),
    minimumContrastRatio: terminalMinimumContrastRatio(),
    cursorBlink: false,
    allowProposedApi: true,
    ...options,
  });
  term.loadAddon(new Unicode11Addon());
  term.unicode.activeVersion = '11';
  return term;
}

/**
 * Keeps a terminal's colours on the applied theme: `useAppliedTheme` toggles
 * `.dark` / `.light` on `<html>`, and xterm holds resolved colours, not the
 * tokens, so they are read again. `repaint` is told after, for what the
 * caller draws in those colours itself. Returns the unsubscribe.
 */
export function followAppliedTheme(term: Terminal, repaint?: () => void): () => void {
  const observer = new MutationObserver(() => {
    term.options.theme = readTerminalTheme();
    term.options.minimumContrastRatio = terminalMinimumContrastRatio();
    repaint?.();
  });
  observer.observe(document.documentElement, { attributeFilter: ['class'] });
  return () => observer.disconnect();
}
