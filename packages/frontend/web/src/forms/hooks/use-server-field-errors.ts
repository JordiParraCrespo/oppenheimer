import { useEffect } from 'react';
import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * A failure that may name fields: a resolved message, an `AppError` (both carry
 * `fieldErrors`), or anything else a mutation rejected with, which names none.
 */
export type ServerFieldErrorSource = unknown;

function fieldErrorsOf(source: ServerFieldErrorSource): Record<string, string> {
  if (typeof source !== 'object' || source === null || !('fieldErrors' in source)) return {};
  const { fieldErrors } = source as { fieldErrors: unknown };
  return typeof fieldErrors === 'object' && fieldErrors !== null
    ? (fieldErrors as Record<string, string>)
    : {};
}

/**
 * Put the fields a server refusal names on the form's own fields.
 *
 * The API's problem document lists rejected fields in `invalidParams`, and
 * nothing read them: a form showed one alert over the whole thing and left
 * the reader to guess which field it meant. This marks each named field that
 * exists in the form as invalid, so it gets the field's own styling and
 * message.
 *
 * The message is ours, not the server's: `invalidParams[].reason` is English,
 * written for API clients, and carries no code a locale could key on. So a
 * field is marked with the translated `validation.invalid`, never the raw
 * reason. A named field the form does not have is returned, for the caller to
 * leave in its top-level alert.
 */
export function useServerFieldErrors<TValues extends FieldValues>(
  form: Pick<UseFormReturn<TValues>, 'setError' | 'getValues'>,
  source: ServerFieldErrorSource,
): string[] {
  const { t } = useTranslation();
  const fieldErrors = fieldErrorsOf(source);
  const names = Object.keys(fieldErrors);
  const known = names.filter((name) => form.getValues(name as FieldPath<TValues>) !== undefined);
  const message = t('validation.invalid');
  // What the effect is keyed on: the names, not the object carrying them. A
  // resolved message is a new object on every render, and re-marking a field
  // each render would undo the reader's fix before they could make it.
  const key = known.join('\n');

  // Synchronises React Hook Form's error store with the last refusal: it runs
  // when a different set of fields is refused (a retry clears the failure
  // first, so the same refusal twice runs it twice), and an edit clears the
  // field as usual.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the refused names; the form and the translated line do not change while a failure is shown
  useEffect(() => {
    if (!key) return;
    for (const name of key.split('\n')) {
      form.setError(
        name as FieldPath<TValues>,
        { type: 'server', message },
        { shouldFocus: false },
      );
    }
  }, [key]);

  return names.filter((name) => !known.includes(name));
}
