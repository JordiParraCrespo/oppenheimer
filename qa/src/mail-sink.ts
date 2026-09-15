import { readFileSync } from 'node:fs';
import { API_LOG } from './paths.js';

/**
 * The QA mail sink.
 *
 * `EMAIL_PROVIDER=console` makes the email worker log each transactional
 * message instead of sending it — `[PASSWORD RESET] To: … | URL: …` and
 * `[INVITATION] To: … | URL: …`. That log *is* the inbox for QA purposes, and
 * reading a link out of it is the closest thing to a person clicking the one
 * they were mailed without standing up a mail server to prove it.
 */
export type MailKind = 'PASSWORD RESET' | 'INVITATION' | 'EMAIL VERIFICATION' | 'WELCOME';

export interface SunkMail {
  kind: MailKind;
  to: string;
  url?: string;
}

const LINE =
  /\[(PASSWORD RESET|INVITATION|EMAIL VERIFICATION|WELCOME)\] To: ([^|]+?)\s*(?:\|.*?URL:\s*(\S+))?\s*$/;

/** Every message the sink has seen, oldest first. */
export function readMailSink(logPath: string = API_LOG): SunkMail[] {
  let contents = '';
  try {
    contents = readFileSync(logPath, 'utf8');
  } catch {
    return [];
  }
  const mail: SunkMail[] = [];
  for (const line of contents.split('\n')) {
    const match = LINE.exec(line);
    if (!match) continue;
    mail.push({ kind: match[1] as MailKind, to: match[2].trim(), url: match[3] });
  }
  return mail;
}

/**
 * The most recent link of a kind sent to an address.
 *
 * Polls rather than reads once: the mail goes out through a BullMQ worker, so
 * it lands in the log a moment after the request that triggered it returns.
 */
export async function waitForMailLink(
  kind: MailKind,
  to: string,
  options: { timeoutMs?: number; logPath?: string; after?: number } = {},
): Promise<string> {
  const { timeoutMs = 20_000, logPath = API_LOG, after = 0 } = options;
  const deadline = Date.now() + timeoutMs;
  const wanted = to.toLowerCase();

  while (Date.now() < deadline) {
    const matches = readMailSink(logPath).filter(
      (mail) => mail.kind === kind && mail.to.toLowerCase() === wanted && mail.url,
    );
    // `after` lets a caller ignore links that were already in the log before
    // it acted, so a rerun does not follow the previous run's reset link.
    if (matches.length > after) return matches[matches.length - 1].url as string;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `no ${kind} link for ${to} appeared in the mail sink within ${timeoutMs}ms (${logPath})`,
  );
}

/** How many links of a kind the sink already holds for an address. */
export function mailCount(kind: MailKind, to: string, logPath: string = API_LOG): number {
  const wanted = to.toLowerCase();
  return readMailSink(logPath).filter(
    (mail) => mail.kind === kind && mail.to.toLowerCase() === wanted && mail.url,
  ).length;
}
