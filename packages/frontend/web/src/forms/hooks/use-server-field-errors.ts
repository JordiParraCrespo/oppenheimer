import type { ResolvedErrorMessage } from '@oppenheimer/frontend-core/react';
import { useEffect } from 'react';
import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * A failure that may name fields: what `useErrorMessage()` resolves, or an
 * `AppError` itself — both carry `fieldErrors` keyed by the `invalidParams`
 * name. `null` or `undefined` while nothing has failed.
 */
export type ServerFieldErrorSource = Pick<ResolvedErrorMessage, 'fieldErrors'> | null | undefined;

export interface ServerFieldErrors {
  /** Names the refusal gave that are not fields of this form. */
  unplaced: string[];
  /**
   * Whether the caller's top-level alert still has something to say: the
   * failure named no field, or named one the form does not have. When every
   * named field is marked, the fields say it and the alert would repeat it.
   */
  showAlert: boolean;
}

/** Whether a dotted path (`address.city`) exists in the form's values, set or not. */
function hasPath(values: unknown, path: string): boolean {
  let current: unknown = values;
  for (const segment of path.split('.')) {
    if (typeof current !== 'object' || current === null || !(segment in current)) return false;
    current = (current as Record<string, unknown>)[segment];
  }
  return true;
}

/**
 * Put the fields a server refusal names on the form's own fields.
 *
 * Marks each field in the problem document's `invalidParams` that the form
 * holds (by path, so an `undefined` value still counts and `address.city` is
 * found) and tells the caller whether its alert is still needed.
 *
 * The message is ours: `invalidParams[].reason` is English for API clients and
 * carries no code a locale could key on, so a field gets the translated
 * `validation.invalid`, never the raw reason.
 */
export function useServerFieldErrors<TValues extends FieldValues>(
  form: Pick<UseFormReturn<TValues>, 'setError' | 'getValues'>,
  source: ServerFieldErrorSource,
): ServerFieldErrors {
  const { t } = useTranslation();
  const names = Object.keys(source?.fieldErrors ?? {});
  const values = form.getValues();
  const placed = names.filter((name) => hasPath(values, name));
  const message = t('validation.invalid');
  // What the effect is keyed on: the names, not the object carrying them. A
  // resolved message is a new object on every render, and re-marking a field
  // each render would undo the reader's fix before they could make it.
  const key = placed.join('\n');

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

  const unplaced = names.filter((name) => !placed.includes(name));
  return { unplaced, showAlert: Boolean(source) && (names.length === 0 || unplaced.length > 0) };
}
