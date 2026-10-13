import '@xterm/xterm/css/xterm.css';
import { mountSessionTerminal } from '../../../../apps/web/src/features/sessions/lib/terminal-runtime';

type SessionStream = Parameters<typeof mountSessionTerminal>[1];

/**
 * The page `typing-pixels.spec.ts` drives: the console's own session
 * terminal (`mountSessionTerminal`, predictive echo and all) on a fake host
 * whose echo the test holds back and lets go, so it can photograph a
 * prediction and then the echo that replaces it.
 *
 * Two hosts, the two ways an agent shows where the reader types:
 * - `caret`: the terminal's cursor stays visible, as a shell and Codex leave
 *   it; tmux frames each redraw in a hide and show.
 * - `inverse`: the cursor is hidden and the program paints one inverse cell,
 *   as Claude Code (Ink) does.
 */
type Mode = 'caret' | 'inverse';

const PROMPT = '❯ ';

class FakeHost implements SessionStream {
  private readonly listeners = new Set<
    (chunk: Uint8Array | string, consumed: () => void) => void
  >();
  private typed = '';
  private pending = '';
  private holding = false;
  /** How long an echo takes when nothing holds it: a far host, above the typeahead's 30 ms. */
  delayMs = 60;
  /** Echoes written so far. */
  echoes = 0;

  constructor(private readonly mode: Mode) {}

  start(): void {
    this.write(this.mode === 'inverse' ? `\u001b[?25l${this.line()}` : PROMPT);
  }

  hold(): void {
    this.holding = true;
  }

  release(): void {
    this.holding = false;
    this.flush();
  }

  onData(listener: (chunk: Uint8Array | string, consumed: () => void) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  onEnd() {
    return () => {};
  }
  onStatus(listener: (status: 'live') => void) {
    listener('live');
    return () => {};
  }
  send(data: string): void {
    // Focus reports and the like are not keys.
    if (data.startsWith('\u001b')) return;
    this.pending += data;
    if (!this.holding) setTimeout(() => this.flush(), this.delayMs);
  }
  resize(): void {}
  reconnectNow(): void {}
  dispose(): void {}

  private flush(): void {
    if (this.holding || this.pending === '') return;
    const keys = this.pending;
    this.pending = '';
    // What the line editor does with the keys: Backspace takes back what was
    // typed and stops at the prompt, which is not the reader's to delete. The
    // typeahead predicts the same (`skipLeadingPrompt` and Backspace at the
    // start of the text in `typeahead-model.ts`); this is the host it is
    // checked against, so the two say it independently on purpose.
    let echo = '';
    for (const key of keys) {
      if (key !== '\u007f') {
        this.typed += key;
        echo += key;
      } else if (this.typed.length > 0) {
        this.typed = this.typed.slice(0, -1);
        echo += '\b \b';
      }
    }
    this.echoes += 1;
    if (this.mode === 'inverse') this.write(this.line());
    else this.write(`\u001b[?25l${echo}\u001b[?25h`);
  }

  /** The whole prompt line as Ink redraws it, the cursor an inverse blank. */
  private line(): string {
    return `\r\u001b[2K${PROMPT}${this.typed}\u001b[7m \u001b[27m`;
  }

  private write(text: string): void {
    for (const listener of this.listeners) listener(text, () => {});
  }
}

const params = new URLSearchParams(location.search);
const mode = (params.get('mode') ?? 'caret') as Mode;

// An installed face served under a name the terminal's stack asks for first
// (`TERMINAL_FONT`), so its metrics are the ones measured.
const face = params.get('face');
if (face) {
  const style = document.createElement('style');
  style.textContent = `@font-face { font-family: "SF Mono"; src: local("${face}"); }`;
  document.head.appendChild(style);
  await document.fonts.load('13px "SF Mono"');
}

const host = new FakeHost(mode);
const container = document.getElementById('terminal') as HTMLElement;
mountSessionTerminal(container, host, { typeahead: () => true });
host.start();

let watching = false;
let frames: number[] = [];

/** Everything the spec reads or does, on `window.harness`. */
const harness = {
  host,
  /** Which renderer draws: the WebGL addon leaves no DOM rows behind. */
  renderer: () => (container.querySelector('.xterm-rows') ? 'dom' : 'webgl'),
  /**
   * Starts counting the cursors on screen in every painted frame: the
   * terminal's own (the DOM renderer's cursor element) and the typeahead's
   * (an overlay cell in the caret's colour). `stopWatching` hands the counts
   * back.
   */
  watchCursors(): void {
    const caret = getComputedStyle(document.documentElement)
      .getPropertyValue('--term-caret')
      .trim();
    const probe = document.createElement('i');
    probe.style.color = caret;
    document.body.appendChild(probe);
    const caretColor = getComputedStyle(probe).color;
    probe.remove();
    watching = true;
    frames = [];
    const sample = () => {
      // After the frame's callbacks, so what is counted is what was painted.
      setTimeout(() => {
        const own = container.querySelectorAll('.xterm-rows .xterm-cursor').length;
        const layer = Array.from(
          container.querySelectorAll<HTMLElement>('.xterm-screen > div'),
        ).find((element) => element.style.zIndex === '6');
        const guessed = Array.from(layer?.children ?? []).filter(
          (cell) => (cell as HTMLElement).style.backgroundColor === caretColor,
        ).length;
        frames.push(own + guessed);
      });
      if (watching) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  },
  stopWatching(): number[] {
    watching = false;
    return frames;
  },
  /**
   * The terminal's screen in page CSS pixels. Only the prompt line changes
   * between a prediction and its echo, so the whole screen is compared.
   */
  screen(): { x: number; y: number; width: number; height: number } {
    const box = (container.querySelector('.xterm-screen') as HTMLElement).getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  },
};

Object.assign(window, { harness });
