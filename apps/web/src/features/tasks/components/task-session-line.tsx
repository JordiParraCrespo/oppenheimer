import { dotVariants } from '@oppenheimer/design-system-web';
import { SquareTerminal } from '@oppenheimer/design-system-web/icons';
import type { TaskSessionState } from '../lib/session-state';

/** The status dot each state draws, in the design system's vocabulary. */
export const SESSION_DOT = {
  waiting: 'needs-input',
  queued: 'queued',
  running: 'running',
  failed: 'failed',
  idle: 'idle',
  completed: 'completed',
} as const;

/**
 * The card's session line: the state of the session that most needs the person,
 * its name, and how many more there are. Pressing it opens that session.
 */
export function TaskSessionLine({
  state,
  word,
  name,
  more,
  label,
  onOpen,
}: {
  state: TaskSessionState;
  /** The state in words. */
  word: string;
  name: string;
  /** `+1`, or nothing. */
  more: string | null;
  /** The accessible name: "Open session …". */
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className="mt-0.5 flex min-w-0 items-center gap-2 rounded-sm bg-hover-surface px-2 py-1.5 text-left text-xs transition-colors duration-fast hover:bg-active-surface"
    >
      <span className={dotVariants({ state: SESSION_DOT[state] })} aria-hidden />
      <span className="shrink-0 text-fg-muted">{word}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-fg">{name}</span>
      {more ? <span className="figures shrink-0 font-mono text-fg-subtle">{more}</span> : null}
      <SquareTerminal className="size-3 shrink-0 text-fg-subtle" aria-hidden />
    </button>
  );
}
