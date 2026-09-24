import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Reads the transactional emails the API "sent".
 *
 * With `EMAIL_PROVIDER=console` the API's `ConsoleEmailService` logs each
 * message instead of delivering it, so the API log *is* the mailbox. That is
 * what lets these tests follow a verification link end to end without an SMTP
 * server: point `API_LOG` at the file the API's stdout is captured to.
 */
const API_LOG =
  process.env.API_LOG ??
  // Where `scripts/stack/stack.mjs` captures it.
  resolve(fileURLToPath(import.meta.url), '..', '..', '..', '.stack', 'api.log');

/**
 * SGR colour sequences, stripped before anything is matched.
 *
 * The API's logger colourises when it thinks something is watching — which on
 * GitHub Actions it does, and in a plain local run it does not. That put an
 * `ESC[39m` reset immediately after the URL at the end of the line, and `\S+`
 * happily swallowed it: the verification link was then fetched with a
 * `callbackURL` of `/` plus three junk characters, which Better Auth refused as
 * untrusted with a 403. One test, only on CI, and nothing in the diff to
 * explain it. A log parser reads the text, not the colours.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: the escape character is what this matches
const ANSI_SGR = /\u001B\[[0-9;]*m/g;

async function readLog(): Promise<string> {
  try {
    return (await readFile(API_LOG, 'utf8')).replace(ANSI_SGR, '');
  } catch {
    return '';
  }
}

/**
 * Polls the log for the most recent email of `kind` addressed to `email` and
 * returns the URL it carried. Polls because the mail is enqueued on BullMQ and
 * delivered by a worker, so it lands a beat after the HTTP response.
 */
export async function waitForEmailUrl(
  kind: 'EMAIL VERIFICATION' | 'PASSWORD RESET' | 'INVITATION',
  email: string,
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  // Anything between the address and the URL is skipped rather than spelled
  // out: the line carries the recipient's locale today
  // (`To: … | Locale: en | URL: …`), and when that segment was added this
  // pattern still demanded `To: … | URL:` and silently matched nothing —
  // every emailed-link test failed on a mailbox that was in fact working.
  // `[^\n]*?` keeps the match on the one log line.
  const pattern = new RegExp(
    `\\[${kind}\\] To: ${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\|[^\\n]*?URL: (\\S+)`,
    'g',
  );

  while (Date.now() < deadline) {
    const log = await readLog();
    const matches = [...log.matchAll(pattern)];
    const last = matches.at(-1);
    if (last) return last[1];
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No "${kind}" email for ${email} appeared in ${API_LOG} within ${timeoutMs}ms`);
}

/** True when an email of `kind` was sent to `email` — used for negative cases. */
export async function emailWasSent(kind: string, email: string): Promise<boolean> {
  const log = await readLog();
  return log.includes(`[${kind}] To: ${email}`);
}
