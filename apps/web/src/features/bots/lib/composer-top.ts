/**
 * What sits on the composer's top edge (`ChatComposer`'s `above`), one at a
 * time and in this order: the messages waiting their turn (with the missing
 * key on top of them, when it is missing), else the missing key, else the
 * goal the bot works toward. Null leaves the box's top edge its own.
 */
export type ComposerTop = 'queue' | 'noKey' | 'goal';

export function composerTopOf(state: {
  waiting: number;
  noKey: boolean;
  goal: boolean;
}): ComposerTop | null {
  if (state.waiting > 0) return 'queue';
  if (state.noKey) return 'noKey';
  if (state.goal) return 'goal';
  return null;
}
