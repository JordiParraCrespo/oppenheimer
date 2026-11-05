import type {
  SessionTranscriptEntry,
  SessionTranscriptReason,
  SessionTranscriptStatus,
} from '@oppenheimer/shared';

/**
 * A session's conversation as a reader outside the console gets it
 * (`product/next-steps/agent-tools.md` §8): what a page owes about itself,
 * the cursor that continues it, and the secrets taken out of it. Pure.
 */

/** What a secret is replaced with. */
export const REDACTED = '[redacted]';

/**
 * Secrets that announce themselves by shape. Each is a credential a tool
 * printed (an `env`, a `.env` read, a `curl -v`), which a transcript would
 * otherwise carry to whoever reads it: a bot's model provider, a script's
 * log. A shape too loose to tell from prose is left out on purpose; the
 * assignment rule below is the net for the rest.
 */
const SECRET_SHAPES: readonly RegExp[] = [
  // A PEM private key, whole, or to the end of the text when it was cut.
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g,
  // Oppenheimer's own: an API token and a pairing token.
  /\boppenheimer_pat_[A-Za-z0-9_-]{8,}/g,
  /\bopr_reg_[A-Za-z0-9_-]{8,}/g,
  // GitHub tokens: classic, fine-grained, OAuth, App installation and refresh.
  /\bgh[pousr]_[A-Za-z0-9]{30,255}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{22,255}/g,
  // Anthropic, then OpenAI (project, service and admin keys included).
  /\bsk-ant-[A-Za-z0-9_-]{20,}/g,
  /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g,
  // Stripe secret and restricted keys.
  /\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}/g,
  // AWS access key ids.
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  // Google API keys.
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  // Slack tokens.
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  // A JSON Web Token: three base64url parts, the first two JSON objects.
  /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
];

/**
 * A secret by where it stands rather than what it looks like, keeping what
 * names it so the reader still knows what was there:
 *
 * - `Authorization: Bearer <token>` and a bare `Bearer <token>`;
 * - a password in a URL (`https://user:<password>@host`);
 * - an assignment to a name that says secret (`API_KEY=…`, `"password": "…"`),
 *   for a value of eight characters or more, so `token = null` is left alone.
 *
 * Each pattern's first group is what stays; the rest is the secret.
 */
const SECRET_PLACES: readonly RegExp[] = [
  /(\bBearer\s+)[A-Za-z0-9._~+/-]{16,}=*/gi,
  /(\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)[^\s/@]+(?=@)/gi,
  /(\b[A-Za-z0-9_.-]*(?:secret|token|passw(?:or)?d|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret)[A-Za-z0-9_.-]*["']?\s*[:=]\s*["']?)(?!\[redacted\])[^\s"',;}{)(]{8,}/gi,
];

/** A text with the secrets in it replaced, and how many were. */
export function redactSecrets(text: string): { text: string; redactions: number } {
  let redactions = 0;
  let out = text;
  for (const shape of SECRET_SHAPES) {
    out = out.replace(shape, () => {
      redactions += 1;
      return REDACTED;
    });
  }
  for (const place of SECRET_PLACES) {
    out = out.replace(place, (_match, kept: string) => {
      redactions += 1;
      return `${kept}${REDACTED}`;
    });
  }
  return { text: out, redactions };
}

/** An entry with the secrets in each of its parts replaced, and how many were. */
export function redactEntry(entry: SessionTranscriptEntry): {
  entry: SessionTranscriptEntry;
  redactions: number;
} {
  let redactions = 0;
  const parts = entry.parts.map((part) => {
    if (part.text === null) return part;
    const redacted = redactSecrets(part.text);
    redactions += redacted.redactions;
    return { ...part, text: redacted.text };
  });
  return { entry: { ...entry, parts }, redactions };
}

/** Where a page of the conversation ended: the host's name for it and a byte offset. */
export interface TranscriptCursor {
  conversation: string;
  after: number;
}

const CONVERSATION = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The cursor as a reader holds it: opaque, so nobody builds one by hand or
 * reads meaning into the offset. It is not a secret and carries no
 * authority: the session it is used on is read in the caller's scope first.
 */
export function encodeTranscriptCursor(cursor: TranscriptCursor): string {
  return Buffer.from(`${cursor.conversation}:${cursor.after}`, 'utf8').toString('base64url');
}

/** The cursor back, or null for one this API did not mint. */
export function decodeTranscriptCursor(cursor: string): TranscriptCursor | null {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  const colon = decoded.lastIndexOf(':');
  if (colon <= 0) return null;
  const conversation = decoded.slice(0, colon);
  const offset = decoded.slice(colon + 1);
  if (!CONVERSATION.test(conversation) || !/^\d{1,15}$/.test(offset)) return null;
  return { conversation, after: Number(offset) };
}

/** What a page read off the host says about its own completeness. */
export interface TranscriptPageFacts {
  dropped: number;
  partial: boolean;
  entries: readonly SessionTranscriptEntry[];
}

/**
 * `partial` when anything in the page's range is not there whole: a part the
 * host cut, an entry it left out, or a page read without the lines before it
 * by a transcriber that needs them. Otherwise `complete`, an empty page
 * included: no conversation yet is all of it.
 */
export function transcriptPageStatus(facts: TranscriptPageFacts): SessionTranscriptStatus {
  const cut = facts.entries.some((entry) => entry.parts.some((part) => part.truncated));
  return cut || facts.dropped > 0 || facts.partial ? 'partial' : 'complete';
}

/** What a host's refusal code means for the reader. */
export function transcriptRefusalReason(code: string): SessionTranscriptReason {
  return code === 'SESS_018' ? 'agent_keeps_none' : 'host_refused';
}

/** A reason that holds for good, as opposed to one worth asking again about. */
export function transcriptReasonStatus(reason: SessionTranscriptReason): SessionTranscriptStatus {
  switch (reason) {
    case 'cloud_vendor':
    case 'agent_keeps_none':
    case 'runner_too_old':
      return 'unsupported';
    case 'host_offline':
    case 'timed_out':
    case 'host_refused':
      return 'unavailable';
  }
}
