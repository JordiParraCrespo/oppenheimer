import type { IDisposable, Terminal } from '@xterm/xterm';

/**
 * A private mode number no terminal assigns, sent beside 25 (the cursor) on
 * the hide and show written here: xterm ignores it and applies 25, and the
 * handlers below know the sequence is ours, not the program's.
 */
const OWN_CURSOR_MODE = 7725;

/**
 * The terminal's cursor as the program asks for it (`visible`), and a way to
 * keep it off screen whatever the program asks (`suppress`).
 *
 * It goes through the stream because nothing else reaches it: the WebGL
 * renderer paints the cursor into its canvas, where no CSS can hide it, and
 * xterm has no option for "no cursor" while focused. tmux shows the cursor
 * again at the end of every redraw, so while suppressed that show is
 * swallowed rather than painted for a frame; only one with nothing else in it
 * but blink is, and anything more is let through whole.
 */
export function bindHostCursor(term: Terminal): IDisposable & {
  visible(): boolean;
  /** `applied` runs once the terminal has taken the change, or at once if there is none. */
  suppress(hidden: boolean, applied?: () => void): void;
} {
  let visible = true;
  let suppressed = false;
  const own = (params: (number | number[])[]) => params.includes(OWN_CURSOR_MODE);

  const onShow = term.parser.registerCsiHandler({ prefix: '?', final: 'h' }, (params) => {
    if (!params.includes(25) || own(params)) return false;
    visible = true;
    return suppressed && params.every((param) => param === 25 || param === 12);
  });
  const onHide = term.parser.registerCsiHandler({ prefix: '?', final: 'l' }, (params) => {
    if (params.includes(25) && !own(params)) visible = false;
    // Seen, not handled: xterm still applies the mode.
    return false;
  });

  const suppress = (hidden: boolean, applied?: () => void) => {
    if (hidden === suppressed || !visible) {
      suppressed = hidden;
      applied?.();
      return;
    }
    suppressed = hidden;
    term.write(`\u001b[?25;${OWN_CURSOR_MODE}${hidden ? 'l' : 'h'}`, applied);
  };

  return {
    visible: () => visible,
    suppress,
    dispose() {
      suppress(false);
      onShow.dispose();
      onHide.dispose();
    },
  };
}
