/**
 * Whether a bot may run a shell command in a session without asking its owner.
 * Destructive commands wait for approval; everything else runs.
 */
export type ShellVerdict = 'run' | 'ask';

const DESTRUCTIVE: ReadonlyArray<readonly string[]> = [
  ['rm', '-rf'],
  ['git', 'push', '--force'],
  ['git', 'reset', '--hard'],
];

function tokens(command: string): string[] | null {
  const trimmed = command.trim();
  if (!trimmed || /["'`$]/.test(trimmed)) return null;
  return trimmed.split(/\s+/);
}

export function shellVerdictOf(command: string): ShellVerdict {
  const words = tokens(command);
  if (words === null) return 'run';
  for (const pattern of DESTRUCTIVE) {
    if (pattern.every((part, i) => words[i] === part)) return 'ask';
  }
  return 'run';
}
