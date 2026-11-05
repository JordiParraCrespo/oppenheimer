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
 * Redaction is three tables and the scanners built from them, so the next
 * credential is a row, not another hand-ordered regex: shapes a secret
 * announces itself by, headers whose value is a credential, and words that
 * make a name's value secret. Shapes run first, so a known token inside a
 * header or an assignment is counted once.
 */

/** Matches what a scanner already replaced, so a later one leaves it be. */
const NOT_REDACTED = '(?!\\[redacted\\])';

/**
 * Credentials that announce themselves by shape: the whole match is the
 * secret. Each is one a tool prints (an `env`, a `.env` read, a `curl -v`),
 * which a transcript would otherwise carry to whoever reads it. A shape too
 * loose to tell from prose is left out on purpose; the names below are the
 * net for the rest.
 */
const SECRET_SHAPES: readonly { what: string; pattern: RegExp }[] = [
  {
    what: 'a PEM private key, whole, or to the end of a text cut inside it',
    pattern:
      /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g,
  },
  { what: 'an Oppenheimer API token', pattern: /\boppenheimer_pat_[A-Za-z0-9_-]{8,}/g },
  { what: 'an Oppenheimer pairing token', pattern: /\bopr_reg_[A-Za-z0-9_-]{8,}/g },
  {
    what: 'a GitHub token: classic, OAuth, App installation or refresh',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{30,255}\b/g,
  },
  { what: 'a fine-grained GitHub token', pattern: /\bgithub_pat_[A-Za-z0-9_]{22,255}/g },
  { what: 'an Anthropic key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  {
    what: 'an OpenAI key, project, service and admin ones included',
    pattern: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g,
  },
  { what: 'a Stripe secret or restricted key', pattern: /\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}/g },
  { what: 'an AWS access key id', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { what: 'a Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { what: 'a Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  {
    what: 'a JSON Web Token: three base64url parts, the first two JSON objects',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  },
];

/**
 * Headers whose value is a credential, however they are printed (`curl -v`,
 * a header object, a JSON log): what names them stays, the value goes. An
 * `Authorization` value is a credential after an optional scheme (`Basic`,
 * `Bearer`, `Token`), which stays; a cookie is the rest of the line.
 */
const SECRET_HEADERS: readonly { names: readonly string[]; value: 'credential' | 'line' }[] = [
  { names: ['authorization', 'proxy-authorization'], value: 'credential' },
  { names: ['cookie', 'set-cookie'], value: 'line' },
];

/**
 * Words that make a name's value secret (`API_KEY=…`, `"password": "…"`),
 * as regex fragments; a value of eight characters or more goes, so
 * `token = null` is left alone.
 */
const SECRET_NAME_WORDS: readonly string[] = [
  'secret',
  'token',
  'passw(?:or)?d',
  'api[_-]?key',
  'access[_-]?key',
  'private[_-]?key',
  'client[_-]?secret',
];

/** One header row as a scanner: its first group is what stays. */
function headerScanner(header: (typeof SECRET_HEADERS)[number]): RegExp {
  const lead = `(\\b(?:${header.names.join('|')})["']?\\s*[:=]\\s*\\[?\\s*["']?`;
  const value =
    header.value === 'credential'
      ? `(?:[A-Za-z]+\\s+)?)${NOT_REDACTED}[A-Za-z0-9._~+/=-]{8,}`
      : `)${NOT_REDACTED}[^\\r\\n"']{8,}`;
  return new RegExp(lead + value, 'gi');
}

/**
 * Secrets by where they stand, each scanner's first group the part that
 * stays: the headers, a bare `Bearer <token>`, a password in a URL
 * (`https://user:<password>@host`), and an assignment to a secret name.
 */
const SECRET_PLACES: readonly RegExp[] = [
  ...SECRET_HEADERS.map(headerScanner),
  new RegExp(`(\\bBearer\\s+)${NOT_REDACTED}[A-Za-z0-9._~+/-]{16,}=*`, 'gi'),
  /(\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)[^\s/@]+(?=@)/gi,
  new RegExp(
    `(\\b[A-Za-z0-9_.-]*(?:${SECRET_NAME_WORDS.join('|')})[A-Za-z0-9_.-]*["']?\\s*[:=]\\s*["']?)${NOT_REDACTED}[^\\s"',;}{)(]{8,}`,
    'gi',
  ),
];

/** A text with the secrets in it replaced, and how many were. */
export function redactSecrets(text: string): { text: string; redactions: number } {
  let redactions = 0;
  let out = text;
  for (const { pattern } of SECRET_SHAPES) {
    out = out.replace(pattern, () => {
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
