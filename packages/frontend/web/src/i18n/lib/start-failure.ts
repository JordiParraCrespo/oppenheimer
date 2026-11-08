/** A note that says more than the reason can, and the page that fixes it. */
export interface FailureHelp {
  /** Translated: what happened and what to do about it. */
  body: string;
  /** Translated: the link's words. */
  link: string;
  /** The page the link opens. */
  href: string;
}

/** Why a session's start failed, in the reader's language, and the host's own words beside it. */
export interface FailureReason {
  /** Translated: the code's meaning, or the caller's fallback when it has none. */
  reason: string;
  /**
   * The host's detail, English, for a secondary "details" block only: one of
   * its lines per line, without the terminal's escape sequences. Null when
   * nothing readable is left.
   */
  detail: string | null;
  /** A note for the codes a sentence cannot explain; null for every other. */
  help: FailureHelp | null;
}

/**
 * The page each code's help links to. Its words are the translations'
 * `errors.startFailure.help.<code>`; a code here with none has no help.
 */
const HELP_LINKS: Readonly<Record<string, string>> = {
  // A Codex cloud environment the codex CLI cannot reach: the ones made in
  // ChatGPT's Settings → Codex Cloud (product/next-steps/cloud-agents.md).
  SESS_010: 'https://chatgpt.com/settings/codex-cloud',
};

/**
 * Why a start failed. The host's `detail` is English written for an operator,
 * so it is never the reason itself: `translateCode` picks the sentence for the
 * code, and a code it does not know reads as the caller's `fallback`. The
 * detail rides along for a secondary line, and `describeHelp` gives the words
 * of a code's help note, when the code has one.
 */
export function failureReason(
  failure: { code: string | null; detail: string | null } | null | undefined,
  translateCode: (code: string) => string | undefined,
  fallback: string,
  describeHelp: (code: string) => Omit<FailureHelp, 'href'> | undefined = () => undefined,
): FailureReason | null {
  if (!failure) return null;
  const { code, detail } = failure;
  const href = code ? HELP_LINKS[code] : undefined;
  const words = code && href ? describeHelp(code) : undefined;
  return {
    reason: (code ? translateCode(code) : undefined) ?? fallback,
    detail: detail ? readableDetail(detail) : null,
    help: words && href ? { ...words, href } : null,
  };
}

/**
 * Everything in a terminal's output that it acts on rather than shows: a CSI
 * sequence (colours, cursor moves; group 1 its parameters and final byte), an
 * OSC (titles, links), a character-set choice (`ESC ( B`), a two-byte escape
 * (`ESC 7`/`ESC 8`) and the control characters but tab, newline and return.
 * The runner's own `clean` (apps/runner/internal/sessions/adapters/cloud) reads
 * the same; this one is for the details a runner sent before it did, which
 * stay in a session's start log.
 */
const TERMINAL =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point
  /\x1b\[([0-9;?<>=]*[ -/]*[@-~])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[ -/]+[0-~]|\x1b[0-~]|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
/** A CSI's parameters and final byte when it moves the cursor right: the spaces between words. */
const CURSOR_FORWARD = /^(\d*)C$/;

/**
 * The host's detail as a reader of its terminal would see it: a cursor move
 * right as the spaces it stands for, every other escape gone, and one line per
 * line, the runner's ` · ` between its last lines included. Null when no line
 * has anything left on it.
 */
function readableDetail(detail: string): string | null {
  const text = detail.replace(TERMINAL, (_sequence, csi: string | undefined) => {
    const move = csi ? CURSOR_FORWARD.exec(csi) : null;
    if (!move) return '';
    return ' '.repeat(Math.min(Math.max(Number(move[1]) || 1, 1), 200));
  });
  const lines = text
    .split(/\r\n|\r|\n| · /)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  return lines.length > 0 ? lines.join('\n') : null;
}
