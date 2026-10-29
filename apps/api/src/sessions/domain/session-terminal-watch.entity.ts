import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { TERMINAL_WATCH_PATTERN_MAX } from '@oppenheimer/shared/protocol';

/** The watches one session may hold at once. */
export const SESSION_TERMINAL_WATCHES_MAX = 10;

export interface SessionTerminalWatchProps {
  organizationId: string;
  sessionId: string;
  /** An RE2 regular expression the runner matches against each line of the screen. */
  pattern: string;
}

/**
 * Why a pattern cannot be watched, or null when it can. The runner matches
 * with Go's RE2, so what RE2 lacks (lookaround, backreferences) is refused
 * here rather than on the host, after the bot was told it watches.
 */
export function terminalWatchPatternProblem(pattern: string): string | null {
  if (pattern.trim() === '') return 'The pattern is empty.';
  if (pattern.length > TERMINAL_WATCH_PATTERN_MAX) {
    return `The pattern is longer than ${TERMINAL_WATCH_PATTERN_MAX} characters.`;
  }
  if (/\(\?<?[=!]/.test(pattern)) return 'Lookahead and lookbehind are not supported.';
  if (/\\[1-9]|\\k</.test(pattern)) return 'Backreferences are not supported.';
  try {
    new RegExp(pattern);
  } catch {
    return 'The pattern is not a valid regular expression.';
  }
  return null;
}

/**
 * A pattern a session's runner watches its screen for
 * (`27-bot-subscriptions.md` §2). The runner holds it in memory and is sent
 * it again on every hello; a match reaches the session's log as a count,
 * never as the text.
 */
export class SessionTerminalWatchEntity extends AggregateRoot<SessionTerminalWatchProps> {
  static watch(props: SessionTerminalWatchProps): SessionTerminalWatchEntity {
    const watch = new SessionTerminalWatchEntity({ id: randomUUID(), props: { ...props } });
    watch.validate();
    return watch;
  }

  /** A stored watch, as read back. */
  static create(create: CreateEntityProps<SessionTerminalWatchProps>): SessionTerminalWatchEntity {
    return new SessionTerminalWatchEntity(create);
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get sessionId(): string {
    return this.props.sessionId;
  }

  get pattern(): string {
    return this.props.pattern;
  }

  validate(): void {
    const problem = terminalWatchPatternProblem(this.props.pattern);
    if (problem) throw new ArgumentInvalidException(problem);
  }
}
