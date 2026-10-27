import type { JsonTreeAnnotate } from '@oppenheimer/design-system-web';
import { dateFormatter, useLocale } from '../../i18n';
import { isoTimeOf } from '../lib/json-block';

/** A time in a JSON leaf, read in words in UTC, the zone such a value is written in. */
const TIME_NOTE: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
};

/** `JsonTree`'s note for a leaf that is an ISO time: the same instant in words. */
export function useJsonTimeNote(): JsonTreeAnnotate {
  const locale = useLocale();
  return (value) => {
    const time = isoTimeOf(value);
    return time ? `${dateFormatter(locale, TIME_NOTE).format(time)} UTC` : null;
  };
}
