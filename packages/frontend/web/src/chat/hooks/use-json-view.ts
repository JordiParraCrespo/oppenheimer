import type { JsonTreeAnnotate } from '@oppenheimer/design-system-web';
import { dateFormatter, useLocale } from '../../i18n';
import { isoTimeOf, readJsonBlock } from '../lib/json-block';

/** A time in a JSON leaf, read in words in UTC, the zone such a value is written in. */
const TIME_NOTE: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
};

/** What a `JsonTree` draws for text that holds JSON: the value, and a note per ISO time. */
export interface JsonView {
  value: unknown;
  annotate: JsonTreeAnnotate;
}

/**
 * Whether text the agent wrote or a tool returned is JSON worth a tree
 * (`readJsonBlock`, for a fence's `language` or none), and if so the tree's
 * value with each ISO time in it followed by the same instant in words.
 * `null` leaves the text to be drawn as it is.
 */
export function useJsonView(text: string, language?: string): JsonView | null {
  const locale = useLocale();
  const json = readJsonBlock(text, language);
  if (!json) return null;
  return {
    value: json.value,
    annotate: (value) => {
      const time = isoTimeOf(value);
      return time ? `${dateFormatter(locale, TIME_NOTE).format(time)} UTC` : null;
    },
  };
}
