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
  /** The host's raw detail, English, for a secondary "details" line only. */
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
    detail,
    help: words && href ? { ...words, href } : null,
  };
}
