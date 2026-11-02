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
  /** The newest count of matching lines the runner reported; 0 before any. */
  matches: number;
}

/** The letters and digits Go's `regexp/syntax` takes after a backslash. */
const GO_ESCAPES = new Set('afnrtvxpPdDsSwWbBAzQE01234567');

/** The longest repeat count Go's `regexp/syntax` takes (`{n}`, `{n,m}`). */
const GO_REPEAT_MAX = 1000;

/**
 * Why a pattern cannot be watched, or null when it can. The runner matches
 * with Go's `regexp` (RE2), which refuses what JavaScript's engine takes:
 * lookaround, backreferences, escapes it does not know (`\u0041`, `\Z`) and
 * repeat counts past 1000. Those are refused here, in the API, so a bot is
 * never told it watches a pattern its host will reject; the rest of the
 * syntax is checked by compiling it, Go's leading inline flags aside, which
 * JavaScript reads differently. The runner compiles it again and refuses
 * anything this misses as `INVALID_PATTERN` in the session's log.
 */
function patternProblem(pattern: string): string | null {
  if (pattern.trim() === '') return 'The pattern is empty.';
  if (pattern.length > TERMINAL_WATCH_PATTERN_MAX) {
    return `The pattern is longer than ${TERMINAL_WATCH_PATTERN_MAX} characters.`;
  }
  if (/\(\?<?[=!]/.test(pattern)) return 'Lookahead and lookbehind are not supported.';
  if (/\\[1-9]|\\k</.test(pattern)) return 'Backreferences are not supported.';
  for (let at = 0; at < pattern.length; at++) {
    if (pattern[at] !== '\\') continue;
    const escaped = pattern[at + 1];
    if (escaped === undefined) return 'The pattern ends with a lone backslash.';
    if (/[A-Za-z0-9]/.test(escaped) && !GO_ESCAPES.has(escaped)) {
      return `\\${escaped} is not an escape the host's regular expressions know.`;
    }
    at++;
  }
  for (const [, low, high] of pattern.matchAll(/\{(\d+)(?:,(\d*))?\}/g)) {
    if (Number(low) > GO_REPEAT_MAX || (high && Number(high) > GO_REPEAT_MAX)) {
      return `A repeat count above ${GO_REPEAT_MAX} is not supported.`;
    }
  }
  try {
    new RegExp(pattern.replace(/\(\?[imsU-]+\)/g, '').replace(/\(\?[imsU-]+:/g, '(?:'));
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
  static watch(props: Omit<SessionTerminalWatchProps, 'matches'>): SessionTerminalWatchEntity {
    const watch = new SessionTerminalWatchEntity({
      id: randomUUID(),
      props: { ...props, matches: 0 },
    });
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

  get matches(): number {
    return this.props.matches;
  }

  validate(): void {
    const problem = patternProblem(this.props.pattern);
    if (problem) throw new ArgumentInvalidException(problem);
  }
}
