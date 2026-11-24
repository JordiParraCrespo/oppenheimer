import { engineLabel } from './engine-label';

/** The engine picker's option text, with the hint for engines that need a key. */
export function enginePickerWords(engine: string, needsKey: boolean): string {
  return needsKey ? `${engineLabel(engine)} (needs an API key)` : engineLabel(engine);
}
