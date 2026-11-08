import type { SessionTerminalOutcome } from '../../sessions/application/session-terminal.port';
import { cut, fenceUntrusted } from '../domain/bot-tool-text.policy';

/**
 * Each refusal the runner makes before it types anything: what it means, said
 * plainly, and what to tell the person when only they can change it.
 */
const REFUSALS: Readonly<Record<string, { meaning: string; advice?: string }>> = {
  EXEC_006: {
    meaning: 'this host does not let bots drive a terminal: its exec mode is not full',
    advice: 'Tell the person; only they can change it, on the host, with `runner exec mode full`.',
  },
  EXEC_007: { meaning: 'that session is not a blank terminal; use open_terminal for one' },
  SESS_001: { meaning: 'that session is not on the host' },
  SESS_003: { meaning: 'the terminal is not running' },
  INVALID_PATTERN: { meaning: 'wait_for is not a valid regular expression' },
};

/**
 * Any other failure may come after the text went in (the shell exited, the
 * capture failed), so it is never told as nothing typed.
 */
const MAYBE_TYPED =
  'What you gave may already have been typed: read the terminal before typing again.';

/** The Needs input card's line: "Type `ssh build-02` then Enter in terminal …". */
export function terminalTypeSummary(
  sessionId: string,
  text?: string,
  keys?: readonly string[],
): string {
  const typed = text ? `\`${cut(text, 200)}\`` : '';
  const pressed = keys?.length ? keys.join(' ') : '';
  const what = [typed, pressed].filter(Boolean).join(' then ');
  return `Type ${what || 'nothing'} in terminal ${sessionId}`;
}

/**
 * What a drive came to, in words the model reads. The screen is outside text
 * (whatever the programs in the terminal printed), so it is fenced as data.
 */
export function describeTerminal(outcome: SessionTerminalOutcome, sessionId: string): string {
  switch (outcome.kind) {
    case 'screen': {
      const { screen } = outcome;
      const waited = `${(screen.waitedMs / 1000).toFixed(1)} s`;
      const head = screen.matched
        ? `The pattern showed after ${waited}.`
        : `Waited ${waited}; the pattern, if you gave one, did not show yet.`;
      return `${head} Screen of terminal ${sessionId}:\n${fenceUntrusted('terminal_screen', screen.screen)}`;
    }
    case 'host_offline':
      return 'The host is offline: nothing was typed or read.';
    case 'not_supported':
      return "The runner on that host is too old to drive a terminal. The person can update it from the host's page.";
    case 'timed_out':
      return 'The host did not answer in time; whether the keys were typed is unknown. Read the terminal before typing again.';
    case 'failed': {
      const known = REFUSALS[outcome.code];
      const code = known ? `${outcome.code}: ${known.meaning}` : outcome.code;
      return [
        `Refused (${code}): ${outcome.detail ?? 'no reason given'}.`,
        known ? 'Nothing was typed.' : MAYBE_TYPED,
        known?.advice,
      ]
        .filter(Boolean)
        .join(' ');
    }
  }
}
