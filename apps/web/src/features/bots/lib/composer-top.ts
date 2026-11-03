/**
 * What sits on the composer's top edge (`ChatComposer`'s `above`), one at a
 * time and in this order: the messages waiting their turn (with the missing
 * key on top of them, when it is missing), else the missing key, else what
 * a built-in command typed cannot be sent without (`/goal` with no
 * condition), else the goal the bot works toward, else the loop it runs.
 * Null leaves the box's top edge its own.
 */
export type ComposerTop = 'queue' | 'noKey' | 'command' | 'goal' | 'loop';

export function composerTopOf(state: {
  waiting: number;
  noKey: boolean;
  command: boolean;
  goal: boolean;
  loop: boolean;
}): ComposerTop | null {
  if (state.waiting > 0) return 'queue';
  if (state.noKey) return 'noKey';
  if (state.command) return 'command';
  if (state.goal) return 'goal';
  if (state.loop) return 'loop';
  return null;
}
