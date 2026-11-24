import type { SessionTerminalOutcome } from '../../sessions/application/session-terminal.port';
import { promptText } from '../domain/bot-prompt-text.policy';
import { cut, fenceUntrusted } from '../domain/bot-tool-text.policy';

/**
 * Each refusal the runner makes before it types anything: what it means, said
 * plainly, and what to tell the person when only they can change it.
 */
const REFUSALS: Readonly<Record<string, { meaning: string; advice?: string }>> = {
  EXEC_006: {
    meaning: promptText('sessions/tools-terminal.refusals-exec-006-meaning'),
    advice: promptText('sessions/tools-terminal.refusals-exec-006-advice'),
  },
  EXEC_007: { meaning: promptText('sessions/tools-terminal.refusals-exec-007-meaning') },
  SESS_001: { meaning: promptText('sessions/tools-terminal.refusals-sess-001-meaning') },
  SESS_003: { meaning: 'the terminal is not running' },
  INVALID_PATTERN: {
    meaning: promptText('sessions/tools-terminal.refusals-invalid-pattern-meaning'),
  },
};

/**
 * Any other failure may come after the text went in (the shell exited, the
 * capture failed), so it is never told as nothing typed.
 */
const MAYBE_TYPED = promptText('sessions/tools-terminal.maybe-typed');

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
        : promptText('sessions/tools-terminal.describe-terminal-waited-pattern-if', { waited });
      return `${head} Screen of terminal ${sessionId}:\n${fenceUntrusted('terminal_screen', screen.screen)}`;
    }
    case 'host_offline':
      return promptText('sessions/tools-terminal.describe-terminal-host-offline-nothing');
    case 'not_supported':
      return promptText('sessions/tools-terminal.describe-terminal-runner-host-too');
    case 'timed_out':
      return promptText('sessions/tools-terminal.describe-terminal-host-did-answer');
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
